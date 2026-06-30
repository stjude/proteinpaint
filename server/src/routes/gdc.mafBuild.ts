import type { RoutePayload, RouteApi } from '#types'
import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import type { GdcMafBuildRequest } from '#types'
import { maxTotalSizeCompressed } from './gdc.maf.ts'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import serverconfig from '#src/serverconfig.js'
import { mapConcurrent } from '#src/utils/concurrencyLimiter.ts'
import { createGzip, gunzip } from 'zlib'
import { once } from 'events'
import { promisify } from 'util'

// async (libuv threadpool) gunzip so decompressing each downloaded MAF doesn't block the event loop
const gunzipAsync = promisify(gunzip)

// per-file download timeout (ms); matches the former rust reqwest per-request timeout so a single
// stalled GDC download can't hold a worker slot indefinitely
const downloadTimeoutMs = 60000

export const GdcMafPayload: RoutePayload = {
	init,
	request: { typeId: 'GdcMafBuildRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcMafBuildResponse' }
}

export const api: RouteApi = {
	endpoint: 'gdc/mafBuild',
	methods: {
		get: GdcMafPayload,
		post: GdcMafPayload
	}
}

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'
			const q: GdcMafBuildRequest = req.query
			await buildMaf(q, res, ds)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

// Number of files downloaded concurrently. Driven by serverconfig.features.gdcMafConcurrency so it
// can be dialed down per environment (e.g. qa-int, which appears to cap simultaneous connections)
// without a rebuild; falls back to 20 when absent (parity with the previous rust buffer_unordered(20)).
const defaultConcurrency = 20

type FileError = { url: string; error: string }

/*
q{}
res{}
ds{}

Downloads each requested MAF file from GDC, selects the requested columns, and concatenates the rows
into a single gzip-compressed cohort MAF that is streamed back as the "gzfile" part of a
multipart/form-data response. Per-file failures are collected and returned as the "errors" part
(jsonlines) so one bad file can't abort the whole download. Downloads run through mapConcurrent() so
at most `concurrency` files are in flight at once.

This replaces the former rust `gdcmaf` binary, which coupled download + column-select + gzip-merge
with a hardcoded concurrency; moving the download into node lets it reuse the shared, tested
concurrencyLimiter and a config-driven, per-environment concurrency cap.
*/
async function buildMaf(q: GdcMafBuildRequest, res, ds) {
	const t0 = Date.now()
	const { host, headers } = ds.getHostHeaders(q)
	const fileLst2: string[] = await getFileLstUnderSizeLimit(q.fileIdLst, host, headers)

	mayLog(
		`${fileLst2.length.toLocaleString()} out of ${q.fileIdLst.length.toLocaleString()} input MAF files accepted by size limit. Time elapsed: ${formatElapsedTime(
			Date.now() - t0
		)}`
	)

	const concurrency = serverconfig.features.gdcMafConcurrency || defaultConcurrency
	const dataHost = joinUrl(host.rest, 'data') // must use the /data/ endpoint from current host
	const columns = q.columns

	// Abort active downloads if the client disconnects (e.g. browser tab refreshed mid-download), so
	// orphaned GDC requests don't keep running after no one is listening.
	const controller = new AbortController()

	const boundary = '------------------------GDC-MAF-BUILD'
	res.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`)
	res.write(`--${boundary}`)
	res.write('\r\nContent-Disposition: form-data; name="gzfile"; filename="cohort.maf.gz"')
	res.write('\r\nContent-Type: application/gzip\r\n\r\n')
	res.flush() // header text should be sent as a separate chunk from the content that will be streamed next

	const errors: FileError[] = []
	let completed = 0 // files that finished (merged or errored); lets the disconnect log report how many were still pending

	// Timing instrumentation, summed across files, to see where the wall-clock goes. download/decompress
	// run concurrently so their sums overlap wall-clock; parse has no awaits so it can't overlap itself —
	// totalParseMs is therefore the real main-thread time spent parsing (i.e. event-loop blocking).
	let merged = 0
	let totalDownloadMs = 0
	let totalDecompressMs = 0 // async gunzip on the libuv threadpool (parallel up to UV_THREADPOOL_SIZE)
	let totalParseMs = 0 // main-thread: buffer->utf8 + selectMafCols column selection

	// Single gzip stream for the merged MAF, piped into the multipart body. { end: false } keeps res
	// open after gz finishes so the trailing "errors" part + closing boundary can still be written.
	const gz = createGzip()
	gz.pipe(res, { end: false }).on('error', (e: any) => {
		console.log('gz.pipe(res) error', e)
	})

	res.on('close', () => {
		if (res.writableEnded) return
		// client went away before we finished: stop downloads and tear down
		mayLog(
			`gdcmaf build: client disconnected, aborting downloads (${completed.toLocaleString()}/${fileLst2.length.toLocaleString()} files done). Time elapsed: ${formatElapsedTime(
				Date.now() - t0
			)}`
		)
		controller.abort()
		try {
			gz.destroy()
		} catch (e) {
			console.log('error destroying gz on close', e)
		}
		try {
			res.end()
		} catch (e) {
			console.log('error with forced res.end()', e)
		}
	})

	// Serialize writes to the gzip stream behind a promise chain so concurrent download workers can't
	// interleave their row chunks mid-line, and so each write honors backpressure (await 'drain' when
	// gz.write() returns false). once() is given the abort signal so a write parked on 'drain' doesn't
	// hang forever if the client disconnects.
	let writeChain: Promise<void> = Promise.resolve()
	function writeGz(str: string): Promise<void> {
		writeChain = writeChain.then(async () => {
			if (!gz.write(str)) await once(gz, 'drain', { signal: controller.signal })
		})
		return writeChain
	}

	try {
		// header row first (matches the former rust output: header line then all selected data rows)
		await writeGz(columns.join('\t') + '\n')

		await mapConcurrent(
			fileLst2,
			concurrency,
			async (fileId: string) => {
				if (controller.signal.aborted) return
				const url = joinUrl(dataHost, fileId)
				try {
					const dl0 = Date.now()
					const buf = Buffer.from(
						await ky
							.get(url, { headers, timeout: downloadTimeoutMs, retry: { limit: 2 }, signal: controller.signal })
							.arrayBuffer()
					)
					const dl1 = Date.now()
					const decompressed = await gunzipAsync(buf)
					const dec1 = Date.now()
					const rows = selectMafCols(decompressed.toString('utf8'), columns) // throws on missing column / empty file
					const ps1 = Date.now()
					totalDownloadMs += dl1 - dl0
					totalDecompressMs += dec1 - dl1
					totalParseMs += ps1 - dec1
					merged++
					await writeGz(rows)
				} catch (e: any) {
					// record per-file failure; the rest of the cohort still merges (settled semantics)
					if (!controller.signal.aborted) errors.push({ url: fileId, error: e?.message || String(e) })
				}
				completed++
			},
			{ signal: controller.signal }
		)

		// flush any pending serialized writes before closing the gzip stream
		await writeChain.catch(() => {})
	} catch (e) {
		console.log('error building cohort MAF', e)
		if (!errors.some(d => !d.url)) errors.push({ url: '', error: (e as any)?.message || String(e) } as FileError)
	}

	if (res.writableEnded) return

	// finalize: end the gzip stream, then once its data has fully flushed into res, append the
	// "errors" part and the closing multipart boundary, then end the response.
	gz.on('end', () => {
		if (res.writableEnded) return
		res.write(`\r\n--${boundary}`)
		res.write('\r\nContent-Disposition: form-data; name="errors"')
		res.write('\r\nContent-Type: application/x-jsonlines')
		const json = errors.map(e => JSON.stringify(e)).join('\n')
		res.write('\r\n\r\n' + json)
		res.write(`\r\n--${boundary}--\r\n`)
		const elapsed = Date.now() - t0
		const avgDownloadMs = merged ? Math.round(totalDownloadMs / merged) : 0
		const avgDecompressMs = merged ? Math.round(totalDecompressMs / merged) : 0
		// totalDownloadMs sums concurrent downloads, so dividing by wall-clock gives the implied
		// parallelism (how many were overlapping on average) rather than a misleading multi-minute sum
		const downloadParallelism = elapsed ? (totalDownloadMs / elapsed).toFixed(1) : '0'
		mayLog(
			`gdcmaf build: ${merged.toLocaleString()} merged / ${errors.length.toLocaleString()} failed of ${fileLst2.length.toLocaleString()} files` +
				` in ${formatElapsedTime(elapsed)}` +
				` | main-thread parse: ${formatElapsedTime(totalParseMs)}` +
				` | decompress: avg ${avgDecompressMs}ms/file (UV_THREADPOOL_SIZE=${
					process.env.UV_THREADPOOL_SIZE || '4 (default)'
				})` +
				` | download: avg ${avgDownloadMs}ms/file, ~${downloadParallelism}× parallel`
		)
		res.end()
	})
	gz.end()
}

/*
query api get size of each input maf file, and only process those files with total size under a set limit,
excess files are not processed in order not to crash server
must not rely on file size sent by client, as that can be spoofed and never to be trusted
it's inexpensive to query api for this
*/
async function getFileLstUnderSizeLimit(lst: string[], host, headers) {
	if (lst.length == 0) throw 'fileIdLst[] not array or blank'
	const body = {
		filters: {
			op: 'in',
			content: { field: 'file_id', value: lst }
		},
		size: 10000,
		fields: 'file_size'
	}

	const response = await ky.post(joinUrl(host.rest, 'files'), { headers, timeout: false, json: body })
	if (!response.ok) throw `HTTP Error: ${response.status} ${response.statusText}`
	const re: any = await response.json() // type any to avoid tsc err

	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'
	const out: string[] = []
	let cumsize = 0
	for (const h of re.data.hits) {
		if (cumsize >= maxTotalSizeCompressed) break // maxed out
		if (!h.id) throw '.id missing'
		if (!Number.isInteger(h.file_size)) throw '.file_size not integer'
		cumsize += h.file_size
		out.push(h.id)
	}
	if (out.length == 0) throw 'no file available'
	return out
}

/*
Port of the former rust select_maf_col: from one decompressed MAF file's text, keep only the requested
columns (in the requested order) for every data row, tab-joined. Skips `#` comment lines, finds the
header line by its Hugo_Symbol column, and resolves each requested column to its index. Throws if a
requested column is absent or the file has no data rows, so the caller records it as a per-file error.
Returns the selected rows as a single string, each row newline-terminated.
*/
function selectMafCols(text: string, columns: string[]): string {
	const lines = text.replace(/\n+$/, '').split('\n')
	let headerIndices: number[] | null = null
	const out: string[] = []
	for (const line of lines) {
		if (line.startsWith('#')) continue
		if (line.includes('Hugo_Symbol')) {
			const header = line.split('\t')
			headerIndices = []
			for (const col of columns) {
				const idx = header.indexOf(col)
				if (idx === -1) throw `Column ${col} was not found`
				headerIndices.push(idx)
			}
			if (headerIndices.length === 0) throw 'No matching columns found'
		} else {
			if (!headerIndices) continue // data before header (shouldn't happen); nothing to select yet
			const cells = line.split('\t')
			out.push(headerIndices.map(i => cells[i] ?? '').join('\t'))
		}
	}
	if (out.length === 0) throw 'Empty MAF file'
	return out.join('\n') + '\n'
}
