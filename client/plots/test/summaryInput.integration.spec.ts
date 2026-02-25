import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { detectLst, detectGte, detectOne } from '../../test/test.helpers.js'
import { getGeneVariantTw } from '../../test/testdata/data.ts'

/*
Test sections

term1=categorical
term1=categorical; term2=numeric
term1=categorical; term2=numeric; term0=categorical
term1=geneVariant
term1=geneExpression
term1=survival; term2=categorical
term1=survival; term2=numeric
term1=survival; term2=geneVariant
term1=survival; term2=geneExpression
*/

tape('\n', function (test) {
	test.comment('-***- plots/summaryInput -***-')
	test.end()
})

tape('term1=categorical', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'diaggrp' }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const barsSvg = await detectOne({ elem: appHolder, selector: '.pp-bars-svg' })
		test.ok(barsSvg, 'Should render barchart svg')
		const bars = await detectGte({ elem: barsSvg, selector: '.bars-cell-grp', count: 1 })
		test.ok(bars.length, 'Should render at least one bar')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=categorical; term2=numeric', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'diaggrp' },
					term2: { id: 'agedx' }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const barsSvg = await detectOne({ elem: appHolder, selector: '.pp-bars-svg' })
		test.ok(barsSvg, 'Should render barchart svg')
		const bars = await detectGte({ elem: barsSvg, selector: '.bars-cell-grp', count: 1 })
		test.ok(bars.length, 'Should render at least one bar')
		const overlays = await detectGte({ elem: barsSvg, selector: '.bars-cell', count: 1 })
		test.ok(overlays.length > bars.length, 'Should have more overlays than bars')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=categorical; term2=numeric; term0=categorical', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'diaggrp' },
					term2: { id: 'agedx' },
					term0: { id: 'sex' }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const barsSvgs = await detectGte({ elem: appHolder, selector: '.pp-bars-svg', count: 1 })
		test.equal(barsSvgs.length, 2, 'Should render 2 barchart svgs')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneVariant', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: getGeneVariantTw()
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const barsSvg = await detectOne({ elem: appHolder, selector: '.pp-bars-svg' })
		test.ok(barsSvg, 'Should render barchart svg')
		const bars = await detectGte({ elem: barsSvg, selector: '.bars-cell-grp', count: 1 })
		test.ok(bars.length, 'Should render at least one bar')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=geneExpression', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { term: { type: 'geneExpression', gene: 'TP53' } }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const violinSvg = await detectOne({ elem: appHolder, selector: '.sjpp-violin-plot' })
		test.ok(violinSvg, 'Should render violin svg')
		const violinPaths = await detectLst({ elem: violinSvg, selector: '.sjpp-vp-path', count: 2 })
		test.equal(violinPaths.length, 2, 'Should render a single violin plot with 2 paths')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=survival; term2=categorical', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'os' },
					term2_surv: { id: 'sex' }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const survivalSvg = await detectOne({ elem: appHolder, selector: '.pp-survival-svg' })
		test.ok(survivalSvg, 'Should render survival svg')
		const serieses = await detectLst({ elem: survivalSvg, selector: '.sjpp-survival-series', count: 2 })
		test.equal(serieses.length, 2, 'Should render 2 survival series')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=survival; term2=numeric', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'os' },
					term2_surv: { id: 'agedx' }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const survivalSvg = await detectOne({ elem: appHolder, selector: '.pp-survival-svg' })
		test.ok(survivalSvg, 'Should render survival svg')
		const serieses = await detectLst({ elem: survivalSvg, selector: '.sjpp-survival-series', count: 2 })
		test.equal(serieses.length, 2, 'Should render 2 survival series')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=survival; term2=geneVariant', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'os' },
					term2_surv: getGeneVariantTw()
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const survivalSvg = await detectOne({ elem: appHolder, selector: '.pp-survival-svg' })
		test.ok(survivalSvg, 'Should render survival svg')
		const serieses = await detectLst({ elem: survivalSvg, selector: '.sjpp-survival-series', count: 2 })
		test.equal(serieses.length, 2, 'Should render 2 survival series')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('term1=survival; term2=geneExpression', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'os' },
					term2_surv: { term: { type: 'geneExpression', gene: 'TP53' } }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		submitBtn.click()
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const survivalSvg = await detectOne({ elem: appHolder, selector: '.pp-survival-svg' })
		test.ok(survivalSvg, 'Should render survival svg')
		const serieses = await detectLst({ elem: survivalSvg, selector: '.sjpp-survival-series', count: 2 })
		test.equal(serieses.length, 2, 'Should render 2 survival series')
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

tape('plot filter', test => {
	test.timeoutAfter(3000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'diaggrp' },
					filter: {
						type: 'tvslst',
						in: true,
						join: '',
						lst: [
							{
								type: 'tvs',
								tvs: {
									term: {
										type: 'categorical',
										values: { '1': { label: 'Male', color: '#e75480' }, '2': { label: 'Female', color: 'blue' } },
										groupsetting: { disabled: true },
										name: 'Sex',
										id: 'sex',
										isleaf: true,
										sample_type: '1',
										hashtmldetail: true,
										included_types: ['categorical'],
										child_types: []
									},
									values: [{ samplecount: 36, key: '2', label: 'Female', bar_width_frac: 1 }]
								}
							}
						]
					}
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		const appHolder = chart.Inner.app.Inner.dom.holder.node()
		const submitBtn = chart.Inner.dom.submit.select('button').node()
		const barsSvg = await detectOne({
			elem: appHolder,
			selector: '.pp-bars-svg',
			trigger: () => {
				submitBtn.click()
			}
		})
		const serieses = barsSvg.querySelectorAll('.bars-cell')
		test.equal(serieses.length, 7, 'Should render 7 bars')
		const tvsPill = barsSvg.closest('.sjpp-sandbox').querySelectorAll('.tvs_pill')
		test.equal(tvsPill.length, 1, 'Should render 1 filter pill in the barchart sandbox')
		test.true(
			barsSvg.querySelector('.sjpcb-bar-chart-x-title text').textContent.includes('n=35'),
			'should render the expected number of samples'
		)
		if (test['_ok']) chart.Inner.app.destroy()
		test.end()
	}
})

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			activeTab: 1
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})
