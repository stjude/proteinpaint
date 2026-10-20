import tape from 'tape'
import { memoryNeededMB } from '../memory.ts'
import { GRIN2_MEMORY } from '#src/grin2/main.ts'
import { DE_MEMORY } from '#src/routes/termdb.DE.ts'
import { TOPVE_MEMORY } from '#src/routes/termdb.topVariablyExpressedGenes.ts'
import { DM_MEMORY } from '../../../routes/termdb.diffMeth.ts'

/*
Every memory cost must be at or above the peak of each real run it was measured on, so that a cost changed later
cannot fall below the data without failing here. Peaks are MB: the Node server's rise plus the peak footprints of its
R, python and rust children, on ASH unless noted, measured 2026-10-19/20 with a fresh server and an empty cache per run.

test sections:
GRIN2
DE
topVE
DM
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
		covers(test, `${lesions} lesions`, memoryNeededMB(GRIN2_MEMORY, { lesions }), peak)
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
	for (const [method, lst] of Object.entries(runs))
		for (const [samples, peak] of lst)
			covers(test, `${method} ${samples} samples`, memoryNeededMB(DE_MEMORY[method], { cells: samples * genes }), peak)
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
		covers(test, `${samples} samples`, memoryNeededMB(TOPVE_MEMORY, { samples }), peak)
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
			memoryNeededMB(DM_MEMORY, { fileCells: rows * fileSamples, cells: rows * selected }),
			peak
		)
	test.end()
})
