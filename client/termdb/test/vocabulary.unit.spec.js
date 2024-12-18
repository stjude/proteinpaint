import tape from 'tape'
import { vocabInit, q_to_param, getVocabFromSamplesArray } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { TermdbVocab } from '#termdb/TermdbVocab'
import { FrontendVocab } from '#termdb/FrontendVocab'
import { testAppInit } from '../../test/test.helpers'
import { termjson } from '../../test/testdata/termjson'

/*
Tests:
	vocabInit
		getPercentile()
		q_to_param()
		** Comments
			Not testing
				getVocabFromSamplesArray() - only appears in old mds.scatterplot code which will be obsolete

	FrontendVocab
		getTermdbConfig()
		getTermChildren()
		findTerm()
		getPercentile()
		getDescrStats()
		getterm()
		graphable()
 */

const vocab = getExample()
const vocabApi = vocabInit({ state: { vocab } })
const frontendVocabApi = new FrontendVocab({ state: { vocab } })
const state = {
	vocab: {
		genome: 'a',
		delabel: 'b'
	}
}
async function getTermdbVocabApi(opts = {}) {
	return new TermdbVocab({
		app: await testAppInit(state),
		state: opts.state || state
	})
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- vocabulary -***-')
	test.end()
})

/* vocabInit tests */
tape('\n', function (test) {
	test.pass('-***- vocabInit Tests (main vocab function)-***-')
	test.end()
})

tape('getPercentile()', async function (test) {
	test.timeoutAfter(100)
	test.plan(13)

	let percentile_lst, result, testMsg, filter

	percentile_lst = [10]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.07500000000000001, 'should get correct 10th percentile')

	percentile_lst = [25]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.2, 'should get correct 25th percentile')

	percentile_lst = [50]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.45, 'should get correct 50th percentile')

	percentile_lst = [75]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.8, 'should get correct 75th percentile')

	percentile_lst = [95]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 1.1, 'should get correct 95th percentile')

	percentile_lst = [25, 50]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.deepEqual(result.values, [0.2, 0.45], 'should get correct 25th and 50th percentiles')

	percentile_lst = [25, 50, 75]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.deepEqual(result.values, [0.2, 0.45, 0.8], 'should get correct 25th, 50th, and 75th percentiles')

	percentile_lst = ['a']
	testMsg = `should throw error for non-integer percentiles (only non-integer value = (${percentile_lst}) in array)`
	try {
		result = await vocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [25, 50, 'a']
	testMsg = `should throw error for non-integer percentiles (non-integer value = (${percentile_lst}) within array)`
	try {
		result = await vocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [120]
	testMsg = `should throw error for percentiles must be between 1-99 (only incorrect value = (${percentile_lst}) in array)`
	try {
		result = await vocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'percentiles must be between 1-99', testMsg)
	}

	percentile_lst = [25, 50, 120]
	testMsg = `should throw error for percentiles must be between 1-99 (one incorrect value = (${percentile_lst}) within array)`
	try {
		result = await vocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'percentiles must be between 1-99', testMsg)
	}

	percentile_lst = [50]
	filter = {
		type: 'tvslst',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: { id: 'c', type: 'categorical' }, values: [{ key: 1 }] } }]
	}
	result = await vocabApi.getPercentile('d', percentile_lst, filter)
	test.equal(result.values[0], 0.55, 'should get correct 50th percentile with categorical filter')

	percentile_lst = [50]
	filter = {
		type: 'tvslst',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'd', type: 'float', values: {} },
					ranges: [{ startunbounded: true, stop: 0.8, stopinclusive: true }]
				}
			}
		]
	}
	result = await vocabApi.getPercentile('d', percentile_lst, filter)
	test.equal(result.values[0], 0.35, 'should get correct 50th percentile with numeric filter')
})

tape('q_to_param()', async test => {
	test.timeoutAfter(100)
	// test.plan()

	let testTerm, testQ, result

	function checkEncoding(str) {
		return /\%/i.test(str)
	}

	testTerm = 'aaclassic_5'
	testQ = {
		q: termjson[testTerm].bins.default
	}

	result = await vocabApi.q_to_param(testQ)
	for (const key of Object.keys(testQ.q)) {
		if (!result.includes(key)) test.fail(`Missing q.${key} in URL string for term = ${testTerm}`)
	}
	test.equal(checkEncoding(result), true, `Should return url for term = ${testTerm}`)

	testTerm = 'Arrhythmias'
	testQ = {
		q: termjson[testTerm]
	}
	result = await vocabApi.q_to_param(testQ)
	for (const key of Object.keys(testQ.q)) {
		if (!result.includes(key)) test.fail(`Missing q.${key} in URL string for term = ${testTerm}`)
	}
	test.equal(checkEncoding(result), true, `Should return url for term = ${testTerm}`)
})

/* FrontendVocab tests */
tape('\n', function (test) {
	test.pass('-***- FrontendVocab Tests -***-')
	test.end()
})

tape('getTermdbConfig()', async test => {
	test.timeoutAfter(100)
	const state = {
		vocab: {
			terms: vocab.terms,
			selectCohort: {
				term: { id: 'subcohort', type: 'multivalue' },
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

	const frontendVocabApi2 = new FrontendVocab({
		app: await testAppInit(state),
		state
	})

	test.ok(
		Array.isArray(frontendVocabApi2.getTermdbConfig().supportedChartTypes),
		'Should return supportedChartTypes from vocab.getTermdbConfig'
	)
	const selectCohort = frontendVocabApi2.getTermdbConfig().selectCohort
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

tape('getTermChildren()', async test => {
	test.timeoutAfter(100)
	test.plan(3)

	let result, vocabFilter

	// =1 result
	result = await frontendVocabApi.getTermChildren(frontendVocabApi.vocab.terms[1])
	vocabFilter = vocab.terms.filter(t => t.parent_id == frontendVocabApi.vocab.terms[1].id)
	test.equal(
		result.lst.length,
		vocabFilter.length,
		`Should return the correct number (n = ${vocabFilter.length}) of child terms for term.id = ${frontendVocabApi.vocab.terms[1].id}`
	)

	// >1 result
	result = await frontendVocabApi.getTermChildren(frontendVocabApi.vocab.terms[0])
	vocabFilter = vocab.terms.filter(t => t.parent_id == frontendVocabApi.vocab.terms[0].id)
	test.equal(
		result.lst.length,
		vocabFilter.length,
		`Should return the correct number (n = ${vocabFilter.length}) of child terms for term.id = ${frontendVocabApi.vocab.terms[0].id}`
	)

	// =0 result
	result = await frontendVocabApi.getTermChildren(frontendVocabApi.vocab.terms[2])
	vocabFilter = vocab.terms.filter(t => t.parent_id == frontendVocabApi.vocab.terms[2].id)
	test.equal(
		result.lst.length,
		vocabFilter.length,
		`Should return the correct number (n = ${vocabFilter.length}) of child terms for term.id = ${frontendVocabApi.vocab.terms[2].id}`
	)
})

tape('findTerm()', async test => {
	test.timeoutAfter(100)
	test.plan(3)

	let result, vocabFilter, testTerm

	// =1 result
	testTerm = 'AAA'
	result = await frontendVocabApi.findTerm(testTerm)
	vocabFilter = await vocab.terms.filter(x => x.name == testTerm)
	test.equal(
		result.lst.length,
		vocabFilter.length,
		`Should return the correct number (n = ${vocabFilter.length}) of terms`
	)

	// >1 result
	testTerm = 'CCC'
	result = await frontendVocabApi.findTerm(testTerm)
	vocabFilter = await vocab.terms.filter(x => x.name == testTerm)
	test.equal(
		result.lst.length,
		vocabFilter.length,
		`Should return the correct number (n = ${vocabFilter.length}) of terms`
	)

	// =0 result
	testTerm = 'ZZZ'
	result = await frontendVocabApi.findTerm(testTerm)
	vocabFilter = await vocab.terms.filter(x => x.name == testTerm)
	test.equal(
		result.lst.length,
		vocabFilter.length,
		`Should return the correct number (n = ${vocabFilter.length}) of terms`
	)

	// Should there be a throw statement if no str is provided? Or is this intentional?
	// result = await vocabFrontend.findTerm()
})

tape('getPercentile() - FrontendVocab directly', async function (test) {
	//Test FrontendVocab getPercentile() method directly
	test.timeoutAfter(100)
	test.plan(13)

	let percentile_lst, result, testMsg, filter

	percentile_lst = [10]
	result = await frontendVocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.07500000000000001, 'should get correct 10th percentile')

	percentile_lst = [25]
	result = await frontendVocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.2, 'should get correct 25th percentile')

	percentile_lst = [50]
	result = await frontendVocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.45, 'should get correct 50th percentile')

	percentile_lst = [75]
	result = await frontendVocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.8, 'should get correct 75th percentile')

	percentile_lst = [95]
	result = await frontendVocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 1.1, 'should get correct 95th percentile')

	percentile_lst = [25, 50]
	result = await frontendVocabApi.getPercentile('d', percentile_lst)
	test.deepEqual(result.values, [0.2, 0.45], 'should get correct 25th and 50th percentiles')

	percentile_lst = [25, 50, 75]
	result = await frontendVocabApi.getPercentile('d', percentile_lst)
	test.deepEqual(result.values, [0.2, 0.45, 0.8], 'should get correct 25th, 50th, and 75th percentiles')

	percentile_lst = ['a']
	testMsg = `should throw error for non-integer percentiles (only non-integer value = (${percentile_lst}) in array)`
	try {
		result = await frontendVocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [25, 50, 'a']
	testMsg = `should throw error for non-integer percentiles (non-integer value = (${percentile_lst}) within array)`
	try {
		result = await frontendVocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [50]
	filter = {
		type: 'tvslst',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: { id: 'c', type: 'categorical' }, values: [{ key: 1 }] } }]
	}
	result = await frontendVocabApi.getPercentile('d', percentile_lst, filter)
	test.equal(result.values[0], 0.55, 'should get correct 50th percentile with categorical filter')

	percentile_lst = [120]
	testMsg = `should throw error for percentiles must be between 1-99 (only incorrect value = (${percentile_lst}) in array)`
	try {
		result = await frontendVocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'percentiles must be between 1-99', testMsg)
	}

	percentile_lst = [25, 50, 120]
	testMsg = `should throw error for percentiles must be between 1-99 (one incorrect value = (${percentile_lst}) within array)`
	try {
		result = await frontendVocabApi.getPercentile('d', percentile_lst)
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
					term: { id: 'd', type: 'float', values: {} },
					ranges: [{ startunbounded: true, stop: 0.8, stopinclusive: true }]
				}
			}
		]
	}
	result = await frontendVocabApi.getPercentile('d', percentile_lst, filter)
	test.equal(result.values[0], 0.35, 'should get correct 50th percentile with numeric filter')
})

tape('getDescrStats()', async test => {
	test.timeoutAfter(100)
	test.plan(9)

	let testId, result, msg

	testId = 'd'
	result = await frontendVocabApi.getDescrStats(testId)
	test.equal(result.values[0].value, 10, `Should get the correct value for ${result.values[0].id}`)
	test.equal(result.values[1].value, 0.05, `Should get the correct value for ${result.values[1].id}`)
	test.equal(result.values[2].value, 0.2, `Should get the correct value for ${result.values[2].id}`)
	test.equal(result.values[3].value, 0.45, `Should get the correct value for ${result.values[3].id}`)
	test.equal(result.values[4].value, 0.48, `Should get the correct value for ${result.values[4].id}`)
	test.equal(result.values[5].value, 0.8, `Should get the correct value for ${result.values[5].id}`)
	test.equal(result.values[6].value, 1.1, `Should get the correct value for ${result.values[6].id}`)
	test.equal(result.values[7].value, 0.35, `Should get the correct value for ${result.values[7].id}`)

	testId = 'c'
	msg = `Should throw error for non-numeric data`
	try {
		const modifiedTestVocab = getExample()
		modifiedTestVocab.sampleannotation[11] = { c: Infinity, d: 0 }
		const testFrontend = new FrontendVocab({ state: { vocab: modifiedTestVocab } })
		result = await testFrontend.getDescrStats(testId)
		test.fail(msg)
	} catch (e) {
		test.pass(`${msg}: ${e}`)
	}
})

tape('getterm()', async test => {
	test.timeoutAfter(100)
	test.plan(2)

	let result, testId, msg

	testId = 'a'
	result = await frontendVocabApi.getterm(testId)
	test.ok(result.id == testId, `Should return term object for test id = ${testId} `)

	msg = `Should throw for missing term id`
	try {
		result = await frontendVocabApi.getterm()
		test.fail(msg)
	} catch (e) {
		test.pass(`${msg}: ${e}`)
	}
})

tape('graphable()', async test => {
	test.timeoutAfter(100)
	test.plan(2)

	let result, message

	message = `Should throw for missing term`
	try {
		await frontendVocabApi.graphable()
		test.fail(message)
	} catch (e) {
		test.equal(e, 'graphable: term is missing', `${message}: ${e}`)
	}

	result = await frontendVocabApi.graphable(termjson['diaggrp'])
	test.ok(true, 'Should return true for graphable term')
})
