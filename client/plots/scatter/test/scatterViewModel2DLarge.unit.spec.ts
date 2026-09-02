import tape from 'tape'
import { scaleLinear as d3Linear } from 'd3-scale'
import { ScatterViewModel2DLarge } from '../viewmodel/scatterViewModel2DLarge.ts'
import { xAxisOffSet, yAxisOffSet } from '#shared'

/** Tests:
 *  - getVertices maps larger data-y to a higher WebGL clip-space y (not inverted)
 *  - getVertices does not mutate the shared chart axis scales
 *  - renderAxes maps the data range onto the plot-area pixels with a non-inverted y-axis
 *  - renderAxes scales the axes about the plot center by the zoom factor
 *  - renderAxes keeps the axis range pinned to the plot edges at any zoom
 *  - renderAxes drops ticks outside the data range when zoomed out
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

/** renderAxes only reads this.axisChart, this.scatter.settings/vm.scatterZoom and this.model.axisOffset,
 * and calls chart.xAxis/yAxis.call(chart.axisBottom/Left.scale(newScale)). Capture the scale handed to
 * each axis so we can assert where data values land in plot-area pixels. */
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
		_capture: capture
	}
}

tape('renderAxes maps the data range onto the plot-area pixels with a non-inverted y-axis', function (test) {
	test.timeoutAfter(100)
	const vm = getAxisMockViewModel(1)
	const chart = getAxisMockChart()
	vm.axisChart = chart

	vm.renderAxes()

	const xScale = chart._capture.x
	const yScale = chart._capture.y

	test.equal(xScale(0), xAxisOffSet, 'Should place the x minimum at the left plot edge (offsetX).')
	test.equal(xScale(10), 600 + xAxisOffSet, 'Should place the x maximum at the right plot edge (svgw + offsetX).')
	test.equal(yScale(100), yAxisOffSet, 'Should place the y maximum at the top plot edge (offsetY).')
	test.equal(yScale(0), 600 + yAxisOffSet, 'Should place the y minimum at the bottom plot edge (svgh + offsetY).')
	test.ok(yScale(100) < yScale(0), 'Should map the larger y value higher (smaller pixel), not inverted.')
	test.equal(vm.currentAxisZoom, 1, 'Should record the zoom the axes were drawn at.')
	test.end()
})

tape('renderAxes scales the axes about the plot center by the zoom factor', function (test) {
	test.timeoutAfter(100)
	const vm = getAxisMockViewModel(2)
	const chart = getAxisMockChart()
	vm.axisChart = chart

	vm.renderAxes()

	const xScale = chart._capture.x
	const cx = xAxisOffSet + 600 / 2
	const cy = yAxisOffSet + 600 / 2
	const yScale = chart._capture.y

	// value 5 is the domain center and must stay fixed at the plot center under zoom
	test.equal(xScale(5), cx, 'Should keep the plot center fixed under zoom (x).')
	test.equal(yScale(50), cy, 'Should keep the plot center fixed under zoom (y).')
	// range half-width doubles at zoom 2: xScale(0) = cx - 2*(svgw/2) = cx - 600
	test.equal(xScale(0), cx - 600, 'Should widen the x range about the center by the zoom factor.')
	test.equal(vm.currentAxisZoom, 2, 'Should record the current zoom.')
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
		vm.axisChart = chart
		vm.renderAxes()
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
	vm.axisChart = chart
	vm.renderAxes()

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
