import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import * as d3color from 'd3-color'
import * as d3s from 'd3-selection'
import {
	detectStyle,
	detectAttr,
	detectChildAttr,
	detectChildStyle,
	detectGte,
	sleep
} from '../../../test/test.helpers.js'
import { state, mockGroups, open_state } from './mockScatterData.ts'

/* Includes test for testing UI functionality of sampleScatter plot. 
Please put tests regarding term type rendering in scatter.integration.spec.ts.

Tests:
    - Show tooltip for sample
    - Test scale dot
    - Test lasso menus options
    - (commented out) Test continuous mode with age color
    - Test legend
    - Render color groups
    - Change symbol and reference size from menu
    - Change chart width and height from menu
    - Check/uncheck Show axes from menu
    - Click zoom in, zoom out, and reset buttons
    - Groups and group menus function
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
	test.comment('-***- plots/sampleScatter UI interactions -***-')
	test.end()
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
		const sample = mockGroups[0].items[0]
		scatter.Inner.vm.scatterTooltip.showSampleTooltip(sample, 100, 100, chart)
		const tooltipDiv = scatter.Inner.view.dom.tooltip.d.node()
		const tree = scatter.Inner.vm.scatterTooltip.tree
		const parentNode = tree.find(n => n.id == 'Acute lymphoblastic leukemia' && n.samples.length == 3)
		test.true(parentNode != null, 'Tooltip should have 3 samples for Acute lymphoblastic leukemia')
		test.true(tooltipDiv != null, 'Tooltip should be shown')
		scatter.Inner.view.dom.tooltip.hide()

		if (test['_ok']) holder.remove()
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
		// const chart = scatter.Inner.model.charts[0]
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
		if (test['_ok']) holder.remove()
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

		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}

	async function triggerLassoMenu(scatter) {
		/* Menu appears in the upper left corner instead of under groups button.
        This is expected. No x/y coord is provided to orient the menu 
        under the groups button. */
		const group = mockGroups[0]
		scatter.Inner.vm.scatterLasso.showLassoMenu(new PointerEvent('click'), group.items)
		const groupsMenu: { [index: string]: any } = scatter.Inner.view.dom.tip.d.selectAll('div.sja_menuoption').nodes()
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
		const samplesRendered: any = scatter.Inner.view.dom.tip.d.selectAll('.sjpp_row_wrapper > td:nth-child(3)').nodes()
		const samples2Check: string[] = []
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
// 		if (test['_ok']) holder.remove()
// 		test.end()
// 	}
// })

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
		// const scatterDiv = scatter.Inner.model.charts[0].chartDiv

		await testHideCategory(scatter, samples)
		await testChangeColor(scatter, samples)
		if (test['_ok']) scatter.Inner.app.destroy()
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
				// const chart = scatter.Inner.model.charts[0]
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
				const targets = mutations.filter(
					(m: any) => d3color.rgb(m.target.getAttribute('fill')).toString() == expectedColor
				)
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

		if (test['_ok']) scatter.Inner.app.destroy()
		test.end()
	}

	async function testColorLegend(scatter) {
		const legendLabels = await detectGte({
			elem: scatter.Inner.model.charts[0].chartDiv.node(),
			selector: 'text[name="sjpp-scatter-legend-label"]'
		})

		const groups: { label: string; samples: string[] }[] = []
		for (const group of legendLabels) {
			const label = group.innerHTML.split(',')
			groups.push({
				label: label[0],
				samples: label[1].match(/[\d.]+/g) || []
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

		if (test['_ok']) scatter.Inner.app.destroy()
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

		if (test['_ok']) scatter.Inner.app.destroy()
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
		if (test['_ok']) scatter.Inner.app.destroy()
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
