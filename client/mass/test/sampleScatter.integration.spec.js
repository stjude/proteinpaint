import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import * as d3color from 'd3-color'
import * as d3s from 'd3-selection'
import {
	detectLst,
	detectStyle,
	detectAttr,
	detectChildAttr,
	detectChildStyle,
	detectGte,
	detectOne
} from '../../test/test.helpers'
import { openSummaryPlot, openPlot, getSamplelstTW } from '../groups'
import { rgb } from 'd3-color'
import { mclass } from '#shared/common.js'

/*
Tests:
	Render TermdbTest scatter plot and open survival and summary
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
	Color by gene
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

const groupState = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: {
				id: 'diaggrp'
			},
			name: 'TermdbTest TSNE',
			groups: [
				{
					name: 'Test group 1',
					items: [
						{
							sample: '2646',
							x: -103.141543,
							y: 73.31223702,
							sampleId: 2646,
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
							sampleId: 2800,
							category_info: {},
							hidden: {
								category: false
							},
							category: '"Acute lymphoblastic leukemia"',
							shape: 'Ref'
						}
					],
					index: 1
				},
				{
					name: 'Test group 2',
					items: [
						{
							sample: '3178',
							x: 121.1951911,
							y: 73.75814818,
							sampleId: 3178,
							category_info: {},
							hidden: {
								category: false
							},
							category: 'Rhabdomyosarcoma',
							shape: 'Ref'
						},
						{
							sample: '3192',
							x: 121.6732408,
							y: 71.66798389,
							sampleId: 3192,
							category_info: {},
							hidden: {
								category: false
							},
							category: 'Wilms tumor',
							shape: 'Ref'
						}
					],
					index: 2
				}
			]
		}
	]
}

function getHolder() {
	return d3s.select('body').append('div')
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- plots/sampleScatter -***-')
	test.end()
})

tape('Render TermdbTest scatter plot and open survival and summary', function (test) {
	test.timeoutAfter(8000)
	test.plan(4)
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
		const scatterDiv = scatter.Inner.charts[0].chartDiv

		testPlot()
		testLegendTitle()
		const group = await testCreateGroup()
		const tw = getSamplelstTW([group])

		await testOpenSurvivalPlot()
		await testOpenSummaryPlot()

		//if (test._ok) holder.remove()
		test.end()

		function testPlot() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const numSymbols = serieG.selectAll('path').size()
			test.equal(
				numSymbols,
				scatter.Inner.charts[0].data.samples.length,
				`Should be ${scatter.Inner.charts[0].data.samples.length}. Rendered ${numSymbols} symbols.`
			)
		}

		function testLegendTitle() {
			if (!scatter.Inner.colorTW) return
			const legendG = scatterDiv.select('.sjpcb-scatter-legend')
			test.true(legendG != null, 'Should have a legend')
			test.true(
				legendG.select('#legendTitle').text().startsWith(scatter.Inner.config.colorTW.id),
				`Legend title should start with ${scatter.Inner.config.colorTW.id}`
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
		const chart = scatter.Inner.charts[0]
		const dots = self.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
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
// 		const chart = scatter.Inner.charts[0]
// 		const startColor = self.config.startColor[chart.id]
// 		const stopColor = self.config.stopColor[chart.id]
// 		test.true(startColor == chart.startRect.style('fill'), `The start color rect should be ${startColor}`)
// 		test.true(stopColor == chart.stopRect.style('fill'), `The stop color rect should be ${stopColor}`)
// 		let color = rgb('green').toString()
// 		let matched = await detectChildAttr({
// 			elem: scatter.Inner.mainDiv.node(),
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
// 			elem: scatter.Inner.mainDiv.node(),
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
		const errorbar = await detectGte({ elem: holder.node(), selector: '.sja_errorbar' })
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
		const samples = scatter.Inner.charts[0].data.samples
		const scatterDiv = scatter.Inner.charts[0].chartDiv

		await testHideCategory(scatter, samples)
		await testChangeColor(scatter, samples)
		test.end()
	}

	async function testHideCategory(scatter, samples) {
		const key = 'Acute lymphoblastic leukemia'
		const expectedNum = samples.filter(s => s.category === key).length

		const matched = await detectChildStyle({
			elem: scatter.Inner.mainDiv.node(),
			selector: '.sjpcb-scatter-series > path',
			style: {
				fillOpacity: '0'
			},
			count: expectedNum,
			trigger: () => {
				const chart = scatter.Inner.charts[0]
				scatter.Inner.hideCategory(chart.legendG, scatter.Inner.config.colorTW, key, true)
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
			elem: scatter.Inner.mainDiv.node(),
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
				scatter.Inner.changeColor(key, color)
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
			elem: scatter.Inner.charts[0].chartDiv.node(),
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
			scatter.Inner.charts[0].colorLegend.size,
			groups.length + 1,
			`Legend categories (# = ${groups.length + 1}) should equal size of colorLegend (# = ${
				scatter.Inner.charts[0].colorLegend.size
			}) `
		)
		compareData2DOMLegend(scatter, groups)
	}

	function compareData2DOMLegend(scatter, groups) {
		for (const group of groups) {
			const mapLeg = scatter.Inner.charts[0].colorLegend.get(group.label)
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
		const sizeInput = scatter.Inner.dom.controlsHolder
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
		const refInput = scatter.Inner.dom.controlsHolder
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
	test.timeoutAfter(10000)

	runpp({
		state: structuredClone(open_state),
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	const testWidth = 50
	const testHeight = 50

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await testChartSizeChange(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function testChartSizeChange(scatter) {
		//Change chart width
		const widthInput = scatter.Inner.dom.controlsHolder
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgw)
		widthInput.value = testWidth

		//Change chart height
		const heightInput = scatter.Inner.dom.controlsHolder
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgh)
		heightInput.value = testHeight

		//Detect change in chart height and width
		await detectAttr({
			target: scatter.Inner.mainDiv.node().querySelector('svg'),
			observe: {
				attributeFilter: ['height', 'width']
			},
			// count: 1,
			trigger() {
				widthInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
				heightInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
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
			target: scatter.Inner.mainDiv.node().querySelector('.sjpcb-scatter-axis'),
			style: {
				opacity: `${opacity}`
			},
			trigger() {
				const axesCheckbox = scatter.Inner.dom.controlsHolder.select('input[type="checkbox"]')
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
		test.end()
	}

	async function testZoomIn(scatter) {
		const zoomin_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-in-btn"]')
		await detectTransform(scatter, zoomin_bt, 1.2)
		const scale = scatter.Inner.zoom
		test.ok(scale > 1, `Plot should zoom in`)
	}

	async function testReset(scatter) {
		const reset_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-reset-btn"]')
		await detectTransform(scatter, reset_bt, 1)
		const scale = scatter.Inner.zoom
		test.ok(scale == 1, `Plot should reset`)
	}

	async function testZoomOut(scatter) {
		const zoomout_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-out-btn"]')
		await detectTransform(scatter, zoomout_bt, 0.8)
		const scale = scatter.Inner.zoom
		test.ok(scale < 1, `Plot should zoom out`)
	}

	async function detectTransform(scatter, btn, scale) {
		const target = await detectAttr({
			target: scatter.Inner.mainDiv.node().querySelector('.sjpcb-scatter-series'),
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

tape('Groups and group menus functions', function (test) {
	test.timeoutAfter(8000)

	runpp({
		state: structuredClone(groupState),
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await triggerGroupMenu(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function triggerGroupMenu(scatter) {
		/* Menu appears in the upper left corner instead of under groups button.
        This is expected. No x/y coord is provided to orient the menu 
        under the groups button. */
		scatter.Inner.showGroupsMenu(new PointerEvent('click'))
		const groupsMenu = scatter.Inner.dom.tip.d.selectAll('div.sja_menuoption').nodes()
		for (const group of scatter.Inner.config.groups) {
			const foundGroupInMenu = groupsMenu.filter(
				d => d?.childNodes[0]?.outerText == `${group.name}: ${group.items.length}`
			)
			test.ok(foundGroupInMenu.length == 1, `Should include ${group.name} in groups menu`)
		}

		for (const [i, group] of scatter.Inner.config.groups.entries()) {
			//Check all group menus appear on click
			scatter.Inner.showGroupMenu(new PointerEvent('click'), scatter.Inner.config.groups[i])
			const groupMenuTitleDiv = await detectOne({
				elem: scatter.Inner.dom.tip.dnode,
				selector: 'div[name="sjpp-group-input-div"]'
			})
			test.ok(groupMenuTitleDiv.innerHTML.endsWith(group.name), `Should display ${group.name} menu`)

			scatter.Inner.showTable(group, 0, 0)
			testSampleTable(scatter, i, group)
		}
	}

	function testSampleTable(scatter, i, group) {
		const samplesRendered = scatter.Inner.dom.tip.d.selectAll('.sjpp_row_wrapper > td:nth-child(3)').nodes()
		const samples2Check = []
		for (const item of samplesRendered) {
			samples2Check.push(item.innerHTML)
		}

		//Check every sample in group renders in sample table
		let foundSamples = 0
		for (const sampleData of scatter.Inner.config.groups[i].items) {
			if (samples2Check.some(d => d == sampleData.sample)) ++foundSamples
			else test.fail(`Sample = ${sampleData.sample} is not displayed in sample table`)
		}
		test.equal(samples2Check.length, foundSamples, `Should render all samples for ${group.name}`)

		if (test._ok) scatter.Inner.dom.tip.d.remove()
	}
})

tape('Color by gene', function (test) {
	const colorGeneState = {
		plots: [
			{
				chartType: 'sampleScatter',
				colorTW: { term: { gene: 'TP53', name: 'TP53', type: 'geneVariant' } },
				name: 'TermdbTest TSNE'
			}
		]
	}
	runpp({
		state: colorGeneState,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(scatter) {
		const dots = scatter.Inner.mainDiv.selectAll('.sjpcb-scatter-series > path').nodes()
		test.true(
			dots.find(dot => dot.getAttribute('fill') == mclass['M'].color),
			`At least a sample with MISSENSE color was expected`
		)
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})
