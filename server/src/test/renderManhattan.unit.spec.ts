import tape from 'tape'
import { renderManhattan } from '#src/renderManhattan.ts'
import type { ManhattanRenderRequest } from '#src/renderManhattan.ts'

/*
test sections:

lesion types are discovered from geneHits columns (any q.nsubj.<type>, incl. itd)
zero-q (most significant) rows render on-canvas, not clipped above the top
established 5-type run still produces points
empty geneHits: no points, no crash
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
	const r = await renderManhattan(makeReq({ geneHits: [] }))
	test.equal(r.plot_data.points.length, 0, 'no interactive points')
	test.ok(r.png.length > 0, 'still returns a (blank) PNG')
	test.end()
})
