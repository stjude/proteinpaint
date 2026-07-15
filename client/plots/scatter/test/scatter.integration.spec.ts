import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import * as d3s from 'd3-selection'
import { detectLst, detectGte, sleep, Locator } from '../../../test/test.helpers'
import { openSummaryPlot, openPlot, getSamplelstTW } from '../../../mass/groups.js'
import { mclass } from '#shared/common.js'
import {
	getGenesetMutTw,
	getGeneVariantTw,
	getSsgseaTw,
	getScgeneexpTw,
	getScctTw
} from '../../../test/testdata/data.ts'
import {
	state,
	state3D,
	stateDynamicScatter,
	state2geneexp,
	state2ssgsea,
	state2dnameth,
	state3DContour
} from './mockScatterData.ts'

/* Include tests for different term types in this file. 
Please add tests for UI interactions in scatter.ui.integration.spec.ts 

Tests:
    - Invalid colorTW.id
    - Invalid colorTW.term
    - Invalid plot name
    - Render TermdbTest scatter plot and open survival and summary
    - Render TermdbTest scatter plot adding age as Z to render a 3D plot
    - Render 3D plot with age as Z and showContour set to true to apply contour on 3D plot
    - dynamic scatter of agedx & hrtavg
    - dynamic scatter of 2-gene expression
    - dynamic scatter of 2-ssgsea
    - dynamic scatter of 2-dnameth
	- Disco plot and lollipop
    - colorTW=geneVariant with no groupsetting
    - colorTW=geneVariant gene list
    - colorTW=ssgsea
    - Single cell scatter properly renders when colorTW = scct term
    - Single cell scatter properly renders when colorTW = scge term
	- Single cell scatter properly renders when coordTWs [scge TP53, scge KRAS] are provided
*/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

function getHolder() {
	return d3s.select('body').append('div')
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- plots/sampleScatter rendering -***-')
	test.end()
})

tape('Invalid colorTW.id', async function (test) {
	test.timeoutAfter(3000)
	const message = `Should display error for colorTW.id not found within dataset`
	const holder = getHolder()
	const id = 'Not real data'

	try {
		runpp({
			holder,
			state: {
				plots: [
					{
						chartType: 'sampleScatter',
						colorTW: { id },
						name: 'TermdbTest TSNE'
					}
				]
			}
		})

		const errorbar = await detectGte({ elem: holder.node(), selector: '.sja_errorbar' })
		test.equal(errorbar.length, 1, 'Should display only one error message.')
		test.ok(
			errorbar[0].innerText.includes(`missing dictionary term for id=${id}`),
			`Should display, "Error: no term found for ${id} [sampleScatter getPlotConfig()]".`
		)
	} catch (e: any) {
		test.fail(message + ': ' + e)
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Invalid colorTW.term', async function (test) {
	test.timeoutAfter(3000)
	const holder = getHolder()
	const id = 'Not real data'
	try {
		runpp({
			holder,
			state: {
				plots: [
					{
						chartType: 'sampleScatter',
						colorTW: { term: { id } },
						name: 'TermdbTest TSNE'
					}
				]
			}
		})
		const errorbar = await detectGte({ elem: holder.node(), selector: '.sja_errorbar > div:nth-child(2)' })
		const error = 'Error: Error: Type is not defined [sampleScatter getPlotConfig()]'
		test.true(errorbar[0].innerText.startsWith(error), `Should display, "${error}...".`)
	} catch (e: any) {
		test.fail(e)
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Invalid plot name', async function (test) {
	test.timeoutAfter(3000)
	const message = `Should display error for invalid plot name`
	const holder = getHolder()

	try {
		runpp({
			holder,
			state: {
				plots: [
					{
						chartType: 'sampleScatter',
						colorTW: {
							id: 'diaggrp'
						},
						name: 'Not real data'
					}
				]
			}
		})
		const errorbar = await Locator.init(holder.node()).shows('.sja_errorbar').get()
		test.equal(errorbar.length, 1, 'Should display only one error message.')
		test.ok(
			errorbar[0].innerText.includes(`plot not found with plotName`),
			'Should display, "Error: plot not found with plotName: Not real data".'
		)
	} catch (e: any) {
		test.fail(message + ': ' + e)
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Render TermdbTest scatter plot and open survival and summary', function (test) {
	test.timeoutAfter(8000)
	test.plan(7)
	const holder = getHolder()
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		const scatterDiv = scatter.Inner.model.charts[0].chartDiv

		testPlot()
		testLegendTitle()
		const group = await testCreateGroup()
		const tw = getSamplelstTW([group])

		await testOpenSurvivalPlot()
		await testOpenSummaryPlot()

		if (test['_ok']) holder.remove()
		test.end()

		function testPlot() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const numSymbols = serieG.selectAll('path').size()
			test.equal(
				numSymbols,
				scatter.Inner.model.charts[0].data.samples.length,
				`Should be ${scatter.Inner.model.charts[0].data.samples.length}. Rendered ${numSymbols} symbols.`
			)
		}

		function testLegendTitle() {
			const g = scatterDiv.select('.sjpcb-scatter-legend')
			test.true(g != null, 'Should have a legend')
			const texts = g.selectAll('text[data-testid="legendTitle"]')
			test.true(
				texts._groups[0][0].innerHTML.startsWith(scatter.Inner.config.colorTW.term.name),
				'colorTW legend title made'
			)
			test.true(
				texts._groups[0][1].innerHTML.startsWith(scatter.Inner.config.shapeTW.term.name),
				'shapeTW legend title made'
			)
		}

		async function testCreateGroup() {
			const samples = scatterDiv
				.select('.sjpcb-scatter-series')
				.selectAll('path')
				.nodes()
				.filter(p => p.__data__?.category === 'Acute lymphoblastic leukemia')
				.map(path => path.__data__)
			test.equal(samples.length, 36, `Group should have 36 symbols.`)

			const self = scatter.Inner
			const group = {
				name: `Group 1`,
				items: samples,
				index: 0
			}
			self.config.groups.push(group)
			return group
		}

		async function testOpenSurvivalPlot() {
			const plots = scatter.Inner.app.getState().plots
			const elem = scatter.Inner.app.Inner.dom.plotDiv.node()
			const preSandboxes = [...elem.querySelectorAll('.sjpp-sandbox')]
			const sandboxes = await detectLst({
				elem,
				selector: '.sjpp-sandbox',
				count: plots.length + 1,
				async trigger() {
					const survivalTerm = await scatter.Inner.app.vocabApi.getterm('efs')
					await openPlot('survival', survivalTerm, tw, scatter.Inner.app)
				}
			})
			const newSandbox = sandboxes.find(s => !preSandboxes.includes(s))
			test.equal(
				[...newSandbox.querySelectorAll('.sja_errorbar')].filter(b => b.style.display != 'none').length,
				0,
				'Should render survival plot without errors".'
			)
		}

		async function testOpenSummaryPlot() {
			const plots = scatter.Inner.app.getState().plots
			const elem = scatter.Inner.app.Inner.dom.plotDiv.node()
			const preSandboxes = [...elem.querySelectorAll('.sjpp-sandbox')]
			// const survivalTerm = await scatter.Inner.app.vocabApi.getterm('efs')
			const sandboxes = await detectLst({
				elem,
				selector: '.sjpp-sandbox',
				count: plots.length + 1,
				async trigger() {
					const genderTerm = await scatter.Inner.app.vocabApi.getterm('sex')
					await openSummaryPlot(genderTerm, tw, scatter.Inner.app)
				}
			})
			const newSandbox = sandboxes.find(s => !preSandboxes.includes(s))
			test.equal(
				[...newSandbox.querySelectorAll('.sja_errorbar')].filter(b => b.style.display != 'none').length,
				0,
				'Should render summary plot without errors".'
			)
		}
	}
})

tape('Render TermdbTest scatter plot adding age as Z to render a 3D plot', function (test) {
	test.timeoutAfter(8000)
	test.plan(1)
	const holder = getHolder()
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state: state3D,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		const is3D = scatter.Inner.model.is3D
		// const scatterDiv = scatter.Inner.model.charts[0].chartDiv
		test.true(is3D, 'Should be a 3D scatter plot')
		if (test['_ok']) holder.remove()
		test.end()
	}
})

tape('Render 3D plot with age as Z and showContour set to true to apply contour on 3D plot', function (test) {
	test.timeoutAfter(8000)
	test.plan(1)
	const holder = getHolder()
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state: state3DContour,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		const chart = scatter.Inner.model.charts[0]
		await sleep(1000)
		test.true(chart.plane != null, 'Should have a plane with the contour map')
		if (test['_ok']) holder.remove()
		test.end()
	}
})

tape('dynamic scatter of agedx & hrtavg', function (test) {
	test.timeoutAfter(8000)
	test.plan(2)
	const holder = getHolder()
	runpp({
		holder,
		state: stateDynamicScatter,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		// const chart = scatter.Inner.model.charts[0]
		test.true(scatter.Inner.settings.showAxes, 'Dynamic scatter should have axes')
		scatter.Inner.settings.showContour = true
		await scatter.Inner.app.dispatch({
			type: 'plot_edit',
			id: scatter.Inner.id,
			config: { settings: { sampleScatter: scatter.Inner.settings } }
		})
		const contourG = scatter.Inner.model.charts[0].chartDiv.select('g[stroke-linejoin="round"]').node()
		test.true(
			contourG != null,
			'Scatter should have contour showing the density of points after selecting show contour'
		)
		if (test['_ok']) holder.remove()
		test.end()
	}
})

tape('dynamic scatter of 2-gene expression', function (test) {
	const holder = getHolder()
	runpp({
		holder,
		state: state2geneexp,
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		// const chart = scatter.Inner.model.charts[0]
		test.true(scatter.Inner.settings.showAxes, 'Dynamic scatter should have axes')
		if (test['_ok']) holder.remove()
		test.end()
	}
})

tape('dynamic scatter of 2-ssgsea', function (test) {
	const holder = getHolder()
	runpp({
		holder,
		state: state2ssgsea,
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		// const chart = scatter.Inner.model.charts[0]
		test.true(scatter.Inner.settings.showAxes, 'Dynamic scatter should have axes')
		if (test['_ok']) holder.remove()
		test.end()
	}
})

tape('dynamic scatter of 2-dnameth', function (test) {
	const holder = getHolder()
	runpp({
		holder,
		state: state2dnameth,
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		// const chart = scatter.Inner.model.charts[0]
		test.true(scatter.Inner.settings.showAxes, 'Dynamic scatter should have axes')
		if (test['_ok']) holder.remove()
		test.end()
	}
})

tape('Disco plot and lollipop', test => {
	test.timeoutAfter(2000)
	const holder = getHolder()

	runpp({
		holder,
		state: state2ssgsea,
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		const sampleWithMutDataFile = scatter.Inner.dom.mainDiv
			.select('.sjpcb-scatter-series')
			.selectAll('path')
			.filter(d => d.sample === '3416')
			.node()
		const box = sampleWithMutDataFile.getBoundingClientRect()
		sampleWithMutDataFile.dispatchEvent(
			new MouseEvent('click', {
				bubbles: true,
				clientX: box.x + box.width / 2,
				clientY: box.y + box.height / 2
			})
		)
		const chordTexts = await detectGte({
			elem: holder.node(),
			selector: '.chord-text',
			count: 1,
			trigger: () => {
				scatter.Inner.dom.tooltip.d
					.selectAll('button')
					.filter(function (this: any) {
						return this.innerHTML == 'Disco'
					})
					.node()
					.click()
			}
		})
		const label = [...chordTexts].find(c => c.__data__?.text === 'TP53')

		if (!label) {
			test.fail('must have a TP53 gene label')
		} else {
			const trackLabelsG = await detectGte({
				elem: holder.node(),
				selector: '[data-testid="sja_sample_menu_opener"]',
				count: 2,
				trigger: () => {
					label.dispatchEvent(new MouseEvent('click'))
				}
			})

			await sleep(500)
			const trackLabels = [...trackLabelsG[0].querySelectorAll('text')]
			test.equal(
				trackLabels.filter(t => t.innerHTML.includes('unknown data source')).length,
				0,
				'must not have an error after clicking a Disco plot gene label to launch a genome browser track'
			)
			if (test['_ok']) holder.remove()
			test.end()
		}
	}
})

tape('colorTW=geneVariant with no groupsetting', function (test) {
	test.timeoutAfter(6000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					name: 'TermdbTest TSNE',
					colorTW: { term: { gene: 'TP53', name: 'TP53', type: 'geneVariant' } }
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		test.true(
			dots.find(dot => dot.getAttribute('fill') == mclass['M'].color),
			'At least a sample with MISSENSE color was expected'
		)
		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('colorTW=geneVariant with groupsetting', function (test) {
	test.timeoutAfter(6000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					name: 'TermdbTest TSNE',
					colorTW: getGeneVariantTw()
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		const lab = 'TP53 SNV/indel Mutated (somatic)'
		test.true(
			dots.find(d => d.__data__.category == lab),
			`A dot with category=${lab}`
		)
		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('colorTW=geneVariant with gene list', function (test) {
	test.timeoutAfter(6000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					name: 'TermdbTest TSNE',
					colorTW: getGenesetMutTw()
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		const lab = 'TP53, KRAS, AKT1, BCR SNV/indel Mutated (somatic)'
		test.true(
			dots.find(d => d.__data__.category == lab),
			`A dot with category=${lab}`
		)
		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('colorTW=ssgsea', function (test) {
	test.timeoutAfter(6000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					name: 'TermdbTest TSNE',
					colorTW: getSsgseaTw()
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		test.true(
			dots.find(d => Number.isFinite(d.__data__.category)),
			`A dot with category=number`
		)
		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('Single cell scatter properly renders when colorTW = scct term', function (test) {
	test.timeoutAfter(6000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: getScctTw(),
					singleCellPlot: { name: 'UMAP', sample: { sID: '1_patient' } }
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		test.true(dots.length, 'some dots are loaded from singlecell map')
		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('Single cell scatter properly renders when colorTW = scge term', function (test) {
	runpp({
		state: {
			nav: { header_mode: 'hidden' },
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: getScgeneexpTw(),
					singleCellPlot: { name: 'UMAP', sample: { sID: '1_patient' } }
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		test.true(dots.length, 'some dots are loaded from singlecell map')
		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('Single cell scatter properly renders when coordTWs [scge TP53, scge KRAS] are provided', function (test) {
	runpp({
		state: {
			nav: { header_mode: 'hidden' },
			plots: [
				{
					chartType: 'sampleScatter',
					term: getScgeneexpTw('TP53'),
					term2: getScgeneexpTw(),
					singleCellPlot: { name: 'UMAP', sample: { sID: '1_patient' } }
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		test.true(dots.length, 'some dots are loaded from singlecell map')

		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}
})
