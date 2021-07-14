const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
		//nav: { header_mode: 'with_tabs' }
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
	test.timeoutAfter(2000)
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Survival outcome', 'efs'],
				visiblePlotIds: ['efs'],
				plots: {
					efs: {
						term: {
							id: 'efs'
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let survivalDiv
	async function runTests(plot) {
		survivalDiv = plot.Inner.components.survival.Inner.dom.chartsDiv
		test.equal(survivalDiv && survivalDiv.selectAll('.sjpp-survival-series').size(), 1, 'should render 1 surv series g')
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-series circle').size(),
			61,
			'should render 61 survival series circles (hidden for hover)'
		)
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored circle').size(),
			10,
			'should render 10 survival censored circles'
		)
		test.end()
	}
})

tape('survival term as term1, with overlay', function(test) {
	test.timeoutAfter(2000)
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Survival outcome', 'efs'],
				visiblePlotIds: ['efs'],
				plots: {
					efs: {
						term: {
							id: 'efs'
						},
						term2: {
							id: 'diaggrp'
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let survivalDiv
	async function runTests(plot) {
		survivalDiv = plot.Inner.components.survival.Inner.dom.chartsDiv
		test.equal(survivalDiv && survivalDiv.selectAll('.sjpp-survival-series').size(), 3, 'should render 3 surv series g')
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-series circle').size(),
			54,
			'should render 54 survival series circles (hidden for hover)'
		)
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored circle').size(),
			9,
			'should render 9 survival censored circles'
		)
		test.end()
	}
})

tape('survival term as overlay', function(test) {
	test.timeoutAfter(2000)
	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis', 'diaggrp'],
				visiblePlotIds: ['diaggrp'],
				plots: {
					diaggrp: {
						term: {
							id: 'diaggrp'
						},
						term2: {
							id: 'efs'
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let survivalDiv
	async function runTests(plot) {
		survivalDiv = plot.Inner.components.survival.Inner.dom.chartsDiv
		test.equal(survivalDiv && survivalDiv.selectAll('.sjpp-survival-series').size(), 3, 'should render 3 surv series g')
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-series circle').size(),
			54,
			'should render 54 survival series circles (hidden for hover)'
		)
		test.equal(
			survivalDiv && survivalDiv.selectAll('.sjpp-survival-censored circle').size(),
			9,
			'should render 9 survival censored circles'
		)
		test.end()
	}
})
