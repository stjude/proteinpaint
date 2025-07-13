import tape from 'tape'
import { vocabInit } from '../vocabulary'
import * as vocabData from './vocabData'
import { TermdbVocab } from '../TermdbVocab'
import { FrontendVocab } from '../FrontendVocab'
import * as d3s from 'd3-selection'
import { TermTypeGroups } from '#shared/terms.js'
import { testAppInit } from '../../test/test.helpers'
import { termjson } from '../../test/testdata/termjson'
import * as helpers from '../../test/front.helpers.js'

/*
Tests:
	vocabInit()
		vocabInit(), default
		getVocab(), custom
		Missing .state

	TermdbVocab
		getTermdbConfig()
		getTermChildren()
		mayFillInMissingCatValues()
		getTdbDataUrl()
		syncTermData()
		getRegressionData()
		findTerm()
		getFilteredSampleCount()
		getTermInfo()
		getPercentile()
		getterm()
		getCategories()
		getCohortsData()
	******TODO: 
			getNestedChartSeriesData()
			getCohortSampleCount()
			getViolinPlotData()
			getNumericUncomputableCategories()
			validateSnps()
			get_variantFilter()
			getAnnotatedSampleData()
			getTwMinCopy()
			getLDdata()
			getScatterData()
		** Comments
			Tested in FrontendVocab
				getDescrStats()
				graphable()
			Not enabled on TermdbTest??
				getTermTypes()


	FrontendVocab
		Missing state.vocab
		** Comments
			Tested in vocab.unit
				getTermdbConfig()
				getTermChildren()
				findTerm()
				getDescrStats()
				getterm()
				getPercentile()
				graphable()

			Not testing
				syncTermData() - similar enough to termdbvocab not testing
				q_to_param() - exported elsewhere from ./vocabulary. Safe to remove?
				Should be in barchart test
					getNestedChartSeriesData()
					getCategories()

			Not used
				getTermInfo() - perpherial scan, only termdb getTermInfo used
				getCohortSampleCount() - only termdb getCohortSampleCount() used
				getFilteredSampleCount()
				getDensityPlotData()
				getNumericUncomputableCategories()
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

// const frontendVocabApi = new FrontendVocab({ state: { vocabData }})

const state = {
	vocab: {
		genome: 'hg38-test',
		dslabel: 'TermdbTest'
	},
	debug: 1
}

async function getTermdbVocabApi(opts = {}) {
	return new TermdbVocab({
		app: await testAppInit(opts.state || state),
		state: state,
		opts
	})
}

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

/* TermdbVocab tests */
tape('\n', function (test) {
	test.comment('-***- TermdbVocab Tests -***-')
	test.end()
})

tape('getTermdbConfig()', async test => {
	test.timeoutAfter(100)
	test.plan(3)

	/* Example of using TestApp for testing */
	const termdbVocabApi = await getTermdbVocabApi()
	const termdbConfig = await termdbVocabApi.getTermdbConfig()

	//.allowedTermTypes
	test.ok(Array.isArray(termdbConfig.allowedTermTypes), `Should return .allowedTermTypes array`)

	//.supportedChartTypes)
	let badArrayFound = 0
	for (const chartsArray of Object.values(termdbConfig.supportedChartTypes)) {
		if (!Array.isArray(chartsArray)) {
			++badArrayFound
			test.fail(`.supportedChartTypes value not an array: ${chartsArray}`)
			return
		}
	}
	test.ok(badArrayFound == 0, `Should only return .supportedChartTypes arrays`)

	//.selectCohort
	const selectCohort = termdbConfig.selectCohort
	const validateSelectCohort =
		typeof selectCohort.term == 'object' &&
		selectCohort.term.id &&
		selectCohort.term.type &&
		Array.isArray(selectCohort.values)
			? true
			: false
	test.ok(validateSelectCohort, 'Should include all required keys for .selectCohort')
})

tape('getTermChildren()', async test => {
	test.timeoutAfter(100)
	// test.plan(2)

	const termdbVocabApi = await getTermdbVocabApi()

	let result, testTerm
	const cohortStr = ['ABC']

	// =1 result
	testTerm = termjson['Arrhythmias']
	result = await termdbVocabApi.getTermChildren(testTerm, cohortStr)
	test.equal(
		result.lst.length,
		1,
		`Should return the correct number (n = 1) of child terms for test term object = ${testTerm}`
	)

	// =0 result
	testTerm = termjson['sex']
	result = await termdbVocabApi.getTermChildren(testTerm, cohortStr)
	test.equal(
		result.lst.length,
		0,
		`Should return the correct number (n = 0) of child terms for test term object = ${testTerm}`
	)

	const message = `Should throw for missing term and cohortValuelst args`
	try {
		await termdbVocabApi.getTermChildren()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})

tape.skip('getNestedChartSeriesData()', async test => {
	test.timeoutAfter(1000)

	const termdbVocabApi = await getTermdbVocabApi()

	let opts, result

	opts = {
		filter: { in: true, join: 'and', lst: [], type: 'tvslst' },
		term: { id: 'diaggrp', term: termjson['diaggrp'], q: termjson['diaggrp'] },
		term0: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] },
		term2: { id: 'sex', term: termjson['agedx'], q: termjson['sex'] }
	}
	result = await termdbVocabApi.getNestedChartSeriesData(opts)
	console.log(result)

	test.end()
})

tape('mayFillInMissingCatValues()', async test => {
	test.timeoutAfter(100)
	/* mayFillInMissingCatValues() requires missingCatValsByTermId{} and samplecount{} to complete */

	const termdbVocabApi = await getTermdbVocabApi()

	let testTerm, term, key, total

	//Invalid input, no missingCatValsByTermId defined
	testTerm = 'diaggrp'
	term = await termdbVocabApi.getterm(testTerm)
	key = '1'
	total = 4
	termdbVocabApi.mayFillInMissingCatValues(term, key, total)
	test.ok(!term.values[key], `Should return term.values unchanged`)

	//Key exists, no change to samplecount
	key = 'Acute lymphoblastic leukemia'
	termdbVocabApi.missingCatValsByTermId = { 'Acute lymphoblastic leukemia': term }
	term.samplecount = {}
	termdbVocabApi.mayFillInMissingCatValues(term, key, total)
	test.ok(!term.samplecount[key], `Should return empty term.samplecount`)

	//Add value
	testTerm = 'sex'
	term = await termdbVocabApi.getterm(testTerm)
	term.samplecount = {}
	termdbVocabApi.missingCatValsByTermId = { sex: term }
	key = '3'
	total = 2
	termdbVocabApi.mayFillInMissingCatValues(term, key, total)
	test.ok(
		term.values[key] &&
			typeof term.values[key] == 'object' &&
			term.samplecount[key] &&
			typeof term.samplecount[key] == 'object',
		`Should return term.values and term.samplecount with new '${key}' objects`
	)

	test.end()
})

// function no longer returns obsolete url string but a body object. should update the tests later
tape.skip('getTdbDataUrl()', async test => {
	test.timeoutAfter(100)
	test.plan(11)

	const termdbVocabApi = await getTermdbVocabApi()

	let opts, result, message, term_1, term_2, term_3

	message = 'Should return the correct URL for only one term'
	opts = {
		chartType: 'barchart',
		term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] }
	}
	result = termdbVocabApi.getTdbDataUrl(opts)
	test.equal(
		result,
		`/termdb?embedder=${window.location.hostname}&term1_$id=undefined&term1_id=agedx&term1_q=%7B%22id%22%3A%22agedx%22%2C%22name%22%3A%22Age%20at%20Cancer%20Diagnosis%22%2C%22unit%22%3A%22Years%22%2C%22type%22%3A%22float%22%2C%22bins%22%3A%7B%22label_offset%22%3A1%2C%22default%22%3A%7B%22type%22%3A%22regular-bin%22%2C%22label_offset%22%3A1%2C%22bin_size%22%3A3%2C%22startinclusive%22%3Atrue%2C%22first_bin%22%3A%7B%22startunbounded%22%3Atrue%2C%22stop%22%3A2%7D%7D%2C%22less%22%3A%7B%22type%22%3A%22regular-bin%22%2C%22label_offset%22%3A1%2C%22bin_size%22%3A5%2C%22startinclusive%22%3Atrue%2C%22first_bin%22%3A%7B%22startunbounded%22%3Atrue%2C%22stop%22%3A5%7D%2C%22last_bin%22%3A%7B%22stopunbounded%22%3Atrue%2C%22start%22%3A15%7D%7D%7D%2C%22isleaf%22%3Atrue%7D&genome=hg38-test&dslabel=TermdbTest`,
		message
	)

	message = 'Should return URL with all expected paramters'
	const paramsNotFound = []
	if (!result.includes(`termdb`)) paramsNotFound.push(`termdb`)
	if (!result.includes(`embedder=${window.location.hostname}`))
		paramsNotFound.push(`embedder=${window.location.hostname}`)
	if (!result.includes(`term1_id=${opts.term.id}`)) paramsNotFound.push(`term1_id=${opts.term.id}`)
	if (!result.includes(`genome=${state.vocab.genome}`)) paramsNotFound.push(`genome=${state.vocab.genome}`)
	if (!result.includes(`&dslabel=${state.vocab.dslabel}`)) paramsNotFound.push(`&dslabel=${state.vocab.dslabel}`)
	paramsNotFound.length == 0 ? test.pass(message) : test.fail(`${message}, not found: ${paramsNotFound}`)

	message = 'Should return the correct URL for two terms'
	opts = {
		chartType: 'barchart',
		term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] },
		term2: { id: 'sex', term: termjson['sex'], q: termjson['sex'] }
	}
	result = termdbVocabApi.getTdbDataUrl(opts)
	term_1 = result.includes(`term1_id=${opts.term.id}`)
	term_2 = result.includes(`term2_id=${opts.term2.id}`)
	test.ok(term_1 == true && term_2 == true, message)

	message = 'Should return the correct URL for all three terms'
	opts = {
		chartType: 'barchart',
		term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] },
		term2: { id: 'sex', term: termjson['sex'], q: termjson['sex'] },
		term0: { id: 'diaggrp', term: termjson['diaggrp'], q: termjson['diaggrp'] }
	}
	result = termdbVocabApi.getTdbDataUrl(opts)
	term_1 = result.includes(`term1_id=${opts.term.id}`)
	term_2 = result.includes(`term2_id=${opts.term2.id}`)
	term_3 = result.includes(`term3_id=${opts.term2.id}`)
	test.ok(term_1 == true && term_2 == true, message)

	message = 'Should return the correct URL for filter'
	opts = {
		chartType: 'barchart',
		term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] },
		filter: {
			type: 'tvslst',
			in: 1,
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'diaggrp', name: 'Diagnosis Group', type: 'categorical' },
						values: [{ key: 'Wilms tumor', label: 'Wilms tumor' }]
					}
				},
				{
					type: 'tvs',
					tvs: {
						term: { id: 'sex', name: 'Sex', type: 'categorical' },
						values: [{ key: '1', label: 'Male' }]
					}
				}
			]
		}
	}
	result = termdbVocabApi.getTdbDataUrl(opts)
	test.ok(result.includes(`filter=`), 'Should return filter= in URL')

	message = 'Should return cuminc parameter'
	opts = {
		chartType: 'cuminc',
		term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] }
	}
	result = termdbVocabApi.getTdbDataUrl(opts)
	test.ok(result.includes(`getcuminc=1`), message)

	message = 'Should return survival plot parameter'
	opts = {
		chartType: 'survival',
		term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] }
	}
	result = termdbVocabApi.getTdbDataUrl(opts)
	test.ok(result.includes(`getsurvival=1`), message)

	opts = {
		chartType: 'barchart'
	}
	result = termdbVocabApi.getTdbDataUrl(opts)
	test.equal(
		result,
		`/termdb?embedder=${window.location.hostname}&genome=hg38-test&dslabel=TermdbTest`,
		'Should return dataset only URL'
	)

	message = 'Should throw for missing opts'
	try {
		termdbVocabApi.getTdbDataUrl()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = 'Should throw for missing opts.chartType'
	try {
		opts = {
			term: { id: 'agedx', term: termjson['agedx'], q: termjson['agedx'] }
		}
		termdbVocabApi.getTdbDataUrl()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = 'Should throw for missing term.q'
	try {
		opts = {
			chartType: 'barchart',
			term: { id: 'agedx', term: termjson['agedx'] }
		}
		termdbVocabApi.getTdbDataUrl(opts)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}
})

tape('syncTermData()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	let config, data, previousConfig

	//Missing term
	const message = `Should throw for missing plot.term{}`
	try {
		config = {}
		data = { charts: [{ chartId: '' }], refs: {} }
		previousConfig = {}
		termdbVocabApi.syncTermData(config, data, previousConfig)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//Missing data
	config = { term: { id: 'agedx', term: { id: 'agedx' } } }
	data = {}
	previousConfig = {}
	termdbVocabApi.syncTermData(config, data, previousConfig)
	test.ok(!config.term.q && Object.keys(data).length == 0, `Should return without altering config or data inputs`)

	test.end()
})

tape('getRegressionData()', async test => {
	test.timeoutAfter(6000)

	const termdbVocabApi = await getTermdbVocabApi()
	let results, type

	const opts = {
		regressionType: 'linear',
		outcome: {
			id: 'agedx',
			isAtomic: true,
			term: {
				id: 'agedx',
				name: 'Age (years) at Cancer Diagnosis',
				type: 'float',
				bins: {
					default: {
						type: 'regular-bin',
						bin_size: 5,
						startinclusive: true,
						first_bin: { startunbounded: true, stop: 5 }
					}
				}
			},
			q: { mode: 'continuous', type: 'regular-bin' }
		},
		independent: [
			{
				id: 'sex',
				isAtomic: true,
				refGrp: '2',
				term: {
					groupsetting: { disabled: true },
					id: 'sex',
					name: 'Sex',
					type: 'categorical',
					values: { 1: { label: 'Male' }, 2: { label: 'Female' } }
				},
				q: { mode: 'discrete', type: 'values' }
			}
		],
		filter: {
			type: 'tvslst',
			join: 'and',
			lst: [
				{
					type: 'tvslst',
					in: true,
					join: 'and',
					lst: [
						{
							tag: 'cohortFilter',
							type: 'tvs',
							tvs: {
								term: { id: 'subcohort', type: 'multivalue' },
								values: [{ key: 'ABC', label: 'ABC' }]
							}
						}
					]
				}
			]
		}
	}

	//Linear results
	type = 'linear'
	results = await termdbVocabApi.getRegressionData(opts)
	test.equal(
		typeof results.resultLst[0].data.coefficients,
		'object',
		`Should return a data.coeffients object for ${type} regression data`
	)
	test.equal(
		typeof results.resultLst[0].data.other,
		'object',
		`Should return adata.other object for ${type} regression data`
	)
	test.equal(
		typeof results.resultLst[0].data.residuals,
		'object',
		`Should return a data.residuals object for ${type} regression data`
	)
	test.equal(
		typeof results.resultLst[0].data.sampleSize,
		'number',
		`Should return a string for sample size for ${type} regression data`
	)
	test.equal(
		typeof results.resultLst[0].data.type3,
		'object',
		`Should return a data.type3 object for ${type} regression data`
	)

	//Logistic results
	type = 'logistic'
	opts.regressionType = type
	opts.independent[0] = opts.outcome
	opts.outcome = {
		id: 'hrtavg',
		term: termjson['hrtavg'],
		q: {
			mode: 'binary',
			type: 'custom-bin',
			lst: [
				{ startunbounded: true, stopinclusive: true, stop: 25, label: '≤25' },
				{ stopunbounded: true, startinclusive: false, start: 25, label: '>25' }
			]
		}
	}
	results = await termdbVocabApi.getRegressionData(opts)

	//Cox results
	type = 'cox'
	opts.regressionType = type
	opts.outcome = {
		id: 'Arrhythmias',
		term: termjson['Arrhythmias'],
		q: {
			mode: 'cox',
			bar_by_grade: true,
			value_by_max_grade: true,
			timeScale: 'time',
			breaks: ['2']
		}
	}
	results = await termdbVocabApi.getRegressionData(opts)
	test.ok(results.resultLst[0].data.eventCnt > 0, `Should return a value for events count for ${type} regression data`)
	test.equal(
		typeof results.resultLst[0].data.tests,
		'object',
		`Should return a data.tests object for ${type} regression data`
	)

	test.end()
})

tape('findTerm()', async test => {
	test.timeoutAfter(500)
	test.plan(3)

	const termdbVocabApi = await getTermdbVocabApi()

	let result, testTerm

	// =1 result
	testTerm = 'Arrhythmias'
	result = await termdbVocabApi.findTerm(testTerm, 'ABC', null, TermTypeGroups.DICTIONARY_VARIABLES)
	test.equal(result.lst.length, 1, `Should return the correct number (n = 1) of terms`)

	// >1 result
	testTerm = 's'
	result = await termdbVocabApi.findTerm(testTerm, 'ABC', null, TermTypeGroups.DICTIONARY_VARIABLES)
	test.equal(result.lst.length, 34, `Should return the correct number of terms`)

	// =0 result
	testTerm = 'ZZZ'
	result = await termdbVocabApi.findTerm(testTerm, '', null, TermTypeGroups.DICTIONARY_VARIABLES)
	test.equal(result.lst.length, 0, `Should return the correct number (n = 0) of terms`)
})

tape('getTermInfo()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	let testId, result

	//Returns result from conditional term with grades
	testId = 'Cardiac dysrhythmia'
	result = await termdbVocabApi.getTermInfo(testId)
	test.ok(result.terminfo, `Should return a terminfo object`)

	//Returns empty object for non-conditional term
	testId = 'diaggrp'
	result = await termdbVocabApi.getTermInfo(testId)
	test.ok(!result.terminfo, `Should return an empty object`)

	const message = 'Should throw for missing term id'
	try {
		result = await termdbVocabApi.getTermInfo()
		test.fail(message)
	} catch (e) {
		test.equal(e, '.getTermInfo: Missing term id', `${message}: ${e}`)
	}

	test.end()
})

tape.skip('getCohortSampleCount()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape('getFilteredSampleCount()', async test => {
	test.timeoutAfter(300)

	let result, filterJSON, getSampleLst, message

	const termdbVocabApi = await getTermdbVocabApi()

	//Data error
	message = `Should throw for data error`
	try {
		filterJSON = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					tag: 'filterUiRoot',
					type: 'tvslst',
					join: '',
					lst: [{ tvs: { term: termjson['agedx'] }, type: 'tvs' }]
				}
			]
		}
		result = await termdbVocabApi.getFilteredSampleCount(filterJSON)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//Data error
	message = `Should throw for missing data`
	try {
		filterJSON = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [{ tag: 'filterUiRoot', type: 'tvslst', join: '', lst: [{}] }]
		}
		result = await termdbVocabApi.getFilteredSampleCount(filterJSON)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//Valid JSON
	filterJSON = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				tag: 'filterUiRoot',
				type: 'tvslst',
				join: '',
				lst: [
					{
						tvs: {
							term: termjson['agedx'],
							ranges: [
								{
									start: 10,
									startinclusive: false,
									startunbounded: false,
									stop: 16,
									stopinclusive: false,
									stopunbounded: false
								}
							]
						},
						type: 'tvs'
					}
				]
			}
		]
	}
	result = await termdbVocabApi.getFilteredSampleCount(filterJSON)
	test.equal(result, '24 samples', `Should return '24 samples'`)

	result = await termdbVocabApi.getFilteredSampleList(filterJSON)
	test.ok(Array.isArray(result), `Should return an array of sample objects`)

	test.end()
})

tape.skip('getViolinPlotData()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape('getPercentile() - TermdbVocab directly', async test => {
	//Test TermdbVocab getPercentile() method directly
	test.timeoutAfter(500)
	test.plan(12)

	const termdbVocabApi = await getTermdbVocabApi()

	let percentile_lst, result, testMsg, filter
	const testId = 'agedx'

	percentile_lst = [10]
	result = await termdbVocabApi.getPercentile(testId, percentile_lst)
	test.equal(result.values[0], 1.52465753425, 'should get correct 10th percentile')

	percentile_lst = [25]
	result = await termdbVocabApi.getPercentile(testId, percentile_lst)
	test.equal(result.values[0], 3.13072460515, 'should get correct 25th percentile')

	percentile_lst = [50]
	result = await termdbVocabApi.getPercentile(testId, percentile_lst)
	test.equal(result.values[0], 8.164619357749999, 'should get correct 50th percentile')

	percentile_lst = [75]
	result = await termdbVocabApi.getPercentile(testId, percentile_lst)
	test.equal(result.values[0], 14.45859001, 'should get correct 75th percentile')

	percentile_lst = [95]
	result = await termdbVocabApi.getPercentile(testId, percentile_lst)
	test.equal(result.values[0], 18.545284078, 'should get correct 95th percentile')

	percentile_lst = [25, 50]
	result = await termdbVocabApi.getPercentile(testId, percentile_lst)
	test.deepEqual(result.values, [3.13072460515, 8.164619357749999], 'should get correct 25th and 50th percentiles')

	percentile_lst = [25, 50, 75]
	result = await termdbVocabApi.getPercentile(testId, percentile_lst)
	test.deepEqual(
		result.values,
		[3.13072460515, 8.164619357749999, 14.45859001],
		'should get correct 25th, 50th, and 75th percentiles'
	)

	percentile_lst = ['a']
	testMsg = `should throw error for non-integer percentiles (only non-integer value = (${percentile_lst}) in array)`
	try {
		result = await termdbVocabApi.getPercentile(testId, percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [25, 50, 'a']
	testMsg = `should throw error for non-integer percentiles (non-integer value = (${percentile_lst}) within array)`
	try {
		result = await termdbVocabApi.getPercentile(testId, percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [120]
	testMsg = `should throw error for percentiles must be between 1-99 (only incorrect value = (${percentile_lst}) in array)`
	try {
		result = await termdbVocabApi.getPercentile(testId, percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'percentiles must be between 1-99', testMsg)
	}

	percentile_lst = [25, 50, 120]
	testMsg = `should throw error for percentiles must be between 1-99 (one incorrect value = (${percentile_lst}) within array)`
	try {
		result = await termdbVocabApi.getPercentile(testId, percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'percentiles must be between 1-99', testMsg)
	}

	percentile_lst = [50]
	filter = {
		type: 'tvslst',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: testId, type: 'float', values: {} },
					ranges: [{ startunbounded: true, stop: 0.8, stopinclusive: true }]
				}
			}
		]
	}
	result = await termdbVocabApi.getPercentile(testId, percentile_lst, filter)
	test.equal(result.values[0], 0.03537315665, 'should get correct 50th percentile with numeric filter')
})

tape('getterm()', async test => {
	test.timeoutAfter(500)
	test.plan(12)

	const termdbVocabApi = await getTermdbVocabApi()
	let testId, result, message

	//Float term
	testId = 'agedx'
	result = await termdbVocabApi.getterm(testId)
	test.equal(typeof result, 'object', 'Should return a term object for float term')
	test.equal(typeof result.name, 'string', 'Should return string term.name')
	test.equal(typeof result.type, 'string', 'Should return string term.type')
	test.ok(!Object.keys(result.values).length, 'Should return an empty term.values object')
	test.equal(typeof result.bins, 'object', 'Should return a term.bins object')

	//Categorical term
	testId = 'diaggrp'
	result = await termdbVocabApi.getterm(testId)
	test.ok(
		Object.keys(result.values).length > 0 && !result.samplecount,
		'Should return term.values for categorical term'
	)

	//No arguments
	message = `Should throw for missing id arg`
	try {
		await termdbVocabApi.getterm()
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = `Should throw for invalid term.id`
	try {
		await termdbVocabApi.getterm('aaa')
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//Missing vocab.dslabel
	message = `Should throw for missing vocab.dslabel`
	try {
		termdbVocabApi.vocab.dslabel = null
		await termdbVocabApi.getterm(testId)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = `Should throw for invalid dslabel`
	try {
		termdbVocabApi.vocab.dslabel = 'aaa'
		await termdbVocabApi.getterm(testId)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	//Missing vocab.genome
	message = `Should throw for missing vocab.genome`
	try {
		termdbVocabApi.vocab.dslabel = 'TermdbTest'
		termdbVocabApi.vocab.genome = null
		await termdbVocabApi.getterm(testId)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	message = `Should throw for invalid genome`
	try {
		termdbVocabApi.vocab.genome = 'aaa'
		await termdbVocabApi.getterm(testId)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	termdbVocabApi.vocab.genome = 'hg38-test' //Reset to avoid problems with other tests
})

tape('getCategories()', async test => {
	test.timeoutAfter(500)
	test.plan(2)

	const termdbVocabApi = await getTermdbVocabApi()

	let testTerm, filter, body, termCat

	//Term and body args, no filter arg
	body = { term1_q: { bar_by_grade: 1, value_by_max_grade: 1 } }
	testTerm = termjson['Arrhythmias']
	termCat = await termdbVocabApi.getCategories(testTerm, '', body)
	test.equal(
		termCat.orderedLabels.length,
		Object.keys(testTerm.values).length,
		`Should return the same number of categories, without filter arg`
	)

	//Term, filter, and body args
	filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: []
			}
		],
		$id: 'fake'
	}
	body = { term1_q: { bar_by_grade: 1, value_by_max_grade: 1 } }
	termCat = await termdbVocabApi.getCategories(testTerm, filter, body)
	test.equal(
		termCat.orderedLabels.length,
		Object.keys(testTerm.values).length,
		`Should return the same number of categories, with filter arg`
	)
})

tape.skip('getNumericUncomputableCategories()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape.skip('validateSnps()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape.skip('get_variantFilter()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape.skip('getAnnotatedSampleData()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape.skip('getTwMinCopy()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape.skip('getTermTypes()', async test => {
	test.timeoutAfter(100)

	/*
	FAILS!  
		console error: ds.getTermTypes is not a function
		Does not appear to be enabled on TermdbTest?? 
	*/

	const termdbVocabApi = await getTermdbVocabApi()
	let testIds, result

	testIds = ['agedx']
	result = await termdbVocabApi.getTermTypes(testIds)
	console.log(result)

	test.end()
})

tape.skip('getLDdata()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape.skip('getScatterData()', async test => {
	test.timeoutAfter(100)

	const termdbVocabApi = await getTermdbVocabApi()

	test.end()
})

tape('getCohortsData()', async test => {
	test.timeoutAfter(300)
	test.plan(3)

	const termdbVocabApi = await getTermdbVocabApi()
	let result

	result = await termdbVocabApi.getCohortsData()
	test.equal(typeof result.cohorts, 'object', `Should return cohorts array`)
	test.equal(typeof result.features, 'object', `Should return features array`)

	termdbVocabApi.vocab.dslabel = 'aaa'
	result = await termdbVocabApi.getCohortsData()
	test.ok(result.error, `Should return error message in object`)

	termdbVocabApi.vocab.dslabel = state.vocab.dslabel

	test.end()
})

/* FrontendVocab tests */
tape('\n', function (test) {
	test.comment('-***- FrontendVocab Tests -***-')
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
