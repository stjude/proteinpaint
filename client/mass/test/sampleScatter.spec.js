import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import * as d3s from 'd3-selection'

/* Launch from http://localhost:3000/testrun.html?name=sampleScatter */

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

const runpp = helpers.getRunPp('mass', {
	state: {
		vocab: {
			dslabel: 'PNET',
			genome: 'hg19'
		}
	},
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

const state = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'TSNE Category' },
			name: 'Methylome TSNE'
		}
	]
}

const open_state = {
	nav: { header_mode: 'hide_search' },
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'TSNE Category' },
			name: 'Methylome TSNE'
		}
	]
}

const groupState = {
	nav: { header_mode: 'hide_search' },
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: {
				id: 'TSNE Category'
			},
			name: 'Methylome TSNE',
			groups: [
				{
					name: 'Test group 1',
					items: [
						{
							sample: 'SJPNET076946_D1',
							x: -99.19282566,
							y: 71.65188517,
							sampleId: 15,
							category_info: {},
							hidden: {
								category: false
							},
							category: 'HGNET_BCOR',
							shape: 'Ref'
						},
						{
							sample: 'SJBT030377_R1',
							x: -103.141543,
							y: 73.31223702,
							sampleId: 55,
							category_info: {},
							hidden: {
								category: false
							},
							category: 'HGNET_BCOR',
							shape: 'Ref'
						}
					],
					index: 1
				},
				{
					name: 'Test group 2',
					items: [
						{
							sample: 'SJBT032267_D1',
							x: -99.54217082,
							y: 72.48937409,
							sampleId: 21,
							category_info: {},
							hidden: {
								category: false
							},
							category: 'HGNET_BCOR',
							shape: 'Ref'
						},
						{
							sample: 'SJBT030377_R1',
							x: -103.141543,
							y: 73.31223702,
							sampleId: 55,
							category_info: {},
							hidden: {
								category: false
							},
							category: 'HGNET_BCOR',
							shape: 'Ref'
						}
					],
					index: 2
				}
			]
		}
	]
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- mass/sampleScatter -***-')
	test.end()
})

tape('PNET plot + filter + colorTW=gene', function (test) {
	test.timeoutAfter(3000)
	test.plan(1)
	const s2 = JSON.parse(JSON.stringify(state))
	s2.termfilter = {
		filter: {
			type: 'tvslst',
			join: '',
			in: true,
			lst: [{ type: 'tvs', tvs: { term: { id: 'Gender' }, values: [{ key: 'M', label: 'Male' }] } }]
		}
	}
	s2.plots[0].colorTW = { term: { type: 'geneVariant', name: 'TP53', gene: 'TP53' } }

	runpp({
		state: s2,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		testPlot()

		if (test._ok) scatter.Inner.app.destroy()
		test.end()

		function testPlot() {
			const scatterDiv = scatter.Inner.model.charts[0].chartDiv
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const numSymbols = serieG.selectAll('path').size()
			console.log(numSymbols == scatter.Inner.model.charts[0].data.samples.length)
			test.true(
				numSymbols == scatter.Inner.model.charts[0].data.samples.length,
				`Should be ${scatter.Inner.model.charts[0].data.samples.length}. Rendered ${numSymbols} symbols.`
			)
		}
	}
})

tape.skip('Add shape, clicking term and replace by search', function (test) {
	test.timeoutAfter(8000)

	runpp({
		state: open_state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	const origTerm = 'TSNE Category'
	const testTerm = 'Mutational Burden'

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		//by click
		await sleep(500)
		triggerAddBtn(scatter)
		await sleep(300)
		triggerPillChange()
		await sleep(100)
		testShapeRendering(scatter, testTerm)

		//by search
		await sleep(500)
		triggerShapeReplace()
		await sleep(300)
		changeShapeBySearch()
		await sleep(100)
		testShapeRendering(scatter, origTerm)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function triggerAddBtn(scatter) {
		const addBtn = scatter.Inner.view.dom.controls
			.selectAll('div')
			.nodes()
			.find(c => c.style.display == 'block' && c?.childNodes[1]?.innerHTML == '+')
		addBtn.dispatchEvent(new Event('click'))
	}

	function triggerPillChange() {
		d3s
			.selectAll('.ts_pill')
			.filter(d => d.name == testTerm)
			.node()
			.click()
	}

	function testShapeRendering(scatter, term) {
		const shapeLegend = scatter.Inner.model.charts[0].chartDiv
			.selectAll('g')
			.nodes()
			.find(c => c?.childNodes[0].innerHTML == term)
		let groups = []
		for (const [i, group] of shapeLegend.childNodes.entries()) {
			if (i == 0) continue //exclude header text
			const label = group.childNodes[1].innerHTML.split(',')
			groups.push({
				label: label[0],
				samples: label[1].match(/[\d\.]+/g) //Maybe test all samples rendered?
			})
		}
		test.ok(
			scatter.Inner.shapeLegend.size == groups.length + 1,
			`Legend categories (# = ${groups.length + 1}) should equal size of shapeLegend (# = ${
				scatter.Inner.shapeLegend.size
			}) `
		)
		compareData2DOMLegend(scatter, groups)
	}
	function compareData2DOMLegend(scatter, groups) {
		for (const group of groups) {
			const mapLeg = scatter.Inner.shapeLegend.get(group.label)
			test.ok(
				mapLeg.sampleCount == group.samples[0],
				`Should show matching n = ${mapLeg.sampleCount} for ${group.label}. Legend: n = ${group.samples[0]}`
			)
		}
	}

	function triggerShapeReplace() {
		d3s
			.selectAll('.ts_pill')
			.filter(d => d.name == testTerm)
			.node()
			.click()

		d3s
			.selectAll('.sja_sharp_border')
			.filter(d => d.label == 'Replace')
			.node()
			.click()
	}

	async function changeShapeBySearch() {
		const termSearchDiv = d3s
			.selectAll('.tree_search')
			.nodes()
			.find(e => e.placeholder.endsWith('genes'))
		termSearchDiv.value = origTerm
		termSearchDiv.dispatchEvent(new Event('input'))
		await sleep(1000)

		d3s
			.selectAll('.sja_tree_click_term')
			.filter(d => d.name == origTerm)
			.node()
			.click()
	}
})
