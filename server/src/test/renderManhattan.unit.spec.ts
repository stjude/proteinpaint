import tape from 'tape'
import { renderManhattan, renderManhattanPoints } from '#src/renderManhattan.ts'
import type { ManhattanRenderRequest } from '#src/renderManhattan.ts'

/*
test sections:

lesion types are discovered from geneHits columns (any q.nsubj.<type>, incl. itd)
zero-q (most significant) rows render on-canvas, not clipped above the top
established 5-type run still produces points
empty geneHits: no points, no crash
renderManhattanPoints: signed y draws both sides of a zero line; top-N interactive rule
renderManhattanPoints: capping off draws the full range of a bounded y; rank picks the live dots
*/

/** Unit tests for renderManhattan. The lesion types plotted are discovered from the geneHits
 * `q.nsubj.<type>` columns (not a hardcoded whitelist), and zero-q rows are parked at the y-cap.
 * These guard the two easy-to-regress behaviors: a new data type (itd) must render, and a q=0
 * top hit must stay within the plotted y-range. We assert on the returned plot_data directly. */

const chrSizes = { chr1: 248956422, chr13: 114364328, chr17: 83257441 }
const CANVAS_H = 404 + 2 * 2 // plotHeight + 2*pngDotRadius

function makeReq(over: Partial<ManhattanRenderRequest> = {}): ManhattanRenderRequest {
	return {
		geneHits: [],
		chrSizes,
		plotWidth: 1004,
		plotHeight: 404,
		devicePixelRatio: 1,
		pngDotRadius: 2,
		qValueThreshold: 0.05,
		maxCappedPoints: 5,
		hardCap: 200,
		binSize: 10,
		...over
	}
}

tape('\n', function (test) {
	test.comment('-***- server/renderManhattan unit specs -***-')
	test.end()
})

tape('lesion types discovered from geneHits columns (itd)', async test => {
	test.timeoutAfter(5000)
	// An itd-only run: FLT3 (q=0, the signal) + noise at q=1. 'itd' is not one of the legacy
	// gain/loss/mutation/fusion/sv types, so this fails if the renderer uses a hardcoded whitelist.
	const geneHits = [
		{ gene: 'FLT3', chrom: 'chr13', 'loc.start': 28003274, 'loc.end': 28100592, 'q.nsubj.itd': 0, 'nsubj.itd': 136 },
		{ gene: 'X', chrom: 'chr1', 'loc.start': 1000000, 'loc.end': 1001000, 'q.nsubj.itd': 1, 'nsubj.itd': 0 }
	]
	const r = await renderManhattan(makeReq({ geneHits, lesionTypeColors: { itd: '#ff70ff' } }))
	const flt3 = r.plot_data.points.find(p => p.gene === 'FLT3')
	test.ok(flt3, 'FLT3 (itd, q=0) is an interactive point')
	test.equal(flt3?.type, 'itd', 'point carries the itd lesion type')
	test.equal(flt3?.color, '#ff70ff', 'itd color from lesionTypeColors is applied')
	test.end()
})

tape('zero-q top hit renders on-canvas (not clipped above top)', async test => {
	test.timeoutAfter(5000)
	// FLT3 q=0 with the next-best non-zero q well below the y-cap: the zero-q row must still land
	// inside [0, canvasHeight]. Regression for zero-q rows being parked above yMax.
	const geneHits = [
		{ gene: 'FLT3', chrom: 'chr13', 'loc.start': 28003274, 'loc.end': 28100592, 'q.nsubj.itd': 0, 'nsubj.itd': 136 },
		{ gene: 'UBTF', chrom: 'chr17', 'loc.start': 44184000, 'loc.end': 44190000, 'q.nsubj.itd': 1e-120, 'nsubj.itd': 33 }
	]
	const r = await renderManhattan(makeReq({ geneHits, lesionTypeColors: { itd: '#ff70ff' } }))
	const flt3 = r.plot_data.points.find(p => p.gene === 'FLT3')!
	test.ok(
		flt3.pixel_y >= 0 && flt3.pixel_y <= CANVAS_H,
		`FLT3 pixel_y ${flt3.pixel_y.toFixed(1)} within [0, ${CANVAS_H}]`
	)
	test.ok(r.plot_data.y_max >= flt3.y, 'y_max clears the zero-q placement value')
	test.end()
})

tape('established multi-type run still produces points', async test => {
	test.timeoutAfter(5000)
	const geneHits = [
		{
			gene: 'TP53',
			chrom: 'chr17',
			'loc.start': 7668402,
			'loc.end': 7687550,
			'q.nsubj.mutation': 1e-10,
			'nsubj.mutation': 40
		},
		{ gene: 'MYC', chrom: 'chr1', 'loc.start': 5000000, 'loc.end': 5010000, 'q.nsubj.gain': 1e-8, 'nsubj.gain': 25 }
	]
	const r = await renderManhattan(makeReq({ geneHits }))
	test.equal(r.plot_data.points.length, 2, 'both mutation and gain points present')
	test.deepEqual(r.plot_data.points.map(p => p.type).sort(), ['gain', 'mutation'], 'legacy types still discovered')
	test.end()
})

tape('empty geneHits: no points, no crash', async test => {
	test.timeoutAfter(5000)
	const r = await renderManhattan(makeReq({ geneHits: [] }))
	test.equal(r.plot_data.points.length, 0, 'no interactive points')
	test.ok(r.png.length > 0, 'still returns a (blank) PNG')
	test.end()
})

tape('renderManhattanPoints: signed y is symmetric about zero and the top N by |y| are interactive', async test => {
	test.timeoutAfter(5000)
	/* The DMR scan puts hypomethylation below the line: a hyper and a hypo DMR of equal evidence
	must sit equally far from it, and "top 1000 interactive" must rank by evidence, not by sign. */
	const base = {
		chrSizes,
		plotWidth: 1004,
		plotHeight: 404,
		devicePixelRatio: 1,
		pngDotRadius: 2,
		maxCappedPoints: 5,
		hardCap: 200,
		binSize: 10
	}
	const points = [
		{ chrom: 'chr1', pos: 1e6, y: 8, color: '#e66101', id: 'hyper8' },
		{ chrom: 'chr1', pos: 2e6, y: -8, color: '#5e81f4', id: 'hypo8' },
		{ chrom: 'chr13', pos: 3e6, y: 2, color: '#e66101', id: 'hyper2' },
		{ chrom: 'chr17', pos: 4e6, y: -30, color: '#5e81f4', id: 'hypo30' }
	]
	const r = await renderManhattanPoints({ ...base, points, signed: true, interactive: 1 })
	test.equal(r.plot_data.y_min, -r.plot_data.y_max, 'the y domain is symmetric')
	test.deepEqual(
		r.plot_data.points.map(p => p.id),
		['hyper8', 'hypo30'],
		'signed, the top N is taken on each side: one direction cannot crowd the other out'
	)
	const p = Object.fromEntries(r.plot_data.points.map(p => [p.id, p]))
	test.ok(
		p.hypo30.pixel_y > CANVAS_H / 2 && p.hyper8.pixel_y < CANVAS_H / 2,
		'hypo draws below the middle, hyper above'
	)
	test.equal(p.hypo30.y, -30, 'the signed y comes back unchanged')
	test.equal(p.hyper8.x, 1e6, 'x is the genome-wide coordinate (chr1 starts at 0)')
	const unsigned = await renderManhattanPoints({ ...base, points, interactive: 10 })
	test.equal(unsigned.plot_data.points.length, 2, 'unsigned, negative y is dropped rather than drawn')
	const capped = await renderManhattanPoints({ ...base, points, interactive: 1 })
	test.deepEqual(
		capped.plot_data.points.map(p => p.id),
		['hyper8'],
		'unsigned, the top N is one list'
	)
	test.end()
})

tape('renderManhattanPoints: capping off draws a bounded y in full, and rank picks the live dots', async test => {
	test.timeoutAfter(5000)
	/* The DMR scan puts delta-beta on y: a range of a few tenths that the -log10 cap logic would
	pad by 2.35 units and squash into a sliver. Uncapped, the range is the data's own, padded by the
	dot radius; and the live dots are chosen by the evidence the caller passes, not by |y|. */
	const base = {
		chrSizes,
		plotWidth: 1004,
		plotHeight: 404,
		devicePixelRatio: 1,
		pngDotRadius: 2,
		maxCappedPoints: 5,
		hardCap: 200,
		binSize: 10
	}
	const points = [
		{ chrom: 'chr1', pos: 1e6, y: 0.3, color: '#e66101', id: 'big-weak', p: 0.04 },
		{ chrom: 'chr1', pos: 2e6, y: 0.1, color: '#e66101', id: 'small-strong', p: 1e-50 },
		{ chrom: 'chr13', pos: 3e6, y: -0.25, color: '#5e81f4', id: 'hypo-weak', p: 0.03 },
		{ chrom: 'chr17', pos: 4e6, y: -0.05, color: '#5e81f4', id: 'hypo-strong', p: 1e-40 }
	]
	const r = await renderManhattanPoints({
		...base,
		points,
		signed: true,
		capping: false,
		interactive: 1,
		rank: p => -Math.log10(p.p)
	})
	const pad = r.plot_data.y_pad
	test.ok(pad > 0 && pad < 0.01, `padding is the dot radius in y units at this height (${pad.toFixed(4)})`)
	test.equal(r.plot_data.y_max, 0.3 + pad, 'y_max is the largest |y| plus that padding')
	test.equal(r.plot_data.y_min, -r.plot_data.y_max, 'and the axis stays symmetric')
	test.notOk(r.plot_data.has_capped_points, 'nothing is reported capped')
	test.deepEqual(
		r.plot_data.points.map(p => p.id),
		['small-strong', 'hypo-strong'],
		'the live dot per side is the best supported, not the largest'
	)
	test.end()
})
