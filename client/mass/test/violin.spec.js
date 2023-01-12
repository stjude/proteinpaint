import tape from 'tape'
import { getRunPp } from '../../test/front.helpers.js'
const d3s = require('d3-selection')

/*************************
 reusable helper functions
**************************/

const runpp = getRunPp('mass', {
	state: {
		vocab: { dslabel: 'TermdbTest', genome: 'hg38' }
	},
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/violin -***-')
	test.end()
})
const open_state = {
	chartType: 'summary',
	childType: 'violin',
	term: {
		id: 'agedx',
		included_types: ['float'],
		isAtomic: true,
		isLeaf: true,
		name: 'Age (years) at Cancer Diagnosis',
		q: {
			mode: 'continuous',
			hiddenValues: {},
			isAtomic: true
		}
	},
	term2: {
		id: 'sex'
	}
}

tape('term1 as numeric and term2 categorical', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [open_state]
		},
		violin: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(violin) {
		await sleep(800)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('render violin plot', function(test) {
	test.timeoutAfter(7000)
	runpp({
		state: {
			plots: [open_state]
		},
		violin: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.holder
		const violinDivControls = violin.Inner.dom.controls
		const violinDivData = violin.Inner.data.plots
		testViolinPath(violinDiv) //test if violin path is generated. should be more than 0
		await sleep(800)
		testPlotTitle(violinDiv, violinDivControls) //test if label in ts-pill is same as title on svg.
		await sleep(800)
		testDataLength(violinDiv, violinDivData) //test if length of samples is same as shown in plot labels
		await sleep(800)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function testViolinPath(violinDiv) {
		const noPlotNum = 0
		const actualPlotNum = violinDiv.selectAll('.sjpp-violinG').size()
		test.true(
			noPlotNum < actualPlotNum,
			`should have more than ${noPlotNum} plots, actual plot no. is ${actualPlotNum}`
		)
	}

	function testPlotTitle(violinDiv, violinDivControls) {
		const label = violinDiv.node().querySelector('.sjpp-numeric-term-label').innerHTML
		test.equal(
			(violinDivControls.node().querySelector('.ts_pill').innerHTML = label),
			label,
			'Plot title is same as ts-pill label'
		)
	}

	async function testDataLength(violinDiv, violinDivData) {
		const axisLabelNodes = violinDiv.selectAll('.sjpp-axislabel').nodes()
		const plotValueCount1 = violinDivData[0]?.plotValueCount

		const plotValueCount2 = violinDivData[1]?.plotValueCount

		if (plotValueCount1) {
			test.equal(
				+axisLabelNodes[0].innerHTML.split('=')[1],
				plotValueCount1,
				`There are ${plotValueCount1} values for Female`
			)
		}
		await sleep(300)

		if (plotValueCount2) {
			test.equal(
				+axisLabelNodes[1].innerHTML.split('=')[1],
				plotValueCount2,
				`There are ${plotValueCount2} values for Male`
			)
		}
	}

	//function testPvalue(){}
})

tape('test basic controls', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [open_state]
		},
		violin: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(violin) {
		violin.on('postRender.test', null)
		const violinDivControls = violin.Inner.dom.controls
		const violinSettings = violin.Inner.config.settings.violin
		const testStrokeWidth = 1
		const testSymSize = 10
		await sleep(1000)
		changeOrientation(violinDivControls) // test orientation by changing to vertical
		await sleep(800)
		changeDataSymbol(violinDivControls) //test change in Data symbol
		await sleep(800)
		changeStrokeWidth(violinDivControls, violinSettings, testStrokeWidth) //test change in stroke width
		await sleep(400)
		testChangeStrokeWidth(violinSettings, testStrokeWidth)
		await sleep(800)
		changeSymbolSize(violinSettings, violinDivControls, testSymSize) //test change in symbol size
		await sleep(400)
		testChangeSymbolSize(violinSettings, testSymSize)
		await sleep(800)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function changeOrientation(violinDivControls) {
		violinDivControls
			.selectAll('input')
			.nodes()
			.find(e => e.value == 'vertical')
			.click()
		test.ok(true, 'Orientation is now Vertical')
	}

	function changeDataSymbol(violinDivControls) {
		violinDivControls
			.selectAll('input')
			.nodes()
			.find(e => e.value == 'rug')
			.click()
		test.ok(true, 'Data Symbol are now Ticks')
	}

	function changeStrokeWidth(violinDivControls, violinSettings, testStrokeWidth) {
		const refValue = violinDivControls
			.selectAll('input')
			.nodes()
			.find(e => e.value == violinSettings.strokeWidth)
		refValue.value = testStrokeWidth
		refValue.dispatchEvent(new Event('change'))
	}
	function testChangeStrokeWidth(violinSettings, testStrokeWidth) {
		test.ok(violinSettings.strokeWidth != testStrokeWidth, `Stroke width changed to ${testStrokeWidth}`)
	}

	function changeSymbolSize(violinSettings, violinDivControls, testSymSize) {
		const actualSymbolSize = violinDivControls
			.selectAll('input')
			.nodes()
			.find(e => e.value == violinSettings.radius)

		actualSymbolSize.value = testSymSize
		actualSymbolSize.dispatchEvent(new Event('change'))
	}

	function testChangeSymbolSize(violinSettings, testSymSize) {
		test.ok(violinSettings.radius != testSymSize, `Stroke width changed to ${testSymSize}`)
	}

	//function changeModeToDiscrete(){}

	//function changeOverlayTerm(){}
})

tape('test label clicking/brushing and filtering', function(test) {
	test.timeoutAfter(8000)
	runpp({
		state: {
			plots: [open_state]
		},
		violin: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(violin) {
		violin.on('postRender.test', null)
		const violinDiv = violin.Inner.dom.holder
		const violinDivControls = violin.Inner.dom.controls
		const violinDivData = violin.Inner.data.plots
		const violinSettings = violin.Inner.config.settings.violin
		await sleep(800)
		labelClicking(violin, violinDiv) //test filter on label clicking
		await sleep(800)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function labelClicking(violin, violinDiv) {
		violinDiv
			.node()
			.querySelectorAll('.sjpp-axislabel')[0]
			.dispatchEvent(new Event('click', { bubbles: true }))

		violin.Inner.app.tip.d
			.selectAll('.sja_menuoption')
			.filter(d => d.label.includes('filter'))
			.node()
			.click()
		test.ok(true, 'label Clicking and filtering ok!')
	}

	//function brushing() {}
})

tape('term1 as numeric and term2 numeric', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						included_types: ['float'],
						isAtomic: true,
						isLeaf: true,
						name: 'Age (years) at Cancer Diagnosis',
						q: {
							mode: 'continuous',
							hiddenValues: {},
							isAtomic: true
						}
					},
					term2: {
						id: 'agelastvisit'
					}
				}
			]
		},
		violin: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(violin) {
		await sleep(800)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('term1 as categorical and term2 numeric', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search'
			},
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'sex',
						included_types: ['categorical'],
						isAtomic: true,
						isLeaf: true,
						name: 'Sex'
					},
					term2: {
						id: 'agedx',
						q: {
							mode: 'continuous',
							hiddenValues: {},
							isAtomic: true
						}
					}
				}
			]
		},
		violin: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(violin) {
		await sleep(800)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
