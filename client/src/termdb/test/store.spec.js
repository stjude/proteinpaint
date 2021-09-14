const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')
const store = require('../store')
const ds = require('../../../../server/dataset/sjlife2.hg38.js')
const rx = require('../../common/rx.core')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/store -***-')
	test.end()
})

tape('init errors', function(test) {
	test.timeoutAfter(1300)
	test.plan(3)
	runpp({
		callbacks: {
			'postInit.test': testMissingState
		}
	})
	function testMissingState(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state{} missing', 'should be displayed for missing .state{}')
		}, 200)
	}

	runpp({
		state: {
			vocab: {
				route: 'termdb'
			}
		},
		callbacks: {
			'postInit.test': testMissingGenome
		}
	})
	function testMissingGenome(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state[.vocab].genome missing', 'should be displayed for missing .state.genome')
		}, 200)
	}

	runpp({
		state: {
			vocab: {
				route: 'termdb',
				genome: 'hg38'
			}
		},
		callbacks: {
			'postInit.test': testMissingDslabel
		}
	})
	function testMissingDslabel(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state[.vocab].dslabel missing', 'should be displayed for missing .state.dslabel')
			test.end()
		}, 400)
	}
})

tape('state: no cohort.termdb.selectCohort', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			genome: 'hg38',
			dslabel: 'NoCohortSJLife'
		},
		callbacks: {
			'postRender.test': runTests
		}
	})

	async function runTests(app) {
		app.Inner.bus.on('postRender.test', null)
		test.equal(app.Inner.state.activeCohort, -1, 'should not set the default activeCohort')
		test.end()
	}
})

tape('state rehydrate: default cohort', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			genome: 'hg38',
			dslabel: 'TermdbTest'
		},
		callbacks: {
			'postRender.test': runTests
		}
	})

	async function runTests(app) {
		app.Inner.bus.on('postRender.test', null)
		test.equal(app.Inner.state.activeCohort, 0, 'should set the default activeCohort')
		const selectCohort = (app.Inner.state.termdbConfig && app.Inner.state.termdbConfig.selectCohort) || { values: [] }
		test.deepEqual(
			app.Inner.state.termfilter.filter,
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						tag: 'cohortFilter',
						type: 'tvs',
						tvs: {
							term: selectCohort.term,
							values: selectCohort.values[0].keys.map(key => {
								return { key, label: key }
							})
						}
					},
					{
						tag: 'filterUiRoot',
						type: 'tvslst',
						in: true,
						join: '',
						lst: []
					}
				]
			},
			'should have matching cohort filter data'
		)
		test.end()
	}
})

tape('state rehydrate: activeCohort=1', function(test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			genome: 'hg38',
			dslabel: 'TermdbTest',
			activeCohort: 1
		},
		callbacks: {
			'postRender.test': runTests
		}
	})

	async function runTests(app) {
		app.Inner.bus.on('postRender.test', null)
		test.equal(app.Inner.state.activeCohort, 1, 'should set activeCohort = 1')
		const selectCohort = (app.Inner.state.termdbConfig && app.Inner.state.termdbConfig.selectCohort) || { values: [] }
		test.deepEqual(
			app.Inner.state.termfilter.filter,
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						tag: 'cohortFilter',
						type: 'tvs',
						tvs: {
							term: selectCohort.term,
							values: selectCohort.values[1].keys.map(key => {
								return { key, label: key }
							})
						}
					},
					{
						tag: 'filterUiRoot',
						type: 'tvslst',
						in: true,
						join: '',
						lst: []
					}
				]
			},
			'should have matching cohort filter data'
		)
		test.end()
	}
})

tape('state rehydrate: by cohortFilter', function(test) {
	test.timeoutAfter(3000)
	const selectCohort = ds.cohort.termdb.selectCohort || { values: [] }
	runpp({
		state: {
			genome: 'hg38',
			dslabel: 'TermdbTest',
			termfilter: {
				filter: {
					type: 'tvslst',
					in: true,
					join: 'and',
					lst: [
						{
							tag: 'cohortFilter',
							type: 'tvs',
							tvs: {
								term: selectCohort.term,
								/*** REVERSE the order of value keys for testing insensitivity to that order ***/
								values: selectCohort.values[1].keys.reverse().map(key => {
									return { key, label: key }
								})
							}
						},
						{
							tag: 'filterUiRoot',
							type: 'tvslst',
							in: true,
							join: '',
							lst: []
						}
					]
				}
			},
			nav: {
				header_mode: 'with_tabs'
			}
		},
		callbacks: {
			'postRender.test': runTests
		}
	})

	async function runTests(app) {
		app.Inner.bus.on('postRender.test', null)
		test.equal(app.Inner.state.activeCohort, 1, 'should set activeCohort = 1')
		const selectCohort = (app.Inner.state.termdbConfig && app.Inner.state.termdbConfig.selectCohort) || { values: [] }
		test.deepEqual(
			app.Inner.state.termfilter.filter,
			{
				type: 'tvslst',
				in: true,
				join: 'and',
				lst: [
					{
						tag: 'cohortFilter',
						type: 'tvs',
						tvs: {
							term: selectCohort.term,
							values: selectCohort.values[1].keys.map(key => {
								return { key, label: key }
							})
						}
					},
					{
						tag: 'filterUiRoot',
						type: 'tvslst',
						in: true,
						join: '',
						lst: []
					}
				]
			},
			'should have matching cohort filter data regardless of value.keys order'
		)
		test.end()
	}
})
