import tape from 'tape'
// import * as d3s from 'd3-selection'
// import * as helpers from '../../test/front.helpers.js'
import { Barchart } from '#plots/barchart/barchart.ts'
import { hideCategory, addGvRowVals, addGvCols } from '#plots/barchart/barchart.events.ts'
// import { detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    - Default barchart component
    - addGvRowVals() lists the mutations of a term over a region, with the gene of each
    - addGvCols() names the columns of a region or a gene set Gene and Mutation
    - addGvRowVals() lists the mutations of each gene of a gene set
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

tape('setExclude() should handle terms without a values dictionary', function (test) {
	test.timeoutAfter(100)

	const testBarchart = new Barchart({}, {} as any) as any
	testBarchart.settings = { exclude: {}, cols: [], rows: [] }
	// a termCollection overlay has bin labels as hiddenValues keys but no term.values
	const term = { term: { type: 'categorical', values: {} }, q: {} }
	const term2 = { term: { type: 'termCollection' }, q: { hiddenValues: { '>0.8': 1 } } }
	testBarchart.setExclude(term, term2)
	test.deepEqual(testBarchart.settings.exclude.rows, ['>0.8'], 'Should exclude the hidden overlay bin label')
	testBarchart.setExclude({ term: { type: 'termCollection' }, q: { hiddenValues: { '<0.8': 1 } } }, null)
	test.deepEqual(testBarchart.settings.exclude.cols, ['<0.8'], 'Should exclude the hidden term1 bin label')
	test.end()
})

tape('addGvRowVals() lists the mutations of a term over a region, with the gene of each', function (test) {
	// as restored from a server response: a value found through a region records it, with no
	// gene of a query entry, and the gene that the variant is annotated to when there is one
	const region = { chr: 'chr12', start: 25205245, stop: 25250936 }
	const name = 'chr12:25205246-25250936'
	const tw = { $id: 'gv', term: { genes: [{ kind: 'coord', ...region, id: name, name }] } }
	const sample = {
		gv: {
			values: [
				{ dt: 1, class: 'M', mname: 'A59T', region, annotatedGene: 'KRAS' },
				{ dt: 1, class: 'M', mname: 'chr12:25210000:A>G', region }
			]
		}
	}
	const row: any[] = []
	addGvRowVals(sample, tw, row, undefined)
	test.equal(row.length, 2, 'Should add a gene column and a mutation column')
	test.equal(row[0].html, 'KRAS<br>', 'Should list the annotated gene of each mutation, blank when it has none')
	const mutations = row[1].html.split('<br>')
	test.ok(mutations[0].includes('A59T'), 'Should list the mutation on the line of its gene')
	test.ok(mutations[1].includes('chr12:25210000:A&gt;G'), 'Should list a mutation with no annotated gene')
	test.end()
})

tape('addGvCols() names the columns of a region or a gene set Gene and Mutation', function (test) {
	const geneAndMutation = [{ label: 'Gene' }, { label: 'Mutation' }]
	const cols = tw => {
		const columns: any[] = []
		addGvCols(tw, columns)
		return columns
	}

	const region = { kind: 'coord', chr: 'chr12', start: 25205245, stop: 25250936 }
	test.deepEqual(cols({ term: { name: 'chr12:25205246-25250936', genes: [region] } }), geneAndMutation, 'for a region')

	const genes = [
		{ kind: 'gene', gene: 'TP53', name: 'TP53' },
		{ kind: 'gene', gene: 'KRAS', name: 'KRAS' }
	]
	// the bi/mono-allelic groupset spans two dts, so it has .dts rather than a .dt to name it by
	const groupsetting = {
		lst: [
			{ name: 'SNV/indel', dt: 1 },
			{ name: 'Bi/mono-allelic', dts: [1, 4] }
		]
	}
	const geneSet = q => ({ term: { name: 'my set', genes, groupsetting }, q })
	for (const [q, which] of [
		[{ type: 'predefined-groupset', predefined_groupset_idx: 0 }, 'of a single dt'],
		[{ type: 'predefined-groupset', predefined_groupset_idx: 1 }, 'of two dts'],
		[{ type: 'custom-groupset', customset: { groups: [] } }, 'that is custom']
	] as const) {
		test.deepEqual(cols(geneSet(q)), geneAndMutation, `for a gene set with a groupset ${which}`)
	}

	test.deepEqual(
		cols({ term: { name: 'KRAS', genes: [{ kind: 'gene', gene: 'KRAS', name: 'KRAS' }] } }),
		[{ label: 'KRAS' }],
		'for a single gene, a mutation column named by the gene'
	)
	test.end()
})

tape('addGvRowVals() lists the mutations of each gene of a gene set', function (test) {
	const tw = {
		$id: 'gv',
		term: {
			genes: [
				{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53' },
				{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS' }
			]
		}
	}
	const sample = {
		gv: {
			values: [
				// a gene's value may also record the region the gene was mapped to
				{ dt: 1, class: 'M', mname: 'G12D', gene: 'KRAS', region: { chr: 'chr12', start: 1, stop: 2 } },
				{ dt: 1, class: 'M', mname: 'R175H', gene: 'TP53' }
			]
		}
	}
	const row: any[] = []
	addGvRowVals(sample, tw, row, undefined)
	test.equal(row[0].html, 'TP53<br>KRAS', 'Should add a gene column in the order of term.genes[]')
	const mutations = row[1].html.split('<br>')
	test.ok(mutations[0].includes('R175H'), 'Should list the TP53 mutation in the TP53 row')
	test.ok(mutations[1].includes('G12D'), 'Should list the KRAS mutation in the KRAS row')
	test.end()
})
