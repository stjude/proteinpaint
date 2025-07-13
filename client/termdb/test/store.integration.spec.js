import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import * as store from '../store'
//import ds from '@sjcrh/proteinpaint-server/dataset/termdb.test.js')
import * as rx from '../../rx'

/*
Tests:
	init errors
	state: no cohort.termdb.selectCohort
	state rehydrate: default cohort
	state rehydrate: activeCohort=1
	state rehydrate: by cohortFilter
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/store -***-')
	test.end()
})

tape('init errors', function (test) {
	test.timeoutAfter(1300)
	test.plan(3)
	runpp({
		vocabApi: {},
		callbacks: {
			'postInit.test': testMissingState
		}
	})
	function testMissingState(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div:nth-child(2)')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state{} missing', 'should be displayed for missing .state{}')
		}, 200)
	}

	runpp({
		vocabApi: {},
		state: {
			vocab: {
				route: 'termdb',
				dslabel: 'test'
			}
		},
		callbacks: {
			'postInit.test': testMissingGenome
		}
	})
	function testMissingGenome(app) {
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div:nth-child(2)')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state[.vocab].genome missing', 'should be displayed for missing .state.genome')
		}, 200)
	}

	runpp({
		vocabApi: {},
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
		const d = app.Inner.dom.errdiv.selectAll('.sja_errorbar').select('div:nth-child(2)')
		setTimeout(() => {
			test.equal(d.text(), 'Error: .state[.vocab].dslabel missing', 'should be displayed for missing .state.dslabel')
			test.end()
		}, 400)
	}
})

tape('state: no cohort.termdb.selectCohort', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			genome: 'hg38-test',
			// dslabel: 'NoCohortSJLife' - This dslabel isn't available
			dslabel: 'TermdbTest',
			activeCohort: -1
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

tape('state rehydrate: default cohort', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			genome: 'hg38-test',
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

tape('state rehydrate: activeCohort=1', function (test) {
	test.timeoutAfter(3000)
	runpp({
		state: {
			genome: 'hg38-test',
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

tape('state rehydrate: by cohortFilter', function (test) {
	test.timeoutAfter(3000)
	// copied from server/dataset/termdb.test.js
	const selectCohort = {
		term: {
			id: 'subcohort',
			type: 'multivalue'
		},
		prompt: 'To get started with the Clinical Browser, select the survivor population you wish to browse.',
		values: [
			// <ul><li> for items, with a radio button for each.
			{
				keys: ['ABC'],
				label: 'St. Jude Lifetime Cohort (ABC)',
				shortLabel: 'ABC',
				isdefault: true
			},
			{
				keys: ['XYZ'],
				label: 'Childhood Cancer Survivor Study (XYZ)',
				shortLabel: 'XYZ'
			},
			{
				keys: ['ABC', 'XYZ'],
				label: 'Combined ABC+XYZ',
				shortLabel: 'ABC+XYZ',
				// show note under label in smaller text size
				note: 'The combined cohorts are limited to those variables that are comparable between the two populations. For example, selecting this category does not allow browsing of clinically-ascertained variables, which are only available in ABC.'
			}
		]
	}

	runpp({
		state: {
			genome: 'hg38-test',
			dslabel: 'TermdbTest',
			header_mode: 'with_cohortHtmlSelect',
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
