import tape from 'tape'
import { estimatePeakMB, runFitsInMemory, largestSizeThatFits } from '../memory.ts'
import { GRIN2_MEMORY } from '#src/grin2/main.ts'
import { DE_MEMORY } from '#src/routes/termdb.DE.ts'
import { TOPVE_MEMORY } from '#src/routes/termdb.topVariablyExpressedGenes.ts'
import { DM_MEMORY } from '../../../routes/termdb.diffMeth.ts'
import { DMRCATE_MEMORY } from '#src/utils/methylationMatrix.ts'

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
	// one dmrcate run on an MMRF CpG shard: [rows, peak MB], the larger of time's footprint and max RSS and rust's own
	for (const [rows, peak] of [
		[220433, 109] /* chr21 scan 20 selected */,
		[220433, 101] /* chr21 region 20 selected */,
		[220433, 104] /* chr21 scan 100 selected */,
		[220433, 94] /* chr21 region 100 selected */,
		[220433, 107] /* chr21 scan 400 selected */,
		[220433, 94] /* chr21 region 400 selected */,
		[415660, 189] /* chr13 scan 20 selected */,
		[415660, 154] /* chr13 region 20 selected */,
		[415660, 184] /* chr13 scan 100 selected */,
		[415660, 154] /* chr13 region 100 selected */,
		[415660, 186] /* chr13 scan 400 selected */,
		[415660, 159] /* chr13 region 400 selected */,
		[769648, 317] /* chr12 scan 20 selected */,
		[769648, 258] /* chr12 region 20 selected */,
		[769648, 315] /* chr12 scan 100 selected */,
		[769648, 264] /* chr12 region 100 selected */,
		[769648, 322] /* chr12 scan 400 selected */,
		[769648, 255] /* chr12 region 400 selected */,
		[1304718, 507] /* chr1 scan 20 selected */,
		[1304718, 430] /* chr1 region 20 selected */,
		[1304718, 524] /* chr1 scan 100 selected */,
		[1304718, 425] /* chr1 region 100 selected */,
		[1304718, 533] /* chr1 scan 400 selected */,
		[1304718, 411] /* chr1 region 400 selected */
	])
		covers(test, `${rows} rows`, estimatePeakMB(DMRCATE_MEMORY, { rows }), peak)
	// a genome-wide scan through the server, two jobs at once: admitted as the two largest shards (chr2 + chr1)
	const twoJobs = { baseMB: 2 * DMRCATE_MEMORY.baseMB, perUnitMB: DMRCATE_MEMORY.perUnitMB }
	for (const peak of [791, 749, 739])
		covers(test, 'scan, 2 jobs at once', estimatePeakMB(twoJobs, { rows: 1377009 + 1304718 }), peak)
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
	test.equal(largestSizeThatFits(2048, GRIN2_MEMORY, 'lesions', 1), 641538, 'GRIN2 ceiling, all of 2 GB => 641,538')
	test.end()
})
