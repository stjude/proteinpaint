import tape from 'tape'
import { CategoricalTW } from '#types'
import { CategoricalBase, RawCatTW } from '../CategoricalTW.ts'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'

const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })

/*************************
 reusable helper functions
**************************/

// function isFullCatTw(tw) {
// 	if (!tw.id) return false
// 	if (!tw.term) return false
// }

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- tw/CategoricalTW -***-')
	test.end()
})

tape('fill(invalid tw)', async test => {
	// not typing with RawCatTW since these are not valid fill() argument
	const tw = {
		term: { id: 'abc', type: 'integer' }
	}
	{
		const msg = 'should detect an incorrect term.type'
		try {
			await CategoricalBase.fill(tw as any)
			test.fail(msg)
		} catch (e: any) {
			test.true(e.includes('incorrect term.type'), msg)
		}
	}

	test.end()
})

tape('fill({id}) basic default', async test => {
	const tw: RawCatTW = {
		term: { id: 'aaa', type: 'categorical' }
	}

	try {
		const fullTw = await CategoricalBase.fill(tw as any, vocabApi)
		test.deepEqual(
			fullTw,
			{
				id: 'aaa',
				term: {
					type: 'categorical',
					id: 'aaa',
					name: 'aaa',
					values: {},
					groupsetting: { useIndex: 0, lst: [] }
				},
				q: {
					type: 'values'
				}
			},
			'should fill-in a minimal tw with only {id}'
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('fill() basic default', async test => {
	const tw: RawCatTW = {
		term: { id: 'abc', type: 'categorical' }
	}

	try {
		const fullTw = await CategoricalBase.fill(tw as any)
		test.deepEqual(
			fullTw,
			{
				id: 'abc',
				term: {
					type: 'categorical',
					id: 'abc',
					name: 'abc',
					values: {},
					groupsetting: { useIndex: 0, lst: [] }
				},
				q: {
					type: 'values'
				}
			},
			'should fill-in a minimal tw with only {id}'
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

//tape.skip('fill() predefined-groupset', test => {})

//tape.skip('fill() custom-groupset', test => {})

tape('init', async test => {
	const tw: RawCatTW = {
		term: { id: 'abc', type: 'categorical' }
	}

	const handler = await CategoricalBase.init(tw)
	test.true(handler instanceof CategoricalBase, `should return a CategoricalTW instance on init()`)
	test.deepEqual(Object.keys(handler.tw || {}), ['id', 'term', 'q'], `must have the expected handler properties`)

	test.end()
})
