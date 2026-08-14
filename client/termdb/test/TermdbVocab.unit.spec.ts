import tape from 'tape'
import { TermdbVocab } from '#termdb/TermdbVocab'
import { testAppInit } from '../../test/test.helpers'

/*
Tests:
    mayFillCategories: single term
    mayFillCategories: multiple terms
    getViolinBox: shapes the request without touching the caller tws
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

tape('getViolinBox: shapes the request without touching the caller tws', async test => {
	const vocabApi: any = await getTermdbVocabApi()
	let sentBody: any
	vocabApi.dofetch3 = async (_route: string, init: any) => {
		sentBody = init.body
		return { descrStats: { total: { label: 'Total', value: 3 } } }
	}

	const tw: any = {
		$id: 'tw1',
		type: 'NumTWCont',
		term: { id: 'agedx', type: 'float', name: 'Age' },
		q: { isAtomic: true, mode: 'discrete' }
	}
	const overlayTw: any = {
		$id: 'tw2',
		type: 'QualTWValues',
		term: { id: 'sex', type: 'categorical', name: 'Sex' },
		q: { isAtomic: true, type: 'values' }
	}
	const arg: any = { plotType: 'violin', tw, overlayTw }

	await vocabApi.getViolinBox(arg)

	/* Violin.ts assigns the response descrStats onto arg.tw.q once this resolves, and the
	legend renders from config.term.q.descrStats, so arg.tw must remain the caller's tw */
	test.equal(arg.tw, tw, 'should leave arg.tw as the caller object')
	test.equal(arg.overlayTw, overlayTw, 'should leave arg.overlayTw as the caller object')
	test.equal(tw.q.mode, 'discrete', 'should not force q.mode onto the caller tw')
	test.equal(tw.q.isAtomic, true, 'should not strip q.isAtomic from the caller tw')

	// the min copies are what gets sent
	test.equal(sentBody.tw.q.mode, 'continuous', 'should send q.mode=continuous')
	test.equal('isAtomic' in sentBody.tw.q, false, 'should strip q.isAtomic from the sent tw')
	test.equal('isAtomic' in sentBody.overlayTw.q, false, 'should strip q.isAtomic from the sent overlayTw')
	test.deepEqual(
		sentBody.tw.term,
		{ id: 'agedx', name: 'Age', type: 'float' },
		'should send a minimum copy of a dictionary term'
	)
	test.end()
})
