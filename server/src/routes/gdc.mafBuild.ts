import type { RoutePayload, RouteApi } from '#types'
import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import type { GdcMafBuildRequest } from '#types'
import { maxTotalSizeCompressed } from './gdc.maf.ts'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime, fileSize } from '#shared'
import serverconfig from '#src/serverconfig.js'
import { mapConcurrent } from '#src/utils/concurrencyLimiter.ts'
import { createGzip, createGunzip } from 'zlib'
import { Readable } from 'stream'
import { once } from 'events'

// per-file whole-download timeout (ms); matches the former rust reqwest per-request timeout so a single
// stalled GDC download can't hold a worker slot indefinitely
const downloadTimeoutMs = 60000

// flush accumulated selected rows to the gzip sink once a file's pending batch exceeds this, so the
// per-file working set stays bounded (~one decompressed chunk + one batch) instead of the whole
// decompressed file and its split/join copies; see streamSelectMafCols
const writeFlushBytes = 256 * 1024

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

export type FileError = { url: string; error: string }

export type MafMergeResult = {
	/** number of files successfully streamed, column-selected, and written */
	merged: number
	/** per-file failures (download/decompress/column errors); never aborts the batch */
	errors: FileError[]
	/** summed per-file stream time (download+decompress+parse interleaved); overlaps wall-clock under concurrency */
	totalStreamMs: number
	/** summed main-thread time in line parsing/column-selection — the only event-loop-blocking work */
	totalParseMs: number
}

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

	// Validate/normalize request + config inputs BEFORE any multipart response bytes are written (and
	// before the GDC size query / RSS timer), so a bad value produces a clean early error — handled by
	// init()'s catch as a JSON error response — instead of corrupting an already-started multipart stream
	// or failing deep inside mapConcurrent().
	const columns = q.columns
	if (!Array.isArray(columns) || columns.length === 0) throw 'columns must be a non-empty array'
	if (columns.some(c => typeof c != 'string' || c.length == 0)) throw 'every column must be a non-empty string'

	// serverconfig is operator-supplied JSON, so gdcMafConcurrency may be absent, a string, or otherwise
	// not a positive integer. Coerce + validate here (a set-but-invalid value falls back to the default,
	// with a log) rather than letting it propagate into mapConcurrent() and throw mid-response.
	const rawConcurrency = serverconfig.features.gdcMafConcurrency
	const concurrencyNum = Number(rawConcurrency)
	const concurrency = Number.isInteger(concurrencyNum) && concurrencyNum > 0 ? concurrencyNum : defaultConcurrency
	if (rawConcurrency != null && concurrency !== concurrencyNum) {
		mayLog(
			`gdcmaf: invalid serverconfig.features.gdcMafConcurrency=${JSON.stringify(
				rawConcurrency
			)}, falling back to ${defaultConcurrency}`
		)
	}

	// Sample process RSS through the build so the finalize log can report the peak working set (helps
	// catch memory spikes from large cohorts / many concurrent downloads). Caveat: rss is process-wide,
	// not request-local — if two /gdc/mafBuild builds overlap, one peak can include the other's memory;
	// the log prints file count + concurrency so overlapping builds stay visible when reading logs.
	const rss0 = process.memoryUsage().rss
	let peakRss = rss0
	const rssTimer = setInterval(() => {
		const rss = process.memoryUsage().rss
		if (rss > peakRss) peakRss = rss
	}, 250)
	rssTimer.unref() // the sampler must never keep the event loop / process alive on its own

	const { host, headers } = ds.getHostHeaders(q)
	const fileLst2: string[] = await getFileLstUnderSizeLimit(q.fileIdLst, host, headers)

	mayLog(
		`${fileLst2.length.toLocaleString()} out of ${q.fileIdLst.length.toLocaleString()} input MAF files accepted by size limit. Time elapsed: ${formatElapsedTime(
			Date.now() - t0
		)}`
	)

	const dataHost = joinUrl(host.rest, 'data') // must use the /data/ endpoint from current host

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

	// Timing instrumentation, summed across files. Each file is downloaded + decompressed + column-selected
	// as a single interleaved stream (see streamSelectMafCols), so totalStreamMs is the summed per-file
	// wall time (overlaps across concurrent files) and totalParseMs is the summed main-thread time in line
	// parsing — the only event-loop-blocking work. Reassigned from the mergeMafFiles() result below;
	// default to 0 so the finalize log is always valid.
	let merged = 0
	let totalStreamMs = 0
	let totalParseMs = 0 // main-thread: per-chunk utf8 + line split + column selection

	// Single gzip stream for the merged MAF, piped into the multipart body. { end: false } keeps res
	// open after gz finishes so the trailing "errors" part + closing boundary can still be written.
	const gz = createGzip()
	gz.pipe(res, { end: false }).on('error', (e: any) => {
		console.log('gz.pipe(res) error', e)
	})

	res.on('close', () => {
		if (res.writableEnded) return
		clearInterval(rssTimer)
		// client went away before we finished: stop downloads and tear down
		mayLog(
			`gdcmaf build: client disconnected, aborting downloads (${completed.toLocaleString()}/${fileLst2.length.toLocaleString()} files done)` +
				` | mem: peak ${fileSize(peakRss)} (Δ ${fileSize(peakRss - rss0)})` +
				` | Time elapsed: ${formatElapsedTime(Date.now() - t0)}`
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

		// the download fan-out + streaming decompress/column-select + per-file error collection lives in
		// mergeMafFiles() so it can be unit-tested with an injected fetcher (no GDC/network). Here the
		// fetcher streams a real GDC /data download via ky, and the write sink is the serialized gzip writer.
		const result = await mergeMafFiles({
			fileIdLst: fileLst2,
			columns,
			concurrency,
			signal: controller.signal,
			// Stream the gz bytes straight from GDC into the decompress+parse pipeline instead of buffering
			// the whole file — this is what caps the per-file memory to ~one chunk + one flush batch.
			// AbortSignal.any combines the client-disconnect controller with a per-file whole-download
			// timeout (covers response + body streaming), mirroring the former rust per-request timeout;
			// ky's own timeout is disabled so that single signal is the sole authority. Tradeoff vs the
			// former .arrayBuffer(): ky's retry no longer covers a mid-stream network drop — that now
			// surfaces as a per-file error (settled semantics), not a silent retry.
			fetchGzStream: async (fileId, signal) => {
				const r = await ky.get(joinUrl(dataHost, fileId), {
					headers,
					timeout: false,
					retry: { limit: 2 },
					signal: AbortSignal.any([signal, AbortSignal.timeout(downloadTimeoutMs)])
				})
				if (!r.body) throw 'no response body from GDC'
				return Readable.fromWeb(r.body as any)
			},
			write: writeGz,
			onFileSettled: () => completed++
		})
		// mergeMafFiles keys per-file errors by fileId (it's URL-agnostic by design, taking an injected
		// fetcher). Rebuild the full GDC /data/<uuid> download URL here so the client renders a clickable
		// link — parity with the former rust path, which returned the full URL. The client still extracts
		// the uuid as the final path segment, so matching keeps working.
		errors.push(...result.errors.map(e => ({ ...e, url: joinUrl(dataHost, e.url) })))
		merged = result.merged
		totalStreamMs = result.totalStreamMs
		totalParseMs = result.totalParseMs

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
		clearInterval(rssTimer)
		res.write(`\r\n--${boundary}`)
		res.write('\r\nContent-Disposition: form-data; name="errors"')
		res.write('\r\nContent-Type: application/x-jsonlines')
		const json = errors.map(e => JSON.stringify(e)).join('\n')
		res.write('\r\n\r\n' + json)
		res.write(`\r\n--${boundary}--\r\n`)
		const elapsed = Date.now() - t0
		const avgStreamMs = merged ? Math.round(totalStreamMs / merged) : 0
		// totalStreamMs sums concurrent per-file stream times, so dividing by wall-clock gives the implied
		// parallelism (how many were overlapping on average) rather than a misleading multi-minute sum
		const streamParallelism = elapsed ? (totalStreamMs / elapsed).toFixed(1) : '0'
		// final RSS sample, in case the last spike landed between 250ms ticks
		const rssEnd = process.memoryUsage().rss
		if (rssEnd > peakRss) peakRss = rssEnd
		mayLog(
			`gdcmaf build: ${merged.toLocaleString()} merged / ${errors.length.toLocaleString()} failed of ${fileLst2.length.toLocaleString()} files` +
				` (concurrency ${concurrency})` +
				` in ${formatElapsedTime(elapsed)}` +
				` | main-thread parse: ${formatElapsedTime(totalParseMs)}` +
				` | stream (download+decompress+parse): avg ${avgStreamMs}ms/file, ~${streamParallelism}× parallel` +
				` (UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE || '4 (default)'})` +
				` | mem: start ${fileSize(rss0)}, peak ${fileSize(peakRss)} (Δ ${fileSize(peakRss - rss0)}), end ${fileSize(
					rssEnd
				)}`
		)
		res.end()
	})
	gz.end()
}

/*
Core of the cohort-MAF build, factored out of buildMaf() so it can be unit-tested without GDC or a
network. For each file: open its gzipped byte stream (via the injected `fetchGzStream`) and run it
through streamSelectMafCols(), which decompresses + column-selects + writes the rows incrementally so
the per-file working set stays bounded (no whole-file buffering). Files run through mapConcurrent() so at
most `concurrency` are in flight at once. A per-file failure is recorded in `errors` and never aborts the
batch (settled semantics); an aborted `signal` stops scheduling new files and suppresses late errors.
`fetchGzStream(fileId, signal)` returns a Readable of one file's gzipped bytes; `write(rows)` consumes a
batch of selected rows (the caller serializes writes / handles backpressure); `onFileSettled` fires once
per finished file for live progress reporting.
*/
export async function mergeMafFiles(opts: {
	fileIdLst: string[]
	columns: string[]
	concurrency: number
	signal: AbortSignal
	fetchGzStream: (fileId: string, signal: AbortSignal) => Promise<Readable>
	write: (rows: string) => Promise<void>
	onFileSettled?: () => void
}): Promise<MafMergeResult> {
	const { fileIdLst, columns, concurrency, signal, fetchGzStream, write, onFileSettled } = opts
	const errors: FileError[] = []
	let merged = 0
	let totalStreamMs = 0
	let totalParseMs = 0

	await mapConcurrent(
		fileIdLst,
		concurrency,
		async (fileId: string) => {
			if (signal.aborted) return
			try {
				const t0 = Date.now()
				const gzStream = await fetchGzStream(fileId, signal)
				// throws on missing column / empty file / mid-stream download error
				const { parseMs } = await streamSelectMafCols({ gzStream, columns, write, signal })
				// only count a file as merged once all its rows are written, and accumulate the timings in
				// lockstep with `merged` — so a failure (recorded below as a per-file error) can't both
				// inflate `merged` and skew the total*/merged averages.
				totalStreamMs += Date.now() - t0
				totalParseMs += parseMs
				merged++
			} catch (e: any) {
				// record per-file failure; the rest of the cohort still merges (settled semantics)
				if (!signal.aborted) errors.push({ url: fileId, error: e?.message || String(e) })
			}
			onFileSettled?.()
		},
		{ signal }
	)

	return { merged, errors, totalStreamMs, totalParseMs }
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
Shared, stateful core of the rust select_maf_col port: feed it MAF lines one at a time and it finds the
header (the first non-comment line with an exact Hugo_Symbol column), resolves each requested column to
its index, and returns the selected tab-joined row for each data line (or null for comment/header/
pre-header lines). Throws if a requested column is absent from the header. Keeping this incremental lets
the same logic drive both selectMafCols() (whole-string, unit-tested) and streamSelectMafCols()
(line-by-line, low memory) with identical behavior.

Header detection is deliberately (a) an exact tab-split field match, not a substring — so a data value
containing "Hugo_Symbol" can't be mistaken for the header — and (b) only attempted while headerIndices
is still null, so a later matching line can't reset the indices and corrupt column selection mid-file.
*/
function createMafRowSelector(columns: string[]) {
	let headerIndices: number[] | null = null
	let dataRowCount = 0
	return {
		processLine(line: string): string | null {
			if (line.startsWith('#')) return null
			if (!headerIndices) {
				// still looking for the header row; identify it by an exact Hugo_Symbol column
				const fields = line.split('\t')
				if (!fields.includes('Hugo_Symbol')) return null // pre-header line (shouldn't happen); skip
				headerIndices = columns.map(col => {
					const idx = fields.indexOf(col)
					if (idx === -1) throw `Column ${col} was not found`
					return idx
				})
				if (headerIndices.length === 0) throw 'No matching columns found'
				return null
			}
			const cells = line.split('\t')
			dataRowCount++
			return headerIndices.map(i => cells[i] ?? '').join('\t')
		},
		get dataRowCount() {
			return dataRowCount
		}
	}
}

/*
Whole-string column selection: from one decompressed MAF file's text, keep only the requested columns
(in the requested order) for every data row, tab-joined. Throws if a requested column is absent or the
file has no data rows, so the caller records it as a per-file error. Returns the selected rows as a single
string, each row newline-terminated. The streaming path (streamSelectMafCols) is what production uses;
this stays for direct, deterministic unit testing of the column-selection logic.
*/
export function selectMafCols(text: string, columns: string[]): string {
	const selector = createMafRowSelector(columns)
	const out: string[] = []
	for (const line of text.replace(/\n+$/, '').split('\n')) {
		const row = selector.processLine(line)
		if (row !== null) out.push(row)
	}
	if (selector.dataRowCount === 0) throw 'Empty MAF file'
	return out.join('\n') + '\n'
}

/*
Streaming select+merge for one file: consume its gzipped byte stream, decompress incrementally
(createGunzip on the libuv threadpool), split into lines as decompressed chunks arrive (carrying any
partial trailing line across chunk boundaries), select the requested columns line-by-line, and flush
selected rows to `write` in ~writeFlushBytes batches. This caps the per-file working set to roughly one
decompressed chunk + one batch, instead of holding the whole decompressed file (and its split/join
copies) at once — the dominant driver of the build's peak RSS. Awaiting each flush propagates gzip
backpressure up through gunzip to the download, so a slow client throttles the download rather than
buffering. Throws on a missing column, an empty file (no data rows), or a stream/decompress error,
matching selectMafCols() so the caller records a per-file error. Returns the rows written and the
main-thread time spent parsing.
*/
export async function streamSelectMafCols(opts: {
	gzStream: Readable
	columns: string[]
	write: (rows: string) => Promise<void>
	signal: AbortSignal
}): Promise<{ rowCount: number; parseMs: number }> {
	const { gzStream, columns, write, signal } = opts
	const selector = createMafRowSelector(columns)
	const gunzip = createGunzip()
	let parseMs = 0
	let buf = '' // pending selected rows, flushed in batches
	let leftover = '' // partial trailing line carried across chunk boundaries
	try {
		// pipe doesn't forward source errors, so wire gzStream errors into gunzip; that makes the for-await
		// reject (e.g. on a mid-stream network drop) instead of hanging
		gzStream.on('error', err => gunzip.destroy(err))
		gzStream.pipe(gunzip)
		for await (const chunk of gunzip) {
			if (signal.aborted) break
			const t0 = Date.now()
			const text = leftover + chunk.toString('utf8')
			const lines = text.split('\n')
			leftover = lines.pop() ?? '' // last element is the (possibly empty) partial line
			for (const line of lines) {
				const row = selector.processLine(line)
				if (row !== null) buf += row + '\n'
			}
			parseMs += Date.now() - t0
			if (buf.length >= writeFlushBytes) {
				await write(buf)
				buf = ''
			}
		}
		// the final line has no trailing newline, so it sits in leftover; process it now
		if (leftover) {
			const t0 = Date.now()
			const row = selector.processLine(leftover)
			if (row !== null) buf += row + '\n'
			parseMs += Date.now() - t0
		}
		if (buf) await write(buf)
		if (selector.dataRowCount === 0) throw 'Empty MAF file'
		return { rowCount: selector.dataRowCount, parseMs }
	} finally {
		// tear down on any exit (success / abort / column or stream error) so a half-read download can't
		// leak a socket or threadpool slot
		gzStream.destroy()
		gunzip.destroy()
	}
}
