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
    Missing state.vocab
*/

tape('\n', function(test) {
	test.pass('-***- termdb/vocabulary -***-')
	test.end()
})

tape('vocabInit(), default', test => {
	/* Tests TermdbVocab indirectly */
	test.timeoutAfter(100)

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
	test.equal(
		typeof vocabApi.mayFillInMissingCatValues,
		'function',
		'should have a vocab.mayFillInMissingCatValues function'
	)
	test.equal(typeof vocabApi.getTdbDataUrl, 'function', 'should have a vocab.getTdbDataUrl function')
	test.equal(typeof vocabApi.syncTermData, 'function', 'should have a vocab.syncTermData function')
	test.equal(typeof vocabApi.getRegressionData, 'function', 'should have a vocab.getRegressionData function')
	test.equal(typeof vocabApi.findTerm, 'function', 'should have a vocab.findTerm function')
	test.equal(typeof vocabApi.getTermInfo, 'function', 'should have a vocab.getTermInfo function')
	test.equal(typeof vocabApi.getCohortSampleCount, 'function', 'should have a vocab.getCohortSampleCount function')
	test.equal(typeof vocabApi.getFilteredSampleCount, 'function', 'should have a vocab.getFilteredSampleCount function')
	test.equal(typeof vocabApi.getViolinPlotData, 'function', 'should have a vocab.getViolinPlotData function')
	test.equal(typeof vocabApi.getPercentile, 'function', 'should have a vocab.getPercentile function')
	test.equal(typeof vocabApi.getDescrStats, 'function', 'should have a vocab.getDescrStats function')
	test.equal(typeof vocabApi.getterm, 'function', 'should have a vocab.getterm function')
	test.equal(typeof vocabApi.graphable, 'function', 'should have a vocab.graphable function')
	test.equal(typeof vocabApi.getCategories, 'function', 'should have a vocab.getCategories function')
	test.equal(
		typeof vocabApi.getNumericUncomputableCategories,
		'function',
		'should have a vocab.getNumericUncomputableCategories function'
	)
	test.equal(typeof vocabApi.getConditionCategories, 'function', 'should have a vocab.getConditionCategories function')
	test.equal(typeof vocabApi.validateSnps, 'function', 'should have a vocab.validateSnps function')
	test.equal(typeof vocabApi.get_variantFilter, 'function', 'should have a vocab.get_variantFilter function')
	test.equal(typeof vocabApi.getAnnotatedSampleData, 'function', 'should have a vocab.getAnnotatedSampleData function')
	test.equal(typeof vocabApi.getTwMinCopy, 'function', 'should have a vocab.getTwMinCopy function')
	test.equal(typeof vocabApi.getTermTypes, 'function', 'should have a vocab.getTermTypes function')
	test.equal(typeof vocabApi.getLDdata, 'function', 'should have a vocab.getLDdata function')
	test.equal(typeof vocabApi.getScatterData, 'function', 'should have a vocab.getScatterData function')
	test.equal(typeof vocabApi.getCohortsData, 'function', 'should have a vocab.getCohortsData function')
	test.equal(typeof vocabApi.getMds3queryDetails, 'function', 'should have a vocab.getMds3queryDetails function')

	test.end()
})

tape('getVocab(), custom', test => {
	/* Tests FrontendVocab indirectly */
	test.timeoutAfter(100)

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
		test.equal(typeof app.vocabApi.syncTermData, 'function', 'should have a vocab.syncTermData function')
		test.equal(typeof app.vocabApi.findTerm, 'function', 'should have a vocab.findTerm function')
		test.equal(typeof app.vocabApi.getTermInfo, 'function', 'should have a vocab.getTermInfo function')
		test.equal(
			typeof app.vocabApi.getCohortSampleCount,
			'function',
			'should have a vocab.getCohortSampleCount function'
		)
		// Frontend.getFilteredSampleCount() returns { samplecount: 'TBD' }??
		test.equal(typeof app.vocabApi.getDensityPlotData, 'function', 'should have a vocab.getDensityPlotData function')
		test.equal(typeof app.vocabApi.getPercentile, 'function', 'should have a vocab.getPercentile function')
		test.equal(typeof app.vocabApi.getDescrStats, 'function', 'should have a vocab.getDescrStats function')
		test.equal(typeof app.vocabApi.getterm, 'function', 'should have a vocab.getterm function')
		test.equal(typeof app.vocabApi.getCategories, 'function', 'should have a vocab.getCategories function')
		test.equal(
			typeof app.vocabApi.getNumericUncomputableCategories,
			'function',
			'should have a vocab.getNumericUncomputableCategories function'
		)
		test.equal(
			typeof app.vocabApi.getConditionCategories,
			'function',
			'should have a vocab.getConditionCategories function'
		)
		test.equal(typeof app.vocabApi.graphable, 'function', 'should have a vocab.graphable function')
		test.equal(typeof app.vocabApi.q_to_param, 'function', 'should have a vocab.q_to_param function')

		test.end()
	}
})

tape('Missing .state', test => {
	test.timeoutAfter(100)

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

/* TermdbVocab tests 

//getTdbDataUrl
//syncTermData

//getPercentile
//syncTermData
//getAnnotatedSampleData
    
*/
tape('\n', function(test) {
	test.pass('-***- TermdbVocab Tests -***-')
	test.end()
})

tape.skip('TermdbVocab()', test => {
	test.timeoutAfter(100)

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

	test.end()
})

/* FrontendVocab tests 

//syncTermData
//getDensityPlotData
*/
tape('\n', function(test) {
	test.pass('-***- FrontendVocab Tests -***-')
	test.end()
})

tape('Missing state.vocab', test => {
	test.timeoutAfter(100)

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
