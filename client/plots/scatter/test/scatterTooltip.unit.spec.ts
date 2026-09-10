import tape from 'tape'
import { scaleLinear as d3Linear } from 'd3-scale'
import { ScatterTooltip, HIT_BUFFER_PX, HOVER_RING_MARGIN_PX } from '../viewmodel/scatterTooltip.ts'
import { ScatterModel } from '../model/scatterModel.ts'
import { getDefaultScatterSettings } from '../settings/defaults.ts'
import { xAxisOffSet, yAxisOffSet } from '#shared'

/** Tests:
 * 	- dotRadius() tracks the rendered dot size
 * 	- Neighbours are the dots that overlap at 100% zoom, held constant in screen px
 * 	- scaleDotTW dots get a neighbourhood matching their larger radius
 * 	- isVisible() excludes hidden dots and the suppressed reference cloud
 * 	- getActions() gates sample-specific actions for reference dots and anonymized (sampleId-less) samples
 *
 * These cover what the deleted distance() got wrong. It clamped both points into
 * [xAxisScale.invert(0), xAxisScale.invert(svgw)] — but the axis range starts at
 * xAxisOffSet, so invert(svgw) fell short of the domain max and every sample in the
 * rightmost ~80px collapsed onto one x, reporting unrelated samples as neighbours.
 * It also used a fixed 5/zoom threshold unrelated to the rendered dot size. The old
 * spec's mock (range [0,500] with width 600) is what hid the first bug, so the
 * geometry below deliberately uses the real offsets.
 */

const svgw = 500
const svgh = 500

/** Minimal stand-in for the Scatter component. ScatterModel and ScatterTooltip both only
 * read settings/config/model off it, so the real getScale/getCoordinates/getOpacity run. */
function getScatterStub(settingsOverrides: any = {}, config: any = {}) {
	const scatter: any = {
		settings: Object.assign(getDefaultScatterSettings(), settingsOverrides),
		config,
		view: {}
	}
	scatter.model = new ScatterModel(scatter)
	return scatter
}

/** `zoom` is the on-screen scale d3-zoom applies to chart.serie; hoverRingFactor() reads it
 * back off the composite CTM, so the stub exposes it the same way. */
function getChart(scatter, zoom = 1) {
	return {
		id: 'Default',
		serie: { node: () => ({ getScreenCTM: () => ({ a: zoom }) }) },
		// same construction as ScatterModelBase.initAxes(): the range is offset by the axis gutter
		xAxisScale: d3Linear()
			.domain([0, 100])
			.range([xAxisOffSet, svgw + xAxisOffSet]),
		yAxisScale: d3Linear()
			.domain([100, 0])
			.range([yAxisOffSet, svgh + yAxisOffSet]),
		ranges: { scaleMin: 0, scaleMax: 100 },
		data: { samples: [] },
		cohortSamples: [],
		colorLegend: new Map(),
		shapeLegend: new Map(),
		_scatter: scatter
	}
}

const sample = (x, y, extra: any = {}) => Object.assign({ sampleId: 1, x, y, hidden: {} }, extra)

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sampleScatter/viewmodel/scatterTooltip -***-')
	test.end()
})

tape('dotRadius() tracks the rendered dot size', function (test) {
	test.timeoutAfter(100)

	const scatter = getScatterStub()
	const tooltip = new ScatterTooltip(scatter)
	const chart = getChart(scatter)

	// transform() draws each shape in a 16x16 box scaled by getScale(), so r = 8 * scale
	// and scale = settings.size / 3
	test.equal(tooltip.dotRadius(chart, sample(0, 0)), (8 * 0.8) / 3, 'default size 0.8 gives r = 2.13')

	const bigger = getScatterStub({ size: 1.6 })
	test.equal(
		new ScatterTooltip(bigger).dotRadius(getChart(bigger), sample(0, 0)),
		(8 * 1.6) / 3,
		'doubling settings.size doubles the radius'
	)

	const ref = getScatterStub({ refSize: 3 })
	test.equal(
		new ScatterTooltip(ref).dotRadius(getChart(ref), { x: 0, y: 0, hidden: {}, isRef: true }),
		(8 * 3) / 3,
		'a reference dot (isRef true) uses refSize'
	)
	test.end()
})

tape('Neighbours are the dots that overlap at 100% zoom', function (test) {
	test.timeoutAfter(100)

	const scatter = getScatterStub()
	const tooltip = new ScatterTooltip(scatter)
	const chart = getChart(scatter)

	// the domain spans 100 over svgw px, so 1 domain unit = 5px
	const seed = sample(100, 50) // hard against the right edge of the domain
	const near = sample(99.5, 50) // 2.5px away — the two r=2.13 circles touch
	const far = sample(90, 50) // 50px away — visibly separate

	test.true(tooltip.isNeighbour(chart, seed, near), 'a dot 2.5px away overlaps the seed')
	test.false(
		tooltip.isNeighbour(chart, seed, far),
		'a dot 50px away at the right edge is not a neighbour (the old clamp collapsed both onto one x)'
	)
	test.true(tooltip.isNeighbour(chart, seed, seed), 'the seed overlaps itself')

	// the same pair near the bottom edge, where the old yAxisOffSet clamp misfired
	const low = sample(50, 0)
	test.false(tooltip.isNeighbour(chart, low, sample(50, 10)), 'a dot 50px away at the bottom edge is not a neighbour')
	test.end()
})

tape('scaleDotTW dots get a neighbourhood matching their larger radius', function (test) {
	test.timeoutAfter(100)

	const scatter = getScatterStub({ maxShapeSize: 4, minShapeSize: 4 }, { scaleDotTW: { term: { name: 'agedx' } } })
	const tooltip = new ScatterTooltip(scatter)
	const chart = getChart(scatter)

	// scale is interpolated to maxShapeSize=minShapeSize=4, so r = 8 * 4/3 = 10.67 each,
	// giving a 21.3px reach vs 2.13/4.27px for a default-sized dot
	const seed = sample(100, 50, { scale: 50 })
	const gap20px = sample(96, 50, { scale: 50 }) // 4 domain units = 20px

	test.equal(tooltip.dotRadius(chart, seed), (8 * 4) / 3, 'scaleDotTW radius comes from the shape size range')
	test.true(tooltip.isNeighbour(chart, seed, gap20px), 'a 20px gap IS a neighbour once the dots are that big')

	// the same pair at the default dot size is not — the reach follows the rendered size,
	// which is the whole point of dropping the fixed 5/zoom threshold
	const small = getScatterStub()
	test.false(
		new ScatterTooltip(small).isNeighbour(getChart(small), sample(100, 50), sample(96, 50)),
		'the same 20px gap is NOT a neighbour at the default dot size'
	)
	test.end()
})

tape('Neighbourhood reach stays a constant screen distance at any zoom', function (test) {
	test.timeoutAfter(100)

	const scatter = getScatterStub()
	const tooltip = new ScatterTooltip(scatter)
	const seed = sample(50, 50)

	// two default dots (r = 2.13 each) reach 4.27px on screen. plain circle overlap looks
	// zoom-invariant, but the dots grow with zoom, so at 11x that same rule spans ~47 screen px
	// and the tooltip starts listing dots strewn across the plot
	const reach = 2 * ((8 * 0.8) / 3)

	for (const zoom of [0.2, 1, 3.4, 11]) {
		const chart = getChart(scatter, zoom)
		// 1 domain unit = 5 serie-local px, so convert the probe distance through both
		const justInside = sample(50 + (reach / zoom / 5) * 0.99, 50)
		const justOutside = sample(50 + (reach / zoom / 5) * 1.01, 50)
		test.true(
			tooltip.isNeighbour(chart, seed, justInside),
			`${reach.toFixed(1)} screen px still reaches at zoom ${zoom}`
		)
		test.false(tooltip.isNeighbour(chart, seed, justOutside), `and stops just past it at zoom ${zoom}`)
	}
	test.end()
})

tape('Cursor detection margin stays a constant screen distance at any zoom', function (test) {
	test.timeoutAfter(100)

	const scatter = getScatterStub({ size: 2 })
	const tooltip = new ScatterTooltip(scatter)
	const dot = sample(50, 50)

	/** how far past the dot's visible edge the cursor can be and still pick it, in screen px */
	const marginAtZoom = zoom => {
		const chart = getChart(scatter, zoom)
		return (tooltip.hitRadiusFor(chart, dot) - tooltip.dotRadius(chart, dot)) * zoom
	}

	// asserted against the constant, not a literal: the property under test is that the margin
	// does not change with zoom, whatever it is set to
	for (const zoom of [0.2, 1, 3.4, 10]) {
		test.ok(
			Math.abs(marginAtZoom(zoom) - HIT_BUFFER_PX) < 1e-9,
			`margin stays ${HIT_BUFFER_PX} screen px at zoom ${zoom}`
		)
	}

	// the dot's own area still counts, so a bigger dot is still easier to hit — only the
	// forgiveness beyond its edge is pinned
	test.true(
		tooltip.hitRadiusFor(getChart(scatter, 1), dot) > tooltip.dotRadius(getChart(scatter, 1), dot),
		'the hit radius is larger than the dot itself'
	)
	test.end()
})

tape('Hover ring keeps a constant screen gap at any zoom', function (test) {
	test.timeoutAfter(100)

	// settings.size 2 as in the ALL-pharmacotyping example, where a fixed 1.6x ring read as a
	// fat halo once zoomed in: the gap has to be measured in screen px, not dot radii
	const scatter = getScatterStub({ size: 2 })
	const tooltip = new ScatterTooltip(scatter)
	const dot = sample(50, 50)

	/** gap between the dot edge and the ring, in screen px */
	const gapAtZoom = zoom => {
		const chart = getChart(scatter, zoom)
		const r = tooltip.dotRadius(chart, dot)
		return (tooltip.hoverRingFactor(chart, dot) * r - r) * zoom
	}

	for (const zoom of [0.2, 1, 3.4, 10]) {
		test.ok(
			Math.abs(gapAtZoom(zoom) - HOVER_RING_MARGIN_PX) < 1e-9,
			`gap stays ${HOVER_RING_MARGIN_PX} screen px at zoom ${zoom}`
		)
	}

	// a fixed multiple would have grown with the dot; confirm the factor shrinks instead
	test.true(
		tooltip.hoverRingFactor(getChart(scatter, 10), dot) < tooltip.hoverRingFactor(getChart(scatter, 1), dot),
		'the ring factor tightens as zoom grows'
	)
	test.end()
})

tape('isVisible() excludes hidden dots and the suppressed reference cloud', function (test) {
	test.timeoutAfter(100)

	const scatter = getScatterStub()
	const tooltip = new ScatterTooltip(scatter)

	test.true(tooltip.isVisible(sample(1, 1)), 'a plain cohort sample is visible')
	test.false(
		tooltip.isVisible(sample(1, 1, { hidden: { category: true } })),
		'a dot hidden by a color legend click is excluded'
	)
	test.true(tooltip.isVisible({ x: 1, y: 1, hidden: {}, isRef: true }), 'a reference dot is visible by default')

	const noRef = new ScatterTooltip(getScatterStub({ showRef: false }))
	test.false(
		noRef.isVisible({ x: 1, y: 1, hidden: {}, isRef: true }),
		'reference dots are excluded when showRef is off'
	)

	const zeroRef = new ScatterTooltip(getScatterStub({ refSize: 0 }))
	test.false(
		zeroRef.isVisible({ x: 1, y: 1, hidden: {}, isRef: true }),
		'reference dots are excluded when refSize is 0'
	)
	test.end()
})

/** Stub carrying the fields getActions() reads: config, interactivity, and the state used to decide which
 * sample-specific actions apply. currentCohortChartTypes includes 'sampleView' so a real cohort sample
 * yields at least the "Sample view" action; the gated cases must still return none. */
function getActionsStub(config: any = {}) {
	const scatter: any = {
		settings: getDefaultScatterSettings(),
		config,
		interactivity: { openSampleView() {}, openDiscoPlot() {}, openMetArray() {}, openLollipop() {} },
		state: { termdbConfig: { queries: {} }, currentCohortChartTypes: ['sampleView'] },
		view: {}
	}
	scatter.model = new ScatterModel(scatter)
	return scatter
}

tape('getActions() gates sample-specific actions for reference and anonymized samples', function (test) {
	test.timeoutAfter(100)
	const tooltip = new ScatterTooltip(getActionsStub())

	const cohortActions = tooltip.getActions({ isRef: false, sampleId: 1, sample: 'S1' })
	test.ok(
		cohortActions.some((a: any) => a.label === 'Sample view'),
		'a real cohort sample offers the Sample view action'
	)

	test.deepEqual(
		tooltip.getActions({ isRef: false }),
		[],
		'an anonymized cohort dot (isRef false, but no sampleId) offers no sample-specific actions'
	)

	test.deepEqual(tooltip.getActions({ isRef: true }), [], 'a reference dot (isRef true) offers no actions')
	test.end()
})
