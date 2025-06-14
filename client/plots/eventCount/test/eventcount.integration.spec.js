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
			chartType: 'eventCount',
			term: { id: 'date' },
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
	test.pass('-***- plots/eventCount -***-')
	test.end()
})

tape('Render TermdbTest eventCount plot', function (test) {
	test.timeoutAfter(8000)
	test.plan(1)
	const holder = getHolder()
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state,
		eventCount: {
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

tape('Test scale dot', function (test) {
	test.timeoutAfter(8000)
	test.plan(2)
	const holder = getHolder()
	const state = {
		plots: [
			{
				chartType: 'eventCount',
				term: { id: 'date' },
				scaleDotTW: { id: 'agedx', q: { mode: 'continuous' } }
			}
		]
	}
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state,
		eventCount: {
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
		eventCount: {
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
		eventCount: {
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

tape('Show accrual', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'eventCount',
					term: { id: 'date' },
					settings: { eventCount: { showAccrual: true } }
				}
			]
		},
		eventCount: {
			callbacks: { 'postRender.test': runTests }
		}
	})

	async function runTests(scatter) {
		const chart = scatter.Inner.model.charts[0]
		const lastEvent = chart.events[chart.events.length - 1]
		const sum = chart.cohortSamples.length
		test.equal(lastEvent, sum, `the last event y value should be equal to the sum of all samples`)
	}
})

tape('Change chart width and height from menu', function (test) {
	test.timeoutAfter(1000)

	runpp({
		state,
		eventCount: {
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
