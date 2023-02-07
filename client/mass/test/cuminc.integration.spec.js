const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
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
**************

basic cuminc
hidden uncomputable
skipped series

*/
tape('\n', function(test) {
	test.pass('-***- termdb/cuminc -***-')
	test.end()
})

tape('basic cuminc', function(test) {
	test.timeoutAfter(10000)
	runpp({
		state: {
			plots: [
				{
					chartType: 'cuminc',
					term: {
						id: 'Cardiac dysrhythmia',
						term: termjson['Cardiac dysrhythmia'],
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

	let cumincDiv
	async function runTests(cuminc) {
		cumincDiv = cuminc.Inner.dom.chartsDiv
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
						//term: termjson['Cardiac dysrhythmia'],
						q: { bar_by_grade: true, value_by_max_grade: true }
					},
					term2: {
						id: 'genetic_race'
						//term: termjson['Cardiac dysrhythmia'],
						//q: { bar_by_grade: true, value_by_max_grade: true }
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
