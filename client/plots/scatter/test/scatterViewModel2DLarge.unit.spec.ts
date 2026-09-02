import tape from 'tape'
import { scaleLinear as d3Linear } from 'd3-scale'
import { ScatterViewModel2DLarge } from '../viewmodel/scatterViewModel2DLarge.ts'
import { xAxisOffSet, yAxisOffSet } from '#shared'

/** Tests:
 *  - getVertices maps larger data-y to a higher WebGL clip-space y (not inverted)
 *  - getVertices does not mutate the shared chart axis scales
 *  - renderAxes maps the data range onto the plot-area pixels with a non-inverted y-axis
 *  - renderAxes scales the axes about the plot center by the zoom factor
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
	// an axis generator stub: .scale(s) records the scale and returns itself for chaining
	const makeAxis = () => ({
		scale(s: any) {
			;(this as any)._scale = s
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
			}
		},
		yAxis: {
			call(gen: any) {
				capture.y = gen._scale
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
