const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		genome: 'hg38',
		dslabel: 'SJLife'
	},
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mass/regression -***-')
	test.end()
})

tape('linear, outcome type=float', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					//cutoff: 57.8,
					term: {
						id: 'LV_Cardiac_Output_3D',
						q: {
							mode: 'continuous'
						}
					},
					independent: [
						{
							id: 'sex',
							q: {
								groupsetting: { disabled: true },
								refGrp: '1'
							},
							type: 'categorical'
						},
						{
							id: 'genetic_race'
						},
						{
							id: 'hrtavg',
							q: { mode: 'continuous' }
						}
					]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regres) {
		regres.on('postRender.test', null)
		testSectionCounts(regres)
		//testAxisDimension(plot)
		//if (test._ok) plot.Inner.app.destroy()
		test.end()
	}

	function testSectionCounts(regres) {
		const resultsDiv = regres.Inner.dom.div
		console.log('resultsDiv:', resultsDiv)
		const actualNumDivs = resultsDiv.selectAll('div').size()
		console.log('actualNumDivs:', actualNumDivs)
		const expectedNumDivs = 15
		test.equal(actualNumDivs, expectedNumDivs, `should have ${expectedNumDivs} divs`)

		const actualNumRows = resultsDiv.selectAll('tr').size()
		const expectedNumRows = 20
		test.equal(actualNumRows, expectedNumRows, `should have ${expectedNumRows} rows`)
	}
})

tape('logistic outcome type=float', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					//cutoff: 57.8,
					term: {
						id: 'LV_Cardiac_Output_3D',
						q: {
							mode: 'binary',
							type: 'custom',
							lst: [
								{ startunbounded: true, stopinclusive: true, stop: '4.72', label: '≤4.72' },
								{ stopunbounded: true, startinclusive: false, start: '4.72', label: '>4.72' }
							],
							refGrp: '≤4.72'
						}
					},
					independent: [
						{
							id: 'sex',
							q: {
								groupsetting: { disabled: true },
								refGrp: '1'
							},
							type: 'categorical'
						},
						{
							id: 'genetic_race'
						},
						{
							id: 'hrtavg',
							q: { mode: 'continuous' }
						}
					]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regres) {
		regres.on('postRender.test', null)
		testSectionCounts(regres)
		//testAxisDimension(plot)
		//if (test._ok) plot.Inner.app.destroy()
		test.end()
	}

	function testSectionCounts(regres) {
		const resultsDiv = regres.Inner.dom.div
		const actualNumDivs = resultsDiv.selectAll('div').size()
		const expectedNumDivs = 15
		test.equal(actualNumDivs, expectedNumDivs, `should have ${expectedNumDivs} divs`)

		const actualNumRows = resultsDiv.selectAll('tr').size()
		const expectedNumRows = 20
		test.equal(actualNumRows, expectedNumRows, `should have ${expectedNumRows} rows`)
	}
})

tape('logistic outcome type=condition', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					//cutoff: 57.8,
					term: {
						id: 'Arrhythmias',
						q: {
							groupsetting: {
								inuse: true,
								predefined_groupset_idx: 0
							},
							value_by_max_grade: true,
							bar_by_grade: true,
							refGrp: 'Has condition'
						}
					},
					independent: [
						{
							id: 'sex',
							q: {
								groupsetting: { disabled: true },
								refGrp: '1'
							},
							type: 'categorical'
						}
					]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regres) {
		regres.on('postRender.test', null)
		testSectionCounts(regres)
		//testAxisDimension(plot)
		//if (test._ok) plot.Inner.app.destroy()
		test.end()
	}

	function testSectionCounts(regres) {
		const resultsDiv = regres.Inner.dom.div
		const actualNumDivs = resultsDiv.selectAll('div').size()
		const expectedNumDivs = 15
		test.equal(actualNumDivs, expectedNumDivs, `should have ${expectedNumDivs} divs`)

		const actualNumRows = resultsDiv.selectAll('tr').size()
		const expectedNumRows = 14
		test.equal(actualNumRows, expectedNumRows, `should have ${expectedNumRows} rows`)
	}
})

tape.only('logistic outcome: reference category missing from tsv', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					//cutoff: 57.8,
					term: {
						id: 'vincristine_5',
						q: {
							mode: 'binary',
							type: 'custom',
							lst: [
								{ startunbounded: true, stopinclusive: true, stop: 22.05, label: '≤22.05' },
								{ stopunbounded: true, startinclusive: false, start: 22.05, label: '>22.05' }
							],
							refGrp: '≤22.05'
						}
					},
					independent: [
						{
							id: 'agedx',
							q: { mode: 'continuous' }
						},
						{
							id: 'idarubicin_5',
							q: {
								mode: 'discrete',
								type: 'regular',
								startinclusive: true,
								bin_size: 10,
								first_bin: { stop: 10, bin: 'first', startunbounded: true },
								last_bin: { start: 70, bin: 'last', stopunbounded: true },
								hiddenValues: { '0': 1, '-8888': 1, '-9999': 1 },
								termtype: 'float',
								stopinclusive: false,
								rounding: '.0f',
								refGrp: '<10'
							}
						}
					]
				}
			]
		},
		regression: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(regres) {
		regres.on('postRender.test', null)
		const banner = regres.Inner.dom.banner
		//banner.node().firstChild.innerText
		const actualErrMsg = banner.text()
		const expectedErrMsg = `Error: the reference category '≤22.05' is not found in the variable 'outcome' in the tsv✕`
		test.equal(
			actualErrMsg,
			expectedErrMsg,
			`absence of reference category in tsv should throw error before regression computation`
		)
		test.end()
	}
})
