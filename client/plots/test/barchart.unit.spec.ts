import tape from 'tape'
// import * as d3s from 'd3-selection'
// import * as helpers from '../../test/front.helpers.js'
import { Barchart } from '#plots/barchart.js'
// import { detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    - Default barchart component
*/

/*************************
 reusable helper functions
**************************/

// function getHolder() {
// 	return d3s
// 		.select('body')
// 		.append('div')
// 		.style('border', '1px solid #aaa')
// 		.style('padding', '5px')
// 		.style('margin', '5px')
// }

// const runpp = helpers.getRunPp('mass', {
// 	state: {
// 		nav: { header_mode: 'hidden' },
// 		dslabel: 'TermdbTest',
// 		genome: 'hg38-test'
// 	},
// 	debug: 1
// })

// function getBarchart(opts) {

// }

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/barchart -***-')
	test.end()
})

tape('Default barchart component', test => {
	test.timeoutAfter(100)

	const testBarchart = new Barchart()

	test.equal(testBarchart.type, 'barchart', 'Should set type to barchart')
	test.equal(typeof testBarchart.setControls, 'function', 'Should have a .setControls() function')
	test.equal(typeof testBarchart.reactsTo, 'function', 'Should have a .reactsTo() function')
	test.equal(typeof testBarchart.getState, 'function', 'Should have a .getState() function')
	test.equal(typeof testBarchart.getDataRequestOpts, 'function', 'Should have a .getDataRequestOpts() function')
	test.equal(typeof testBarchart.updateSettings, 'function', 'Should have a .updateSettings() function')
	test.equal(typeof testBarchart.mayResetHidden, 'function', 'Should have a .mayResetHidden() function')
	test.equal(typeof testBarchart.mayEditHiddenValues, 'function', 'Should have a .mayEditHiddenValues() function')
	test.equal(typeof testBarchart.setExclude, 'function', 'Should have a .setExclude() function')
	test.equal(typeof testBarchart.processData, 'function', 'Should have a .processData() function')
	test.equal(typeof testBarchart.setMaxVisibleTotals, 'function', 'Should have a .setMaxVisibleTotals() function')
	test.equal(typeof testBarchart.sortStacking, 'function', 'Should have a .sortStacking() function')
	test.equal(typeof testBarchart.setTerm2Color, 'function', 'Should have a .setTerm2Color() function')
	test.equal(typeof testBarchart.getColor, 'function', 'Should have a .getColor() function')
	test.equal(typeof testBarchart.getMutationColor, 'function', 'Should have a .getMutationColor() function')
	test.equal(typeof testBarchart.getLegendGrps, 'function', 'Should have a .getLegendGrps() function')
	test.equal(typeof testBarchart.getOneLegendGrps, 'function', 'Should have a .getOneLegendGrps() function')
	test.equal(typeof testBarchart.toggleLoadingDiv, 'function', 'Should have a .toggleLoadingDiv() function')

	test.end()
})
