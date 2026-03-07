import tape from 'tape'
import { TermdbVocab } from '#termdb/TermdbVocab'
import { testAppInit } from '../../test/test.helpers'

/*
Tests:
    mayFillCategories: single term
    mayFillCategories: multiple terms
 */

const state = {
	vocab: {
		genome: 'a',
		delabel: 'b'
	}
}
async function getTermdbVocabApi(opts: any = {}) {
	return new TermdbVocab({
		app: await testAppInit(state),
		state: opts.state || state
	})
}
const termdbVocabApi = await getTermdbVocabApi()

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/TermdbVocab -***-')
	test.end()
})

tape('mayFillCategories: single term', test => {
	const term = Object.freeze({
		values: {
			v1: { label: 'value1' },
			v2: { label: 'value2' },
			v3: { label: 'value3' }
		}
	})
	let categories: any
	const opts: any = { term: { term: structuredClone(term) } }
	termdbVocabApi.mayFillCategories(opts, categories)
	test.deepEqual(opts.term.term, term, 'opts.term.term should not change when categories is undefined')

	categories = [
		[],
		[],
		[
			{ key: 'v4', label: 'value4', samplecount: 5 },
			{ key: 'v5', label: 'value5', samplecount: 10 },
			{ key: 'v6', label: 'value6', samplecount: 15 }
		]
	]
	termdbVocabApi.mayFillCategories(opts, categories)
	test.deepEqual(opts.term.term, term, 'opts.term.term should not change when term is not in categories')

	categories = [
		[],
		[
			{ key: 'v4', label: 'value4', samplecount: 5 },
			{ key: 'v5', label: 'value5', samplecount: 10 },
			{ key: 'v6', label: 'value6', samplecount: 15 }
		],
		[]
	]
	termdbVocabApi.mayFillCategories(opts, categories)
	const expectedCategories = [
		{ key: 'v4', label: 'value4', samplecount: 5 },
		{ key: 'v5', label: 'value5', samplecount: 10 },
		{ key: 'v6', label: 'value6', samplecount: 15 }
	]
	test.deepEqual(
		opts.term.term.categories,
		expectedCategories,
		'term.categories should get filled change when term is in categories'
	)

	opts.term.term.values = {}
	termdbVocabApi.mayFillCategories(opts, categories)
	test.deepEqual(
		opts.term.term.categories,
		expectedCategories,
		'term.categories should get filled change when term is in categories'
	)
	test.end()
})

tape('mayFillCategories: multiple terms', test => {
	const term = Object.freeze({
		values: {
			v1: { label: 'value1' },
			v2: { label: 'value2' },
			v3: { label: 'value3' }
		}
	})
	const term2 = Object.freeze({
		values: {
			v4: { label: 'value4' },
			v5: { label: 'value5' },
			v6: { label: 'value6' }
		}
	})
	const categories = [
		[],
		[],
		[
			{ key: 'v7', label: 'value7', samplecount: 5 },
			{ key: 'v8', label: 'value8', samplecount: 10 },
			{ key: 'v9', label: 'value9', samplecount: 15 }
		]
	]
	const opts: any = {
		term: { term: structuredClone(term) },
		term2: { term: structuredClone(term2) }
	}
	termdbVocabApi.mayFillCategories(opts, categories)
	test.deepEqual(opts.term.term, term, 'opts.term.term should not change when term is not in categories')
	test.notDeepEqual(opts.term2.term, term2, 'opts.term.term2 should change when term is in categories')
	const expectedCategories = [
		{ key: 'v7', label: 'value7', samplecount: 5 },
		{ key: 'v8', label: 'value8', samplecount: 10 },
		{ key: 'v9', label: 'value9', samplecount: 15 }
	]
	test.deepEqual(
		opts.term2.term.categories,
		expectedCategories,
		'term.categories should get filled change when term is in categories'
	)
	test.end()
})
