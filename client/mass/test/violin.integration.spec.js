import tape from 'tape'
import { getRunPp } from '../../test/front.helpers.js'
import { fillTermWrapper } from '../../termsetting/termsetting.js'
import { getFilterItemByTag } from '../../filter/filter.js'
import { filterJoin } from '../../filter/filter.js'

/*************************
 reusable helper functions
**************************/

const runpp = getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' }
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
		const legendDiv = violin.Inner.dom.legendDiv
		const violinDiv = violin.Inner.dom.violinDiv
		const violinPvalueDiv = violin.Inner.dom.tableHolder
		const violinDivControls = violin.Inner.dom.controls
		const violinDivData = violin.Inner.data.plots
		await sleep(800)
		testViolinPath(violinDiv) //test if violin path is generated. should be more than 0
		await sleep(800)
		testPlotTitle(violinDiv, violinDivControls) //test if label in ts-pill is same as title on svg.
		await sleep(800)
		testDataLength(violinDiv, violinDivData) //test if length of samples is same as shown in plot labels
		await sleep(800)
		testPvalue(violin, violinPvalueDiv)
		await sleep(800)
		testDescrStats(violin, legendDiv)
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

	function testPvalue(violin, violinPvalueDiv) {
		test.equal(
			+violin.Inner.data.pvalues[0][2].html,
			+violinPvalueDiv.node().querySelectorAll('.sjpp_table_item')[5].innerHTML,
			`p-value of ${+violinPvalueDiv.node().querySelectorAll('.sjpp_table_item')[5].innerHTML} is correct`
		)
	}

	function testDescrStats(violin, legendDiv) {
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[0]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[0].value,
			'Total n values rendered'
		)
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[1]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[1].value,
			'Minimum value rendered'
		)
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[2]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[2].value,
			'1st quartile value rendered'
		)
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[3]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[3].value,
			'Median value rendered'
		)
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[4]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[4].value,
			'Mean value rendered'
		)
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[5]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[5].value,
			'3rd quartile value rendered'
		)
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[6]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[6].value,
			'Max value rendered'
		)
		test.equal(
			+legendDiv
				.node()
				.querySelectorAll('.legend-row')[7]
				.innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[7].value,
			'Standard deviation rendered'
		)
	}
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
		await sleep(800)
		changeOrientation(violinDivControls) // test orientation by changing to vertical
		await sleep(700)
		changeDataSymbol(violinDivControls) //test change in Data symbol
		await sleep(700)
		await changeOverlayTerm(violin) //test change in term2/overlay term
		await sleep(400)
		changeStrokeWidth(violinDivControls, violinSettings, testStrokeWidth) //test change in stroke width
		await sleep(300)
		testChangeStrokeWidth(violinSettings, testStrokeWidth)
		await sleep(700)
		changeSymbolSize(violinSettings, violinDivControls, testSymSize) //test change in symbol size
		await sleep(300)
		testChangeSymbolSize(violinSettings, testSymSize)
		await sleep(700)
		changeModeToDiscrete(violin) //test change in q: {mode: 'Discrete'} to display barchart
		await sleep(1000)
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

	async function changeOverlayTerm(violin) {
		violin.Inner.app.dispatch({
			id: violin.Inner.id,
			type: 'plot_edit',
			config: {
				term2: await fillTermWrapper({ id: 'genetic_race' }, violin.Inner.app.vocabApi)
			}
		})
	}

	async function changeModeToDiscrete(violin) {
		// console.log(242, violin.getComponents('controls.config.term1').Inner.pill.Inner.dom.tip.d.selectAll('.sjpp-toggle-button'));
		violin.Inner.app.dispatch({
			id: violin.Inner.id,
			type: 'plot_edit',
			config: {
				term: await fillTermWrapper({ id: 'agedx', q: { mode: 'discrete' } }, violin.Inner.app.vocabApi)
			}
		})
		test.ok(true, "q.mode changed to 'Discrete' ")
	}
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
		const violinDiv = violin.Inner.dom.violinDiv
		const violinDivData = violin.Inner.data.plots
		const violinSettings = violin.Inner.config.settings.violin
		await sleep(800)
		labelClicking(violin, violinDiv) //test filter on label clicking
		await sleep(800)
		testFiltering(violin, violinSettings, violinDivData) //test filtering by providing tvs.lst object
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

	//This function tests filtering based on range provided.
	async function testFiltering(violin) {
		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					tvs: {
						term: {
							groupsetting: { disbled: true },
							id: 'sex',
							isLeaf: true,
							name: 'Sex',
							type: 'categorical',
							values: {
								1: { label: 'Male' },
								2: { label: 'Female' }
							}
						},
						values: [{ key: '2' }]
					},
					type: 'tvs'
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [
							{
								start: 12.289737495475805,
								stop: 16.794964344698805
							}
						],
						term: {
							id: 'agedx',
							isleaf: true,
							name: 'Age (years) at Cancer Diagnosis',
							type: 'float',
							bins: {
								default: {
									type: 'regular-bin',
									bin_size: 5,
									startinclusive: true,
									first_bin: {
										startunbounded: true,
										stop: 5
									}
								},
								label_offset: 1
							}
						}
					}
				}
			]
		}
		const filterUiRoot = getFilterItemByTag(violin.Inner.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, tvslst])
		filter.tag = 'filterUiRoot'
		violin.Inner.app.dispatch({
			type: 'filter_replace',
			filter
		})
		test.ok(true, 'Filtering works as expected upon given range(start, stop) of values')
	}
})

tape('test Hide option on label clicking', function(test) {
	test.timeoutAfter(5000)
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
		const legendDiv = violin.Inner.dom.legendDiv
		await sleep(800)
		testHideOption(violin, legendDiv) //test filter on label clicking
		await sleep(800)
		testHiddenValues(violin, legendDiv)
		await sleep(500)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function testHideOption(violin) {
		const q = {
			groupsetting: { disabled: true },
			hiddenValues: { 'Female, n=35': 1 },
			isAtomic: true,
			type: 'values'
		}
		violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				term2: {
					isAtomic: true,
					id: violin.Inner.config.term2.id,
					term: violin.Inner.config.term2.term,
					q: q
				}
			}
		})
		test.ok(true, 'label Clicking and Hide option ok!')
	}

	async function testHiddenValues(violin, legendDiv) {
		await sleep(300)
		test.true(
			violin.Inner.config.term2.q.hiddenValues[legendDiv.node().querySelectorAll('.sjpp-htmlLegend')[8].innerHTML],
			'q.hiddenValues match legend'
		)
	}
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

tape('test custom groupsetting from Methylome tSNE', function(test) {
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
						id: 'agedx',
						included_types: ['float'],
						isAtomic: true,
						isLeaf: true,
						name: 'Age (years) at Cancer Diagnosis',
						q: {
							mode: 'continuous'
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
		violin.on('postRender.test', null)
		testSamplelst(violin)
		await sleep(400)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function testSamplelst(violin) {
		violin.Inner.app.dispatch({
			id: violin.Inner.id,
			type: 'plot_edit',
			config: {
				term2: {
					term: {
						name: 'Methylome TSNE groups',
						type: 'samplelst'
					},
					q: {
						mode: 'custom-groupsetting',
						groups: [
							{
								name: 'Group 1',
								key: 'sample',
								values: ['2646', '2800', '2856', '2884', '2954', '3150']
							},
							{
								name: 'Others',
								key: 'sample',
								in: false,
								values: ['2646', '2800', '2856', '2884', '2954', '3150']
							}
						],
						isAtomic: true
					},
					isAtomic: true
				}
			}
		})
		test.ok(true, 'Custom groups rendered')
	}
})
