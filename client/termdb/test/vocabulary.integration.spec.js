import tape from 'tape'
import { vocabInit } from '../vocabulary'
import * as vocabData from './vocabData'
import * as helpers from '../../test/front.helpers.js'

/*
Tests:
	vocabInit(), default
	getVocab(), custom
	Missing .state
 */

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

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/vocabulary -***-')
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
	test.equal(typeof vocabApi.validateSnps, 'function', 'should have a vocab.validateSnps function')
	test.equal(typeof vocabApi.get_variantFilter, 'function', 'should have a vocab.get_variantFilter function')
	test.equal(typeof vocabApi.getAnnotatedSampleData, 'function', 'should have a vocab.getAnnotatedSampleData function')
	test.equal(typeof vocabApi.getTwMinCopy, 'function', 'should have a vocab.getTwMinCopy function')
	test.equal(typeof vocabApi.getTermTypes, 'function', 'should have a vocab.getTermTypes function')
	test.equal(typeof vocabApi.getLDdata, 'function', 'should have a vocab.getLDdata function')
	test.equal(typeof vocabApi.getScatterData, 'function', 'should have a vocab.getScatterData function')
	test.equal(typeof vocabApi.getCohortsData, 'function', 'should have a vocab.getCohortsData function')

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
