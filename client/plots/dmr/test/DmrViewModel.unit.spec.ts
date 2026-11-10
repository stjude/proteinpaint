import tape from 'tape'
import { DmrViewModel } from '../viewModel/DmrViewModel'
import { getDefaultDMRSettings } from '../settings/defaults'
import { inlineSvgImages } from '../../../src/block.svg.js'

/*
Tests:
	A DMR under the scan's Min Δβ is drawn gray and labeled, and a note says why, with the read depths
	A masked DMR is labeled with its mask, with its own note
	No depth sentence when the groups' depths are close, or when one group has no reads
	A view saved with no scan says its DMRs come from the default genome-wide run
	The per-CpG means track is SVG that the block's Export SVG inlines as vector, with and without a CI band
	Export SVG keeps an SVG track image it may not inline: unlisted markup, or a source that is not percent-encoded
*/

const dmr = (start: number, delta_beta_mean: number, direction = 'hyper') =>
	({ chr: 'chr1', start, stop: start + 1000, no_cpgs: 20, min_smoothed_fdr: 1e-20, delta_beta_mean, direction } as any)

function vm(readDepth?: { control: number; case: number }, masked: any[] = [], scanChromosomes = ['chr1']) {
	const config: any = {
		group1Name: 'NM Background',
		group2Name: 'ATRT SHH',
		readDepth,
		// opened from a scan, unless a test passes none
		scanChromosomes,
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

tape('No depth sentence when the groups are close in depth, or when one group has no reads', test => {
	test.notOk(vm({ control: 2, case: 2.4 }).notes[0].includes('reads per CpG'), 'only the Min Δβ explanation')
	test.notOk(vm({ control: 0, case: 2.4 }).notes[0].includes('reads per CpG'), 'no ratio of a group with no reads')
	test.end()
})

tape('A view saved with no scan says its DMRs come from the default genome-wide run', test => {
	test.ok(
		vm(undefined, [], []).notes.some(n => n.startsWith('This view was saved before region views were opened')),
		'a view with no scan chromosomes gets the note'
	)
	test.notOk(
		vm().notes.some(n => n.startsWith('This view was saved')),
		'a view opened from a scan does not'
	)
	test.end()
})

/** the per-CpG means track's image source, for 3 probes with LOESS curves */
function betaTrackSrc(minProbesForCi: number): string {
	const positions = [1000, 1100, 1200]
	const curve = [0.2, 0.3, 0.4]
	const config: any = {
		group1Name: 'A',
		group2Name: 'B',
		scanChromosomes: ['chr1'],
		settings: { dmr: getDefaultDMRSettings({ settings: { minProbesForCi } }) }
	}
	const diagnostic = {
		probes: {
			positions,
			mean_group1: [0.2, null, 0.4],
			mean_group2: [0.6, 0.7, 0.8],
			sig: [true, false, true],
			smoothed_sig: [true, false, true],
			logFC: [1, 1, 1]
		},
		probe_spacings: [],
		loess: {
			positions,
			group1_fitted: curve,
			group1_ci_lower: curve.map(v => v - 0.1),
			group1_ci_upper: curve.map(v => v + 0.1),
			group2_fitted: curve,
			group2_ci_lower: curve.map(v => v - 0.1),
			group2_ci_upper: curve.map(v => v + 0.1)
		}
	}
	const v = new DmrViewModel({ status: 'ok', dmrs: [], diagnostic } as any, config, { tracks: [] }, 'chr1', 900, 1300)
		.viewData
	return v.tklst.find((t: any) => t.imgData)!.imgData.src
}

/** an export's <svg> holding one track <image> with this source */
function exportWith(src: string) {
	const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml')
	const img = doc.createElementNS('http://www.w3.org/2000/svg', 'image')
	for (const [k, v] of Object.entries({ x: '5', y: '10', width: '800', height: '150', href: src }))
		img.setAttribute(k, v)
	doc.documentElement.appendChild(img)
	return doc.documentElement
}

tape('The per-CpG means track is SVG that Export SVG inlines as vector', test => {
	for (const [minProbesForCi, band] of [
		[2, 'with a CI band'],
		[10, 'dashed, with no band']
	] as [number, string][]) {
		const svg = exportWith(betaTrackSrc(minProbesForCi))
		inlineSvgImages(svg)
		test.equal(svg.querySelectorAll('image').length, 0, `${band}: every element and attribute is inlined`)
		const track = svg.querySelector('svg')!
		test.equal(track.getAttribute('x'), '5', `${band}: placed where the image was`)
		test.equal(track.querySelectorAll('circle').length, 5, `${band}: a dot per mean, none for a missing one`)
		test.equal(track.querySelectorAll('polyline').length, 2, `${band}: a LOESS curve per group`)
		test.equal(
			track.querySelectorAll('polygon').length,
			minProbesForCi == 2 ? 2 : 0,
			`${band}: a band per group or none`
		)
	}
	test.end()
})

tape('Export SVG keeps an SVG track image it may not inline', test => {
	const enc = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
	const ns = 'xmlns="http://www.w3.org/2000/svg"'
	for (const [src, what] of [
		[enc(`<svg ${ns}><script>1</script></svg>`), 'an element off the list'],
		[enc(`<svg ${ns}><circle r="1" onclick="1"/></svg>`), 'an attribute off the list'],
		[`data:image/svg+xml;charset=utf-8,<svg ${ns} width="100%"></svg>`, 'a source that is not percent-encoded']
	]) {
		const svg = exportWith(src)
		test.doesNotThrow(() => inlineSvgImages(svg), `${what}: no error`)
		test.equal(svg.querySelectorAll('image').length, 1, `${what}: stays an image`)
	}
	test.end()
})
