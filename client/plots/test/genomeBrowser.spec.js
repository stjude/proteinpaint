import tape from 'tape'
import * as d3s from 'd3-selection'
import * as helpers from '../../test/front.helpers.js'
import { detectGt, detectOne } from '../../test/test.helpers'

/********************************************
 TEST SECTIONS

sjlife default setting
Sjlife default, with global mass filter

Two groups: filter + population
Two groups: filter + info
Two groups: filter + filter
Two groups: info + info
Two groups: population + poulation
Two groups: info + poulation

Single group: population
Single group: filter
Single group: info

********************************************/

/****************************************************
NOTE: cannot convert this to integration test because
these tests use SJLIFE as dataset
*****************************************************/

tape('\n', function (test) {
	test.comment('-***- plots/genomeBrowser -***-')
	test.end()
})

// callback must not be async as that somehow will not allow test to work
tape('sjlife default setting', test => {
	const holder = getHolder()
	runpp({
		holder,
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Sjlife default, with global mass filter', test => {
	const holder = getHolder()
	runpp({
		holder,
		state: {
			termfilter: {
				filter: {
					type: 'tvslst',
					join: 'and',
					in: true,
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: { id: 'diaggrp_s' },
								values: [{ key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }]
							}
						},
						{
							type: 'tvs',
							tvs: {
								term: { id: 'agedx_s', name: 'agedx', type: 'float' },
								ranges: [{ startunbounded: true, stop: 10, stopinclusive: true }]
							}
						}
					]
				}
			}
		},
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Two groups: filter + population', test => {
	const holder = getHolder()
	const p = getPlot([groupFilterAML, groupPopulation1])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Two groups: filter + info', test => {
	const holder = getHolder()
	const p = getPlot([groupFilterAML, groupInfo1])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Two groups: filter + filter', test => {
	const holder = getHolder()
	const p = getPlot([groupFilterAML, groupFilterALLmale])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Two groups: info + info', test => {
	const holder = getHolder()
	const p = getPlot([groupInfo1, groupInfo2])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Two groups: info + poulation', test => {
	const holder = getHolder()
	const p = getPlot([groupInfo1, groupPopulation1])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Two groups: population + poulation', test => {
	const holder = getHolder()
	const p = getPlot([groupPopulation1, groupPopulation2])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

tape('Single group: population', test => {
	const holder = getHolder()
	const p = getPlot([groupPopulation1])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})
tape('Single group: filter', test => {
	const holder = getHolder()
	const p = getPlot([groupFilterALLmale])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})
tape('Single group: info', test => {
	const holder = getHolder()
	const p = getPlot([groupInfo1])
	runpp({
		holder,
		state: { plots: [p] },
		genomeBrowser: { callbacks: { 'postRender.test': runTests(test, holder) } }
	})
})

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

function getPlot(groups) {
	const p = {
		chartType: 'genomeBrowser',
		geneSearchResult: { chr: 'chr10', start: 61901683, stop: 62096944 }
	}
	if (groups) {
		p.snvindel = {
			details: {
				groups,
				groupTestMethods: [
					{ name: 'Allele frequency difference' },
					{ name: "Fisher's exact test", axisLabel: '-log10(pvalue)' }
				],
				groupTestMethodsIdx: 1
			}
		}
	}
	return p
}

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: { dslabel: 'SJLife', genome: 'hg38' },
		plots: [getPlot()]
	},
	debug: 1
})

// reusable tester to return postRender callback that scopes "test" and "holder"
function runTests(test, holder) {
	return async gb => {
		// gb{} is the genomebrowser plot instance
		const div = gb.Inner.dom.holder
		const blockDiv = await detectOne({ elem: div.node(), selector: '.sja_Block_div' })
		test.ok(blockDiv, 'Block div is rendered')
		const tklst = blockDiv.querySelectorAll('[data-testid="sja_sample_menu_opener"]')
		test.equal(tklst.length, 2, 'Block has 2 tracks')
		const variantTk = tklst[0]
		const variants = await detectGt({ elem: variantTk, selector: '.sja_aa_discg' })
		test.ok(variants.length > 0, 'Should render variants in variants track')
		if (test._ok) holder.remove()
		test.end()
	}
}

// reusable groups

const groupFilterAML = {
	type: 'filter',
	filter: {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diaggrp_s', name: 'Diagnosis Group', type: 'categorical' },
					values: [{ key: 'Acute myeloid leukemia', label: 'Acute myeloid leukemia' }]
				}
			}
		]
	}
}
const groupFilterALLmale = {
	type: 'filter',
	filter: {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'diaggrp_s', name: 'Diagnosis Group', type: 'categorical' },
					values: [{ key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }]
				}
			},
			{
				type: 'tvs',
				tvs: { term: { id: 'sex_s', name: 'Sex', type: 'categorical' }, values: [{ key: '1', label: 'Male' }] }
			}
		]
	}
}

const groupPopulation1 = {
	type: 'population',
	key: 'gnomAD',
	label: 'gnomAD',
	allowto_adjust_race: true,
	adjust_race: true
}
const groupPopulation2 = {
	type: 'population',
	key: 'TOPMed',
	label: 'TOPMed',
	allowto_adjust_race: true,
	adjust_race: true
}

const groupInfo1 = { type: 'info', infoKey: 'AF_sjlife' }
const groupInfo2 = { type: 'info', infoKey: 'gnomAD_AF' }
