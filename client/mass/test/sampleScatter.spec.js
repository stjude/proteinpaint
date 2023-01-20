'use strict'
const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const d3color = require('d3-color')
const d3s = require('d3-selection')
const d3drag = require('d3-drag')

/* Launch from http://localhost:3000/testrun.html?name=sampleScatter */

/*************************
 reusable helper functions
**************************/

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
			colorTW: {
				id: 'TSNE Category'
			},
			name: 'Methylome TSNE'
		}
	]
}

const open_state = {
	nav: {
		header_mode: 'hide_search'
	},
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: {
				id: 'TSNE Category'
			},
			name: 'Methylome TSNE',
			settings: {
				controls: {
					isOpen: true
				}
			}
		}
	]
}

// Considering removing for Airen's testCreateGroup() code of perhaps
// Another function once termdbTest is ready
const groupState = {
	nav: {
		header_mode: 'hide_search'
	},
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: {
				id: 'TSNE Category'
			},
			name: 'Methylome TSNE',
			groups: [
				{
					name: 'Test group',
					items: [
						{
							__data__: {
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
							}
						},
						{
							__data__: {
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
							}
						},
						{
							__data__: {
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
						}
					],
					index: 1
				}
			]
		}
	]
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mass/sampleScatter -***-')
	test.end()
})

tape('Render PNET scatter plot', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		const scatterDiv = scatter.Inner.dom.holder
		testPlot()
		testLegendTitle()
		testCreateGroupPlots()

		/* 
		Commented out because of "TypeError: Cannot...." error. 
		Cannot destory event survival sandbox. 
		
		TODO: Will add holder to destory both sandboxes after all tests pass.
		*/
		// if (test._ok) scatter.Inner.app.destroy()
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
			const legendG = scatterDiv.select('.sjpcb-scatter-legend')
			test.true(legendG != null, 'Should have a legend')
			//scatter.Inner.config.colorTW.id = category legend header
			test.true(
				legendG
					.select('#legendTitle')
					.text()
					.startsWith(scatter.Inner.config.colorTW.id),
				`Legend title should start with ${scatter.Inner.config.colorTW.id}`
			)
		}

		function testCreateGroupPlots() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const samples = serieG.selectAll('path').filter(s => s.category === 'ETMR')
			test.true(28 == samples.size(), `Group should have 28 symbols.`)

			/* TODO: since no holder is defined (separate from the body), the opening the survival plot 
			creates a "TypeError: Cannot read properties of undefined (reading 'append')" error
			Error throws at random under different tests. Will move to its own tape test.*/

			const self = scatter.Inner
			const group = {
				name: `Group 1`,
				items: samples,
				index: 0
			}
			self.config.groups.push(group)
			//Should be replaced by
			const term = {
				id: 'Event-free survival'
			}
			self.openSurvivalPlot(term, self.getGroupvsOthersOverlay(group))

			self.openSummaryPlot({ id: 'Gender' }, self.getGroupvsOthersOverlay(group))
		}
	}
})

tape('PNET plot + filter + colorTW=gene', function(test) {
	test.timeoutAfter(3000)

	const s2 = JSON.parse(JSON.stringify(state))
	s2.termfilter = {
		filter: {
			type: 'tvslst',
			join: '',
			in: true,
			lst: [{ type: 'tvs', tvs: { term: { id: 'Gender' }, values: [{ key: 'M', label: 'Male' }] } }]
		}
	}
	s2.plots[0].colorTW = { term: { type: 'geneVariant', name: 'TP53' } }

	runpp({
		state: s2,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		scatter.on('postRender.test', null)
		const scatterDiv = scatter.Inner.dom.holder

		testPlot()

		if (test._ok) scatter.Inner.app.destroy()
		test.end()

		function testPlot() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const numSymbols = serieG.selectAll('path').size()
			test.true(
				numSymbols == scatter.Inner.data.samples.length,
				`Should be ${scatter.Inner.data.samples.length}. Rendered ${numSymbols} symbols.`
			)
		}
	}
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

	const testTerm = 'ETMR'

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
			// .use(clickCategory, {wait: 300})
			// .to(testUnclickedCategory, {wait: 1000})
			.done(test)

		function testClickedCategory() {
			categoryLegend.dispatchEvent(new Event('click'))
			const findColorDots = scatterDiv
				.selectAll('.sjpcb-scatter-series > path')
				.nodes()
				.some(c => c.style.fill == testColor)
			test.ok(findColorDots == false, `Should remove all testTerm = ${testTerm} colored dots, color = ${testColor}`)
		}

		// function clickCategory(){
		// 	categoryLegend.dispatchEvent(new Event('click'))
		// }

		// function testUnclickedCategory(){
		// 	const findColorDots = scatterDiv.selectAll('.sjpcb-scatter-series > path').nodes().some(c => c.style.fill == testColor)
		// 	test.ok(findColorDots == true, `Should include ${testCategory.value.label} colored dots, color = ${testColor}`)
		// }
	}
})

tape('Create color groups from Edit', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: open_state,

		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
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
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await sleep(100)
		triggerReplace(scatter)

		// if (test._ok) scatter.Inner.app.destroy()
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

tape.skip('Add shape, clicking term and replace by search', function(test) {
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
		const addBtn = scatter.Inner.dom.controls
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
		const shapeLegend = scatter.Inner.dom.holder
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

tape('Change symbol and reference size from menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: open_state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
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
			callbacks: {
				'postRender.test': runTests
			}
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
			callbacks: {
				'postRender.test': runTests
			}
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

tape.skip('Click download button for SVG', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		// if (test._ok) scatter.Inner.app.destroy()
		test.end()
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

tape.skip('Zoom in and zoom out on mousedown', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state,
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		//TODO
		//Add tests for changes in axes
	}
})

tape.skip('Edit grouped samples', function(test) {
	test.timeoutAfter(3000)

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

		triggerGroupMenu(scatter)

		// if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function triggerGroupMenu(scatter) {
		const btn = scatter.Inner.dom.controls
			.selectAll('button > div')
			.nodes()
			.find(d => d.innerText == '①')
		btn.dispatchEvent(new Event('click'))
	}
})
