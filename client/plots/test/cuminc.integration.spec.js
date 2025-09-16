import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { termjson } from '../../test/testdata/termjson'
import { select, selectAll } from 'd3-selection'
import { detectOne, detectGte } from '../../test/test.helpers.js'

/*
Tests:
	basic cuminc
	term1=Cardiovascular System, filter=ALL
	term1=Cardiovascular System, term2=agedx
	term1=Cardiovascular System, term0=sex
	term1 = Cardiovascular System, term2 = agedx, numeric regular bins
	term1 = Cardiovascular System, term0 = agedx, numeric regular bins ** skipped, see note in runTests()
	term1 = Cardiovascular System, term2 = agedx, numeric custom bins
	term1 = Cardiovascular System, term0 = agedx, numeric custom bins
	hidden uncomputable
	skipped series
	term1 = Cardiovascular System, term2 = samplelst

TODOs: 
	Test tipline functionality and rendering
	Test overlay and divide by rendering
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hide_search',
			activeTab: 1
		},
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

/**************
 test sections
 ***************/

tape('\n', function (test) {
	test.comment('-***- plots/cuminc -***-')
	test.end()
})

tape('term1=Cardiac dysrhythmia', function (test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiac dysrhythmia' },
					settings: { cuminc: { minSampleSize: 1, minAtRisk: 0 } }
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		const cumincDiv = cuminc.Inner.dom.chartsDiv

		//Test all dom elements present
		test.equal(cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series').size(), 1, 'should render 1 cuminc series g')
		test.equal(
			cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series path').size(),
			2,
			'should render 2 cuminc series paths for estimate line and 95% CI area'
		)
		test.equal(cumincDiv.selectAll('.sjpcb-cuminc-title').size(), 1, `Should render title above chart`)
		test.equal(cumincDiv.selectAll('.sjpp-cuminc-atrisk').size(), 1, `Should render 'Number at risk' table below chart`)

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('term1=Cardiovascular System, filter=ALL', function (test) {
	// this test breaks due to the "missing minSampleSize" err
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					settings: { cuminc: { minSampleSize: 1, minAtRisk: 0 } }
				}
			],
			termfilter: {
				filter: {
					type: 'tvslst',
					join: '',
					in: true,
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: { id: 'diaggrp' },
								values: [{ key: 'Acute lymphoblastic leukemia', label: 'Acute lymphoblastic leukemia' }]
							}
						}
					]
				}
			}
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(plot) {
		const div = plot.Inner.dom.chartsDiv
		test.equal(div.selectAll('.sjpcb-cuminc-series').size(), 1, 'should render 1 cuminc series <g>')
		test.equal(
			div.selectAll('.sjpcb-cuminc-series path').size(),
			2,
			'should render 2 cuminc series paths for estimate line and 95% CI area'
		)

		if (test._ok) plot.Inner.app.destroy()
		test.end()
	}
})

tape('term1=Cardiovascular System, term2=agedx', function (test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term2: { id: 'agedx' },
					settings: { cuminc: { minSampleSize: 1, minAtRisk: 0 } }
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		const div = cuminc.Inner.dom.chartsDiv
		test.equal(div.selectAll('.sjpcb-cuminc-series').size(), 2, 'should render 2 cuminc series <g>')
		test.equal(
			div.selectAll('.sjpcb-cuminc-series path').size(),
			4,
			'should render 4 cuminc series paths for estimate line and 95% CI area'
		)

		const legend = div.selectAll('.pp-cuminc-chartLegends').node()
		test.ok(legend, `Should render chart legend`)
		//Exclude table header and tick values
		const numRiskRowLabels = div
			.selectAll('.sjpp-cuminc-atrisk text')
			.nodes()
			.filter(d => !d.__data__?.tickVal && d.className.animVal != 'sjpp-atrisk-title')

		//Test legend and risk table match legend data
		for (const [i, d] of legend.__data__.visibleSerieses.entries()) {
			if (cuminc.Inner.legendData[0].items[i].seriesId != d.seriesId)
				test.fail(
					`Missing or mismatched series found in legend, series = '${cuminc.Inner.legendData[0].items[i].seriesId}'`
				)
			else if (numRiskRowLabels[i].__data__.seriesId != d.seriesId)
				test.fail(
					`Missing or mismatched series found in 'Number at risk' table, series = '${numRiskRowLabels[i].__data__.seriesId}'`
				)
			else test.pass(`Should display series = '${d.seriesId}' in both legend and 'Number at risk' table`)
		}

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('term1=Cardiovascular System, term0=sex', test => {
	test.timeoutAfter(5000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term0: { id: 'sex' },
					settings: { cuminc: { minSampleSize: 1, minAtRisk: 0 } }
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		cuminc.on('postRender.test', null)

		const cumincDiv = cuminc.Inner.dom.chartsDiv
		const term0Values = cuminc.Inner.config.term0.term.values

		//Test all dom elements present
		test.equal(
			cumincDiv.selectAll('.pp-cuminc-chart').size(),
			Object.keys(term0Values).length,
			`Should render ${Object.keys(term0Values).length} cuminc charts`
		)
		test.equal(
			cumincDiv.selectAll('.sjpp-cuminc-atrisk').size(),
			Object.keys(term0Values).length,
			`Should render 'Number at risk' tables below chart`
		)

		const titleNodes = cumincDiv.selectAll('.sjpcb-cuminc-title').nodes()
		for (const v of Object.values(term0Values)) {
			if (!titleNodes.some(d => d.innerText == v.label)) test.fail(`Missing title for term0 value = ${v.label}`)
		}

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('term1 = Cardiovascular System, term2 = agedx, numeric regular bins', test => {
	test.timeoutAfter(10000)
	const testBinSize = 5
	const testStop = 5

	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term2: {
						id: 'agedx',
						name: 'Age (years) at Cancer Diagnosis',
						type: 'float',
						bins: {
							default: {
								type: 'regular-bin',
								bin_size: testBinSize,
								startinclusive: true,
								first_bin: {
									startunbounded: true,
									stop: testStop
								}
							},
							label_offset: 1
						}
					},
					settings: {
						cuminc: { minSampleSize: 1, minAtRisk: 0 }
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		cuminc.on('postRender.test', null)

		const div = cuminc.Inner.dom.chartsDiv

		//Test data correctly appears
		test.equal(cuminc.Inner.config.term2.q.type, 'regular-bin', `Should correctly pass 'regular-bin' to config`)
		test.equal(
			cuminc.Inner.config.term2.q.bin_size,
			testBinSize,
			`Should correctly pass q.bin_size = ${testBinSize} to config`
		)
		test.equal(
			cuminc.Inner.config.term2.q.first_bin.stop,
			testStop,
			`Should correctly pass q.first_bin.stop = ${testStop} to config`
		)

		//***Test q.bin_size and q.first_bin.stop changes are applied
		const config = structuredClone(cuminc.Inner.config)
		const expectedCount = cuminc.Inner.uniqueSeriesIds.size

		//Plot
		const cumincCurves = await detectGte({
			elem: div.node(),
			selector: '.sjpcb-cuminc-series',
			count: expectedCount,
			async trigger() {
				config.term2.q.bin_size = 3
				config.term2.q.first_bin.stop = 1
				await cuminc.Inner.app.dispatch({
					type: 'plot_edit',
					id: cuminc.Inner.id,
					config
				})
			},
			matcher(mutations) {
				const changedSeries = mutations.filter(
					m => m.previousSibling != null && cuminc.Inner.uniqueSeriesIds.has(m.target.__data__.seriesId)
				)
				if (changedSeries.length >= expectedCount) return changedSeries.map(d => d.target)
			}
		})

		test.equal(cumincCurves.length, expectedCount, `Should update ${expectedCount} curves in plot`)

		//Number at risk table
		const numRiskRowLabels = div
			.selectAll('.sjpp-cuminc-atrisk text')
			.nodes()
			.filter(d => !d.__data__?.tickVal && d.className.animVal != 'sjpp-atrisk-title')
		const foundNewLabels = numRiskRowLabels.filter(l => cuminc.Inner.uniqueSeriesIds.has(l.__data__.seriesId))
		test.equal(foundNewLabels.length, expectedCount, `Should update ${expectedCount} labels in Number at risk table`)

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('term1 = Cardiovascular System, term0 = agedx, numeric regular bins', test => {
	test.timeoutAfter(5000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term0: {
						id: 'agedx',
						term: {
							type: 'float',
							bins: {
								default: {
									type: 'regular-bin',
									bin_size: 5,
									startinclusive: true,
									first_bin: {
										startunbounded: true,
										stop: 5
									},
									label_offset: 1
								},
								label_offset: 1
							},
							name: 'Age (years) at Cancer Diagnosis',
							id: 'agedx'
							// isleaf: true,
							// values: {},
							// included_types: [
							// 	'float'
							// ],
							// child_types: []
						},
						q: {
							isAtomic: true,
							mode: 'discrete',
							type: 'regular-bin'
							// type: 'custom-bin',
							// lst: [
							// 	{
							// 		startunbounded: true,
							// 		stop: 8.164619357749999,
							// 		stopinclusive: false,
							// 		label: '<8.164619357749999'
							// 	},
							// 	{
							// 		start: 8.164619357749999,
							// 		startinclusive: true,
							// 		stopunbounded: true,
							// 		label: '≥8.164619357749999'
							// 	}
							// ],
							// hiddenValues: {}
						}
					},
					settings: {
						cuminc: { minSampleSize: 1, minAtRisk: 0 },
						controls: {
							term0: { id: 'agedx', term: termjson['agedx'] }
						}
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		cuminc.on('postRender.test', null)

		//TODO: Need data in TermdbTest to process

		// if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('term1 = Cardiovascular System, term2 = agedx, numeric custom bins', test => {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term2: {
						id: 'agedx',
						q: {
							type: 'custom-bin',
							mode: 'discrete',
							lst: [
								{ startunbounded: true, stop: 7, stopinclusive: false, label: '<7' },
								{ startinclusive: true, stopinclusive: true, start: 7, stop: 12, label: '7 to 12' },
								{ start: 12, startinclusive: false, stopunbounded: true, label: '>12' }
							]
						}
					},
					settings: {
						cuminc: { minSampleSize: 1, minAtRisk: 0 }
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		cuminc.on('postRender.test', null)

		const inner = cuminc.Inner
		const div = inner.dom.chartsDiv

		//Test data correctly appears
		test.equal(inner?.config.term2.q.type, 'custom-bin', `Should correctly pass 'custom-bin' to config`)

		//Test overlay changes are applied
		const config = structuredClone(cuminc.Inner.config)
		const expectedCount = cuminc.Inner.uniqueSeriesIds.size

		//Plot
		const cumincCurves = await detectGte({
			elem: div.node(),
			selector: '.sjpcb-cuminc-series',
			count: expectedCount,
			async trigger() {
				config.term2.q.lst[2] = { startinclusive: true, stopinclusive: true, start: 12, stop: 15, label: '12 to 15' }
				config.term2.q.lst.push({ start: 15, startinclusive: false, stopunbounded: true, label: '>15' })
				await cuminc.Inner.app.dispatch({
					type: 'plot_edit',
					id: inner.id,
					config
				})
			},
			matcher(mutations) {
				const changedSeries = mutations.filter(
					m => m.previousSibling != null && inner.uniqueSeriesIds.has(m.target.__data__.seriesId)
				)
				if (changedSeries.length >= expectedCount) return changedSeries.map(d => d.target)
			}
		})

		test.equal(cumincCurves.length, expectedCount, `Should update ${expectedCount} curves in plot`)

		//Number at risk table
		const numRiskRowLabels = div
			.selectAll('.sjpp-cuminc-atrisk text')
			.nodes()
			.filter(d => !d.__data__?.tickVal && d.className.animVal != 'sjpp-atrisk-title')
		const foundNewLabels = numRiskRowLabels.filter(l => inner.uniqueSeriesIds.has(l.__data__.seriesId))
		test.equal(foundNewLabels.length, expectedCount, `Should update ${expectedCount} labels in Number at risk table`)

		if (test._ok) inner.app.destroy()
		test.end()
	}
})

tape('term1 = Cardiovascular System, term0 = agedx, numeric custom bins', test => {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term0: {
						id: 'agedx',
						term: {
							type: 'float',
							bins: {
								default: {
									type: 'regular-bin',
									bin_size: 5,
									startinclusive: true,
									first_bin: {
										startunbounded: true,
										stop: 5
									},
									label_offset: 1
								},
								label_offset: 1
							},
							name: 'Age (years) at Cancer Diagnosis',
							id: 'agedx'
						},
						q: {
							isAtomic: true,
							mode: 'discrete',
							type: 'custom-bin',
							lst: [
								{
									startunbounded: true,
									stop: 12,
									stopinclusive: false,
									label: '<12'
								},
								{
									start: 12,
									startinclusive: true,
									stopunbounded: true,
									label: '≥12'
								}
							],
							hiddenValues: {}
						}
					},
					settings: {
						cuminc: { minSampleSize: 1, minAtRisk: 0 }
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		cuminc.on('postRender.test', null)
		const inner = cuminc.Inner
		const div = cuminc.Inner.dom.chartsDiv

		//Test data correctly appears
		test.equal(inner.config.term0.q.type, 'custom-bin', `Should correctly pass 'custom-bin' to config`)

		//***Test divide by changes are applied
		const config = structuredClone(inner.config)

		//Plot
		const chartIds2Check = new Set()
		const cumincCurves = await detectGte({
			target: div.node(),
			selector: 'g.sjpcb-cuminc-mainG',
			async trigger() {
				config.term0.q.lst[0] = { startunbounded: true, stop: 15, stopinclusive: false, label: '<15' }
				config.term0.q.lst[1] = { start: 15, startinclusive: false, stopunbounded: true, label: '>15' }
				config.term0.q.lst.forEach(d => chartIds2Check.add(d.label))
				await inner.app.dispatch({
					type: 'plot_edit',
					id: inner.id,
					config
				})
			},
			matcher(mutations) {
				const changedSeries = mutations.filter(
					m => m.attributeName == 'transform' && chartIds2Check.has(m.target.__data__.chartId)
				)
				if (changedSeries.length >= chartIds2Check.size) return changedSeries.map(d => d.target)
			}
		})

		test.equal(cumincCurves.length, chartIds2Check.size, `Should update ${chartIds2Check.size} plots`)

		if (test._ok) inner.app.destroy()
		test.end()
	}
})

tape('skipped series', function (test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term2: { id: 'genetic_race' },
					settings: {
						cuminc: { minSampleSize: 10, minAtRisk: 0 }
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		const skippedDivs = cuminc.Inner.dom.chartsDiv
			.select('.pp-cuminc-chartLegends')
			.selectAll('.pp-cuminc-chartLegends-skipped')

		// db rebuilt on 8/30/23 no longer shows Asian skipped for "No event"
		//test.equal(skippedDivs && skippedDivs.size(), 2, 'should render 2 skipped series')
		test.equal(skippedDivs && skippedDivs.size(), 1, 'should render 1 skipped series')

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape.skip('term1 = Cardiovascular System, term2 = samplelst', function (test) {
	test.timeoutAfter(5000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: { id: 'Cardiovascular System' },
					term2: {
						term: {
							name: 'Samplelst term',
							type: 'samplelst',
							values: {
								'Group 1': {
									key: 'Group 1',
									label: 'Test 1',
									inuse: false,
									list: [
										{ sampleId: 1, sample: 1 },
										{ sampleId: 2, sample: 2 }
									]
								},
								'Group 2': {
									key: 'Group 2',
									label: 'Test 2',
									inuse: false,
									list: [
										{ sampleId: 3, sample: 3 },
										{ sampleId: 4, sample: 4 },
										{ sampleId: 5, sample: 5 }
									]
								},
								'Group 3': { key: 'Group 3', label: 'Test 3', inuse: false, list: [{ sampleId: 6, sample: 6 }] }
							}
						},
						q: {
							groups: [
								{
									name: 'Group 1',
									in: false,
									values: [
										{ sampleId: 1, sample: 1 },
										{ sampleId: 2, sample: 2 }
									]
								},
								{
									name: 'Group 2',
									in: false,
									values: [
										{ sampleId: 3, sample: 3 },
										{ sampleId: 4, sample: 4 },
										{ sampleId: 5, sample: 5 }
									]
								},
								{
									name: 'Group 3',
									in: false,
									values: [{ sampleId: 6, sample: 6 }]
								}
							]
						}
					},
					settings: {
						cuminc: { minSampleSize: 1, minAtRisk: 0 }
					}
				}
			]
		},
		cuminc: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(cuminc) {
		cuminc.on('postRender.test', null)

		const valKeys = Object.keys(cuminc.Inner.config.term2.term.values)
		const uniqueSeriesIds = Array.from(cuminc.Inner.uniqueSeriesIds)
		test.equal(JSON.stringify(valKeys), JSON.stringify(uniqueSeriesIds), `Should create custom groups`)

		let numGrpLabelFails = 0
		const numRiskRowLabels = cuminc.Inner.dom.chartsDiv
			.selectAll('.sjpp-cuminc-atrisk text')
			.nodes()
			.filter(d => !d.__data__?.tickVal && d.className.animVal != 'sjpp-atrisk-title')

		for (const grp of Object.values(cuminc.Inner.config.term2.term.values)) {
			const findGrpLabel = numRiskRowLabels.some(d => d.__data__.seriesId == grp.key && d.innerHTML == grp.label)
			if (!findGrpLabel) {
				test.fail(`Missing group in 'Number at risk' table: group = ${grp.key}, label = ${grp.label}`)
				++numGrpLabelFails
			}
		}
		if (numGrpLabelFails == 0) test.pass(`All custom groups display`)

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})
