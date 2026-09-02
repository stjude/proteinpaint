import tape from 'tape'
import { scaleLinear as d3Linear, scaleTime as d3Time } from 'd3-scale'
import { ScatterViewModel2DLarge } from '../viewmodel/scatterViewModel2DLarge.ts'
import { xAxisOffSet, yAxisOffSet } from '#shared'

/** Tests:
 *  - getVertices maps larger data-y to a higher WebGL clip-space y (not inverted)
 *  - getVertices does not mutate the shared chart axis scales
 *  - renderAxes maps the data range onto the plot-area pixels with a non-inverted y-axis
 *  - renderAxes scales the axes about the plot center by the zoom factor
 *  - renderAxes keeps the axis range pinned to the plot edges at any zoom
 *  - renderAxes drops ticks outside the data range when zoomed out
 *  - renderAxes tracks zoom per chart so multiple charts stay in sync (categorical term0)
 *  - renderAxes rescales the time scale for date terms, keeping date ticks
 *  - animate releases the canvas and renderer when its loop becomes stale
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/scatter/viewmodel/scatterViewModel2DLarge -***-')
	test.end()
})

/** Build a chart with axis scales like ScatterModelBase.initAxes():
 * the y scale uses a flipped domain [yMax, yMin] mapped to SVG pixels (top -> bottom),
 * because SVG's y grows downward. getVertices must re-map into WebGL clip space, where
 * y grows upward, so larger data values land nearer +1 (the top). */
function getMockChart() {
	const svgw = 400
	const svgh = 400
	const xAxisScale = d3Linear()
		.domain([0, 10])
		.range([xAxisOffSet, svgw + xAxisOffSet])
	const yAxisScale = d3Linear()
		.domain([100, 0]) // flipped for SVG (yMax first), as initAxes builds it
		.range([yAxisOffSet, svgh + yAxisOffSet])
	return {
		xAxisScale,
		yAxisScale,
		data: {
			samples: [
				{ sampleId: 'high', x: 5, y: 90 },
				{ sampleId: 'low', x: 5, y: 10 }
			]
		}
	}
}

/** getVertices only uses this.model.getOpacity/getColor besides the chart scales/samples,
 * so exercise it on a bare prototype instance to avoid constructing the full view/DOM. */
function getMockViewModel() {
	const vm: any = Object.create(ScatterViewModel2DLarge.prototype)
	vm.model = {
		getOpacity: () => 1,
		getColor: () => '#000000'
	}
	return vm
}

tape('getVertices maps larger data-y to a higher WebGL clip-space y (not inverted)', function (test) {
	test.timeoutAfter(100)
	const vm = getMockViewModel()
	const chart = getMockChart()

	const { vertices } = vm.getVertices(chart)

	// vertices is a flat [x, y, z, x, y, z, ...] array; sample order is preserved
	const highY = vertices[1] // data y = 90
	const lowY = vertices[4] // data y = 10

	test.ok(
		highY > lowY,
		`Should place the larger data value higher in clip space (got high=${highY}, low=${lowY}), not inverted.`
	)
	test.ok(highY <= 1 && lowY >= -1, 'Should keep clip-space y within [-1, 1].')
	test.end()
})

tape('getVertices does not mutate the shared chart axis scales', function (test) {
	test.timeoutAfter(100)
	const vm = getMockViewModel()
	const chart = getMockChart()
	const yRangeBefore = chart.yAxisScale.range().slice()
	const xRangeBefore = chart.xAxisScale.range().slice()

	vm.getVertices(chart)

	test.deepEqual(
		chart.yAxisScale.range(),
		yRangeBefore,
		'Should leave chart.yAxisScale range intact for the axis, zoom and hover quadtree.'
	)
	test.deepEqual(chart.xAxisScale.range(), xRangeBefore, 'Should leave chart.xAxisScale range intact.')
	test.end()
})

/** renderAxes(chart) reads the passed chart, this.scatter.settings/vm.scatterZoom and
 * this.model.axisOffset, and calls chart.xAxis/yAxis.call(chart.axisBottom/Left.scale(newScale)).
 * Capture the scale handed to each axis so we can assert where data values land in plot-area pixels. */
function getAxisMockViewModel(zoom = 1) {
	const vm: any = Object.create(ScatterViewModel2DLarge.prototype)
	vm.model = { axisOffset: { x: xAxisOffSet, y: yAxisOffSet } }
	vm.scatter = {
		settings: { svgw: 600, svgh: 600 },
		vm: { scatterZoom: { zoom } }
	}
	return vm
}

function getAxisMockChart() {
	const capture: any = {}
	// an axis generator stub: .scale(s)/.tickValues(v) record their args and return itself for chaining
	const makeAxis = () => ({
		scale(s: any) {
			;(this as any)._scale = s
			return this
		},
		tickValues(v: any) {
			;(this as any)._tickValues = v
			return this
		}
	})
	return {
		// domain like ScatterModelBase.initAxes(): x normal, y flipped (yMax first) for SVG's downward y
		xAxisScale: d3Linear()
			.domain([0, 10])
			.range([xAxisOffSet, 600 + xAxisOffSet]),
		yAxisScale: d3Linear()
			.domain([100, 0])
			.range([yAxisOffSet, 600 + yAxisOffSet]),
		axisBottom: makeAxis(),
		axisLeft: makeAxis(),
		xAxis: {
			call(gen: any) {
				capture.x = gen._scale
				capture.xTicks = gen._tickValues
			}
		},
		yAxis: {
			call(gen: any) {
				capture.y = gen._scale
				capture.yTicks = gen._tickValues
			}
		},
		// renderAxes() records the per-chart zoom here
		currentAxisZoom: undefined as number | undefined,
		// optional time scales set by tests to simulate a date term (as ScatterModelBase.initAxes does)
		xAxisScaleTime: undefined as any,
		yAxisScaleTime: undefined as any,
		_capture: capture
	}
}

tape('renderAxes maps the data range onto the plot-area pixels with a non-inverted y-axis', function (test) {
	test.timeoutAfter(100)
	const vm = getAxisMockViewModel(1)
	const chart = getAxisMockChart()

	vm.renderAxes(chart)

	const xScale = chart._capture.x
	const yScale = chart._capture.y

	test.equal(xScale(0), xAxisOffSet, 'Should place the x minimum at the left plot edge (offsetX).')
	test.equal(xScale(10), 600 + xAxisOffSet, 'Should place the x maximum at the right plot edge (svgw + offsetX).')
	test.equal(yScale(100), yAxisOffSet, 'Should place the y maximum at the top plot edge (offsetY).')
	test.equal(yScale(0), 600 + yAxisOffSet, 'Should place the y minimum at the bottom plot edge (svgh + offsetY).')
	test.ok(yScale(100) < yScale(0), 'Should map the larger y value higher (smaller pixel), not inverted.')
	test.equal(chart.currentAxisZoom, 1, 'Should record the zoom the axes were drawn at on the chart.')
	test.end()
})

tape('renderAxes scales the axes about the plot center by the zoom factor', function (test) {
	test.timeoutAfter(100)
	const vm = getAxisMockViewModel(2)
	const chart = getAxisMockChart()

	vm.renderAxes(chart)

	const xScale = chart._capture.x
	const cx = xAxisOffSet + 600 / 2
	const cy = yAxisOffSet + 600 / 2
	const yScale = chart._capture.y

	// value 5 is the domain center and must stay fixed at the plot center under zoom
	test.equal(xScale(5), cx, 'Should keep the plot center fixed under zoom (x).')
	test.equal(yScale(50), cy, 'Should keep the plot center fixed under zoom (y).')
	// range half-width doubles at zoom 2: xScale(0) = cx - 2*(svgw/2) = cx - 600
	test.equal(xScale(0), cx - 600, 'Should widen the x range about the center by the zoom factor.')
	test.equal(chart.currentAxisZoom, 2, 'Should record the current zoom on the chart.')
	test.end()
})

tape('renderAxes keeps the axis range pinned to the plot edges at any zoom', function (test) {
	test.timeoutAfter(100)
	// Rescaling adjusts the domain, not the range, so the axis spines stay at the plot edges and the
	// two axes remain joined at the corner — never spilling past the canvas (zoom in) or pulling
	// inward (zoom out).
	for (const zoom of [0.5, 2]) {
		const vm = getAxisMockViewModel(zoom)
		const chart = getAxisMockChart()
		vm.renderAxes(chart)
		test.deepEqual(
			chart._capture.x.range(),
			[xAxisOffSet, 600 + xAxisOffSet],
			`Should pin the x-axis range to the plot edges at zoom ${zoom}.`
		)
		test.deepEqual(
			chart._capture.y.range(),
			[yAxisOffSet, 600 + yAxisOffSet],
			`Should pin the y-axis range to the plot edges at zoom ${zoom}.`
		)
	}
	test.end()
})

tape('renderAxes drops ticks outside the data range when zoomed out', function (test) {
	test.timeoutAfter(100)
	// zoomed out, the visible window extends past the data domain ([0,10] x, [0,100] y); those
	// out-of-range values should not be labeled with tick marks
	const vm = getAxisMockViewModel(0.5)
	const chart = getAxisMockChart()
	vm.renderAxes(chart)

	const xTicks = chart._capture.xTicks
	const yTicks = chart._capture.yTicks
	test.ok(Array.isArray(xTicks) && xTicks.length > 0, 'Should still render x ticks within the data range.')
	test.ok(
		xTicks.every((t: number) => t >= 0 && t <= 10),
		'Should not render x ticks below the min or above the max.'
	)
	test.ok(
		yTicks.every((t: number) => t >= 0 && t <= 100),
		'Should not render y ticks below the min or above the max.'
	)
	test.end()
})

tape('renderAxes tracks zoom per chart so multiple charts stay in sync (categorical term0)', function (test) {
	test.timeoutAfter(100)
	// A categorical term0 renders multiple charts, each with its own canvas and animation loop but a
	// single shared zoom. The zoom must be tracked per chart, not on the view model, so that every
	// chart's axes are redrawn — not just the last one rendered.
	const vm = getAxisMockViewModel(1)
	const chartA = getAxisMockChart()
	const chartB = getAxisMockChart()

	vm.renderAxes(chartA)
	vm.renderAxes(chartB)
	test.equal(chartA.currentAxisZoom, 1, 'Should record zoom 1 on chartA.')
	test.equal(chartB.currentAxisZoom, 1, 'Should record zoom 1 on chartB.')

	// the shared zoom changes; chartA's loop redraws chartA
	vm.scatter.vm.scatterZoom.zoom = 3
	vm.renderAxes(chartA)
	test.equal(chartA.currentAxisZoom, 3, 'Should redraw chartA and record the new zoom.')
	test.equal(chartB.currentAxisZoom, 1, 'Should leave chartB tracked independently until its own loop redraws it.')

	// chartB's own loop redraws chartB to the same shared zoom
	vm.renderAxes(chartB)
	test.equal(chartB.currentAxisZoom, 3, 'Should redraw chartB to the shared zoom independently.')
	test.end()
})

tape('renderAxes rescales the time scale for date terms, keeping date ticks', function (test) {
	test.timeoutAfter(100)
	// initAxes() binds the axis generator to a time scale for a date term; renderAxes must rescale
	// that time scale (so date ticks/formatting survive) rather than replacing it with the numeric
	// coordinate scale used for the WebGL points.
	const vm = getAxisMockViewModel(1)
	const chart = getAxisMockChart()
	// simulate a date x term: numeric xAxisScale (for WebGL coords) plus a time scale for the axis
	chart.xAxisScaleTime = d3Time()
		.domain([new Date(2000, 0, 1), new Date(2020, 0, 1)])
		.range([xAxisOffSet, 600 + xAxisOffSet])

	vm.renderAxes(chart)

	const xScale = chart._capture.x
	const yScale = chart._capture.y
	test.ok(
		xScale.invert(xAxisOffSet) instanceof Date,
		'Should rescale the time scale (its invert returns a Date) for a date x term.'
	)
	test.equal(typeof yScale.invert(yAxisOffSet), 'number', 'Should keep the numeric scale for the non-date y axis.')
	test.end()
})

tape('animate releases the canvas and renderer when its loop becomes stale', function (test) {
	test.timeoutAfter(100)
	// a re-render swaps scatter.vm; the old loop must clean up rather than leave a stale overlay canvas
	// (which would cover a plot that switched back to the SVG path) and a retained WebGL context
	const vm: any = Object.create(ScatterViewModel2DLarge.prototype)
	vm.scatter = { vm: {} } // scatter.vm !== vm, so this loop is stale
	let removed = false
	let disposed = false
	let rendered = false
	const renderer = {
		domElement: {
			remove() {
				removed = true
			}
		},
		dispose() {
			disposed = true
		},
		render() {
			rendered = true
		}
	}
	const camera = { updateProjectionMatrix() {} }

	vm.animate({}, camera, {}, renderer)

	test.ok(removed, 'Should remove the overlay canvas.')
	test.ok(disposed, 'Should dispose the WebGL renderer.')
	test.notOk(rendered, 'Should not render again after the loop is stale.')
	test.end()
})
