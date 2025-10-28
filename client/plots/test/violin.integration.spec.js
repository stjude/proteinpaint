import tape from 'tape'
import { getRunPp } from '../../test/front.helpers.js'
import {
	getSamplelstTw,
	getCategoryGroupsetting,
	getGenesetMutTw,
	getSsgseaTw,
	getGeneVariantTw
} from '../../test/testdata/data.ts'
import { fillTermWrapper } from '#termsetting'
import { getFilterItemByTag, filterJoin } from '#filter'
import { sleep, detectOne, detectGte, detectLst, whenVisible, whenHidden } from '../../test/test.helpers.js'
import { select, brushX } from 'd3'

/**************
 test sections

agedx/sex, basic rendering
agedx/sex, basic controls
test label clicking, filtering and hovering
test hide option on label clicking
term1=categorical, term2=numeric
term1=numeric, term2=cat groupsetting
term1=numeric, term2=survival
term1=numeric, term2=geneVariant
term1=numeric, term2=geneVariant geneset
term1=numeric, term2=condition
term1=geneExp, term2=categorical
term1=geneExp, term2=cat groupsetting
term1=geneExp, term2=geneVariant
term1=geneExp, term2=geneVariant geneset
term1=ssgsea, term2=categorical
term1=ssgsea, term2=cat groupsetting
term1=ssgsea, term2=geneVariant
term1=ssgsea, term2=geneVariant geneset
term1=geneExp, term2=survival (SKIPPED)
term1=geneExp, term2=survival
term1=numeric, term2=samplelst
term1=geneexp, term2=samplelst
term1=ssgsea, term2=samplelst
term=agedx, term2=geneExp with regular bins
term=agedx, term2=geneExp with custom bins
term1=numeric, term0=categorical
term1=numeric, term2=numeric, term0=categorical
test uncomputable categories legend
Load linear regression-violin UI
term1=singleCellExpression, term2=singleCellCellType

***************/

tape('\n', function (test) {
	test.comment('-***- plots/violin -***-')
	test.end()
})

tape('agedx/sex, basic rendering', function (test) {
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
		const violinDivControls = violin.Inner.dom.controls
		const violinDivData = violin.Inner.data.charts

		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		testPlotTitle(violinDiv, violinDivControls) //test if label in ts-pill is same as title on svg.
		testPvalue(violin, violinDiv, violinDivData)
		testDescrStats(violin, legendDiv)
		await testMedianRendering(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function testPlotTitle(violinDiv, violinDivControls) {
		const label = violinDiv.node().querySelector('.sjpp-numeric-term-label').innerHTML
		test.equal(
			(violinDivControls.node().querySelector('.ts_pill').innerHTML = label),
			label,
			'Plot title is same as ts-pill label'
		)
	}

	function testPvalue(violin, violinDiv, violinDivData) {
		const violinPvalueDiv = violinDiv.selectAll('.sjpp-tableHolder')
		test.equal(violinPvalueDiv.size(), 1, 'Should have 1 p-value table')
		const pvalues = violinDivData[''].pvalues
		test.equal(
			+pvalues[0][2].html,
			+violinPvalueDiv.node().querySelectorAll('.sjpp_table_item')[5].innerHTML,
			`p-value of ${+violinPvalueDiv.node().querySelectorAll('.sjpp_table_item')[5].innerHTML} is correct`
		)
	}

	function testDescrStats(violin, legendDiv) {
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[0].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.total.value,
			'Total n values rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[1].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.min.value,
			'Minimum value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[2].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.p25.value,
			'1st quartile value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[3].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.median.value,
			'Median value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[4].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.p75.value,
			'3rd quartile value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[5].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.max.value,
			'Max value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[6].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.mean.value,
			'Mean value rendered'
		)
		test.equal(
			+legendDiv.node().querySelectorAll('.legend-row')[7].innerText.split(':')[1],
			+violin.Inner.config.term.q.descrStats.stdDev.value,
			'Standard deviation rendered'
		)
	}
	async function testMedianRendering(violin, violinDiv) {
		const median = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-median-line',
			count: 2
		})
		test.ok(median, 'Median exists')
		test.equal(
			median.length,
			violin.Inner.data.charts[''].plots.length,
			'Number of median lines rendered should be/is equal to number of plots rendered'
		)
		const medianValues = median.map(({ __data__: { summaryStats } }) => {
			const { value } = summaryStats.median
			return value
		})
		const sumStatsValues = violin.Inner.data.charts[''].plots.map(({ summaryStats }) => {
			const { value } = summaryStats.median
			return value
		})

		test.equal(
			medianValues[0],
			sumStatsValues[0],
			`median rendered correctly for plot ${violin.Inner.data.charts[''].plots[0].label}`
		)
		test.equal(
			medianValues[1],
			sumStatsValues[1],
			`median rendered correctly for plot ${violin.Inner.data.charts[''].plots[1].label}`
		)
	}
})

tape('agedx/sex, basic controls', function (test) {
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
		await changeSvgw(violin, violinDiv)
		await changeMedianSize(violin, violinDiv)
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

	async function changeSvgw(violin, violinDiv) {
		const svgw = 333
		await violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: { svgw }
				}
			}
		})
		test.equal(violin.Inner.app.Inner.state.plots[0].settings.violin.svgw, svgw, 'svgw changed in state')
	}
	async function changeMedianSize(violin, violinDiv) {
		const testMedianLength = 10
		const testMedianThickness = 10
		const medianEle = await detectGte({
			elem: violinDiv.node(),
			selector: '.sjpp-median-line',
			count: 1,
			async trigger() {
				await violin.Inner.app.dispatch({
					type: 'plot_edit',
					id: violin.Inner.id,
					config: {
						settings: {
							violin: {
								medianLength: testMedianLength,
								medianThickness: testMedianThickness
							}
						}
					}
				})
			}
		})
		test.ok(medianEle, 'Median exists')
		test.equal(
			violin.Inner.app.Inner.state.plots[0].settings.violin.medianLength,
			testMedianLength,
			'Median length changed in state'
		)
		test.equal(
			violin.Inner.app.Inner.state.plots[0].settings.violin.medianLength,
			testMedianLength,
			'Median thickness changed in state'
		)
	}
	async function changeOrientation(violin, violinDiv) {
		await violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						orientation: 'vertical'
					}
				}
			}
		})
		test.equal(
			violin.Inner.app.Inner.state.plots[0].settings.violin.orientation,
			'vertical',
			'state changed to vertical'
		)
	}

	async function changeDataSymbol(violin, violinDiv) {
		await violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						datasymbol: 'rug'
					}
				}
			}
		})
		test.true(violin.Inner.app.Inner.state.plots[0].settings.violin.datasymbol === 'rug', 'Data Symbol are now Ticks')
	}

	async function changeStrokeWidth(violin) {
		const testStrokeWidth = 1
		await violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						strokeWidth: testStrokeWidth
					}
				}
			}
		})
		test.true(
			violin.Inner.app.Inner.state.plots[0].settings.violin.strokeWidth === testStrokeWidth,
			`Stroke width changed to ${testStrokeWidth}`
		)
	}

	async function changeSymbolSize(violin) {
		const testSymSize = 10
		await violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				settings: {
					violin: {
						radius: testSymSize
					}
				}
			}
		})
		test.true(
			violin.Inner.app.Inner.state.plots[0].settings.violin.radius === testSymSize,
			`Symbol size changed to ${testSymSize}`
		)
	}

	async function changeOverlayTerm(violin, violinDiv) {
		const term2 = await fillTermWrapper({ id: 'genetic_race' }, violin.Inner.app.vocabApi)

		await violin.Inner.app.dispatch({
			type: 'plot_edit',
			id: violin.Inner.id,
			config: {
				term2
			}
		})
		test.true(violin.Inner.app.Inner.state.plots[0].term2.term.id === 'genetic_race', 'Overlay term changed')
	}

	async function changeScaleToLog(violin, violinDiv) {
		const showLogScale = await detectOne({
			elem: violinDiv.node(),
			selector: '.sjpp-logscale',
			async trigger() {
				await violin.Inner.app.dispatch({
					type: 'plot_edit',
					id: violin.Inner.id,
					config: {
						settings: {
							violin: {
								unit: 'log',
								plotThickness: 150
							}
						}
					}
				})
			}
		})
		test.ok(showLogScale, 'Log scale exists')
		test.true(violin.Inner.app.Inner.state.plots[0].settings.violin.unit === 'log', 'Axis scale rendered in log')
	}

	async function changeModeToDiscrete(violin, violinDiv) {
		violin.Inner.app.dispatch({
			id: violin.Inner.id,
			type: 'plot_edit',
			config: {
				term: await fillTermWrapper({ id: 'agedx', q: { mode: 'discrete' } }, violin.Inner.app.vocabApi)
			}
		})
		await sleep(20)
		test.true(violin.Inner.app.Inner.state.plots[0].term.q.mode === 'discrete', "q.mode changed to 'Discrete' ")
	}
})

tape('test label clicking, filtering and hovering', function (test) {
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search'
			},
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
		const violinDivData = violin.Inner.data.charts[''].plots
		const violinSettings = violin.Inner.config.settings.violin

		// before filtering there are two violins, one for each sex
		await testLabelHoverClick(test, violin, violinDiv, 2)
		// filter to just one sex
		await testFiltering(violin, violinSettings, violinDivData)
		// after filtering, just one sex is left
		await testLabelHoverClick(test, violin, violinDiv, 1)
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
							groupsetting: { disabled: true },
							id: 'sex',
							isleaf: true,
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
		await violin.Inner.app.dispatch({
			type: 'filter_replace',
			filter
		})
		test.ok(true, 'Filtering works as expected upon given range(start, stop) of values')
	}
})

tape('test hide option on label clicking', function (test) {
	runpp({
		state: {
			nav: {
				header_mode: 'hide_search'
			},
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

		testHideOption(violin, legendDiv) //test filter on label clicking
		await testHiddenValues(violin, legendDiv, violinDiv)

		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	function testHideOption(violin) {
		const q = {
			hiddenValues: { [violin.Inner.data.charts[''].plots[0].label]: 1 },
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

	async function testHiddenValues(violin, legendDiv, violinDiv) {
		const htmlLegends = await detectGte({ elem: legendDiv.node(), selector: '.sjpp-htmlLegend' })
		test.ok(htmlLegends, 'Legend exists')

		const hiddenKeys = Object.keys(violin.Inner.config.term2.q.hiddenValues)
		test.equal(
			Object.keys(violin.Inner.config.term2.q.hiddenValues)[0],
			htmlLegends[8].innerHTML,
			'q.hiddenValues match legend'
		)
		const unhideLegendValue = htmlLegends.filter(c => hiddenKeys.find(k => c.__data__.text === k))
		unhideLegendValue[0].dispatchEvent(new Event('click'), { bubbles: true })
		const hiddenValueRendered = await detectGte({
			elem: violinDiv.node(),
			selector: '[data-testid="sjpp-violin-label"]',
			count: 2
		})
		test.ok(hiddenValueRendered, 'hidden value rendered')

		test.equal(
			hiddenValueRendered[0].__data__.label,
			unhideLegendValue[0].innerHTML,
			'Clicking on hidden legend value renders the hidden plot'
		)
	}
})

tape('term1=categorical, term2=numeric', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'diaggrp' },
					term2: { id: 'agedx', q: { mode: 'continuous' } }
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testLabelHoverClick(test, violin, violinDiv, 7)
		await testViolinByCount(test, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=numeric, term2=cat groupsetting', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'agedx', q: { mode: 'continuous' } },
					term2: getCategoryGroupsetting()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testLabelHoverClick(test, violin, violinDiv, 2)
		await testViolinByCount(test, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('term1=numeric, term2=survival', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'agedx', q: { mode: 'continuous' } },
					term2: { id: 'efs' }
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=numeric, term2=geneVariant', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'agedx', q: { mode: 'continuous' } },
					term2: getGeneVariantTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=numeric, term2=geneVariant geneset', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'agedx', q: { mode: 'continuous' } },
					term2: getGenesetMutTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('term1=numeric, term2=condition', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'agedx', q: { mode: 'continuous' } },
					term2: { id: 'Hearing loss' }
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		await testConditionTermOrder(violin, violinDiv)
		await testLabelHoverClick(test, violin, violinDiv, 5)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
	async function testConditionTermOrder(violin, violinDiv) {
		const groups = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-path', count: 1 })
		test.ok(groups, 'Condition groups exist')
		test.deepEqual(
			groups.filter((k, i) => i % 2 == 0).map(k => k.__data__.label),
			violin.Inner.data.charts[''].plots.filter(plot => plot.plotValueCount > 5).map(k => k.label),
			'Order of conditional categories in term2 is accurate'
		)
	}
})

tape('term1=geneExp, term2=categorical', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: { mode: 'continuous' }
					},
					term2: {
						id: 'diaggrp'
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 7)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=geneExp, term2=cat groupsetting', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: { mode: 'continuous' }
					},
					term2: getCategoryGroupsetting()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=geneExp, term2=geneVariant', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: { mode: 'continuous' }
					},
					term2: getGeneVariantTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=geneExp, term2=geneVariant geneset', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: { mode: 'continuous' }
					},
					term2: getGenesetMutTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=ssgsea, term2=categorical', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: getSsgseaTw(),
					term2: {
						id: 'diaggrp'
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 7)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=ssgsea, term2=cat groupsetting', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: getSsgseaTw(),
					term2: getCategoryGroupsetting()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=ssgsea, term2=geneVariant', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: getSsgseaTw(),
					term2: getGeneVariantTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=ssgsea, term2=geneVariant geneset', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: getSsgseaTw(),
					term2: getGenesetMutTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 1)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

// this returns no data thus breaks
tape.skip('term1=geneExp, term2=survival (SKIPPED)', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: { mode: 'continuous' }
					},
					term2: {
						id: 'efs'
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolin(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
	async function testViolin(violin, violinDiv) {
		const groups = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-path', count: 2 })
		test.ok(groups, 'survival groups exist')
	}
})

tape('term1=numeric, term2=samplelst', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'agedx', q: { mode: 'continuous' } },
					term2: getSamplelstTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=geneexp, term2=samplelst', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: { mode: 'continuous' }
					},
					term2: getSamplelstTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})
tape('term1=ssgsea, term2=samplelst', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: getSsgseaTw(),
					term2: getSamplelstTw()
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 2)
		await testLabelHoverClick(test, violin, violinDiv, 2)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('term=agedx, term2=geneExp with regular bins', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						q: { mode: 'continuous' }
					},
					term2: {
						term: { gene: 'TP53', name: 'TP53', type: 'geneExpression' },
						q: {
							type: 'regular-bin',
							startinclusive: true,
							bin_size: 5,
							first_bin: {
								stop: 5
							},
							last_bin: {
								start: 35
							},
							mode: 'discrete'
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 4)
		// FIXME list sample breaks with tvs.ranges[] not found
		//await testLabelHoverClick(test, violin, violinDiv, 8)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('term=agedx, term2=geneExp with custom bins', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: { id: 'agedx', q: { mode: 'continuous' } },
					term2: {
						term: { gene: 'TP53', type: 'geneExpression', bins: { type: 'custom-bin' } },
						q: {
							type: 'custom-bin',
							mode: 'discrete',
							lst: [
								{
									startunbounded: true,
									stop: 10,
									startinclusive: true,
									stopinclusive: false,
									label: '<10'
								},
								{
									start: 10,
									startinclusive: true,
									stopinclusive: false,
									stop: 15,
									label: '10 to <15'
								},
								{
									start: 15,
									startinclusive: true,
									stopinclusive: false,
									stopunbounded: true,
									label: '≥15'
								}
							],
							startinclusive: true
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolinByCount(test, violinDiv, 3)
		// FIXME list sample breaks with tvs.ranges[] not found
		//await testLabelHoverClick(test, violin, violinDiv, 3)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

tape('term1=numeric, term0=categorical', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						q: { mode: 'continuous' }
					},
					term0: {
						id: 'sex',
						isAtomic: true
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolin(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
	async function testViolin(violin, violinDiv) {
		const chartDivs = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-chartDiv' })
		test.equal(chartDivs.length, 2, 'Should have 2 charts')
		const violinPaths = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-path' })
		test.equal(violinPaths.length, 4, 'Should have 4 paths')
	}
})

tape('term1=numeric, term2=numeric, term0=categorical', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'violin',
					term: {
						id: 'agedx',
						q: { mode: 'continuous' }
					},
					term2: {
						id: 'aaclassic_5',
						isAtomic: true
					},
					term0: {
						id: 'sex',
						isAtomic: true
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
		const violinDiv = violin.Inner.dom.violinDiv
		await testViolin(violin, violinDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
	async function testViolin(violin, violinDiv) {
		const chartDivs = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-chartDiv' })
		test.equal(chartDivs.length, 2, 'Should have 2 charts')
		const violinPaths = await detectGte({ elem: violinDiv.node(), selector: '.sjpp-vp-path' })
		test.equal(violinPaths.length, 6, 'Should have 6 paths')
	}
})

tape('test uncomputable categories legend', function (test) {
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
						id: 'aaclassic_5',
						isAtomic: true,
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
		const legendDiv = violin.Inner.dom.legendDiv
		violin.on('postRender.test', null)

		await testUncomputableCategories(violin, legendDiv)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}

	async function testUncomputableCategories(violin, legendDiv) {
		const keys = Object.keys(violin.Inner.data.uncomputableValues)
		const categories = await detectGte({ elem: legendDiv.node(), selector: '.legend-row', count: 9 })
		test.ok(categories, 'Uncomputable categories exist')

		const uncomputableLegend = categories.filter(c => keys.find(k => c.__data__.text.startsWith(k)))

		test.equal(keys.length, uncomputableLegend.length, 'should have the correct number of uncomputable legend entries')
		test.equal(
			uncomputableLegend
				.find(c => c.__data__.text.startsWith(keys[0]))
				?.__data__.text.split(',')
				.pop(),
			' n = ' + violin.Inner.data.uncomputableValues[keys[0]],
			`Uncomputable category '${keys[0]}' rendered with the correct count`
		)
		test.equal(
			uncomputableLegend
				.find(c => c.__data__.text.startsWith(keys[1]))
				?.__data__.text.split(',')
				.pop(),
			' n = ' + violin.Inner.data.uncomputableValues[keys[1]],
			`Uncomputable category '${keys[1]}' rendered with the correct count`
		)
	}
})

tape('Load linear regression-violin UI', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					hasUnsubmittedEdits: true,
					regressionType: 'linear',
					outcome: {
						id: 'hrtavg',
						isAtomic: true
					}
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(regression) {
		regression.on('postRender.test', null)
		// point to outcome tw holder and avoid searching whole regression ui, in case later input terms are also added
		await testViolinByCount(test, regression.Inner.inputs.outcome.dom.holder, 1)
		if (test._ok) regression.Inner.app.destroy()
		test.end()
	}
})

tape('term1=singleCellExpression, term2=singleCellCellType', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					term: {
						term: {
							type: 'singleCellGeneExpression',
							id: 'KRAS',
							gene: 'KRAS',
							name: 'KRAS',
							sample: {
								sID: '1_patient'
							}
						},
						q: {
							mode: 'continuous'
						}
					},
					term2: {
						term: {
							type: 'singleCellCellType',
							id: 'CellType',
							name: 'CellType',
							sample: {
								sID: '1_patient'
							},
							plot: 'scRNA',
							colorBy: 'CellType',
							values: {
								T_NK: {
									key: 'T_NK',
									value: 'T_NK'
								},
								Blast: {
									key: 'Blast',
									value: 'Blast'
								},
								Monocyte: {
									key: 'Monocyte',
									value: 'Monocyte'
								}
							},
							groupsetting: {
								disabled: false
							}
						}
					}
				}
			],
			vocab: {
				genome: 'hg38-test',
				dslabel: 'TermdbTest'
			}
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
		await testViolinByCount(test, violinDiv, 3)
		await testLabelHoverClick(test, violin, violinDiv, 3)
		if (test._ok) violin.Inner.app.destroy()
		test.end()
	}
})

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
const open_state = {
	chartType: 'summary',
	childType: 'violin',
	term: {
		id: 'agedx',
		q: { mode: 'continuous' }
	},
	term2: { id: 'sex' }
}

// detect given number of violin labels
// use the first label to test mouseover menu and click menu options
async function testLabelHoverClick(test, violin, violinDiv, labelcount) {
	const labs = await detectLst({
		elem: violinDiv.node(),
		selector: '[data-testid="sjpp-violin-label"]',
		count: labelcount
	})
	test.ok(labs, `Detected ${labelcount} violin labels`)
	// this test just work without term0 and can be generalized
	for (let i = 0; i < labelcount; i++) {
		const n = violin.Inner.data.charts[''].plots[i].values.length
		test.ok(labs[i].innerHTML.endsWith('n=' + n), `violin #${i} label text ends with "n=${n}"`)
	}

	// test mouseover
	labs[0].dispatchEvent(new Event('mouseover'), { bubbles: true })
	{
		const tip = violin.Inner.dom.hovertip
		await whenVisible(tip.d)
		const table = await detectOne({ elem: tip.dnode, selector: '[data-testid="sja_simpletable"]' })
		test.pass('summary stat table found in hover tooltip')
		tip.hide()
	}

	labs[0].dispatchEvent(new Event('click'), { bubbles: true })
	const tip = violin.Inner.dom.clicktip
	if (!violin.Inner.state.config.term2 || violin.Inner.state.config.term2.term.type == 'singleCellCellType') {
		/* by design, menu won't show:
		- if no term2
		- if term2 is singleCellCellType
		*/
		test.equal(tip.d.style('display'), 'none', 'Clicked on first label and app.tip will not show')
		//await whenHidden(tip.d) // this breaks
	} else {
		// has term2, click label will show menu and test this menu
		await whenVisible(tip.d)
		test.pass('Clicked on first label and app.tip will show')
		await detectOne({ elem: tip.dnode, selector: '[data-testid="sjpp-violinLabOpt-addf"]' })
		test.pass('Add filter option is in menu')
		await detectOne({ elem: tip.dnode, selector: '[data-testid="sjpp-violinLabOpt-hide"]' })
		test.pass('Hide option is in menu')
		// option "List sample" is conditional; lacks way to test different conditions
		const lab = await detectOne({ elem: tip.dnode, selector: '[data-testid="sjpp-violinLabOpt-list"]' })
		test.pass('List option is in menu')
		// click to load samples and display in table
		await whenVisible(violin.Inner.dom.sampletabletip.d)
		lab.dispatchEvent(new Event('click'))
		await detectOne({ elem: violin.Inner.dom.sampletabletip.dnode, selector: '[data-testid="sjpp-listsampletable"]' })
		test.pass('Tip with sample table displayed after clicking "List sample"')
		violin.Inner.dom.sampletabletip.hide()
		tip.hide()
	}
}
// detect given number of violin svg <path>
async function testViolinByCount(test, violinDiv, count) {
	// each violin has two path.sjpp-vp-path, thus *2!!
	const groups = await detectLst({ elem: violinDiv.node(), selector: 'path.sjpp-vp-path', count: count * 2 })
	test.ok(groups, `Detected ${count} violin <path class=sjpp-vp-path>`)
}
