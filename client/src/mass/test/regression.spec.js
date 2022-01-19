const tape = require('tape')
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
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'linear',
					//cutoff: 57.8,
					outcome: {
						varClass: 'term',
						id: 'LV_Cardiac_Output_3D',
						q: {
							mode: 'continuous'
						}
					},
					independent: [
						{
							varClass: 'term',
							id: 'sex',
							q: {
								groupsetting: { disabled: true }
							},
							refGrp: '1',
							type: 'categorical'
						},
						{
							varClass: 'term',
							id: 'genetic_race'
						},
						{
							varClass: 'term',
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
		const resultsDiv = regres.Inner.results.dom.holder
		const actualNumDivs = resultsDiv.selectAll('div').size()
		const expectedNumDivs = 20
		test.equal(actualNumDivs, expectedNumDivs, `should have ${expectedNumDivs} divs`)

		const actualNumRows = resultsDiv.selectAll('tr').size()
		const expectedNumRows = 21
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
					outcome: {
						varClass: 'term',
						id: 'LV_Cardiac_Output_3D',
						q: {
							mode: 'binary',
							type: 'custom',
							lst: [
								{ startunbounded: true, stopinclusive: true, stop: '4.72', label: '≤4.72' },
								{ stopunbounded: true, startinclusive: false, start: '4.72', label: '>4.72' }
							]
						},
						refGrp: '≤4.72'
					},
					independent: [
						{
							varClass: 'term',
							id: 'sex',
							q: {
								groupsetting: { disabled: true }
							},
							refGrp: '1',
							type: 'categorical'
						},
						{
							varClass: 'term',
							id: 'genetic_race'
						},
						{
							varClass: 'term',
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
		const resultsDiv = regres.Inner.results.dom.holder
		const actualNumDivs = resultsDiv.selectAll('div').size()
		const expectedNumDivs = 23
		test.equal(actualNumDivs, expectedNumDivs, `should have ${expectedNumDivs} divs`)

		const actualNumRows = resultsDiv.selectAll('tr').size()
		const expectedNumRows = 21
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
					outcome: {
						varClass: 'term',
						id: 'Arrhythmias',
						q: {
							mode: 'binary',
							groupsetting: {
								inuse: true,
								predefined_groupset_idx: 0
							},
							value_by_max_grade: true,
							bar_by_grade: true,
							type: 'predefined-groupset'
						},
						refGrp: 'Has condition'
					},
					independent: [
						{
							varClass: 'term',
							id: 'sex',
							q: {
								groupsetting: { disabled: true }
							},
							refGrp: '1',
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
		const resultsDiv = regres.Inner.results.dom.holder
		const actualNumDivs = resultsDiv.selectAll('div').size()
		const expectedNumDivs = 19
		test.equal(actualNumDivs, expectedNumDivs, `should have ${expectedNumDivs} divs`)

		const actualNumRows = resultsDiv.selectAll('tr').size()
		const expectedNumRows = 15
		test.equal(actualNumRows, expectedNumRows, `should have ${expectedNumRows} rows`)
	}
})

/* 
	Testing for a reference group error from the server may be hard to trigger
	from the client side, since the regression.inputs.term.js code may 
	automatically replace a refGrp based on sampleCounts from the server

	skip for now until more reliable server error can be triggered
*/
tape.skip('logistic outcome: missing reference category', function(test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'regression',
					regressionType: 'logistic',
					//cutoff: 57.8,
					outcome: {
						varClass: 'term',
						id: 'vincristine_5',
						q: {
							mode: 'binary',
							type: 'custom',
							lst: [
								{ startunbounded: true, stopinclusive: true, stop: 22.05, label: '≤22.05' },
								{ stopunbounded: true, startinclusive: false, start: 22.05, label: '>22.05' }
							]
						},
						refGrp: '≤22.05'
					},
					independent: [
						{
							varClass: 'term',
							id: 'agedx',
							q: { mode: 'continuous' }
						},
						{
							varClass: 'term',
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
								rounding: '.0f'
							},
							refGrp: '<10'
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
		const actualErrMsg = regres.Inner.results.dom.err_div.text()
		const expectedErrMsg = `Error: the reference category '≤22.05' is not found in the variable 'outcome'✕`
		test.equal(
			actualErrMsg,
			expectedErrMsg,
			`should error out prior to R script if reference category of variable is missing in data matrix`
		)
		const results = regres.Inner.results.dom.holder
		const actualResultDivCnt = results
			.selectAll('div')
			.filter(function() {
				return this.style.display !== 'none'
			})
			.size()
		const expectedResultDivCnt = 6 // may include empty divs, not rendered divs for results
		test.equal(actualResultDivCnt, expectedResultDivCnt, `should not have results divs`)
		test.end()
	}
})
