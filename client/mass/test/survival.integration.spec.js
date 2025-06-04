import tape from 'tape'
import { termjson } from '../../test/testdata/termjson'
import * as helpers from '../../test/front.helpers.js'
import { detectOne, detectGte } from '../../test/test.helpers.js'

/*
Tests:
	survival term as term1
	survival term as term1, with overlay
	survival term as overlay
	survival term as term1, with divide by
	survival term as term1, term2 = genetic_race, categorical groupsetting
	survival term as term1, term0 = genetic_race, categorical groupsetting
	survival term as term1, term2 = agedx, regular bins
	survival term as term1, term2 = agedx, custom bins
	survival term as term1, term0 = agedx, custom bins
	survival term as term1, term2 = geneVariant
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
tape('\n', function (test) {
	test.pass('-***- plots/survival -***-')
	test.end()
})

tape('survival term as term1', function (test) {
	test.timeoutAfter(10000)
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

tape('survival term as term1, with overlay', function (test) {
	test.timeoutAfter(10000)
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

tape('survival term as term1, with divide by', function (test) {
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
						id: 'sex'
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
		const inner = survival.Inner
		const survivalDiv = inner.dom.chartsDiv
		const term0Values = inner.state.config.term0.term.values

		//Test all dom elements present
		const termNum = Object.keys(term0Values).length
		test.equal(survivalDiv.selectAll('.pp-survival-chart').size(), termNum, `Should render ${termNum} survival charts`)

		test.equal(
			survivalDiv.selectAll('.sjpp-survival-atrisk').size(),
			termNum,
			`Should render 'Number at risk' tables below chart`
		)

		const titleNodes = survivalDiv.selectAll('.sjpp-survival-title').nodes()
		for (const v of Object.values(term0Values)) {
			if (!titleNodes.some(d => d.innerText == v.label)) test.fail(`Missing title for term0 value = ${v.label}`)
		}

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as overlay', function (test) {
	test.timeoutAfter(10000)
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

tape('survival term as term1, term2 = genetic_race, categorical groupsetting', function (test) {
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
							customset: {
								groups
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
			JSON.stringify(config.term2.q.customset.groups),
			JSON.stringify(groups),
			`Should correctly pass customset groups for term2`
		)

		const numOfTerms = Object.keys(inner.term2toColor).length
		test.equal(
			inner.dom.chartsDiv.selectAll('.sjpp-survival-series').size(),
			numOfTerms,
			`Should render ${numOfTerms} surv series g`
		)

		const censoredSym = inner.currData.filter(d => d.ncensor)
		test.equal(
			inner.dom.chartsDiv.selectAll('.sjpp-survival-censored-x').size(),
			censoredSym.length,
			`should render ${censoredSym.length} survival censored symbols`
		)

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term0 = genetic_race, categorical groupsetting', function (test) {
	test.timeoutAfter(10000)

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
							customset: {
								groups
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
		const term0Values = config.term0.term.values

		test.equal(
			JSON.stringify(config.term0.q.customset.groups),
			JSON.stringify(groups),
			`Should correctly pass customset groups for term0`
		)

		//Test all dom elements present
		const termNum = inner.serverData.refs.orderedKeys.chart
		test.equal(
			inner.dom.chartsDiv.selectAll('.pp-survival-chart').size(),
			termNum.length,
			`Should render ${termNum.length} survival charts`
		)

		test.equal(
			inner.dom.chartsDiv.selectAll('.sjpp-survival-atrisk').size(),
			termNum.length,
			`Should render 'Number at risk' tables below each chart`
		)

		const titleNodes = inner.dom.chartsDiv.selectAll('.sjpp-survival-title').nodes()
		termNum.forEach(v => {
			if (!titleNodes.some(d => d.innerText == v)) test.fail(`Missing title for term0 value = ${v}`)
		})

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term2 = agedx, regular bins', function (test) {
	test.timeoutAfter(10000)
	test.plan(4)

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

		// Test q.bin_size and q.first_bin.stop changes are applied
		const newStop = 1
		// Create a copy of the state config to modify, otherwise
		// a dispatch may not propagate to this survival component instance
		// since the state would just equal itself (nothing has changed so no need to rerender),
		// whereas a modified copy will not equal the original state
		const config = structuredClone(survival.Inner.state.config)
		const expectedCount = 8

		const survCurves = await detectGte({
			elem: survival.Inner.dom.chartsDiv.node(),
			selector: '.sjpp-survival-series',
			count: expectedCount,
			async trigger() {
				// this modifies the copy
				config.term2.q.bin_size = 3
				config.term2.q.first_bin.stop = newStop
				survival.Inner.app.dispatch({
					type: 'plot_edit',
					id: survival.Inner.id,
					config
				})
			}
		})

		test.equal(survCurves.length, expectedCount, `Should display the correct bin size = ${expectedCount}`)

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term2 = agedx, custom bins', function (test) {
	test.timeoutAfter(10000)

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
						survival: {}
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

		// Create a copy of the state config to modify, otherwise
		// a dispatch may not propagate to this survival component instance
		// since the state would just equal itself (nothing has changed so no need to rerender),
		// whereas a modified copy will not equal the original state
		const config2 = structuredClone(config)
		const expectedCount = 3

		const survCurves = await detectGte({
			elem: survival.Inner.dom.chartsDiv.node(),
			selector: '.sjpp-survival-series',
			count: expectedCount,
			async trigger() {
				//Test overlay bin changes are applied
				config2.term2.q.lst[2] = { startinclusive: true, stopinclusive: true, start: 12, stop: 15, label: '12 to 15' }
				config2.term2.q.lst.push({ start: 15, startinclusive: false, stopunbounded: true, label: '>15' })
				inner.app.dispatch({
					type: 'plot_edit',
					id: inner.id,
					config: config2
				})
			}
		})

		test.equal(survCurves.length, expectedCount, `Should display the correct num of bins = ${expectedCount}`)

		if (test._ok) inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term0 = agedx, custom bins', function (test) {
	test.timeoutAfter(20000)

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

		// Create a copy of the state config to modify, otherwise
		// a dispatch may not propagate to this survival component instance
		// since the state would just equal itself (nothing has changed so no need to rerender),
		// whereas a modified copy will not equal the original state
		const config2 = structuredClone(config)
		const expectedCount = 3

		const survCurves = await detectGte({
			elem: survival.Inner.dom.chartsDiv.node(),
			selector: '.sjpp-survival-series',
			count: expectedCount,
			async trigger() {
				//Test overlay bin changes are applied
				config2.term0.q.lst = [
					{ startunbounded: true, stop: 5, stopinclusive: false, label: '<5' },
					{ start: 5, stop: 8, startinclusive: true, stopinclusive: false, label: '5 to <8' },
					{ start: 8, startinclusive: true, stopunbounded: true, label: '>=8' }
				]

				await inner.app.dispatch({
					type: 'plot_edit',
					id: inner.id,
					config: config2
				})
			}
		})
		test.equal(survCurves.length, expectedCount, `Should display the correct num of bins = ${expectedCount}`)

		if (test._ok) inner.app.destroy()
		test.end()
	}
})

tape('survival term as term1, term2 = geneVariant', function (test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'survival',
					term: {
						id: 'efs'
					},
					term2: { term: { type: 'geneVariant', gene: 'TP53' } }
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
		test.equal(survivalDiv && survivalDiv.selectAll('.sjpp-survival-series').size(), 2, 'should render 2 surv series g')
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored-x').size(),
			10,
			'should render 10 survival censored symbols'
		)

		if (test._ok) survival.Inner.app.destroy()
		test.end()
	}
})
