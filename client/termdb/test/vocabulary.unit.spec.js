import tape from 'tape'
import { vocabInit, getVocabFromSamplesArray } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { termjson } from '../../test/testdata/termjson'

/*
Tests:
	getPercentile()
	q_to_param()
	getVocabFromSamplesArray()

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

tape('getVocabFromSamplesArray() does not pollute Object.prototype', test => {
	test.timeoutAfter(100)
	test.plan(4)

	// simulates a mdsjsonurl-supplied analysisdata.samples entry with sample name "__proto__"
	// (code-scanning #146); JSON.parse (not an object literal) so "__proto__" lands as a
	// regular own key, matching what a real attacker JSON payload produces
	const samplesWithProtoName = JSON.parse('[{"sample":"__proto__","s":{"a":"payload"}}]')
	const attributesA = { a: { label: 'a' } }
	const resultFromName = getVocabFromSamplesArray({ samples: samplesWithProtoName, sample_attributes: attributesA })

	test.equal(Object.prototype.a, undefined, 'a "__proto__" sample name must not set Object.prototype.a')
	test.equal(
		resultFromName.sampleannotation['__proto__'].a,
		'payload',
		'the attribute is still recorded under sampleannotation["__proto__"]'
	)

	// same attack via the sample attribute key instead of the sample name
	const samplesWithProtoKey = JSON.parse('[{"sample":"s1","s":{"__proto__":"payload"}}]')
	const attributesProto = JSON.parse('{"__proto__":{"label":"a"}}')
	const resultFromKey = getVocabFromSamplesArray({ samples: samplesWithProtoKey, sample_attributes: attributesProto })

	test.equal(Object.prototype.id, undefined, 'a "__proto__" attribute key must not set Object.prototype.id')
	test.ok(
		resultFromKey.terms.find(t => t.id === '__proto__'),
		'a term definition for "__proto__" is still created'
	)
})
