import tape from 'tape'
// import * as d3s from 'd3-selection'
// import * as helpers from '../../test/front.helpers.js'
import { Barchart } from '#plots/barchart/barchart.ts'
import { hideCategory } from '#plots/barchart/barchart.events.ts'
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

	const api = {} as any
	const testBarchart = new Barchart({}, api)

	test.equal(testBarchart.type, 'barchart', 'Should set type to barchart')
	test.equal(typeof testBarchart.setControls, 'function', 'Should have a .setControls() function')
	test.equal(typeof testBarchart.getState, 'function', 'Should have a .getState() function')
	test.equal(typeof testBarchart.getDataRequestOpts, 'function', 'Should have a .getDataRequestOpts() function')
	test.equal(typeof testBarchart.getDescrStats, 'function', 'Should have a .getDescrStats() function')
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

tape('hideCategory() should key q.hiddenValues by value key', function (test) {
	test.timeoutAfter(100)

	const getHiddenValues = (values, d, isHidden, hiddenValues = {}, type = 'categorical') => {
		const term = { $id: 'abc', id: 't', term: { type, values }, q: { hiddenValues } }
		let config
		const self = { id: 'plot', config: { term }, app: { dispatch: action => (config = action.config) } }
		hideCategory({ type: 'col', ...d }, self, isHidden)
		return config.term.q.hiddenValues
	}

	const notAssessed = 'not assessed'
	const values = {
		1: { key: '1', label: 'Yes' },
		9: { key: '9', label: notAssessed },
		Yes: { label: 'Yes' },
		[notAssessed]: { label: notAssessed }
	}

	test.deepEqual(
		getHiddenValues(values, { id: 'Yes' }, true),
		{ Yes: 1 },
		'Should hide the clicked key, not an earlier key with the same label'
	)
	test.deepEqual(
		getHiddenValues(values, { id: '9' }, true),
		{ 9: 1 },
		'Should hide a code key that shares a label with another key'
	)
	test.deepEqual(
		getHiddenValues(values, { id: notAssessed }, true),
		{ [notAssessed]: 1 },
		'Should only hide the clicked key when two keys share a label'
	)
	test.deepEqual(
		getHiddenValues(values, { id: 'Yes' }, false, { Yes: 1, 9: 1 }),
		{ 9: 1 },
		'Should show the clicked key and leave other hidden keys'
	)
	test.deepEqual(
		getHiddenValues({ '-999': { label: 'unknown' } }, { id: 'unknown' }, true),
		{ '-999': 1 },
		'Should convert a label that is not a value key'
	)
	test.deepEqual(getHiddenValues(undefined, { id: '1-5' }, true), { '1-5': 1 }, 'Should support a term without values')

	const uncomputable = { '-999': { label: '0', uncomputable: true }, 0: { label: 'Not assessed', uncomputable: true } }
	for (const type of ['integer', 'float', 'date']) {
		test.deepEqual(
			getHiddenValues(uncomputable, { id: '0' }, true, {}, type),
			{ '-999': 1 },
			`Should hide the key of a ${type} label that equals another key`
		)
		test.deepEqual(
			getHiddenValues(uncomputable, { id: '0' }, false, { '-999': 1 }, type),
			{},
			`Should show the key of a ${type} label that equals another key`
		)
		test.deepEqual(
			getHiddenValues(uncomputable, { id: 'Not assessed' }, true, {}, type),
			{ 0: 1 },
			`Should hide the key of a ${type} label that is not a key`
		)
		test.deepEqual(
			getHiddenValues(uncomputable, { id: '1 to <5' }, true, {}, type),
			{ '1 to <5': 1 },
			`Should keep a ${type} bin label that has no value key`
		)
	}
	test.deepEqual(
		getHiddenValues(uncomputable, { id: '0' }, true),
		{ 0: 1 },
		'Should prefer the key for a categorical term when a label equals another key'
	)
	test.deepEqual(
		getHiddenValues(uncomputable, { id: '0' }, false, { 0: 1, '-999': 1 }),
		{ '-999': 1 },
		'Should show the clicked key of a categorical term when a label equals another key'
	)

	test.end()
})
