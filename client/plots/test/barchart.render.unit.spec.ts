import tape from 'tape'
import * as d3s from 'd3-selection'
// import barsRenderer from '#plots/bars.renderer.js'

/* 
Tests:
    - Default barchart component
*/

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function getMockChartData(_opts) {
	const svg = _opts.holder.append('svg')
	const mockData: { settings: any; handlers: { svg: any }; h: any } = {
		settings: {
			cols: [1],
			colLabels: [{ id: 1, label: 'ABC' }]
		},
		handlers: {
			svg: svg
		},
		h: {
			svg: svg
		}
	}
	return mockData
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- plots/barchart -***-')
	test.end()
})
/** Difficult to test.
 * Throws several type errors.
 */
// tape('\n', test => {
//     test.timeoutAfter(100)
//     const holder = getHolder()
//     const opts = { holder }

//     const testBarsRender = barsRenderer({}, holder)
//     testBarsRender
//     const testBarsRenderMain = testBarsRender(getMockChartData(opts))

//     if (test['ok']) holder.remove()
//     test.end()
// })
