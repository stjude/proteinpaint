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

tape('logistic regression', function(test) {
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
		const expectedNumDivs = 5
		test.equal(actualNumDivs, expectedNumDivs, `should have ${expectedNumDivs} divs`)

		const actualNumRows = resultsDiv.selectAll('tr').size()
		const expectedNumRows = 17
		test.equal(actualNumRows, expectedNumRows, `should have ${expectedNumRows} rows`)
	}
})
