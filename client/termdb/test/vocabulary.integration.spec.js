const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const vocabInit = require('../vocabulary').vocabInit
const appInit = require('../app').appInit
const vocabData = require('./vocabData')
const TermdbVocab = require('../TermdbVocab').TermdbVocab
const FrontendVocab = require('../FrontendVocab').FrontendVocab
const d3s = require('d3-selection')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('position', 'relative')
		.style('margin', '20px')
		.style('border', '1px solid #000')
}

/**************
 test sections
**************
vocabInit()
	vocabInit(), default
	getVocab(), custom
	Missing .state
TermdbVocab
	TermdbVocab()
FrontendVocab
	FrontendVocab()
	Missing state.vocab
*/

tape('\n', function(test) {
	test.pass('-***- termdb/vocabulary -***-')
	test.end()
})

tape('vocabInit(), default', test => {
	/* Tests TermdbVocab indirectly */
	const app = {
		opts: {
			state: {
				genome: 'xxx',
				dslabel: 'yyy'
			}
		}
	}
	const vocabApi = vocabInit({ app, state: app.opts.state, fetchOpts: app.opts.fetchOpts })

	test.equal(typeof vocabApi, 'object', 'should return a vocab object')
	test.equal(typeof vocabApi.vocab, 'object', 'should return a vocab.vocab object')
	const validateVocabObject =
		typeof vocabApi.vocab.genome == 'string' && typeof vocabApi.vocab.dslabel == 'string' ? true : false
	test.ok(validateVocabObject, 'Should include all required keys for created vocab object')

	test.equal(typeof vocabApi.getTermdbConfig, 'function', 'should have a vocab.getTermdbConfig function')
	test.equal(typeof vocabApi.getTermChildren, 'function', 'should have a vocab.getTermChildren function')
	test.equal(
		typeof vocabApi.getNestedChartSeriesData,
		'function',
		'should have a vocab.getNestedChartSeriesData function'
	)
	test.equal(typeof vocabApi.getRegressionData, 'function', 'should have a vocab.getRegressionData function')
	test.equal(typeof vocabApi.findTerm, 'function', 'should have a vocab.findTerm function')
	test.equal(typeof vocabApi.getCohortSampleCount, 'function', 'should have a vocab.getCohortSampleCount function')
	test.equal(typeof vocabApi.getFilteredSampleCount, 'function', 'should have a vocab.getFilteredSampleCount function')

	//getPercentile
	//syncTermData
	//getAnnotatedSampleData
	test.end()
})

tape('getVocab(), custom', test => {
	/* Tests FrontendVocab indirectly */

	runpp({
		state: {
			vocab: vocabData
		},
		callbacks: {
			'postInit.test': runTests
		}
	})

	function runTests(app) {
		test.equal(typeof app.vocabApi, 'object', 'should return a vocab object')
		test.equal(typeof app.vocabApi.getTermdbConfig, 'function', 'should have a vocab.getTermdbConfig function')
		test.equal(typeof app.vocabApi.getTermChildren, 'function', 'should have a vocab.getTermChildren function')
		test.equal(
			typeof app.vocabApi.getNestedChartSeriesData,
			'function',
			'should have a vocab.getNestedChartSeriesData function'
		)
		//test.equal(typeof app.vocabApi.getRegressionData, 'function', 'should have a vocab.getRegressionData function')
		test.equal(typeof app.vocabApi.findTerm, 'function', 'should have a vocab.findTerm function')
		test.equal(
			typeof app.vocabApi.getCohortSampleCount,
			'function',
			'should have a vocab.getCohortSampleCount function'
		)
		test.equal(
			typeof app.vocabApi.getFilteredSampleCount,
			'function',
			'should have a vocab.getFilteredSampleCount function'
		)

		//syncTermData
		//getDensityPlotData
		//getPercentile
		test.end()
	}
})

tape('Missing .state', test => {
	test.timeoutAfter(3000)

	const app = {
		opts: {
			state: null
		}
	}

	const message = 'Should error for missing .state'
	try {
		vocabInit({ app, state: app.opts.state, fetchOpts: app.opts.fetchOpts })
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

tape.skip('TermdbVocab()', test => {
	test.timeoutAfter(3000)

	const app = {
		opts: {
			state: {
				genome: 'hg38-test',
				dslabel: 'TermdbTest'
			}
		}
	}

	const termdbVocabApi = new TermdbVocab({
		app,
		state: app.opts.state,
		fetchOpts: app.opts.fetchOpts
	})

	//getTdbDataUrl
	//syncTermData

	test.end()
})

tape('FrontendVocab()', test => {
	test.timeoutAfter(3000)
	const app = {
		state: {
			vocab: {
				terms: vocabData.terms,
				selectCohort: {
					term: { id: 'subcohort', type: 'categorical' },
					values: [
						{
							keys: ['ABC'],
							label: 'ABC Lifetime Cohort (ABC)',
							shortLabel: 'ABC',
							isdefault: true
						},
						{
							keys: ['XYZ'],
							label: 'XYZ Cancer Survivor Study (XYZ)',
							shortLabel: 'XYZ'
						}
					]
				}
			}
		}
	}

	const frontendVocabApi = new FrontendVocab({
		app,
		state: app.state,
		fetchOpts: app.fetchOpts
	})

	test.ok(
		Array.isArray(frontendVocabApi.getTermdbConfig().supportedChartTypes),
		'Should return supportedChartTypes from vocab.getTermdbConfig'
	)
	const selectCohort = frontendVocabApi.getTermdbConfig().selectCohort
	const validateSelectCohort =
		typeof selectCohort.term == 'object' &&
		selectCohort.term.id &&
		selectCohort.term.type &&
		Array.isArray(selectCohort.values)
			? true
			: false
	test.ok(validateSelectCohort, 'Should include all required keys for .selectCohort')

	test.end()
})

tape('Missing state.vocab', test => {
	test.timeoutAfter(3000)

	const app = {
		opts: {
			state: {
				genome: 'hg38-test',
				dslabel: 'TermdbTest'
			}
		}
	}

	const message = 'Should error for missing .vocab'
	try {
		new FrontendVocab({
			app,
			state: app.opts.state,
			fetchOpts: app.opts.fetchOpts
		})
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})
