const tape = require('tape')
const termjson = require('../../test/testdata/termjson').termjson
const helpers = require('../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
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
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-series circle').size(),
			153,
			'should render 153 survival series circles (hidden for hover)'
		)
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored-x').size(),
			10,
			'should render 10 survival censored circles'
		)
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
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-series circle').size(),
			171,
			'should render 171 survival series circles (hidden for hover)'
		)
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored-x').size(),
			10,
			'should render 9 survival censored circles'
		)
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
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-series circle').size(),
			171,
			'should render 171 survival series circles (hidden for hover)'
		)
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored-x').size(),
			10,
			'should render 10 survival censored circles'
		)
		test.end()
	}
})
