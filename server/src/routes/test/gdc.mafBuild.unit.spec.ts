import tape from 'tape'
import { gzipSync } from 'zlib'
import { Readable } from 'stream'
import { selectMafCols, mergeMafFiles, streamSelectMafCols, getFileLstUnderSizeLimit } from '../gdc.mafBuild.ts'
import { maxTotalSizeCompressed } from '../gdc.maf.ts'

// a single-chunk binary Readable of the given gz bytes, standing in for one file's GDC download stream
function gzStreamFrom(buf: Buffer): Readable {
	return new Readable({
		read() {
			this.push(buf)
			this.push(null)
		}
	})
}

/*
selectMafCols() is the column-selection logic ported from the former rust gdcmaf binary. It takes one
decompressed MAF file's text and returns only the requested columns (in the requested order) for every
data row, tab-joined and newline-terminated. It does NOT emit the header row (buildMaf writes that once
for the merged file). These specs lock in the port's behavior so it can't silently drift from the rust
original.

test sections:
- selects requested columns and preserves the requested order (not the file's column order)
- skips leading #-comment lines and finds the header by its Hugo_Symbol column
- throws "Column X was not found" when a requested column is absent from the header
- throws "Empty MAF file" when there are no data rows (header only, or comments only)
- pads a short/ragged data row with empty fields rather than emitting undefined
- trims trailing blank lines so no empty data row leaks into the output
*/

// a small but realistic MAF fixture: two comment lines, a header, two data rows
const HEADER = ['Hugo_Symbol', 'Chromosome', 'Start_Position', 'Variant_Classification']
const maf = [
	'#version 2.4',
	'#filedate 20240101',
	HEADER.join('\t'),
	['TP53', 'chr17', '7577120', 'Missense_Mutation'].join('\t'),
	['KRAS', 'chr12', '25398284', 'Nonsense_Mutation'].join('\t')
].join('\n')

tape('\n', function (test) {
	test.comment('-***- #routes/gdc.mafBuild selectMafCols -***-')
	test.end()
})

tape('selects requested columns in the requested order', function (test) {
	test.timeoutAfter(1000) // fail fast instead of hanging CI

	// request a subset, reordered relative to the file's column order
	const out = selectMafCols(maf, ['Variant_Classification', 'Hugo_Symbol'])
	test.equal(
		out,
		'Missense_Mutation\tTP53\nNonsense_Mutation\tKRAS\n',
		'should emit only the requested columns, in request order, one data row per line, newline-terminated'
	)
	test.end()
})

tape('selects all columns when all are requested', function (test) {
	test.timeoutAfter(1000) // fail fast instead of hanging CI

	const out = selectMafCols(maf, HEADER)
	test.equal(
		out,
		'TP53\tchr17\t7577120\tMissense_Mutation\nKRAS\tchr12\t25398284\tNonsense_Mutation\n', // pragma: allowlist secret
		'should pass through every data row with all columns intact'
	)
	test.end()
})

tape('throws when a requested column is not in the header', function (test) {
	test.timeoutAfter(1000) // fail fast instead of hanging CI

	test.throws(
		() => selectMafCols(maf, ['Hugo_Symbol', 'No_Such_Column']),
		/Column No_Such_Column was not found/,
		'should throw a descriptive error naming the missing column'
	)
	test.end()
})

tape('throws "Empty MAF file" when there are no data rows', function (test) {
	test.timeoutAfter(1000) // fail fast instead of hanging CI

	const headerOnly = ['#meta', HEADER.join('\t')].join('\n')
	test.throws(() => selectMafCols(headerOnly, ['Hugo_Symbol']), /Empty MAF file/, 'header but no data rows → throws')

	const commentsOnly = ['#a', '#b'].join('\n')
	test.throws(() => selectMafCols(commentsOnly, ['Hugo_Symbol']), /Empty MAF file/, 'no header/data at all → throws')
	test.end()
})

tape('pads a ragged (short) data row with empty fields', function (test) {
	test.timeoutAfter(1000) // fail fast instead of hanging CI

	// second data row is missing its trailing Variant_Classification cell
	const ragged = [
		HEADER.join('\t'),
		['TP53', 'chr17', '7577120', 'Missense_Mutation'].join('\t'),
		['EGFR', 'chr7', '55249071'].join('\t') // only 3 of 4 cells
	].join('\n')
	const out = selectMafCols(ragged, ['Hugo_Symbol', 'Variant_Classification'])
	test.equal(
		out,
		'TP53\tMissense_Mutation\nEGFR\t\n',
		'missing trailing cell should render as an empty field, not the string "undefined"'
	)
	test.end()
})

tape('trims trailing blank lines so no empty data row leaks through', function (test) {
	test.timeoutAfter(1000) // fail fast instead of hanging CI

	const trailing = maf + '\n\n\n'
	const out = selectMafCols(trailing, ['Hugo_Symbol'])
	test.equal(out, 'TP53\nKRAS\n', 'trailing newlines should not produce extra empty rows')
	test.end()
})

tape('does not treat a data field containing "Hugo_Symbol" as a second header', function (test) {
	test.timeoutAfter(1000) // fail fast instead of hanging CI

	// only the first exact-Hugo_Symbol line is the header; a later data row whose field merely CONTAINS
	// the substring must be selected as data, not re-parsed as a header (which would reset column indices
	// or throw "Column ... was not found")
	const withSubstring = [
		HEADER.join('\t'),
		['TP53', 'chr17', '7577120', 'Missense_Mutation'].join('\t'),
		['BRCA1', 'chr17', '41197694', 'note_Hugo_Symbol_x'].join('\t')
	].join('\n')
	const out = selectMafCols(withSubstring, ['Hugo_Symbol', 'Variant_Classification'])
	test.equal(
		out,
		'TP53\tMissense_Mutation\nBRCA1\tnote_Hugo_Symbol_x\n',
		'a data row with a "Hugo_Symbol" substring is selected as data, not misread as a header'
	)
	test.end()
})

/*
mergeMafFiles() is the download+decompress+select+merge pipeline, with the GDC fetch injected so we can
drive the whole thing deterministically in-process (no network/server). These cover the behaviors that
matter beyond a single file's column selection: concurrent merge, per-file error isolation, and abort.

test sections:
- merges good files and isolates per-file failures (download error / empty file / missing column) without aborting the batch
- runs with concurrency > 1 and still merges every good file exactly once
- an already-aborted signal processes nothing
- a signal aborted mid-build (the 5-min timeout backstop) stops in-flight work without recording abort-noise errors
*/

// build a gzipped MAF "download" for one file; the injected fetcher returns these
function makeGzMaf(header: string[], dataRows: string[][]): Buffer {
	const text = ['#comment line', header.join('\t'), ...dataRows.map(r => r.join('\t'))].join('\n')
	return gzipSync(Buffer.from(text))
}
const OUT_COLS = ['Hugo_Symbol', 'Variant_Classification']
const gzByFile: Record<string, Buffer> = {
	a: makeGzMaf(HEADER, [['TP53', 'chr17', '7577120', 'Missense_Mutation']]),
	b: makeGzMaf(HEADER, [
		['KRAS', 'chr12', '25398284', 'Nonsense_Mutation'],
		['EGFR', 'chr7', '55249071', 'Silent']
	]),
	c: makeGzMaf(HEADER, [['BRAF', 'chr7', '140453136', 'Missense_Mutation']]),
	empty: makeGzMaf(HEADER, []), // header only → selectMafCols throws "Empty MAF file"
	missingcol: makeGzMaf(['Hugo_Symbol', 'Chromosome'], [['PTEN', 'chr10']]) // lacks a requested column
}
// injected fetcher: returns a gz byte stream for the file, or throws to simulate a failed download ('bad')
const fetchGzStream = async (fileId: string): Promise<Readable> => {
	if (fileId === 'bad') throw new Error('simulated download failure')
	return gzStreamFrom(gzByFile[fileId])
}

tape('\n', function (test) {
	test.comment('-***- #routes/gdc.mafBuild mergeMafFiles -***-')
	test.end()
})

tape('merges good files and isolates per-file failures', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	const written: string[] = []
	let settled = 0
	// concurrency 1 → deterministic write order matching fileIdLst, so we can assert exact output
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'bad', 'b', 'empty', 'missingcol'],
		columns: OUT_COLS,
		concurrency: 1,
		signal: new AbortController().signal,
		fetchGzStream,
		write: async rows => {
			written.push(rows)
		},
		onFileSettled: () => settled++
	})

	test.equal(result.merged, 2, 'two good files (a, b) merged')
	test.equal(settled, 5, 'onFileSettled fired once per input file (merged + errored)')
	test.equal(
		written.join(''),
		'TP53\tMissense_Mutation\nKRAS\tNonsense_Mutation\nEGFR\tSilent\n',
		'only good files contribute rows, in input order, with the selected columns'
	)

	const byUrl = Object.fromEntries(result.errors.map(e => [e.url, e.error]))
	test.equal(result.errors.length, 3, 'three files failed')
	test.match(byUrl.bad, /simulated download failure/, 'download failure recorded for "bad"')
	test.match(byUrl.empty, /Empty MAF file/, 'empty-file error recorded for "empty"')
	test.match(byUrl.missingcol, /Column Variant_Classification was not found/, 'missing-column error recorded')
	test.end()
})

tape('merges every good file exactly once with concurrency > 1', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	const written: string[] = []
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'b', 'c'],
		columns: OUT_COLS,
		concurrency: 3,
		signal: new AbortController().signal,
		fetchGzStream,
		write: async rows => {
			written.push(rows)
		}
	})
	test.equal(result.merged, 3, 'all three good files merged')
	test.equal(result.errors.length, 0, 'no errors')
	// write order is non-deterministic under concurrency, so assert membership rather than order
	const all = written.join('')
	for (const sym of ['TP53', 'KRAS', 'EGFR', 'BRAF']) {
		test.ok(all.includes(sym), `merged output contains rows from each file (${sym})`)
	}
	test.end()
})

tape('an already-aborted signal processes nothing', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	const controller = new AbortController()
	controller.abort()
	const written: string[] = []
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'b', 'c'],
		columns: OUT_COLS,
		concurrency: 2,
		signal: controller.signal,
		fetchGzStream,
		write: async rows => {
			written.push(rows)
		}
	})
	test.equal(result.merged, 0, 'no files merged when aborted up front')
	test.equal(result.errors.length, 0, 'no errors recorded under abort (late errors suppressed)')
	test.equal(written.length, 0, 'nothing written')
	test.end()
})

tape('a signal aborted mid-build stops in-flight work without recording abort-noise errors', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// Models the 5-min timeout backstop firing while a build is running (app.middlewares.js aborts
	// q.__abortSignal, which buildMaf folds into the signal passed here). The abort lands mid-flight:
	// the file that already finished must still count as merged, but the in-flight and not-yet-started
	// files must record NO per-file errors — so the response's "errors" part carries only buildMaf's
	// single "expired process" message, not a flood of abort noise. Distinct from the already-aborted
	// case above, which bails before any work starts.
	const controller = new AbortController()
	const written: string[] = []
	const fetchGzStream = async (fileId: string, signal: AbortSignal): Promise<Readable> => {
		if (fileId === 'a') return gzStreamFrom(gzByFile.a)
		// 'slow*' are still fetching when the abort lands: reject only on abort, mirroring how the real
		// ky download (via AbortSignal.any) rejects when the timeout fires. Their rejection must be
		// suppressed because signal.aborted is true.
		return new Promise<Readable>((_, reject) => {
			signal.addEventListener('abort', () => reject(new Error('The operation was aborted')), { once: true })
		})
	}
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'slow1', 'slow2'],
		columns: OUT_COLS,
		concurrency: 2, // 'a' and 'slow1' start together; 'slow2' waits for a free slot
		signal: controller.signal,
		fetchGzStream,
		// abort right after the first file settles, so 'slow1' is in-flight and 'slow2' never starts
		onFileSettled: () => {
			if (!controller.signal.aborted) controller.abort()
		},
		write: async rows => {
			written.push(rows)
		}
	})

	test.equal(result.merged, 1, "only the file that completed before the timeout merged ('a')")
	test.equal(result.errors.length, 0, 'in-flight and not-yet-started files under abort record no per-file errors')
	test.ok(written.join('').includes('TP53'), "the completed file's rows were written before the abort")
	test.end()
})

tape('a write() failure is counted as an error, not a merge', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// `merged` and the timing totals must only advance after write() succeeds, so a failed write can't
	// both inflate `merged` and skew the total*/merged averages. 'b' downloads + selects fine but its
	// write throws; it must be recorded as a per-file error and excluded from `merged`.
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'b', 'c'],
		columns: OUT_COLS,
		concurrency: 1,
		signal: new AbortController().signal,
		fetchGzStream,
		write: async rows => {
			if (rows.includes('KRAS')) throw new Error('simulated write failure')
		}
	})
	test.equal(result.merged, 2, 'only the two files whose write succeeded count as merged')
	const byUrl = Object.fromEntries(result.errors.map(e => [e.url, e.error]))
	test.equal(result.errors.length, 1, 'the failed-write file is recorded as a single error')
	test.match(byUrl.b, /simulated write failure/, 'write failure recorded against the right file')
	test.end()
})

tape('\n', function (test) {
	test.comment('-***- #routes/gdc.mafBuild streamSelectMafCols -***-')
	test.end()
})

tape('an abort mid-stream throws instead of finishing the file (no partial write, not merged)', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// Reproduces the abort-mid-stream bug: streamSelectMafCols used to `break` on signal.aborted and then
	// flush the leftover/buffered rows and return success — writing partial output past the abort and
	// letting mergeMafFiles count the abandoned file as merged. The file below is large enough that the
	// selected output exceeds writeFlushBytes, so an in-loop write() fires while the stream is still
	// running; aborting from inside that first write() models the timeout landing mid-stream. The
	// function must reject (so mergeMafFiles drops it) and perform no further write() after the abort.
	const rows = Array.from({ length: 20000 }, (_, i) => ['G' + i, 'chr1', String(i), 'Missense_Mutation'])
	const gz = makeGzMaf(HEADER, rows)
	const controller = new AbortController()
	let writeCalls = 0
	let wroteAfterAbort = false
	let threw = false
	try {
		await streamSelectMafCols({
			gzStream: gzStreamFrom(gz),
			columns: OUT_COLS,
			signal: controller.signal,
			write: async () => {
				if (controller.signal.aborted) wroteAfterAbort = true
				writeCalls++
				controller.abort() // abort during the first batch flush → the next loop iteration must bail
			}
		})
	} catch (e: any) {
		threw = true
		test.match(String(e?.message || e), /abort/i, 'rejects with an abort error, not a success return')
	}
	test.ok(threw, 'aborting mid-stream rejects rather than returning success')
	test.ok(writeCalls >= 1, 'at least one batch was flushed before the abort (the file was genuinely mid-stream)')
	test.notOk(wroteAfterAbort, 'no leftover/final flush runs after the signal is aborted')
	test.end()
})

tape('\n', function (test) {
	test.comment('-***- #routes/gdc.mafBuild getFileLstUnderSizeLimit -***-')
	test.end()
})

tape('the elapsed-time watchdog can abort a stalled GDC size query', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// The pre-stream metadata query must be covered by the same watchdog as the download phase — a stalled
	// GDC /files request should be cancellable, not hang buildMaf() indefinitely before streaming starts.
	// The injected query stands in for that stalled request: it never resolves on its own, only rejecting
	// when the forwarded signal aborts. Asserts (a) the build signal reaches the metadata request, and
	// (b) aborting it (as the middleware timer does) rejects the query instead of hanging.
	const controller = new AbortController()
	let forwardedSignal: AbortSignal | undefined
	const stalledQuery = (_host: any, _headers: any, _body: any, signal: AbortSignal): Promise<any[]> => {
		forwardedSignal = signal
		return new Promise((_resolve, reject) => {
			signal.addEventListener('abort', () => reject(new Error('The operation was aborted')), { once: true })
		})
	}

	const pending = getFileLstUnderSizeLimit(
		['f1', 'f2'],
		{ rest: 'https://gdc.example/' },
		{},
		controller.signal,
		stalledQuery
	)
	controller.abort() // the middleware watchdog fires while the query is still in flight

	let threw = false
	try {
		await pending
	} catch (e: any) {
		threw = true
		test.match(String(e?.message || e), /abort/i, 'a stalled size query rejects once the signal aborts')
	}
	test.ok(threw, 'aborting the signal cancels the pending metadata query rather than hanging')
	test.equal(forwardedSignal, controller.signal, 'the build signal is forwarded to the GDC metadata request')
	test.end()
})

tape('getFileLstUnderSizeLimit caps the returned files at the total-size limit', async function (test) {
	test.timeoutAfter(5000) // fail fast instead of hanging CI

	// Accumulates file_size in input order and stops once the running total reaches the cap, so the total
	// downloaded stays bounded regardless of how many files the client selected. Use a per-file size just
	// over half the cap: the first two fit (second pushes the running total to/over the cap), the third is
	// dropped. Injected query → no GDC/network.
	const half = Math.ceil(maxTotalSizeCompressed / 2) + 1
	const hits = [
		{ id: 'a', file_size: half },
		{ id: 'b', file_size: half },
		{ id: 'c', file_size: half }
	]
	const query = async () => hits
	const out = await getFileLstUnderSizeLimit(['a', 'b', 'c'], {}, {}, new AbortController().signal, query)
	test.deepEqual(out, ['a', 'b'], 'stops accepting files once the cumulative compressed size reaches the cap')
	test.end()
})
