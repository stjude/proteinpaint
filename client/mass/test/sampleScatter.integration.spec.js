const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const d3color = require('d3-color')
const d3s = require('d3-selection')

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38'
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
			settings: {
				controls: { isOpen: true }
			}
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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mass/sampleScatter -***-')
	test.end()
})

tape('Render TermdbTest scatter plot and open survival and summary', function(test) {
	test.timeoutAfter(3000)
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
			scatter.Inner.openSurvivalPlot(survivalTerm, scatter.Inner.getGroupvsOthersOverlay(group))
			await sleep(300)
			test.true(d3s.selectAll('.sja_errorbar').size() == 0, 'Should render survival plot without erros".')
		}

		async function testOpenSummaryPlot() {
			const genderTerm = await scatter.Inner.app.vocabApi.getterm('sex')
			scatter.Inner.openSummaryPlot(genderTerm, scatter.Inner.getGroupvsOthersOverlay(group))
			await sleep(300)
			test.true(d3s.selectAll('.sja_errorbar').size() == 0, 'Should render summary plot without erros".')
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
						colorTW: { id, term: { id, type: 'categorical' } },
						name: 'TermdbTest TSNE'
					}
				]
			}
		})
		await sleep(300)
		test.equal(
			d3s.selectAll('.sja_errorbar').size(),
			1,
			'Should display, "Error: no term found for Not real data [bsampleScatter getPlotConfig()]".'
		)
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Invalid colorTW.term', async function(test) {
	test.timeoutAfter(3000)
	const message = `Should display error for colorTW.term not found within dataset`
	const holder = getHolder()
	const id = 'Not real data'
	try {
		runpp({
			holder,
			state: {
				plots: [
					{
						chartType: 'sampleScatter',
						colorTW: { term: { id, type: 'categorical' } },
						name: 'TermdbTest TSNE'
					}
				]
			}
		})
		await sleep(500)
		test.equal(
			holder.selectAll('.sja_errorbar').size(),
			1,
			'Should display, "Error: Error: Cannot find module \'./undefined.js\' [bsampleScatter getPlotConfig()]".'
		)
	} catch (e) {
		test.fail(message + ': ' + e)
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
						colorTW: { id: 'TSNE Category' },
						name: 'Not real data'
					}
				]
			}
		})
		await sleep(500)
		test.equal(
			holder.selectAll('.sja_errorbar').size(),
			1,
			'Should display, "Error: plot not found with plotName: Not real data".'
		)
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Click behavior of category legend', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	const testTerm = 'Acute lymphoblastic leukemia'

	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		const testCategory = scatter.Inner.colorLegend.get(testTerm)
		const testColor = d3color.rgb(testCategory.color)

		const scatterDiv = scatter.Inner.dom.holder
		const categoryLegend = scatterDiv
			.selectAll('text[name="sjpp-scatter-legend-label"]')
			.nodes()
			.find(c => c.innerHTML.startsWith(testTerm))

		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.run(testClickedCategory)
			.done(test)

		function testClickedCategory() {
			categoryLegend.dispatchEvent(new Event('click'))
			const findColorDots = scatterDiv
				.selectAll('.sjpcb-scatter-series > path')
				.nodes()
				.some(c => c.style.fill == testColor)
			test.ok(findColorDots == false, `Should remove all testTerm = ${testTerm} colored dots, color = ${testColor}`)
		}
	}
})

tape('Create color groups from Edit', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: open_state,
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		// helpers.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
		// .run(openColorEditMenu, {wait: 100})
		// .done(test)

		await sleep(100)
		triggerEdit(scatter)
		makeGroupsViaUI(scatter)
		await sleep(100)
		testGroups(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function triggerEdit(scatter) {
		scatter.Inner.dom.controls
			.node()
			.querySelector('.ts_pill')
			.click()
		/*
		Problematic! menu tooltip renders outside of scatter.Inner.dom/app and current setup
		does not allow for targeting only the rendered test div. If any test fails, leaving 
		an rendered mass UI, these tests will fail as well
		*/
		d3s
			.selectAll('.sja_sharp_border')
			.filter(d => d.label == 'Edit')
			.node()
			.click()
	}

	function makeGroupsViaUI(scatter) {
		const firstGrpInput = d3s
			.selectAll('.group_edit_div > input')
			.nodes()
			.filter(e => e.value == '1')
		firstGrpInput[0].value = 'Group 1'
		firstGrpInput[0].dispatchEvent(new KeyboardEvent('keyup'))

		const secondGrpInput = d3s
			.selectAll('.group_edit_div > input')
			.nodes()
			.filter(e => e.value == '2')
		secondGrpInput[0].value = 'Group 2'
		secondGrpInput[0].dispatchEvent(new KeyboardEvent('keyup'))

		const dragDivs = d3s.selectAll('.sjpp-drag-drop-div').nodes()
		const dragItems = d3.selectAll('.sj-drag-item').nodes()
		//First item in list
		dragItems[0].dispatchEvent(new Event('dragstart'))
		//Second drag div
		dragDivs[1].dispatchEvent(new Event('drop'))
		dragItems[0].dispatchEvent(new Event('dragend'))

		const applyBtn = d3.selectAll('.sjpp_apply_btn').node()
		applyBtn.dispatchEvent(new Event('click'))
	}

	function testGroups(scatter) {
		const legendLabels = scatter.Inner.dom.holder.selectAll('text[name="sjpp-scatter-legend-label"]').nodes()
		let groups = []
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

tape('Replace color from burger menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: open_state,
		sampleScatter: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await sleep(100)
		triggerReplace(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function triggerReplace(scatter) {
		scatter.Inner.dom.controls
			.node()
			.querySelector('.ts_pill')
			.click()
		/*
		Problematic! menu tooltip renders outside of scatter.Inner.dom/app and current setup
		does not allow for targeting only the rendered test div. If any test fails, leaving 
		an rendered mass UI, these tests will fail as well
		*/
		d3s
			.selectAll('.sja_sharp_border')
			.filter(d => d.label == 'Replace')
			.node()
			.click()
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
			.to(testRefDotSize, { wait: 100 })
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
		test.ok(
			scatter.Inner.settings.refSize == testRefSize,
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
		// helpers
		// 	.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
		// 	.run(changeWidth)
		// 	.use(changeHeight)
		// 	.to(testChartSizeChange)
		// 	.done(test)

		changeWidth(scatter)
		changeHeight(scatter)
		await sleep(100)
		testChartSizeChange(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
	function changeWidth(scatter) {
		const widthInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgw)
		widthInput.value = testWidth
		widthInput.dispatchEvent(new Event('change'))
	}

	function changeHeight(scatter) {
		const heightInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgh)
		heightInput.value = testHeight
		heightInput.dispatchEvent(new Event('change'))
	}

	function testChartSizeChange(scatter) {
		test.ok(
			scatter.Inner.settings.svgw == testWidth,
			`Chart width = ${scatter.Inner.settings.svgw} should be equal to test width = ${testWidth}`
		)
		test.ok(
			scatter.Inner.settings.svgh == testHeight,
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
		// helpers
		// 	.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
		// 	.run(checkAxesBox)
		// 	.run(testAxes)
		// 	.done(test)

		scatter.on('postRender.test', null)

		checkAxesBox(scatter, false)
		await sleep(100)
		testAxes(scatter, 1)
		checkAxesBox(scatter, true)
		await sleep(100)
		testAxes(scatter, 0)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function checkAxesBox(scatter, bool) {
		const axesCheckbox = scatter.Inner.dom.controls
			.selectAll('input[type="checkbox"]')
			.nodes()
			.find(e => e.checked == bool)
		axesCheckbox.checked = !bool
		axesCheckbox.dispatchEvent(new Event('change'))
	}

	function testAxes(scatter, num) {
		const axesDiv = scatter.Inner.dom.holder.node().querySelector('.sjpcb-scatter-axis')
		const axesStyle = getComputedStyle(axesDiv)
		test.ok(axesStyle.opacity == num, `Should ${num == 1 ? 'show' : 'hide'} axes`)
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

	function runTests(scatter) {
		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.run(clickZoomIn)
			.run(testZoomIn, 2000)
			.run(triggerReset)
			.run(testReset, 2000)
			.run(clickZoomOut)
			.run(testZoomOut, 2000)
			.done(test)
	}

	function clickZoomIn(scatter) {
		const zoomin_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-in-btn"]')
		zoomin_bt.click()
	}

	function testZoomIn(scatter) {
		const scale = scatter.Inner.k
		test.ok(scale > 1, `Plot should zoom in`)
	}

	function triggerReset(scatter) {
		const reset_bt = scatter.Inner.dom.toolsDiv.node().querySelector('div[name="sjpp-reset-btn"]')
		reset_bt.click()
	}

	function testReset(scatter) {
		const scale = scatter.Inner.k
		test.ok(scale == 1, `Plot should reset`)
	}

	function clickZoomOut(scatter) {
		scatter.Inner.dom.toolsDiv
			.node()
			.querySelector('div[name="sjpp-zoom-out-btn"]')
			.click()
	}

	function testZoomOut(scatter) {
		const scale = scatter.Inner.k
		test.ok(scale < 1, `Plot should zoom out`)
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
			scatter.Inner.showGroupMenu(new PointerEvent('click'), scatter.Inner.config.groups[i])
			await sleep(1000)
			const groupMenuTitleDiv = scatter.Inner.dom.tip.d.selectAll('div[name="sjpp-group-input-div"]').node()
			test.ok(groupMenuTitleDiv.innerHTML.endsWith(group.name), `Should display ${group.name} menu`)

			scatter.Inner.showTable(group, 0, 0)
			testSampleTable(scatter, i, group)
		}
	}

	function testSampleTable(scatter, i, group) {
		const samplesRendered = scatter.Inner.dom.tip.d.selectAll('.sjpp_row_wrapper > td:nth-child(3)').nodes()
		let samples2Check = []
		for (const item of samplesRendered) {
			samples2Check.push(item.innerHTML)
		}

		//Check every sample in group renders in sample table
		let foundSamples = 0
		for (const sampleData of scatter.Inner.config.groups[i].items) {
			if (samples2Check.some(d => d == sampleData.sample)) ++foundSamples
			else notFound.push(sampleData.sample)
		}
		test.equal(samples2Check.length, foundSamples, `Should render all samples for ${group.name}`)

		if (test._ok) scatter.Inner.dom.tip.d.remove()
	}
})
