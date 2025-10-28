import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import * as d3color from 'd3-color'
import * as d3s from 'd3-selection'
import {
	detectLst,
	detectStyle,
	detectAttr,
	detectChildAttr,
	detectChildStyle,
	detectGte,
	sleep
} from '../../../test/test.helpers'
import { openSummaryPlot, openPlot, getSamplelstTW } from '../../../mass/groups.js'
import { rgb } from 'd3-color'
import { mclass } from '#shared/common.js'
import {
	getSamplelstTw,
	getCategoryGroupsetting,
	getGenesetMutTw,
	getGeneVariantTw,
	getSsgseaTw
} from '../../../test/testdata/data.ts'

/*
Tests:
	Render TermdbTest scatter plot and open survival and summary
	Render TermdbTest scatter plot adding age as Z to render a 3D plot
	Render 3D plot with age as Z and showContour set to true to apply contour on 3D plot
	dynamic scatter of agedx & hrtavg
	Invalid colorTW.id
	Invalid colorTW.term
	Invalid plot name
	Test legend
	Render color groups
	Change symbol and reference size from menu
	Change chart width and height from menu
	Check/uncheck Show axes from menu
	Click zoom in, zoom out, and reset buttons
	Groups and group menus function
	colorTW=geneVariant with no groupsetting
	colorTW=geneVariant gene list
	colorTW=ssgsea
	singlecell

todo
	dynamic scatter of two gene exp
	dynamic scatter of two ssgsea
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

const state = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE'
		}
	]
}

const open_state = {
	nav: { header_mode: 'hide_search' },
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE'
		}
	]
}

const state3D = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE',
			term0: { id: 'agedx', q: { mode: 'continuous' } }
		}
	]
}

const stateDynamicScatter = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE',
			term: { id: 'agedx', q: { mode: 'continuous' } },
			term2: { id: 'hrtavg', q: { mode: 'continuous' } }
		}
	]
}

const state3DContour = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE',
			term0: { id: 'agedx', q: { mode: 'continuous' } },
			settings: { sampleScatter: { showContour: true } }
		}
	]
}

const groups = [
	{
		name: 'Test group 1',
		items: [
			{
				sample: '2646',
				x: -103.141543,
				y: 73.31223702,
				sampleId: 41,
				category_info: {},
				hidden: {
					category: false
				},
				category: '"Acute lymphoblastic leukemia"',
				shape: 'Ref'
			},
			{
				sample: '2800',
				x: -99.20065673,
				y: 73.64971694,
				sampleId: 52,
				category_info: {},
				hidden: {
					category: false
				},
				category: '"Acute lymphoblastic leukemia"',
				shape: 'Ref'
			}
		],
		index: 1
	}
]

function getHolder() {
	return d3s.select('body').append('div')
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- plots/sampleScatter -***-')
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

		if (test._ok) holder.remove()
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
			test.equal(newSandbox.querySelectorAll('.sja_errorbar').length, 0, 'Should render survival plot without errors".')
		}

		async function testOpenSummaryPlot() {
			const plots = scatter.Inner.app.getState().plots
			const elem = scatter.Inner.app.Inner.dom.plotDiv.node()
			const preSandboxes = [...elem.querySelectorAll('.sjpp-sandbox')]
			const survivalTerm = await scatter.Inner.app.vocabApi.getterm('efs')
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
			test.equal(newSandbox.querySelectorAll('.sja_errorbar').length, 0, 'Should render summary plot without errors".')
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
		const scatterDiv = scatter.Inner.model.charts[0].chartDiv
		test.true(is3D, 'Should be a 3D scatter plot')
		if (test._ok) holder.remove()
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
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('dynamic scatter of agedx & hrtavg', function (test) {
	test.timeoutAfter(8000)
	test.plan(2)
	const holder = getHolder()
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state: stateDynamicScatter,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		const chart = scatter.Inner.model.charts[0]
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
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Show tooltip for sample', function (test) {
	test.timeoutAfter(8000)
	test.plan(2)
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
		scatter.on('postRender.test', null)
		const chart = scatter.Inner.model.charts[0]
		const sample = groups[0].items[0]
		scatter.Inner.vm.scatterTooltip.showSampleTooltip(sample, 100, 100, chart)
		const tooltipDiv = scatter.Inner.view.dom.tooltip.d.node()
		const tree = scatter.Inner.vm.scatterTooltip.tree
		const parentNode = tree.find(n => n.id == 'Acute lymphoblastic leukemia' && n.samples.length == 3)
		test.true(parentNode != null, 'Tooltip should have 3 samples for Acute lymphoblastic leukemia')
		test.true(tooltipDiv != null, 'Tooltip should be shown')
		scatter.Inner.view.dom.tooltip.hide()
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Test scale dot', function (test) {
	test.timeoutAfter(8000)
	test.plan(2)
	const holder = getHolder()
	const state = {
		plots: [
			{
				chartType: 'sampleScatter',
				scaleDotTW: { id: 'agedx', q: { mode: 'continuous' } },
				name: 'TermdbTest TSNE'
			}
		]
	}
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
		scatter.on('postRender.test', null)
		const self = scatter.Inner
		const chart = scatter.Inner.model.charts[0]
		const dots = self.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		const minSize = (self.settings.minShapeSize * self.zoom) / 3

		const maxSize = (self.settings.maxShapeSize * self.zoom) / 3 //original icons are scaled to 0.3

		test.true(
			dots.find(dot => dot.getAttribute('transform').includes(`scale(${minSize})`)) != null,
			`Dots with the minimum size should be found`
		)
		test.true(
			dots.find(dot => dot.getAttribute('transform').includes(`scale(${maxSize})`)) != null,
			`Dots with the maximum size should be found`
		)
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Test lasso menus options', function (test) {
	test.timeoutAfter(8000)

	runpp({
		state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await triggerLassoMenu(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function triggerLassoMenu(scatter) {
		/* Menu appears in the upper left corner instead of under groups button.
        This is expected. No x/y coord is provided to orient the menu 
        under the groups button. */
		const group = groups[0]
		scatter.Inner.vm.scatterLasso.showLassoMenu(new PointerEvent('click'), group.items)
		const groupsMenu = scatter.Inner.view.dom.tip.d.selectAll('div.sja_menuoption').nodes()
		const options = ['List 2 samples', 'Add to a group', 'Add to a group and filter', 'Open sample view']
		for (const [i, node] of Object.entries(groupsMenu)) {
			const option = node.innerText
			test.equal(option, options[i], `Should display ${option} in the menu`)
		}
		//Create group and add checks

		scatter.Inner.vm.scatterLasso.showTable(group, 0, 0, false)
		testSampleTable(scatter, group)
		groupsMenu[1].click()
		await sleep(1000)
		test.equal(scatter.Inner.state.groups.length, 1, `Should create a group in mass state`)
		groupsMenu[2].click()
		await sleep(1000)
		test.equal(scatter.Inner.state.groups.length, 2, `Should create another group in mass state`)
		test.true(
			scatter.Inner.state.termfilter?.filter?.lst[1]?.lst[0]?.tvs?.term.type == 'samplelst',
			`Should create a samplelst filter in mass state`
		)
	}

	function testSampleTable(scatter, group) {
		const samplesRendered = scatter.Inner.view.dom.tip.d.selectAll('.sjpp_row_wrapper > td:nth-child(4)').nodes()
		const samples2Check = []
		for (const item of samplesRendered) {
			samples2Check.push(item.innerHTML)
		}

		//Check every sample in group renders in sample table
		let foundSamples = 0
		for (const sampleData of group.items) {
			if (samples2Check.some(d => d == sampleData.sample)) ++foundSamples
			else test.fail(`Sample = ${sampleData.sample} is not displayed in sample table`)
		}
		test.equal(samples2Check.length, foundSamples, `Should render all samples for ${group.name}`)

		scatter.Inner.view.dom.tip.hide()
	}
})

// tape('Test continuous mode with age color', function (test) {
// 	test.timeoutAfter(8000)
// 	test.plan(4)
// 	const holder = getHolder()
// 	const state = {
// 		plots: [
// 			{
// 				chartType: 'sampleScatter',
// 				colorTW: { id: 'agedx', q: { mode: 'continuous' } },
// 				name: 'TermdbTest TSNE'
// 			}
// 		]
// 	}
// 	runpp({
// 		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
// 		state,
// 		sampleScatter: {
// 			callbacks: {
// 				'postRender.test': runTests
// 			}
// 		}
// 	})

// 	async function runTests(scatter) {
// 		scatter.on('postRender.test', null)

// 		const self = scatter.Inner
// 		const chart = scatter.Inner.model.charts[0]
// 		const startColor = self.config.startColor[chart.id]
// 		const stopColor = self.config.stopColor[chart.id]
// 		test.true(startColor == chart.startRect.style('fill'), `The start color rect should be ${startColor}`)
// 		test.true(stopColor == chart.stopRect.style('fill'), `The stop color rect should be ${stopColor}`)
// 		let color = rgb('green').toString()
// 		let matched = await detectChildAttr({
// 			elem: scatter.Inner.view.dom.mainDiv.node(),
// 			selector: '.sjpcb-scatter-series > path',
// 			observe: {
// 				attributeFilter: ['fill']
// 			},
// 			trigger: () => self.changeGradientColor(chart, 'startColor', chart.startRect, color),
// 			matcher(mutations) {
// 				return mutations.filter(m => m.target.getAttribute('fill') == color)
// 			}
// 		})
// 		test.true(matched.length > 0, `Should render at least one sample with start color ${color}`)
// 		color = rgb('red').toString()
// 		matched = await detectChildAttr({
// 			elem: scatter.Inner.view.dom.mainDiv.node(),
// 			selector: '.sjpcb-scatter-series > path',
// 			observe: {
// 				attributeFilter: ['fill']
// 			},
// 			trigger: () => self.changeGradientColor(chart, 'stopColor', chart.stopRect, color),
// 			matcher(mutations) {
// 				return mutations.filter(m => m.target.getAttribute('fill') == color)
// 			}
// 		})
// 		test.true(matched.length > 0, `Should render at least one sample with stop color ${color}`)
// 		if (test._ok) holder.remove()
// 		test.end()
// 	}
// })

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
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	if (test._ok) holder.remove()
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
	} catch (e) {
		test.fail(e)
	}

	if (test._ok) holder.remove()
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
		const errorbar = await detectGte({ elem: holder.node(), selector: '.sja_errorbar' })
		test.equal(errorbar.length, 1, 'Should display only one error message.')
		test.ok(
			errorbar[0].innerText.includes(`plot not found with plotName`),
			'Should display, "Error: plot not found with plotName: Not real data".'
		)
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Test legend', function (test) {
	test.timeoutAfter(6000) //Fix for breaking on local CI but maynot be necessary for nightly build

	runpp({
		state: structuredClone(state),
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		const samples = scatter.Inner.model.charts[0].data.samples
		const scatterDiv = scatter.Inner.model.charts[0].chartDiv

		await testHideCategory(scatter, samples)
		await testChangeColor(scatter, samples)
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function testHideCategory(scatter, samples) {
		const key = 'Acute lymphoblastic leukemia'
		const expectedNum = samples.filter(s => s.category === key).length

		const matched = await detectChildStyle({
			elem: scatter.Inner.view.dom.mainDiv.node(),
			selector: '.sjpcb-scatter-series > path',
			style: {
				fillOpacity: '0'
			},
			count: expectedNum,
			trigger: () => {
				const chart = scatter.Inner.model.charts[0]
				scatter.Inner.vm.legendvm.legendInteractivity.hideCategory(scatter.Inner.config.colorTW, key, true)
				scatter.Inner.app.dispatch({
					type: 'plot_edit',
					id: scatter.Inner.id,
					config: { colorTW: scatter.Inner.config.colorTW }
				})
			}
			/* example of a custom matcher, instead of opts.style
            matcher(mutations, observer) {
                const hidden = mutations.filter(m => m.target.__data__.category == key && m.target.style.fillOpacity == '0')
                if (hidden.length >= expectedNum) return hidden.map(d => d.target)
            }*/
		})
		test.equal(
			matched.filter(t => t.__data__.category == key).length,
			expectedNum,
			`Should remove all samples with category = ${key}`
		)
	}

	async function testChangeColor(scatter, samples) {
		const key = 'Wilms tumor'
		const color = 'blue'
		const expectedColor = d3color.rgb(color).toString()
		const expectedNum = samples.filter(s => s.category === key).length
		const targets = await detectChildAttr({
			elem: scatter.Inner.view.dom.mainDiv.node(),
			selector: '.sjpcb-scatter-series > path',
			observe: {
				attributeFilter: ['fill']
			},
			/* example of opts.attr, instead of opts.matcher()
            attr: {
                // key is name of attribute, value can be a string, number, or function
                fill: value => {
                    return d3color.rgb(value).toString() === expectedColor
                }
            },*/
			count: expectedNum,
			trigger: async () => {
				scatter.Inner.vm.legendvm.legendInteractivity.changeColor(key, color)
			},
			// example of a custom matcher, instead of opts.attr{}
			matcher(mutations) {
				const targets = mutations.filter(m => d3color.rgb(m.target.getAttribute('fill')) == expectedColor)
				if (targets.length >= expectedNum) return targets.map(d => d.target)
			}
		})

		test.equal(targets.length, 2, `Should change the color of the category = ${key} to blue`)
	}
})

tape('Render color groups', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'genetic_race',
						q: {
							customset: {
								groups: [
									{
										name: 'non-Asian Ancestry',
										type: 'values',
										values: [
											{ key: 'European Ancestry', label: 'European Ancestry' },
											{ key: 'African Ancestry', label: 'African Ancestry' },
											{ key: 'Multi-Ancestry-Admixed', label: 'Multi-Ancestry-Admixed' }
										]
									},
									{
										name: 'Asian Ancestry',
										type: 'values',
										values: [{ key: 'Asian Ancestry', label: 'Asian Ancestry' }]
									}
								]
							}
						}
					},
					name: 'TermdbTest TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await testColorLegend(scatter)
		await changeColorGroups(scatter)
		await testColorLegend(scatter)
		// await removeColorGroups(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function testColorLegend(scatter) {
		const legendLabels = await detectGte({
			elem: scatter.Inner.model.charts[0].chartDiv.node(),
			selector: 'text[name="sjpp-scatter-legend-label"]'
		})

		const groups = []
		for (const group of legendLabels) {
			const label = group.innerHTML.split(',')
			groups.push({
				label: label[0],
				samples: label[1].match(/[\d\.]+/g)
			})
		}
		test.equal(
			scatter.Inner.model.charts[0].colorLegend.size,
			groups.length + 1,
			`Legend categories (# = ${groups.length + 1}) should equal size of colorLegend (# = ${
				scatter.Inner.model.charts[0].colorLegend.size
			}) `
		)
		compareData2DOMLegend(scatter, groups)
	}

	function compareData2DOMLegend(scatter, groups) {
		for (const group of groups) {
			const mapLeg = scatter.Inner.model.charts[0].colorLegend.get(group.label)
			test.ok(mapLeg, `Should display group custom label = ${group.label} in legend`)
			test.equal(
				`${mapLeg.sampleCount}`,
				group.samples[0],
				`Should show matching n = ${group.samples[0]} for ${group.label}`
			)
		}
	}

	async function changeColorGroups(scatter) {
		scatter.Inner.config.colorTW.q.customset = {
			groups: [
				{
					name: 'European Ancestryy',
					type: 'values',
					values: [{ key: 'European Ancestry', label: 'European Ancestry' }]
				},
				{
					name: 'non-European Ancestry',
					type: 'values',
					values: [
						{ key: 'Asian Ancestry', label: 'Asian Ancestry' },
						{ key: 'African Ancestry', label: 'African Ancestry' },
						{ key: 'Multi-Ancestry-Admixed', label: 'Multi-Ancestry-Admixed' }
					]
				}
			]
		}

		await scatter.Inner.app.dispatch({
			type: 'plot_edit',
			id: scatter.Inner.id,
			config: scatter.Inner.config
		})
	}

	// async function removeColorGroups(scatter) {
	// 	scatter.Inner.config.colorTW.q.groupsetting = { inuse: false }
	// 	await scatter.Inner.app.dispatch({
	// 		type: 'plot_edit',
	// 		id: scatter.Inner.id,
	// 		config: scatter.Inner.config
	// 	})
	// }
})

tape('Change symbol and reference size from menu', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: structuredClone(open_state),
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	const testSymSize = 300
	const testRefSize = 1

	async function runTests(scatter) {
		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.use(changeSymbolInput)
			.to(testSymbolSize, { wait: 100 })
			.use(changeRefInput, { wait: 100 })
			.to(testRefDotSize, { wait: 300 })
			.done(test)
	}
	function changeSymbolInput(scatter) {
		const sizeInput = scatter.Inner.view.dom.controlsHolder
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.size)
		sizeInput.value = testSymSize
		sizeInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
	}
	function testSymbolSize(scatter) {
		//separate function because wait needed before test to run
		test.equal(scatter.Inner.settings.size, testSymSize, `Should change symbol dot size to test value = ${testSymSize}`)
	}
	function changeRefInput(scatter) {
		const refInput = scatter.Inner.view.dom.controlsHolder
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.refSize)
		refInput.value = testRefSize
		refInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
	}
	function testRefDotSize(scatter) {
		test.equal(
			scatter.Inner.settings.refSize,
			testRefSize,
			`Should change reference dot size to test value = ${testRefSize}`
		)
	}
})

tape('Change chart width and height from menu', function (test) {
	test.timeoutAfter(1000)

	runpp({
		state: structuredClone(open_state),
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	const testWidth = 550
	const testHeight = 550

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await testChartSizeChange(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function testChartSizeChange(scatter) {
		//Change chart width
		const widthInput = scatter.Inner.view.dom.controlsHolder
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgw)
		widthInput.value = testWidth

		//Change chart height
		const heightInput = scatter.Inner.view.dom.controlsHolder
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgh)
		heightInput.value = testHeight
		//Detect change in chart height and width
		await detectAttr({
			target: scatter.Inner.view.dom.mainDiv.select('svg').node(),
			observe: {
				attributeFilter: ['height', 'width']
			},
			// count: 1,
			trigger() {
				widthInput.dispatchEvent(new Event('change'))
				heightInput.dispatchEvent(new Event('change'))
			}
			// matcher(mutations){
			// 	let foundH, foundW = 0
			// 	for (const mut of mutations) {
			// 		if (mut.type == 'width') ++foundW
			// 		if (mut.type == 'height') ++foundH
			// 	}
			// }
		})

		test.equal(
			scatter.Inner.settings.svgw,
			testWidth,
			`Chart width = ${scatter.Inner.settings.svgw} should be equal to test width = ${testWidth}`
		)
		test.equal(
			scatter.Inner.settings.svgh,
			testHeight,
			`Chart height = ${scatter.Inner.settings.svgh} should be equal to test height = ${testHeight}`
		)
	}
})

tape('Check/uncheck Show axes from menu', function (test) {
	test.timeoutAfter(4000)

	runpp({
		state: structuredClone(open_state),
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await showAxes(scatter, true)
		await showAxes(scatter, false)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function showAxes(scatter, isvisible) {
		const opacity = isvisible ? 1 : 0

		const axesDiv = await detectStyle({
			target: scatter.Inner.view.dom.mainDiv.node().querySelector('.sjpcb-scatter-axis'),
			style: {
				opacity: `${opacity}`
			},
			trigger() {
				const axesCheckbox = scatter.Inner.view.dom.controlsHolder.select('input[data-testid="showAxes"]')
				axesCheckbox.property('checked', isvisible)
				axesCheckbox.node().dispatchEvent(new Event('change'))
			}
		})
		const axesStyle = getComputedStyle(axesDiv[0])
		test.equal(axesStyle.opacity, `${opacity}`, `Should ${isvisible ? 'show' : 'hide'} axes`)
	}
})

tape('Click zoom in, zoom out, and reset buttons', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: structuredClone(state),
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await testZoomIn(scatter)
		await testReset(scatter)
		await testZoomOut(scatter)
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function testZoomIn(scatter) {
		const zoomin_bt = scatter.Inner.view.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-in-btn"]')
		const m = await detectTransform(scatter, zoomin_bt, 1.2)
		test.ok(m != null, `Plot should zoom in`)
	}

	async function testReset(scatter) {
		const reset_bt = scatter.Inner.view.dom.toolsDiv.node().querySelector('div[name="sjpp-reset-btn"]')
		const m = await detectTransform(scatter, reset_bt, 1)
		test.ok(m != null, `Plot should reset`)
	}

	async function testZoomOut(scatter) {
		const zoomout_bt = scatter.Inner.view.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-out-btn"]')
		const m = await detectTransform(scatter, zoomout_bt, 0.8)
		test.ok(m != null, `Plot should zoom out`)
	}

	async function detectTransform(scatter, btn, scale) {
		const target = await detectAttr({
			target: scatter.Inner.view.dom.mainDiv.node().querySelector('.sjpcb-scatter-series'),
			observe: {
				subtree: true,
				characterData: true,
				attributeFilter: ['transform']
			},
			count: 1,
			trigger() {
				btn.click()
			},
			matcher(mutations) {
				for (const m of mutations) {
					if (m.attributeName == 'transform' && m.target.attributes[1].value.includes(`scale(${scale})`)) return m
				}
			}
		})
		return target
	}

	//Add tests for changes in axes
})

tape('colorTW=geneVariant with no groupsetting', function (test) {
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
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})
tape('colorTW=geneVariant with groupsetting', function (test) {
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
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})
tape('colorTW=geneVariant with gene list', function (test) {
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
		const lab = 'TP53, KRAS, AKT1 SNV/indel Mutated (somatic)'
		test.true(
			dots.find(d => d.__data__.category == lab),
			`A dot with category=${lab}`
		)
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})
tape('colorTW=ssgsea', function (test) {
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
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('singlecell', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					singleCellPlot: { name: 'scRNA', sample: { sID: '1_patient' } }
				}
			]
		},
		sampleScatter: { callbacks: { 'postRender.test': runTests } }
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.view.dom.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		test.true(dots.length, 'some dots are loaded from singlecell plot')
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})
