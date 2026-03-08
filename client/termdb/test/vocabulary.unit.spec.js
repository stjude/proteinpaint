import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { termjson } from '../../test/testdata/termjson'

/*
Tests:
	getPercentile()
	q_to_param()
	** Comments
		Not testing
			getVocabFromSamplesArray() - only appears in old mds.scatterplot code which will be obsolete

 */

const vocab = getExample()
const vocabApi = vocabInit({ state: { vocab } })

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/vocabulary -***-')
	test.end()
})

tape('getPercentile()', async function (test) {
	test.timeoutAfter(100)
	test.plan(13)

	const term = structuredClone(await vocabApi.getterm('d'))

	let percentile_lst, result, testMsg, filter

	percentile_lst = [10]
	result = await vocabApi.getPercentile(term, percentile_lst)
	test.equal(result.values[0], 0.07500000000000001, 'should get correct 10th percentile')

	percentile_lst = [25]
	result = await vocabApi.getPercentile(term, percentile_lst)
	test.equal(result.values[0], 0.2, 'should get correct 25th percentile')

	percentile_lst = [50]
	result = await vocabApi.getPercentile(term, percentile_lst)
	test.equal(result.values[0], 0.45, 'should get correct 50th percentile')

	percentile_lst = [75]
	result = await vocabApi.getPercentile(term, percentile_lst)
	test.equal(result.values[0], 0.8, 'should get correct 75th percentile')

	percentile_lst = [95]
	result = await vocabApi.getPercentile(term, percentile_lst)
	test.equal(result.values[0], 1.1, 'should get correct 95th percentile')

	percentile_lst = [25, 50]
	result = await vocabApi.getPercentile(term, percentile_lst)
	test.deepEqual(result.values, [0.2, 0.45], 'should get correct 25th and 50th percentiles')

	percentile_lst = [25, 50, 75]
	result = await vocabApi.getPercentile(term, percentile_lst)
	test.deepEqual(result.values, [0.2, 0.45, 0.8], 'should get correct 25th, 50th, and 75th percentiles')

	percentile_lst = ['a']
	testMsg = `should throw error for non-integer percentiles (only non-integer value = (${percentile_lst}) in array)`
	try {
		result = await vocabApi.getPercentile(term, percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [25, 50, 'a']
	testMsg = `should throw error for non-integer percentiles (non-integer value = (${percentile_lst}) within array)`
	try {
		result = await vocabApi.getPercentile(term, percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [120]
	testMsg = `should throw error for percentiles must be between 1-99 (only incorrect value = (${percentile_lst}) in array)`
	try {
		result = await vocabApi.getPercentile(term, percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'percentiles must be between 1-99', testMsg)
	}

	percentile_lst = [25, 50, 120]
	testMsg = `should throw error for percentiles must be between 1-99 (one incorrect value = (${percentile_lst}) within array)`
	try {
		result = await vocabApi.getPercentile(term, percentile_lst)
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
	result = await vocabApi.getPercentile(term, percentile_lst, filter)
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
	result = await vocabApi.getPercentile(term, percentile_lst, filter)
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
