const tape = require('tape')
const helpers = require('../../test/front.helpers.js')

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

basic cuminc
term1=Cardiovascular System, filter=ALL
term1=Cardiovascular System, term2=agedx
hidden uncomputable
skipped series

**************
*/
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
		test.equal(cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series').size(), 1, 'should render 1 cuminc series g')
		test.equal(
			cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series path').size(),
			2,
			'should render 2 cuminc series paths for estimate line and 95% CI area'
		)

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

	async function runTests(plot) {
		const div = plot.Inner.dom.chartsDiv
		test.equal(div.selectAll('.sjpcb-cuminc-series').size(), 2, 'should render 2 cuminc series <g>')
		test.equal(
			div.selectAll('.sjpcb-cuminc-series path').size(),
			4,
			'should render 4 cuminc series paths for estimate line and 95% CI area'
		)

		if (test._ok) plot.Inner.app.destroy()
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
