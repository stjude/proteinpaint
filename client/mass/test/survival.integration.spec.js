const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
const helpers = require('../../test/front.helpers.js')
const { detectOne } = require('../../test/test.helpers.js')

/*
Tests:
	survival term as term1
	survival term as term1, with overlay
	survival term as overlay
	survival term as term1, term2 = genetic_race, categorical groupsetting
	survival term as term1, term0 = genetic_race, categorical groupsetting
	survival term as term1, term2 = agedx, regular bins
	survival term as term1, term2 = agedx, custom bins
	survival term as term1, term0 = agedx, custom bins
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
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
	test.pass('-***- termdb/surv -***-')
	test.end()
})

tape('survival term as term1', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
					}
				}
			]
		},
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let survivalDiv
	async function runTests(survival) {
		survivalDiv = survival.Inner.dom.chartsDiv
		test.equal(survivalDiv && survivalDiv.selectAll('.sjpp-survival-series').size(), 1, 'should render 1 surv series g')
		// please advice if to remove below tests using "circle" which is no longered rendered
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored-x').size(),
			10,
			'should render 10 survival censored symbols'
		)

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, with overlay', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
					},
					term2: {
						id: 'diaggrp'
					}
				}
			]
		},
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let survivalDiv
	async function runTests(survival) {
		survivalDiv = survival.Inner.dom.chartsDiv
		test.equal(survivalDiv && survivalDiv.selectAll('.sjpp-survival-series').size(), 7, 'should render 7 surv series g')
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored-x').size(),
			10,
			'should render 9 survival censored symbols'
		)

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as overlay', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'diaggrp'
					},
					term2: {
						id: 'efs'
					}
				}
			]
		},
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let survivalDiv
	async function runTests(survival) {
		survivalDiv = survival.Inner.dom.chartsDiv
		test.equal(survivalDiv && survivalDiv.selectAll('.sjpp-survival-series').size(), 7, 'should render 7 surv series g')
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored-x').size(),
			10,
			'should render 10 survival censored symbols'
		)

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term2 = genetic_race, categorical groupsetting', function(test) {
	test.timeoutAfter(3000)

	const groups = [
		{
			name: 'non-Asian Ancestry',
			type: 'values',
			values: [
				{ key: 'European Ancestry', label: 'European Ancestry' },
				{ key: 'African Ancestry', label: 'African Ancestry' },
				{ key: 'Multi-Ancestry-Admixed', label: 'Multi-Ancestry-Admixed' }
			]
		},
		{
			name: 'Asian Ancestry',
			type: 'values',
			values: [{ key: 'Asian Ancestry', label: 'Asian Ancestry' }]
		}
	]

	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
					},
					term2: {
						id: 'genetic_race',
						q: {
							groupsetting: {
								customset: {
									groups
								}
							}
						}
					}
				}
			]
		},
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(survival) {
		survival.on('postRender.test', null)

		const inner = survival.Inner
		const config = inner.state.config

		test.equal(
			JSON.stringify(config.term2.q.groupsetting.customset.groups),
			JSON.stringify(groups),
			`Should correctly pass groups for term2`
		)

		// if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape.skip('survival term as term1, term0 = genetic_race, categorical groupsetting', function(test) {
	test.timeoutAfter(3000)

	const groups = [
		{
			name: 'non-Asian Ancestry',
			type: 'values',
			values: [
				{ key: 'European Ancestry', label: 'European Ancestry' },
				{ key: 'African Ancestry', label: 'African Ancestry' },
				{ key: 'Multi-Ancestry-Admixed', label: 'Multi-Ancestry-Admixed' }
			]
		},
		{
			name: 'Asian Ancestry',
			type: 'values',
			values: [{ key: 'Asian Ancestry', label: 'Asian Ancestry' }]
		}
	]

	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
					},
					term0: {
						id: 'genetic_race',
						q: {
							groupsetting: {
								customset: {
									groups
								}
							}
						}
					}
				}
			]
		},
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(survival) {
		survival.on('postRender.test', null)

		const inner = survival.Inner
		const config = inner.state.config

		test.equal(
			JSON.stringify(config.term2.q.groupsetting.customset.groups),
			JSON.stringify(groups),
			`Should correctly pass groups for term0`
		)

		// if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term2 = agedx, regular bins', function(test) {
	test.timeoutAfter(3000)

	const testBinSize = 5
	const testStop = 5

	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
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
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(survival) {
		survival.on('postRender.test', null)

		//Test data correctly appears
		test.equal(survival.Inner.state.config.term2.q.type, 'regular-bin', `Should correctly pass 'regular-bin' to config`)
		test.equal(
			survival.Inner.state.config.term2.q.bin_size,
			testBinSize,
			`Should correctly pass q.bin_size = ${testBinSize} to config`
		)
		test.equal(
			survival.Inner.state.config.term2.q.first_bin.stop,
			testStop,
			`Should correctly pass q.first_bin.stop = ${testStop} to config`
		)

		//Test q.bin_size and q.first_bin.stop changes are applied
		const newStop = 1
		survival.Inner.state.config.term2.q.bin_size = 3
		survival.Inner.state.config.term2.q.first_bin.stop = newStop

		await survival.Inner.app.dispatch({
			type: 'plot_edit',
			id: survival.Inner.id,
			config: survival.Inner.state.config
		})

		const findBin = await detectOne({
			elem: survival.Inner.dom.controls.node(),
			selector: '.ts_summary_btn.sja_filter_tag_btn'
		})
		test.ok(
			findBin.innerText.endsWith(`=${survival.Inner.state.config.term2.q.bin_size}`),
			`Should display the correct bin size = ${survival.Inner.state.config.term2.q.bin_size}`
		)
		test.equal(survival.Inner.state.config.term2.q.first_bin.stop, newStop, `Should update first bin stop = ${newStop}`)

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term2 = agedx, custom bins', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
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
						survival: {},
						controls: {
							isOpen: true
						}
					}
				}
			]
		},
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(survival) {
		survival.on('postRender.test', null)

		const inner = survival.Inner
		const config = inner.state.config

		//Test data correctly appears
		test.equal(config.term2.q.type, 'custom-bin', `Should correctly pass 'custom-bin' to config`)
		const overlayConfig =
			inner.components.controls.Inner.components.config.Inner.components.overlay.Inner.usedTerms[0].q.lst
		test.equal(
			JSON.stringify(config.term2.q.lst),
			JSON.stringify(overlayConfig),
			`Should correctly pass the custom list to overlay component`
		)

		//Test overlay bin changes are applied
		config.term2.q.lst[2] = { startinclusive: true, stopinclusive: true, start: 12, stop: 15, label: '12 to 15' }
		config.term2.q.lst.push({ start: 15, startinclusive: false, stopunbounded: true, label: '>15' })

		await inner.app.dispatch({
			type: 'plot_edit',
			id: inner.id,
			config
		})

		const findBin = await detectOne({
			elem: survival.Inner.dom.controls.node(),
			selector: '.ts_summary_btn.sja_filter_tag_btn'
		})
		test.ok(
			findBin.innerText.endsWith(`${config.term2.q.lst.length} bins`),
			`Should display the correct num of bins = ${config.term2.q.lst.length}`
		)

		if (test._ok) inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term0 = agedx, custom bins', function(test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
					},
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
		survival: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(survival) {
		survival.on('postRender.test', null)

		const inner = survival.Inner
		const config = inner.state.config

		//Test data correctly appears
		test.equal(config.term0.q.type, 'custom-bin', `Should correctly pass 'custom-bin' to config`)
		const overlayConfig =
			inner.components.controls.Inner.components.config.Inner.components.divideBy.Inner.usedTerms[0].q.lst
		test.equal(
			JSON.stringify(config.term0.q.lst),
			JSON.stringify(overlayConfig),
			`Should correctly pass the custom list to divide by component`
		)

		//Test overlay bin changes are applied
		config.term0.q.lst[0] = { startunbounded: true, stop: 15, stopinclusive: false, label: '<15' }
		config.term0.q.lst[1] = { start: 15, startinclusive: false, stopunbounded: true, label: '>15' }

		await inner.app.dispatch({
			type: 'plot_edit',
			id: inner.id,
			config
		})

		const findBin = await detectOne({
			elem: survival.Inner.dom.controls.node(),
			selector: '.ts_summary_btn.sja_filter_tag_btn'
		})
		test.ok(
			findBin.innerText.endsWith(`${config.term0.q.lst.length} bins`),
			`Should display the correct num of bins = ${config.term0.q.lst.length}`
		)

		if (test._ok) inner.app.destroy()
		test.end()
	}
})
