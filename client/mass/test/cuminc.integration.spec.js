const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const termjson = require('../../test/testdata/termjson').termjson
const { select, selectAll } = require('d3-selection')

/*
Tests:
	basic cuminc
	term1=Cardiovascular System, filter=ALL
	term1=Cardiovascular System, term2=agedx
	term1 = Cardiovascular System, term2 = agedx, numeric regular bins
	hidden uncomputable
	skipped series
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
						isleaf: true,
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
					term0: {
						id: 'agedx',
						isleaf: true,
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

tape.skip('term1 = Cardiovascular System, term2 = agedx, numeric custom bins', test => {
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
		console.log(379, cuminc.Inner)

		//Test data correctly appears
		test.equal(cuminc.Inner.config.term2.q.type, 'custom-bin', `Should correctly pass 'custom-bin' to config`)

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
		// test.equal(cuminc.Inner.config.term0.q.first_bin.stop, newStop, `Should update first bin stop to ${newStop}`)

		// if (test._ok) cuminc.Inner.app.destroy()
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
