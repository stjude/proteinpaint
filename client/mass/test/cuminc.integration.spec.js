const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const termjson = require('../../test/testdata/termjson').termjson
const { select, selectAll } = require('d3-selection')

/*
Tests:
	basic cuminc
	term1=Cardiovascular System, filter=ALL
	term1=Cardiovascular System, term2=agedx
	term1=Cardiovascular System, term0=sex
	term1 = Cardiovascular System, term2 = agedx, numeric regular bins
	term1 = Cardiovascular System, term0 = agedx, numeric regular bins
	term1 = Cardiovascular System, term2 = agedx, numeric custom bins
	term1 = Cardiovascular System, term0 = agedx, numeric custom bins
	hidden uncomputable
	skipped series
	term1 = Cardiovascular System, term2 = samplelst
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

tape('\n', function(test) {
	test.pass('-***- termdb/cuminc -***-')
	test.end()
})

tape('term1=Cardiac dysrhythmia', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiac dysrhythmia',
						q: { bar_by_grade: true, value_by_max_grade: true }
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

tape('term1=Cardiovascular System, filter=ALL', function(test) {
	// this test breaks due to the "missing minSampleSize" err
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiovascular System',
						q: { bar_by_grade: true, value_by_max_grade: true }
					}
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

tape('term1=Cardiovascular System, term2=agedx', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiovascular System',
						q: { bar_by_grade: true, value_by_max_grade: true }
					},
					term2: { id: 'agedx' }
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
			.filter(d => !d.__data__?.tickVal && d.className.animVal != 'sjpp-cuminc-atrisk-title')

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
					term0: { id: 'sex' }
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
	test.timeoutAfter(5000)

	const testBinSize = 5
	const testStop = 5
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiovascular System',
						q: { bar_by_grade: true, value_by_max_grade: true }
					},
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
						controls: {
							isOpen: true
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

		//Test q.bin_size and q.first_bin.stop changes are applied
		const newStop = 1
		cuminc.Inner.config.term2.q.bin_size = 3
		cuminc.Inner.config.term2.q.first_bin.stop = newStop

		await cuminc.Inner.app.dispatch({
			type: 'plot_edit',
			id: cuminc.Inner.id,
			config: cuminc.Inner.config
		})

		const findBin = cuminc.Inner.dom.controls.selectAll('.ts_summary_btn.sja_filter_tag_btn').nodes()
		test.ok(
			findBin[1].innerText.endsWith(`=${cuminc.Inner.config.term2.q.bin_size}`),
			`Should display the correct bin size = ${cuminc.Inner.config.term2.q.bin_size}`
		)
		test.equal(cuminc.Inner.config.term2.q.first_bin.stop, newStop, `Should update first bin stop = ${newStop}`)

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape.skip('term1 = Cardiovascular System, term0 = agedx, numeric regular bins', test => {
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

		//Test data correctly appears
		// test.equal(cuminc.Inner.config.term0.q.type, 'regular-bin', `Should correctly pass 'regular-bin' to config`)
		// test.equal(cuminc.Inner.config.term0.q.bin_size, testBinSize, `Should correctly pass q.bin_size = ${testBinSize} to config`)
		// test.equal(cuminc.Inner.config.term0.q.first_bin.stop, testStop, `Should correctly pass q.first_bin.stop = ${testStop} to config`)

		// //Test q.bin_size and q.first_bin.stop changes are applied
		// const newStop = 1
		// cuminc.Inner.config.term0.q.bin_size = 3
		// cuminc.Inner.config.term0.q.first_bin.stop = newStop

		// await cuminc.Inner.app.dispatch({
		// 	type: 'plot_edit',
		// 	id: cuminc.Inner.id,
		// 	config: cuminc.Inner.config
		// })

		// const findBin = cuminc.Inner.dom.controls.selectAll('.ts_summary_btn.sja_filter_tag_btn').nodes()
		// test.ok(findBin[1].innerText.endsWith(`=${cuminc.Inner.config.term0.q.bin_size}`), `Should display the correct bin size = ${cuminc.Inner.config.term0.q.bin_size}`)
		// test.equal(cuminc.Inner.config.term0.q.first_bin.stop, newStop, `Should update first bin stop = ${newStop}`)

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
					term: {
						id: 'Cardiovascular System',
						q: { bar_by_grade: true, value_by_max_grade: true }
					},
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
						cuminc: {},
						controls: {
							isOpen: true
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
		const inner = cuminc.Inner

		//Test data correctly appears
		test.equal(inner.config.term2.q.type, 'custom-bin', `Should correctly pass 'custom-bin' to config`)
		const overlayConfig =
			inner.components.controls.Inner.components.config.Inner.components.overlay.Inner.usedTerms[0].q.lst
		test.equal(
			JSON.stringify(inner.config.term2.q.lst),
			JSON.stringify(overlayConfig),
			`Should correctly pass the custom list to overlay component`
		)

		//Test overlay bin changes are applied
		inner.config.term2.q.lst[2] = { startinclusive: true, stopinclusive: true, start: 12, stop: 15, label: '12 to 15' }
		inner.config.term2.q.lst.push({ start: 15, startinclusive: false, stopunbounded: true, label: '>15' })

		await inner.app.dispatch({
			type: 'plot_edit',
			id: inner.id,
			config: inner.config
		})

		const findBin = cuminc.Inner.dom.controls.selectAll('.ts_summary_btn.sja_filter_tag_btn').nodes()
		test.ok(
			findBin[1].innerText.endsWith(`${inner.config.term2.q.lst.length} bins`),
			`Should display the correct num of bins = ${inner.config.term2.q.lst.length}`
		)

		if (test._ok) cuminc.Inner.app.destroy()
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
						controls: {
							isOpen: true
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
		const inner = cuminc.Inner

		//Test data correctly appears
		test.equal(inner.config.term0.q.type, 'custom-bin', `Should correctly pass 'custom-bin' to config`)
		const divideConfig =
			inner.components.controls.Inner.components.config.Inner.components.divideBy.Inner.usedTerms[0].q.lst
		test.equal(
			JSON.stringify(inner.config.term0.q.lst),
			JSON.stringify(divideConfig),
			`Should correctly pass the custom list to overlay component`
		)

		//Test overlay bin changes are applied
		inner.config.term0.q.lst[0] = { startunbounded: true, stop: 15, stopinclusive: false, label: '<15' }
		inner.config.term0.q.lst[1] = { start: 15, startinclusive: false, stopunbounded: true, label: '>15' }

		await inner.app.dispatch({
			type: 'plot_edit',
			id: inner.id,
			config: inner.config
		})

		const findBin = cuminc.Inner.dom.controls.selectAll('.ts_summary_btn.sja_filter_tag_btn').nodes()
		test.ok(
			findBin[1].innerText.endsWith(`${inner.config.term0.q.lst.length} bins`),
			`Should display the correct num of bins = ${inner.config.term0.q.lst.length}`
		)

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('hidden uncomputable', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiac dysrhythmia'
					},
					term2: {
						id: 'cisplateq_5'
					},
					settings: {
						cuminc: {
							minSampleSize: 1
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
		const hiddenDiv = cuminc.Inner.dom.hiddenDiv
		test.equal(hiddenDiv && hiddenDiv.selectAll('.legend-row').size(), 1, 'should hide 1 series (not exposed)')

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('skipped series', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiovascular System',
						q: { bar_by_grade: true, value_by_max_grade: true }
					},
					term2: {
						id: 'genetic_race'
					},
					settings: {
						cuminc: {
							minSampleSize: 5
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
		const skippedDivs = cuminc.Inner.dom.chartsDiv
			.select('.pp-cuminc-chartLegends')
			.selectAll('.pp-cuminc-chartLegends-skipped')
		test.equal(skippedDivs && skippedDivs.size(), 2, 'should render 2 skipped series')

		if (test._ok) cuminc.Inner.app.destroy()
		test.end()
	}
})

tape('term1 = Cardiovascular System, term2 = samplelst', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiovascular System'
					},
					term2: {
						term: {
							name: 'Samplelst term',
							type: 'samplelst',
							values: {
								'Group 1': {
									key: 'Group 1',
									label: 'Test 1',
									inuse: false,
									list: [{ sampleId: 1, sample: 1 }, { sampleId: 2, sample: 2 }]
								},
								'Group 2': {
									key: 'Group 2',
									label: 'Test 2',
									inuse: false,
									list: [{ sampleId: 3, sample: 3 }, { sampleId: 4, sample: 4 }, { sampleId: 5, sample: 5 }]
								},
								'Group 3': { key: 'Group 3', label: 'Test 3', inuse: false, list: [{ sampleId: 6, sample: 6 }] }
							}
						},
						q: {
							mode: 'custom-groupsetting',
							groups: [
								{
									name: 'Group 1',
									in: false,
									values: [{ sampleId: 1, sample: 1 }, { sampleId: 2, sample: 2 }]
								},
								{
									name: 'Group 2',
									in: false,
									values: [{ sampleId: 3, sample: 3 }, { sampleId: 4, sample: 4 }, { sampleId: 5, sample: 5 }]
								},
								{
									name: 'Group 3',
									in: false,
									values: [{ sampleId: 6, sample: 6 }]
								}
							]
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

		const valKeys = Object.keys(cuminc.Inner.config.term2.term.values)
		const uniqueSeriesIds = Array.from(cuminc.Inner.uniqueSeriesIds)
		test.equal(JSON.stringify(valKeys), JSON.stringify(uniqueSeriesIds), `Should create custom groups`)

		let numGrpLabelFails = 0
		const numRiskRowLabels = cuminc.Inner.dom.chartsDiv
			.selectAll('.sjpp-cuminc-atrisk text')
			.nodes()
			.filter(d => !d.__data__?.tickVal && d.className.animVal != 'sjpp-cuminc-atrisk-title')

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
