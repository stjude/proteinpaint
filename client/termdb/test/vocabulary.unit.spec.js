import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'

const vocab = getExample()
const vocabApi = vocabInit({ state: { vocab } })

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- vocabulary -***-')
	test.end()
})

tape('getPercentile', async function(test) {
	test.timeoutAfter(100)
	test.plan(11)

	let percentile_lst, result, testMsg, filter

	percentile_lst = [10]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.1, 'should get correct 10th percentile')

	percentile_lst = [25]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.2, 'should get correct 25th percentile')

	percentile_lst = [50]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.5, 'should get correct 50th percentile')

	percentile_lst = [75]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 0.8, 'should get correct 75th percentile')

	percentile_lst = [95]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.equal(result.values[0], 1.1, 'should get correct 95th percentile')

	percentile_lst = [25, 50]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.deepEqual(result.values, [0.2, 0.5], 'should get correct 25th and 50th percentiles')

	percentile_lst = [25, 50, 75]
	result = await vocabApi.getPercentile('d', percentile_lst)
	test.deepEqual(result.values, [0.2, 0.5, 0.8], 'should get correct 25th, 50th, and 75th percentiles')

	percentile_lst = ['a']
	testMsg = 'should throw error for non-integer percentiles'
	try {
		result = await vocabApi.getPercentile('d', percentile_lst)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, 'non-integer percentiles found', testMsg)
	}

	percentile_lst = [25, 50, 'a']
	testMsg = 'should throw error for non-integer percentiles'
	try {
		result = await vocabApi.getPercentile('d', percentile_lst)
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
	result = await vocabApi.getPercentile('d', percentile_lst, filter)
	test.equal(result.values[0], 0.8, 'should get correct 50th percentile with categorical filter')

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
	test.equal(result.values[0], 0.4, 'should get correct 50th percentile with numeric filter')
	test.end()
})
