import tape from 'tape'
import { estimatePeakMB, runFitsInMemory, largestSizeThatFits } from '../memory.ts'
import { GRIN2_MEMORY } from '#src/grin2/main.ts'
import { DE_MEMORY } from '#src/routes/termdb.DE.ts'
import { TOPVE_MEMORY } from '#src/routes/termdb.topVariablyExpressedGenes.ts'
import { DM_MEMORY } from '../../../routes/termdb.diffMeth.ts'
import { DMRCATE_MEMORY, DMRCATE_REGION_MEMORY } from '#src/utils/methylationMatrix.ts'

/*
Every memory cost must be at or above the peak of each real run it was measured on, so that a cost changed later
cannot fall below the data without failing here. Peaks are MB: the Node server's rise plus the peak footprints of its
R, python and rust children, on ASH unless noted, measured 2026-10-19/20 with a fresh server and an empty cache per run.
The last section pins the @example outputs in memory.ts, so a changed cost fails here until those comments are updated.

test sections:
GRIN2
DE
topVE
DM
DM routes (dmrcate)
memory.ts @example outputs
*/

function covers(test, label: string, needed: number, measured: number) {
	test.ok(needed >= measured, `${label}: cost ${Math.round(needed)} MB >= measured ${measured} MB`)
}

tape('GRIN2', test => {
	// [lesions, peak]
	for (const [lesions, peak] of [
		[851, 336],
		[9784, 346],
		[11673, 337],
		[29403, 371],
		[50000, 460],
		[56133, 418],
		[100000, 631],
		[150000, 765],
		[200000, 878],
		[250000, 803],
		[250000, 795],
		[250000, 1006],
		[250000, 1000],
		[250000, 986]
	])
		covers(test, `${lesions} lesions`, estimatePeakMB(GRIN2_MEMORY, { lesions }), peak)
	test.end()
})

tape('DE', test => {
	const genes = 17928
	// [samples, peak] per engine
	const runs = {
		edgeR: [
			[102, 817],
			[138, 997],
			[385, 926],
			[1773, 4120],
			[4438, 5999]
		],
		limma: [
			[102, 863],
			[138, 1065],
			[385, 994],
			[1773, 4778],
			[4438, 9059]
		],
		wilcoxon: [
			[102, 244],
			[138, 298],
			[385, 155],
			[1773, 779],
			[4438, 2017]
		]
	}
	// spanCells at its least, the selected samples side by side, so the check cannot pass on a wide span
	for (const [method, lst] of Object.entries(runs))
		for (const [samples, peak] of lst)
			covers(
				test,
				`${method} ${samples} samples`,
				estimatePeakMB(DE_MEMORY[method], { cells: samples * genes, spanCells: samples * genes }),
				peak
			)
	test.end()
})

tape('topVE', test => {
	// [samples, peak], maxGenes 100 and 1,000
	for (const [samples, peak] of [
		[16, 78],
		[265, 96],
		[1508, 102],
		[2930, 125],
		[4873, 122]
	])
		covers(test, `${samples} samples`, estimatePeakMB(TOPVE_MEMORY, { samples }), peak)
	test.end()
})

tape('DM', test => {
	// [rows in the file, samples in the file, selected samples, peak]: DISCOVER promoter and allccre, MMRF promoter and allccre
	for (const [rows, fileSamples, selected, peak] of [
		[128994, 155, 20, 1190],
		[128994, 155, 80, 1044],
		[128994, 155, 150, 1390],
		[375525, 155, 20, 1057],
		[375525, 155, 80, 1620],
		[375525, 155, 150, 2292],
		[114875, 415, 20, 1299],
		[114875, 415, 200, 1769],
		[114875, 415, 400, 2476],
		[267531, 415, 20, 1714],
		[267531, 415, 200, 3997],
		[267531, 415, 400, 5057],
		[267531, 415, 20, 1274],
		[267531, 415, 200, 2927],
		[267531, 415, 400, 3860]
	])
		covers(
			test,
			`${rows} x ${fileSamples} file, ${selected} selected`,
			estimatePeakMB(DM_MEMORY, { fileCells: rows * fileSamples, cells: rows * selected }),
			peak
		)
	test.end()
})

tape('DM routes (dmrcate)', test => {
	/* one dmrcate run, one process over every chromosome named: [rows, columns, peak MB], max RSS. The model reads the
	values in 2,000-row chunks, so the selected samples do not count, but the columns of the file do. */
	for (const [rows, cols, peak] of [
		[896179, 151, 96] /* DISCOVER chr21+chr22 scan, 125 selected */,
		[1110433, 151, 129] /* DISCOVER chr17 scan, 125 selected */,
		[16374220, 415, 1216] /* MMRF genome scan, 200 of 415 selected */,
		[26591958, 151, 2075] /* DISCOVER genome scan, 125 selected, 214,978 DMRs */
	])
		covers(test, `${rows} rows`, estimatePeakMB(DMRCATE_MEMORY, { rows, cols }), peak)
	// the chunk buffer alone, 2,000 rows of f32 beta and u16 depth, at 10,000 columns
	test.ok(
		estimatePeakMB(DMRCATE_MEMORY, { rows: 0, cols: 10000 }) - DMRCATE_MEMORY.baseMB >= 114,
		'a wide matrix reserves its read buffer'
	)
	// a region view: one window of MMRF chr1 (1,304,718 rows x 415 columns, 200 selected), [label, peak MB]
	for (const [label, peak] of [
		['100 kb', 43],
		['5 Mb', 64],
		['densest 10 Mb, 76,344 CpGs', 90]
	] as [string, number][])
		covers(test, `region ${label}`, estimatePeakMB(DMRCATE_REGION_MEMORY, { rows: 1304718, cols: 415 }), peak)
	test.end()
})

tape('memory.ts @example outputs', test => {
	const allAsh = { cells: 4438 * 17928, spanCells: 4438 * 17928 }
	// 20 samples spread over 10,000 columns of a 60,660-gene file
	const wideSpan = { cells: 20 * 60660, spanCells: 10000 * 60660 }
	const mmrfAllccre = { fileCells: 267531 * 415, cells: 267531 * 400 }
	const r = (mb: number) => Math.round(mb)

	test.equal(estimatePeakMB(GRIN2_MEMORY, { lesions: 250_000 }), 1030, 'GRIN2 250,000 lesions => 1030 MB')
	test.equal(r(estimatePeakMB(DE_MEMORY.edgeR, allAsh)), 8938, 'edgeR on all ASH => ≈ 8938 MB')
	test.equal(r(estimatePeakMB(DE_MEMORY.wilcoxon, allAsh)), 2551, 'wilcoxon on all ASH => ≈ 2551 MB')
	test.equal(
		r(estimatePeakMB(DE_MEMORY.wilcoxon, wideSpan)),
		2594,
		'wilcoxon on 20 samples over 10,000 columns => ≈ 2594 MB'
	)
	test.equal(r(estimatePeakMB(TOPVE_MEMORY, { samples: 4873 })), 145, 'topVE on 4,873 samples => ≈ 145 MB')
	test.equal(r(estimatePeakMB(DM_MEMORY, mmrfAllccre)), 6134, 'DM MMRF allccre, 400 selected => ≈ 6134 MB')
	test.throws(
		() => estimatePeakMB(DM_MEMORY, { cells: mmrfAllccre.cells }),
		/needs the run's fileCells/,
		'DM without fileCells => throws'
	)

	test.equal(runFitsInMemory(DE_MEMORY.edgeR, allAsh, 12000), false, 'edgeR on all ASH at 12 GB => does not fit')
	test.equal(
		runFitsInMemory(DE_MEMORY.wilcoxon, allAsh, 12000),
		false,
		'wilcoxon on all ASH at 12 GB => fits the budget, not DE maxMB'
	)
	test.equal(
		runFitsInMemory(DE_MEMORY.limma, { cells: 500 * 17928 }, 100000),
		true,
		'limma on 500 ASH samples => within DE maxMB'
	)
	test.equal(
		runFitsInMemory(DE_MEMORY.wilcoxon, wideSpan, 1000),
		false,
		'wilcoxon on 20 samples over a wide span at 1 GB => does not fit'
	)
	test.equal(
		runFitsInMemory(DM_MEMORY, mmrfAllccre, 16000),
		false,
		'DM MMRF allccre at 16 GB => over the default maxMB'
	)
	test.equal(
		runFitsInMemory(DM_MEMORY, { fileCells: 114875 * 415, cells: 114875 * 200 }, 16000),
		true,
		'DM MMRF promoter, 200 selected, at 16 GB => fits'
	)
	test.equal(
		r(estimatePeakMB(DM_MEMORY, { fileCells: 114875 * 415, cells: 114875 * 200 })),
		2263,
		'DM MMRF promoter, 200 selected => ≈ 2263 MB'
	)
	test.equal(runFitsInMemory(TOPVE_MEMORY, { samples: 4873 }, 100), false, 'topVE at 100 MB => does not fit')

	test.equal(largestSizeThatFits(1500, GRIN2_MEMORY, 'lesions'), 430769, 'GRIN2 at 1,500 MB => 430,769 lesions')
	test.equal(largestSizeThatFits(300, GRIN2_MEMORY, 'lesions'), 0, 'GRIN2 at 300 MB => 0, refused')
	test.equal(
		largestSizeThatFits(2048, GRIN2_MEMORY, 'lesions', 1),
		641538,
		'all of 2 GB, under the default maxMB => 641,538 lesions'
	)
	test.end()
})
