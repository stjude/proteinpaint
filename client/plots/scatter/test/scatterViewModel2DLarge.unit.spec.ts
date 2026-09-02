import tape from 'tape'
import { scaleLinear as d3Linear } from 'd3-scale'
import { ScatterViewModel2DLarge } from '../viewmodel/scatterViewModel2DLarge.ts'
import { xAxisOffSet, yAxisOffSet } from '#shared'

/** Tests:
 *  - getVertices maps larger data-y to a higher WebGL clip-space y (not inverted)
 *  - getVertices does not mutate the shared chart axis scales
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
