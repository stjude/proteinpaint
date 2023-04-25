const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const d3color = require('d3-color')
const d3s = require('d3-selection')
const {
	detectLst,
	detectStyle,
	detectAttr,
	detectChildAttr,
	detectChildStyle,
	detectGte,
	detectOne,
	sleep
} = require('../../test/test.helpers')

/*
Tests:
	Render TermdbTest scatter plot and open survival and summary
	Invalid colorTW.id
	Invalid colorTW.term
	Invalid plot name
	Test legend
	Create color group
	Replace color from burger menu
	Change symbol and reference size from menu
	Change chart width and height from menu
	Check/uncheck Show axes from menu
	Click zoom in, zoom out, and reset buttons
	Groups and group menus function
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
			name: 'TermdbTest TSNE',
			settings: { controls: { isOpen: true } }
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
tape('\n', function(test) {
	test.pass('-***- mass/sampleScatter -***-')
	test.end()
})

tape('Render TermdbTest scatter plot and open survival and summary', function(test) {
	test.timeoutAfter(5000)
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
		const scatterDiv = scatter.Inner.dom.holder
		testPlot()
		testLegendTitle()
		const group = await testCreateGroup()
		await testOpenSurvivalPlot()
		await testOpenSummaryPlot()

		if (test._ok) holder.remove()
		test.end()

		function testPlot() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const numSymbols = serieG.selectAll('path').size()
			test.true(
				numSymbols == scatter.Inner.data.samples.length,
				`Should be ${scatter.Inner.data.samples.length}. Rendered ${numSymbols} symbols.`
			)
		}

		function testLegendTitle() {
			if (!scatter.Inner.colorTW) return
			const legendG = scatterDiv.select('.sjpcb-scatter-legend')
			test.true(legendG != null, 'Should have a legend')
			test.true(
				legendG
					.select('#legendTitle')
					.text()
					.startsWith(scatter.Inner.config.colorTW.id),
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
			test.true(36 == samples.length, `Group should have 36 symbols.`)

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
			const survivalTerm = await scatter.Inner.app.vocabApi.getterm('efs')
			await scatter.Inner.openSurvivalPlot(survivalTerm, [group])
			test.true(d3s.selectAll('.sja_errorbar').size() == 0, 'Should render survival plot without errors".')
		}

		async function testOpenSummaryPlot() {
			const genderTerm = await scatter.Inner.app.vocabApi.getterm('sex')
			await scatter.Inner.openSummaryPlot(genderTerm, [group])
			test.true(d3s.selectAll('.sja_errorbar').size() == 0, 'Should render summary plot without errors".')
		}
	}
})

tape('Invalid colorTW.id', async function(test) {
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
			errorbar[0].innerText.includes(`no term found for ${id}`),
			`Should display, "Error: no term found for ${id} [sampleScatter getPlotConfig()]".`
		)
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Invalid colorTW.term', async function(test) {
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
		const error = 'Error: Type not defined for {"term":{"id":"Not real data"},"isAtomic":true'
		test.true(errorbar[0].innerText.startsWith(error), `Should display, "${error}...".`)
	} catch (e) {
		test.fail(e)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Invalid plot name', async function(test) {
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

tape('Test legend', function(test) {
	test.timeoutAfter(3000)
	test.plan(2)

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
		const samples = scatter.Inner.data.samples
		const scatterDiv = scatter.Inner.dom.holder
		const legendG = scatterDiv.select('.sjpcb-scatter-legend')
		const elem = scatterDiv.select('.sjpcb-scatter-series').node()

		await testHideCategory(scatter, samples, elem, legendG)
		await testChangeColor(scatter, samples, elem)
		test.end()
	}

	async function testHideCategory(scatter, samples, elem, legendG) {
		const key = 'Acute lymphoblastic leukemia'
		const expectedNum = samples.filter(s => s.category === key).length
		const matched = await detectChildStyle({
			elem,
			selector: 'path',
			style: {
				fillOpacity: '0'
			},
			count: expectedNum,
			trigger: () => {
				scatter.Inner.hideCategory(legendG, scatter.Inner.config.colorTW, key, true)
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

	async function testChangeColor(scatter, samples, elem) {
		const key = 'Wilms tumor'
		const color = 'blue'
		const expectedColor = d3color.rgb(color).toString()
		const expectedNum = samples.filter(s => s.category === key).length
		const targets = await detectChildAttr({
			elem,
			selector: 'path',
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

tape.skip('Create color groups', function(test) {
	test.timeoutAfter(3000)
	test.plan(2)

	runpp({
		state,
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		await triggerEdit(scatter)
		// makeGroupsViaUI(scatter)
		await sleep(100)
		// testGroups(scatter)

		// if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function triggerEdit(scatter) {
		const groups = [
			{
				name: 'group 1',
				items: [],
				index: 0
			},
			{
				name: 'group 2',
				items: [],
				index: 1
			}
		]
		for (const sample of scatter.Inner.data.samples) {
			if (sample.category === 'Acute lymphoblastic leukemia') groups[0].items.push(sample)
			else groups[1].items.push(sample)
		}

		// await scatter.Inner.app.dispatch({
		//  type: 'plot_edit',
		//  id: scatter.Inner.id,
		//  config: { groups }
		// })
		await sleep(1000)
		// scatter.Inner.dom.controls
		//  .node()
		//  .querySelector('.ts_pill')
		//  .click()
		// /*
		// Problematic! menu tooltip renders outside of scatter.Inner.dom/app and current setup
		// does not allow for targeting only the rendered test div. If any test fails, leaving
		// an rendered mass UI, these tests will fail as well
		// */
		// d3s
		//  .selectAll('.sja_sharp_border')
		//  .filter(d => d.label == 'Edit')
		//  .node()
		//  .click()
	}

	// function makeGroupsViaUI(scatter) {
	//  const firstGrpInput = d3s
	//      .selectAll('.group_edit_div > input')
	//      .nodes()
	//      .filter(e => e.value == '1')
	//  firstGrpInput[0].value = 'Group 1'
	//  firstGrpInput[0].dispatchEvent(new KeyboardEvent('keyup'))

	//  const secondGrpInput = d3s
	//      .selectAll('.group_edit_div > input')
	//      .nodes()
	//      .filter(e => e.value == '2')
	//  secondGrpInput[0].value = 'Group 2'
	//  secondGrpInput[0].dispatchEvent(new KeyboardEvent('keyup'))

	//  const dragDivs = d3s.selectAll('.sjpp-drag-drop-div').nodes()
	//  const dragItems = d3.selectAll('.sj-drag-item').nodes()
	//  //First item in list
	//  dragItems[0].dispatchEvent(new Event('dragstart'))
	//  //Second drag div
	//  dragDivs[1].dispatchEvent(new Event('drop'))
	//  dragItems[0].dispatchEvent(new Event('dragend'))

	//  const applyBtn = d3.selectAll('.sjpp_apply_btn').node()
	//  applyBtn.dispatchEvent(new Event('click'))
	// }

	async function testGroups(scatter) {
		const legendLabels = await detectLst({
			elem: scatter.Inner.dom.holder.node(),
			selector: 'text[name="sjpp-scatter-legend-label"]',
			matchAs: '>='
		})
		const groups = []
		for (const group of legendLabels) {
			const label = group.innerHTML.split(',')
			groups.push({
				label: label[0],
				samples: label[1].match(/[\d\.]+/g)
			})
		}
		test.ok(
			scatter.Inner.colorLegend.size == groups.length + 1,
			`Legend categories (# = ${groups.length + 1}) should equal size of colorLegend (# = ${
				scatter.Inner.colorLegend.size
			}) `
		)
		compareData2DOMLegend(scatter, groups)
	}

	function compareData2DOMLegend(scatter, groups) {
		for (const group of groups) {
			const mapLeg = scatter.Inner.colorLegend.get(group.label)
			test.ok(mapLeg.sampleCount == group.samples[0], `Should show matching n = for ${group.label}`)
		}
	}
})

tape('Change symbol and reference size from menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: open_state,
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	const testSymSize = 300
	const testRefSize = 1

	async function runTests(scatter) {
		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.run(changeSymbolInput)
			.run(testSymbolSize, { wait: 100 })
			.use(changeRefInput, { wait: 100 })
			.to(testRefDotSize, { wait: 300 })
			.done(test)
	}
	function changeSymbolInput(scatter) {
		const sizeInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.size)
		sizeInput.value = testSymSize
		sizeInput.dispatchEvent(new Event('change'))
	}
	function testSymbolSize(scatter) {
		//separate function because wait needed before test to run
		test.ok(scatter.Inner.settings.size == testSymSize, `Should change symbol dot size to test value = ${testSymSize}`)
	}
	function changeRefInput(scatter) {
		const refInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.refSize)
		refInput.value = testRefSize
		refInput.dispatchEvent(new Event('change'))
	}
	function testRefDotSize(scatter) {
		test.equal(
			scatter.Inner.settings.refSize,
			testRefSize,
			`Should change reference dot size to test value = ${testRefSize}`
		)
	}
})

tape('Change chart width and height from menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: open_state,
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
		const widthInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgw)
		widthInput.value = testWidth

		//Change chart height
		const heightInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgh)
		heightInput.value = testHeight

		//Detect change in chart height and width
		await detectAttr({
			target: scatter.Inner.dom.holder.node().querySelector('svg'),
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

tape('Check/uncheck Show axes from menu', function(test) {
	test.timeoutAfter(4000)

	runpp({
		state: open_state,
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await testAxes(scatter, false, 1)
		await testAxes(scatter, true, 0)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function testAxes(scatter, bool, num) {
		const axesCheckbox = scatter.Inner.dom.controls
			.selectAll('input[type="checkbox"]')
			.nodes()
			.find(e => e.checked == bool)
		axesCheckbox.checked = !bool

		const axesDiv = await detectStyle({
			target: scatter.Inner.dom.holder.node().querySelector('.sjpcb-scatter-axis'),
			style: {
				opactiy: `${num}`
			},
			trigger() {
				axesCheckbox.dispatchEvent(new Event('change'))
			}
		})
		const axesStyle = getComputedStyle(axesDiv[0])
		test.equal(axesStyle.opacity, `${num}`, `Should ${num == 1 ? 'show' : 'hide'} axes`)
	}
})

tape('Click zoom in, zoom out, and reset buttons', function(test) {
	test.timeoutAfter(10000)

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

		await testZoomIn(scatter)
		await testReset(scatter)
		await testZoomOut(scatter)
		test.end()
	}

	async function testZoomIn(scatter) {
		const zoomin_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-in-btn"]')
		await detectTransform(scatter, zoomin_bt, 1.5)
		const scale = scatter.Inner.k
		test.ok(scale > 1, `Plot should zoom in`)
	}

	async function testReset(scatter) {
		const reset_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-reset-btn"]')
		await detectTransform(scatter, reset_bt, 1)
		const scale = scatter.Inner.k
		test.ok(scale == 1, `Plot should reset`)
	}

	async function testZoomOut(scatter) {
		const zoomout_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-out-btn"]')
		await detectTransform(scatter, zoomout_bt, 0.5)
		const scale = scatter.Inner.k
		test.ok(scale < 1, `Plot should zoom out`)
	}

	async function detectTransform(scatter, btn, scale) {
		const target = await detectAttr({
			target: scatter.Inner.dom.holder.node().querySelector('.sjpcb-scatter-series'),
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

tape('Groups and group menus functions', function(test) {
	test.timeoutAfter(8000)

	runpp({
		state: groupState,
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
