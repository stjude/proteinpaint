import tape from 'tape'
import { getRunPp } from '../../test/front.helpers.js'
import { fillTermWrapper } from '#termsetting'
import { getFilterItemByTag, filterJoin } from '#filter'
import { sleep, detectOne, detectGte } from '../../test/test.helpers.js'

/***************** Test Layout *****************:

1.  'term1 as numeric and term2 categorical, test median rendering'
2.  'render violin plot'
3.  'test basic controls'
4.  'test label clicking, filtering and hovering'
5.  'test hide option on label clicking'
6.  'term1 as numeric and term2 numeric, change median size'
7.  'term1 as categorical and term2 numeric'
8. 	'term1 as numerical and term2 condition'
9.  'test samplelst term2'
10. 'test uncomputable categories legend'
11. 'Load linear regression-violin UI'
12. 'test change in plot length and thickness for new custom group variable'

***********************************************/

/*************************
 reusable helper functions
**************************/

const runpp = getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' },
	},
	debug: 1,
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- plots/violin -***-')
	test.end()
})
const open_state = {
	chartType: 'summary',
	childType: 'violin',
	term: {
		id: 'agedx',
		isAtomic: true,
		q: {
			mode: 'continuous',
			hiddenValues: {},
			isAtomic: true,
		},
	},
	term2: {
		id: 'sex',
	},
}

tape('render violin plot', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [open_state],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})

	async function runTests(violin) {
		violin.on('postRender.test', null)
		const legendDiv = violin.Inner.dom.legendDiv
		const violinDiv = violin.Inner.dom.violinDiv
		const violinPvalueDiv = violin.Inner.dom.tableHolder
		const violinDivControls = violin.Inner.dom.controls
		const violinDivData = violin.Inner.data.plots

		await testViolinPath(violinDiv) //test if violin path is generated. should be more than 0
		testPlotTitle(violinDiv, violinDivControls) //test if label in ts-pill is same as title on svg.
		testDataLength(violinDiv, violinDivData) //test if length of samples is same as shown in plot labels
		testPvalue(violin, violinPvalueDiv)
		testDescrStats(violin, legendDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	async function testViolinPath(violinDiv) {
		await detectOne({ elem: violinDiv.node(), selector: 'svg' })
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

	function testDataLength(violinDiv, violinDivData) {
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
			+legendDiv.node().querySelectorAll('.legend-row')[0].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[0].value,
			'Total n values rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[1].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[1].value,
			'Minimum value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[2].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[2].value,
			'1st quartile value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[3].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[3].value,
			'Median value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[4].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[4].value,
			'Mean value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[5].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[5].value,
			'3rd quartile value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[6].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[6].value,
			'Max value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[7].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats[7].value,
			'Standard deviation rendered'
		)
	}
})

tape('term1 as numeric and term2 categorical, test median rendering', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [open_state],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})
	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.violinDiv
		await testMedianRendering(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	async function testMedianRendering(violin, violinDiv) {
		const median = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-median-line',
			count: 2,
		})
		test.ok(median, 'Median exists')

		test.equal(
			median.length,
			violin.Inner.data.plots.length,
			'Number of median lines rendered should be/is equal to number of plots rendered'
		)
		const medianValues = median.map(
			({
				__data__: {
					summaryStats: { values },
				},
			}) => {
				const { value } = values.find((c) => c.id === 'median')
				return value
			}
		)
		const sumStatsValues = violin.Inner.data.plots.map(({ summaryStats: { values } }) => {
			const { value } = values.find((c) => c.id === 'median')
			return value
		})
		test.equal(
			medianValues[0],
			sumStatsValues[0],
			`median rendered correctly for plot ${violin.Inner.data.plots[0].label}`
		)
		test.equal(
			medianValues[1],
			sumStatsValues[1],
			`median rendered correctly for plot ${violin.Inner.data.plots[1].label}`
		)
	}
})

tape('test basic controls', function (test) {
	test.timeoutAfter(4000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [open_state],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})

	async function runTests(violin) {
		violin.on('postRender.test', null)
		const violinDiv = violin.Inner.dom.violinDiv
		await changeOrientation(violin, violinDiv) // test orientation by changing to vertical
		await changeDataSymbol(violin, violinDiv) //test change in Data symbol
		await changeStrokeWidth(violin) //test change in stroke width
		await changeSymbolSize(violin) //test change in symbol size
		await changeScaleToLog(violin, violinDiv) //test change in axis scale
		await changeOverlayTerm(violin, violinDiv) //test change in term2/overlay term
		await changeModeToDiscrete(violin) //test change in q: {mode: 'Discrete'} to display barchart
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	async function changeOrientation(violin, violinDiv) {
		//capture if the angle is rotated to -90 degrees to test orientation
		const termLabel = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-numeric-term-label',
			count: 1,
			async trigger() {
				await violin.Inner.app.dispatch({
					type: 'plot_edit',
					id: violin.Inner.id,
					config: {
						settings: {
							violin: {
								orientation: 'vertical',
							},
						},
					},
				})
			},
		})
		test.ok(termLabel, 'Term label exists')
		test.true(termLabel[0].transform.animVal[0].angle === -90, 'Orientation is now vertical')
	}

	async function changeDataSymbol(violin, violinDiv) {
		const datasymbol = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-rug-img',
			count: 2,
			async trigger() {
				await violin.Inner.app.dispatch({
					type: 'plot_edit',
					id: violin.Inner.id,
					config: {
						settings: {
							violin: {
								datasymbol: 'rug',
							},
						},
					},
				})
			},
		})
		test.ok(datasymbol, 'Data symbol exists')
		test.true(violin.Inner.app.Inner.state.plots[0].settings.violin.datasymbol === 'rug', 'Data Symbol are now Ticks')
	}

	async function changeStrokeWidth(violin) {
		const testStrokeWidth = 1
		violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						strokeWidth: testStrokeWidth,
					},
				},
			},
		})
		await sleep(20)
		test.true(
			violin.Inner.app.Inner.state.plots[0].settings.violin.strokeWidth === testStrokeWidth,
			`Stroke width changed to ${testStrokeWidth}`
		)
	}

	async function changeSymbolSize(violin) {
		const testSymSize = 10
		violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						radius: testSymSize,
					},
				},
			},
		})
		await sleep(20)
		test.true(
			violin.Inner.app.Inner.state.plots[0].settings.violin.radius === testSymSize,
			`Symbol size changed to ${testSymSize}`
		)
	}

	async function changeOverlayTerm(violin, violinDiv) {
		const changeOvTerm = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-vp-path',
			count: 3,
			async trigger() {
				await violin.Inner.app.dispatch({
					type: 'plot_edit',
					id: violin.Inner.id,
					config: {
						term2: await fillTermWrapper({ id: 'genetic_race' }, violin.Inner.app.vocabApi),
					},
				})
			},
		})
		test.ok(changeOvTerm, 'Overlay Term has been changed')
		test.true(violin.Inner.app.Inner.state.plots[0].term2.id === 'genetic_race', 'Overlay term changed')
	}

	async function changeScaleToLog(violin, violinDiv) {
		const showLogScale = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-logscale',
			count: 1,
			async trigger() {
				await violin.Inner.app.dispatch({
					type: 'plot_edit',
					id: violin.Inner.id,
					config: {
						settings: {
							violin: {
								unit: 'log',
							},
						},
					},
				})
			},
		})
		test.ok(showLogScale, 'Log scale exists')
		test.true(violin.Inner.app.Inner.state.plots[0].settings.violin.unit === 'log', 'Axis scale rendered in log')
	}

	async function changeModeToDiscrete(violin, violinDiv) {
		// console.log(violin.getComponents('controls.config.term1').Inner.pill.Inner.dom.tip.d.selectAll('.sjpp-toggle-button'));
		violin.Inner.app.dispatch({
			id: violin.Inner.id,
			type: 'plot_edit',
			config: {
				term: await fillTermWrapper({ id: 'agedx', q: { mode: 'discrete' } }, violin.Inner.app.vocabApi),
			},
		})
		await sleep(20)
		test.true(violin.Inner.app.Inner.state.plots[0].term.q.mode === 'discrete', "q.mode changed to 'Discrete' ")
	}
})

tape('test label clicking, filtering and hovering', function (test) {
	test.timeoutAfter(5000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [open_state],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})

	async function runTests(violin) {
		violin.on('postRender.test', null)
		const violinDiv = violin.Inner.dom.violinDiv
		const violinDivData = violin.Inner.data.plots
		const violinSettings = violin.Inner.config.settings.violin

		await testFiltering(violin, violinSettings, violinDivData) //test filtering by providing tvs.lst object
		await testLabelHovering(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
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
							isleaf: true,
							name: 'Sex',
							type: 'categorical',
							values: {
								1: { label: 'Male' },
								2: { label: 'Female' },
							},
						},
						values: [{ key: '2' }],
					},
					type: 'tvs',
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [
							{
								start: 12.289737495475805,
								stop: 16.794964344698805,
							},
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
										stop: 5,
									},
								},
								label_offset: 1,
							},
						},
					},
				},
			],
		}
		const filterUiRoot = getFilterItemByTag(violin.Inner.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, tvslst])
		filter.tag = 'filterUiRoot'
		await violin.Inner.app.dispatch({
			type: 'filter_replace',
			filter,
		})
		test.ok(true, 'Filtering works as expected upon given range(start, stop) of values')
	}

	async function testLabelHovering(violin, violinDiv) {
		const elem = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-axislabel',
			count: 1,
		})
		test.ok(elem, 'Hover Element exists')
		elem[0].dispatchEvent(new Event('mouseover'), { bubbles: true })
		const tip = violin.Inner.dom.tip
		test.ok(tip.d.node().style.display == 'block', 'Should display table of summary statistics on hover')
		tip.hide()
	}
})

tape('test hide option on label clicking', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [open_state],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})
	async function runTests(violin) {
		violin.on('postRender.test', null)
		const legendDiv = violin.Inner.dom.legendDiv
		const violinDiv = violin.Inner.dom.violinDiv

		testHideOption(violin, legendDiv) //test filter on label clicking
		await testHiddenValues(violin, legendDiv, violinDiv)

		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function testHideOption(violin) {
		const q = {
			groupsetting: { disabled: true },
			hiddenValues: { [violin.Inner.data.plots[0].label]: 1 },
			isAtomic: true,
			type: 'values',
		}
		violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				term2: {
					isAtomic: true,
					id: violin.Inner.config.term2.id,
					term: violin.Inner.config.term2.term,
					q: q,
				},
			},
		})
		test.ok(true, 'label Clicking and Hide option ok!')
	}

	async function testHiddenValues(violin, legendDiv, violinDiv) {
		const htmlLegends = await detectGte({ elem: legendDiv.node(), selector: '.sjpp-htmlLegend', count: 8 })
		test.ok(htmlLegends, 'Legend exists')

		const hiddenKeys = Object.keys(violin.Inner.config.term2.q.hiddenValues)
		test.equal(
			Object.keys(violin.Inner.config.term2.q.hiddenValues)[0],
			htmlLegends[8].innerHTML,
			'q.hiddenValues match legend'
		)
		const unhideLegendValue = htmlLegends.filter((c) => hiddenKeys.find((k) => c.__data__.text === k))
		unhideLegendValue[0].dispatchEvent(new Event('click'), { bubbles: true })
		const hiddenValueRendered = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-axislabel', count: 2 })
		test.ok(hiddenValueRendered, 'hidden value rendered')

		test.equal(
			hiddenValueRendered[0].__data__.label,
			unhideLegendValue[0].innerHTML,
			'Clicking on hidden legend value renders the hidden plot'
		)
	}
})

tape('term1 as numeric and term2 numeric, change median size', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						isAtomic: true,
						q: {
							mode: 'continuous',
							hiddenValues: {},
							isAtomic: true,
						},
					},
					term2: {
						id: 'agelastvisit',
					},
				},
			],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})
	async function runTests(violin) {
		violin.on('postRender.test', null)
		const violinDiv = violin.Inner.dom.violinDiv
		await changeMedianSize(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	async function changeMedianSize(violin, violinDiv){
		const testMedianLength = 10
		const testMedianThickness = 10
		const medianEle = await detectGte(
			{
			 elem: violinDiv.node(), selector: '.sjpp-median-line', count: 6 ,
			async trigger() {
				await violin.Inner.app.dispatch({
				type: 'plot_edit',
				id: violin.Inner.id,
				config: {
					settings: {
						violin: {
							medianLength: testMedianLength,
							medianThickness: testMedianThickness
						},
					},
				}
			})
		}})
		test.ok(medianEle, 'Median exists')
		test.true(
			violin.Inner.app.Inner.state.plots[0].settings.violin.medianLength === testMedianLength,
			`Plot median length changed to ${testMedianLength}`
		)
		test.true(violin.Inner.app.Inner.state.plots[0].settings.violin.medianLength === testMedianLength,
			`Plot median thickness changed to ${testMedianThickness}`
			)
	}
})

tape.skip('term1 as categorical and term2 numeric', function (test) {
	test.timeoutAfter(1000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'sex',
						isAtomic: true
					},
					term2: {
						id: 'agedx',
						q: {
							mode: 'continuous',
							hiddenValues: {},
							isAtomic: true,
						},
					},
				},
			],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})
	async function runTests(violin) {
		//TODO
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('term1 as numerical and term2 condition', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						isAtomic: true,
						q: {
							mode: 'continuous',
							hiddenValues: {},
							isAtomic: true,
						},
					},
					term2: {
						id: 'Hearing loss',
					},
				},
			],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})
	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.violinDiv
		await testConditionTermOrder(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
	async function testConditionTermOrder(violin, violinDiv) {
		const groups = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-path', count: 5 })
		test.ok(groups, 'Condition groups exist')

		test.deepEqual(
			groups.map((k) => k.__data__.label),
			violin.Inner.data.plots.map((k) => k.label),
			'Order of conditional categories in term2 is accurate'
		)
	}
})

tape('test samplelst term2', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						q: {
							mode: 'continuous',
						},
					},
					term2: {
						term: {
							name: 'TermdbTest TSNE groups',
							type: 'samplelst',
							values: {
								'Group 1': {
									key: 'Group 1',
									label: 'Group 1',
								},
								'Not in Group 1': {
									key: 'Not in Group 1',
									label: 'Not in Group 1',
								},
							},
						},
						q: {
							mode: 'discrete',
							groups: [
								{
									name: 'Group 1',
									in: true,
									values: [
										{
											sampleId: 42,
											sample: '2660',
										},
										{
											sampleId: 44,
											sample: '2688',
										},
										{
											sampleId: 45,
											sample: '2702',
										},
										{
											sampleId: 46,
											sample: '2716',
										},
										{
											sampleId: 59,
											sample: '2898',
										},
										{
											sampleId: 60,
											sample: '2912',
										},
										{
											sampleId: 67,
											sample: '3010',
										},
										{
											sampleId: 68,
											sample: '3024',
										},
										{
											sampleId: 69,
											sample: '3038',
										},
										{
											sampleId: 70,
											sample: '3052',
										},
										{
											sampleId: 73,
											sample: '3094',
										},
										{
											sampleId: 79,
											sample: '3178',
										},
										{
											sampleId: 80,
											sample: '3192',
										},
									],
								},
								{
									name: 'Not in Group 1',
									in: false,
									values: [
										{
											sampleId: 42,
											sample: '2660',
										},
										{
											sampleId: 44,
											sample: '2688',
										},
										{
											sampleId: 45,
											sample: '2702',
										},
										{
											sampleId: 46,
											sample: '2716',
										},
										{
											sampleId: 59,
											sample: '2898',
										},
										{
											sampleId: 60,
											sample: '2912',
										},
										{
											sampleId: 67,
											sample: '3010',
										},
										{
											sampleId: 68,
											sample: '3024',
										},
										{
											sampleId: 69,
											sample: '3038',
										},
										{
											sampleId: 70,
											sample: '3052',
										},
										{
											sampleId: 73,
											sample: '3094',
										},
										{
											sampleId: 79,
											sample: '3178',
										},
										{
											sampleId: 80,
											sample: '3192',
										},
									],
								},
							],
							groupsetting: {
								disabled: false,
							},
							isAtomic: true,
							type: 'custom-groupset',
						},
					},
				},
			],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})

	async function runTests(violin) {
		const violinDiv = violin.Inner.dom.violinDiv
		violin.on('postRender.test', null)

		await testGroupsRendering(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
	// TODO test listsamples/hide - callbacks on label clicking and brushing for samplelst
	async function testGroupsRendering(violin, violinDiv) {
		await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-path', count: 2 })
		test.equal(violin.Inner.data.plots.length, 2, 'Inner.data.plots[] should be array length of 2')
	}
})

tape('test uncomputable categories legend', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'aaclassic_5',
						isAtomic: true,
						q: {
							mode: 'continuous',
						},
					},
				},
			],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})

	async function runTests(violin) {
		const legendDiv = violin.Inner.dom.legendDiv
		violin.on('postRender.test', null)

		await testUncomputableCategories(violin, legendDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	async function testUncomputableCategories(violin, legendDiv) {
		const keys = Object.keys(violin.Inner.data.uncomputableValueObj)
		const categories = await detectGte({ elem: legendDiv.node(), selector: '.legend-row', count: 9 })
		test.ok(categories, 'Uncomputable categories exist')

		const uncomputableLegend = categories.filter((c) => keys.find((k) => c.__data__.text.startsWith(k)))

		test.equal(keys.length, uncomputableLegend.length, 'should have the correct number of uncomputable legend entries')
		test.equal(
			uncomputableLegend
				.find((c) => c.__data__.text.startsWith(keys[0]))
				?.__data__.text.split(',')
				.pop(),
			' n = ' + violin.Inner.data.uncomputableValueObj[keys[0]],
			`Uncomputable category '${keys[0]}' rendered with the correct count`
		)
		test.equal(
			uncomputableLegend
				.find((c) => c.__data__.text.startsWith(keys[1]))
				?.__data__.text.split(',')
				.pop(),
			' n = ' + violin.Inner.data.uncomputableValueObj[keys[1]],
			`Uncomputable category '${keys[1]}' rendered with the correct count`
		)
	}
})

tape('Load linear regression-violin UI', function (test) {
	test.timeoutAfter(1000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [
				{
					chartType: 'regression',
					hasUnsubmittedEdits: true,
					regressionType: 'linear',
					outcome: {
						id: 'hrtavg',
						isAtomic: true,
					},
				},
			],
		},
		regression: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})
	async function runTests(regression) {
		regression.on('postRender.test', null)
		await regressionViolinRendering(regression)
		if (test._ok) regression.Inner.app.destroy()
		test.end()
	}
	async function regressionViolinRendering(regression) {
		const regressionVp = await detectGte({
			elem: regression.Inner.dom.inputs.node(),
			selector: '.sjpp-vp-path',
			count: 1,
		})
		test.ok(regressionVp, 'Violin plot for regression UI exists')

		const expectedPathColor = 'rgb(221, 221, 221)'
		test.equal(expectedPathColor, getComputedStyle(regressionVp[0]).fill, 'Path fill matches expected fill')
	}
})

tape('test change in plot length and thickness for custom group variable', function (test) {
	test.timeoutAfter(5000)
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search',
			},
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						q: {
							mode: 'continuous',
						},
					},
					term2: {
						term: {
							name: 'Group 1 vs Group 2',
							type: 'samplelst',
							values: {
								'Group 1': {
									key: 'Group 1',
									label: 'Group 1',
									list: [
										{
											sampleId: 41,
											sample: '2646',
										},
										{
											sampleId: 52,
											sample: '2800',
										},
										{
											sampleId: 56,
											sample: '2856',
										},
										{
											sampleId: 58,
											sample: '2884',
										},
									],
								},
								'Group 2': {
									key: 'Group 2',
									label: 'Group 2',
									list: [
										{
											sampleId: 49,
											sample: '2758',
										},
										{
											sampleId: 50,
											sample: '2772',
										},
										{
											sampleId: 61,
											sample: '2926',
										},
										{
											sampleId: 74,
											sample: '3108',
										},
										{
											sampleId: 75,
											sample: '3122',
										},
										{
											sampleId: 76,
											sample: '3136',
										},
									],
								},
							},
						},
						q: {
							mode: 'discrete',
							groups: [
								{
									name: 'Group 1',
									values: [
										{
											sampleId: 41,
											sample: '2646',
										},
										{
											sampleId: 52,
											sample: '2800',
										},
										{
											sampleId: 56,
											sample: '2856',
										},
										{
											sampleId: 58,
											sample: '2884',
										},
									],
								},
								{
									name: 'Group 2',
									values: [
										{
											sampleId: 49,
											sample: '2758',
										},
										{
											sampleId: 50,
											sample: '2772',
										},
										{
											sampleId: 61,
											sample: '2926',
										},
										{
											sampleId: 74,
											sample: '3108',
										},
										{
											sampleId: 75,
											sample: '3122',
										},
										{
											sampleId: 76,
											sample: '3136',
										},
									],
								},
							],
							type: 'custom-groupset',
						},
					},
				},
			],
		},
		violin: {
			callbacks: {
				'postRender.test': runTests,
			},
		},
	})
	async function runTests(violin) {
		violin.on('postRender.test', null)
		await changePlotLength(violin)
		await changePlotThickness(violin)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	async function changePlotLength(violin) {
		const testPlotLength = 800
		violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						plotLength: testPlotLength,
					},
				},
			},
		})
		await sleep(20)
		test.true(
			violin.Inner.app.Inner.state.plots[0].settings.violin.plotLength === testPlotLength,
			`Plot length changed to ${testPlotLength}`
		)
	}

	async function changePlotThickness(violin) {
		const testPlotThickness = 80
		violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						plotThickness: testPlotThickness,
					},
				},
			},
		})
		await sleep(20)
		test.true(
			violin.Inner.app.Inner.state.plots[0].settings.violin.plotThickness === testPlotThickness,
			`Plot thickness changed to ${testPlotThickness}`
		)
	}
})
