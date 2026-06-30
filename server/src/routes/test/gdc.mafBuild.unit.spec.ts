import tape from 'tape'
import { gzipSync } from 'zlib'
import { selectMafCols, mergeMafFiles } from '../gdc.mafBuild.ts'

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
	const out = selectMafCols(maf, HEADER)
	test.equal(
		out,
		'TP53\tchr17\t7577120\tMissense_Mutation\nKRAS\tchr12\t25398284\tNonsense_Mutation\n',
		'should pass through every data row with all columns intact'
	)
	test.end()
})

tape('throws when a requested column is not in the header', function (test) {
	test.throws(
		() => selectMafCols(maf, ['Hugo_Symbol', 'No_Such_Column']),
		/Column No_Such_Column was not found/,
		'should throw a descriptive error naming the missing column'
	)
	test.end()
})

tape('throws "Empty MAF file" when there are no data rows', function (test) {
	const headerOnly = ['#meta', HEADER.join('\t')].join('\n')
	test.throws(() => selectMafCols(headerOnly, ['Hugo_Symbol']), /Empty MAF file/, 'header but no data rows → throws')

	const commentsOnly = ['#a', '#b'].join('\n')
	test.throws(() => selectMafCols(commentsOnly, ['Hugo_Symbol']), /Empty MAF file/, 'no header/data at all → throws')
	test.end()
})

tape('pads a ragged (short) data row with empty fields', function (test) {
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
	const trailing = maf + '\n\n\n'
	const out = selectMafCols(trailing, ['Hugo_Symbol'])
	test.equal(out, 'TP53\nKRAS\n', 'trailing newlines should not produce extra empty rows')
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
// injected fetcher: returns canned bytes, or throws to simulate a failed download for id 'bad'
const fetchGz = async (fileId: string): Promise<Buffer> => {
	if (fileId === 'bad') throw new Error('simulated download failure')
	return gzByFile[fileId]
}

tape('\n', function (test) {
	test.comment('-***- #routes/gdc.mafBuild mergeMafFiles -***-')
	test.end()
})

tape('merges good files and isolates per-file failures', async function (test) {
	const written: string[] = []
	let settled = 0
	// concurrency 1 → deterministic write order matching fileIdLst, so we can assert exact output
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'bad', 'b', 'empty', 'missingcol'],
		columns: OUT_COLS,
		concurrency: 1,
		signal: new AbortController().signal,
		fetchGz,
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
	const written: string[] = []
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'b', 'c'],
		columns: OUT_COLS,
		concurrency: 3,
		signal: new AbortController().signal,
		fetchGz,
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
	const controller = new AbortController()
	controller.abort()
	const written: string[] = []
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'b', 'c'],
		columns: OUT_COLS,
		concurrency: 2,
		signal: controller.signal,
		fetchGz,
		write: async rows => {
			written.push(rows)
		}
	})
	test.equal(result.merged, 0, 'no files merged when aborted up front')
	test.equal(result.errors.length, 0, 'no errors recorded under abort (late errors suppressed)')
	test.equal(written.length, 0, 'nothing written')
	test.end()
})

tape('a write() failure is counted as an error, not a merge', async function (test) {
	// `merged` and the timing totals must only advance after write() succeeds, so a failed write can't
	// both inflate `merged` and skew the total*/merged averages. 'b' downloads + selects fine but its
	// write throws; it must be recorded as a per-file error and excluded from `merged`.
	const result = await mergeMafFiles({
		fileIdLst: ['a', 'b', 'c'],
		columns: OUT_COLS,
		concurrency: 1,
		signal: new AbortController().signal,
		fetchGz,
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
