import tape from 'tape'
import { CategoricalTW } from '#types'
import { CategoricalBase, PartialCatTW } from '../CategoricalTW.ts'

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

tape('fill() errors', async test => {
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

tape('fill() basic default', async test => {
	const tw: PartialCatTW = {
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
	const tw: PartialCatTW = {
		term: { id: 'abc', type: 'categorical' }
	}

	const handler = await CategoricalBase.init(tw)
	test.true(handler instanceof CategoricalBase, `should return a CategoricalTW instance on init()`)
	test.deepEqual(Object.keys(handler.tw || {}), ['id', 'term', 'q'], `must have the expected handler properties`)

	test.end()
})
