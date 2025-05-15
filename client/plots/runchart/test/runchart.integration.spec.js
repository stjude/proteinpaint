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
} from '../../../test/test.helpers.js'
import { mclass } from '#shared/common.js'

/*
Tests:
	Render TermdbTest summary plot
	Test legend
	Change symbol and reference size from menu
	Change chart width and height from menu
	Click zoom in, zoom out, and reset buttons
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
			chartType: 'runChart',
			term: { id: 'date' },
			term2: { id: 'hrtavg' },
			colorTW: { id: 'sex' }
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
	test.pass('-***- plots/runchart -***-')
	test.end()
})

tape('Render TermdbTest runchart plot', function (test) {
	test.timeoutAfter(8000)
	test.plan(1)
	const holder = getHolder()
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state,
		runChart: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		const scatterDiv = scatter.Inner.model.charts[0].chartDiv

		testPlot()
		testLegendTitle()

		if (test._ok) holder.remove()
		test.end()

		function testPlot() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const numSymbols = serieG.selectAll('path').size() - 1 // exclude the path connecting the dots
			test.equal(
				numSymbols,
				scatter.Inner.model.charts[0].data.samples.length,
				`Should be ${scatter.Inner.model.charts[0].data.samples.length}. Rendered ${numSymbols} symbols.`
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
	}
})

// tape('Show tooltip for sample', function (test) {
// 	test.timeoutAfter(8000)
// 	test.plan(2)
// 	const holder = getHolder()
// 	runpp({
// 		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
// 		state,
// 		runchart: {
// 			callbacks: {
// 				'postRender.test': runTests
// 			}
// 		}
// 	})

// 	async function runTests(scatter) {
// 		scatter.on('postRender.test', null)
// 		const chart = scatter.Inner.model.charts[0]
// 		const sample = groups[0].items[0]
// 		scatter.Inner.vm.scatterTooltip.showSampleTooltip(sample, 100, 100, chart)
// 		const tooltipDiv = scatter.Inner.view.dom.tooltip.d.node()
// 		const tree = scatter.Inner.vm.scatterTooltip.tree
// 		const parentNode = tree.find(n => n.id == 'Acute lymphoblastic leukemia' && n.samples.length == 3)
// 		test.true(parentNode != null, 'Tooltip should have 3 samples for Acute lymphoblastic leukemia')
// 		test.true(tooltipDiv != null, 'Tooltip should be shown')
// 		scatter.Inner.view.dom.tooltip.hide()
// 		if (test._ok) holder.remove()
// 		test.end()
// 	}
// })

tape('Test scale dot', function (test) {
	test.timeoutAfter(8000)
	test.plan(2)
	const holder = getHolder()
	const state = {
		plots: [
			{
				chartType: 'runChart',
				term: { id: 'date' },
				term2: { id: 'hrtavg' },
				scaleDotTW: { id: 'agedx', q: { mode: 'continuous' } }
			}
		]
	}
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state,
		runChart: {
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
		const minSize = (self.settings.minShapeSize * self.vm.scatterZoom.zoom) / 3

		const maxSize = (self.settings.maxShapeSize * self.vm.scatterZoom.zoom) / 3 //original icons are scaled to 0.3

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

tape('Test legend', function (test) {
	test.timeoutAfter(3000) //Fix for breaking on local CI but maynot be necessary for nightly build

	runpp({
		state: structuredClone(state),
		runChart: {
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
		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	async function testHideCategory(scatter, samples) {
		const key = 'Female'
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
		})
		test.equal(
			matched.filter(t => t.__data__.category == key).length,
			expectedNum,
			`Should remove all samples with category = ${key}`
		)
	}
})

tape('Change symbol size from menu', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state,
		runChart: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	const testSymSize = 300

	async function runTests(scatter) {
		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.use(changeSymbolInput)
			.to(testSymbolSize, { wait: 100 })
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
})

tape('Change chart width and height from menu', function (test) {
	test.timeoutAfter(1000)

	runpp({
		state,
		runChart: {
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

tape('Click zoom in, zoom out, and reset buttons', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: structuredClone(state),
		runChart: {
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
		await detectTransform(scatter, zoomin_bt, 1.2)
		const scale = scatter.Inner.vm.scatterZoom.zoom
		test.ok(scale > 1, `Plot should zoom in`)
	}

	async function testReset(scatter) {
		const reset_bt = scatter.Inner.view.dom.toolsDiv.node().querySelector('div[name="sjpp-reset-btn"]')
		await detectTransform(scatter, reset_bt, 1)
		const scale = scatter.Inner.vm.scatterZoom.zoom
		test.ok(scale == 1, `Plot should reset`)
	}

	async function testZoomOut(scatter) {
		const zoomout_bt = scatter.Inner.view.dom.toolsDiv.node().querySelector('div[name="sjpp-zoom-out-btn"]')
		await detectTransform(scatter, zoomout_bt, 0.8)
		const scale = scatter.Inner.vm.scatterZoom.zoom
		test.ok(scale < 1, `Plot should zoom out`)
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
