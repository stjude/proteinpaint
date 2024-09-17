import tape from 'tape'
import * as d3s from 'd3-selection'
import * as helpers from '../../test/front.helpers.js'
import { sleep, detectLst, detectOne, detectZero, whenHidden, whenVisible, detectGte } from '../../test/test.helpers'

// run this test at http://localhost:3000/testrun.html?name=genomeBrowser

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
		p.snvindel = { details: { groups } }
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
		test.equal(gb.Inner.blockInstance.tklst.length, 2, 'Block has 2 tracks')
		const tk = gb.Inner.blockInstance.tklst.find(i => i.type == 'mds3')
		test.ok(tk, 'One of the track is mds3')
		test.ok(tk.custom_variants.length > 0, 'Many variants are found in mds3 tk')
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
					term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical' },
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
					term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical' },
					values: [{ key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }]
				}
			},
			{
				type: 'tvs',
				tvs: { term: { id: 'sex', name: 'Sex', type: 'categorical' }, values: [{ key: '1', label: 'Male' }] }
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
tape('\n', function (test) {
	test.pass('-***- mass/genomeBrowser -***-')
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
								term: { id: 'diaggrp' },
								values: [{ key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }]
							}
						},
						{
							type: 'tvs',
							tvs: {
								term: { id: 'agedx', name: 'agedx', type: 'float' },
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
