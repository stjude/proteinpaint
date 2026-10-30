import tape from 'tape'
import { DmrViewModel } from '../viewModel/DmrViewModel'
import { getDefaultDMRSettings } from '../settings/defaults'

/*
Tests:
	A DMR under the scan's Min Δβ is drawn gray and labeled, and a note says why, with the read depths
	A masked DMR is labeled with its mask, with its own note
	No depth sentence when the groups' depths are close
*/

const dmr = (start: number, delta_beta_mean: number, direction = 'hyper') =>
	({ chr: 'chr1', start, stop: start + 1000, no_cpgs: 20, min_smoothed_fdr: 1e-20, delta_beta_mean, direction } as any)

function vm(readDepth?: { control: number; case: number }, masked: any[] = []) {
	const config: any = {
		group1Name: 'NM Background',
		group2Name: 'ATRT SHH',
		readDepth,
		settings: { dmr: getDefaultDMRSettings({ settings: { minDeltaBeta: 0.1 } }) }
	}
	return new DmrViewModel(
		{ status: 'ok', dmrs: [dmr(1000, 0.3), dmr(5000, 0.006)], maskedDmrs: masked } as any,
		config,
		{ tracks: [] },
		'chr1',
		0,
		10000
	).viewData
}

tape('\n', test => {
	test.comment('-***- plots/dmr/DmrViewModel -***-')
	test.end()
})

tape('A DMR under the Min Δβ is gray, labeled, and explained with the read depths', test => {
	const v = vm({ control: 1.59, case: 3.84 })
	const [counted, below] = v.dmrBedItems
	test.equal(counted.name, 'Δβ +0.300, 20 CpGs', 'a counted DMR is labeled with its change and CpGs')
	test.equal(below.name, 'Δβ +0.006, under 0.1: not counted', 'the gray one says what it is')
	test.ok(v.notes[0].startsWith('Light gray: a DMR that DMRcate called'), 'the note names it')
	test.ok(v.notes[0].includes('ATRT SHH has 2.4× the reads per CpG of NM Background (3.84 vs 1.59)'), 'and the depths')
	const legend = v.legendRows.find(r => r.label == 'DMR')!.items.map(i => i.text)
	test.ok(legend.includes('Methylation change below 0.1: not counted (see note)'), 'the legend points to the note')
	test.end()
})

tape('A masked DMR is labeled with its mask and gets its own note', test => {
	const v = vm(undefined, [{ ...dmr(8000, 0.4), maskedBy: ['Segmental duplications'] }])
	test.equal(v.dmrBedItems[2].name, 'masked: segmental duplications')
	test.ok(
		v.notes.some(n => n.startsWith('Dark gray: a DMR in segmental duplications')),
		'the masked note'
	)
	test.end()
})

tape('No depth sentence when the groups are close in depth', test => {
	const v = vm({ control: 2, case: 2.4 })
	test.notOk(v.notes[0].includes('reads per CpG'), 'only the Min Δβ explanation')
	test.end()
})
