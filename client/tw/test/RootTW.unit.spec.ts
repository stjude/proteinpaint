import tape from 'tape'
//import { CategoricalTW } from '#types'
import { RootTW } from '../RootTW.ts'
import { RawCatTW, RawTW } from '#types'
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
	test.pass('-***- tw/RootTW -***-')
	test.end()
})

tape('fill({id}) no tw.term', async test => {
	const tw /*: RawTW*/ = {
		id: 'sex'
	}

	try {
		const fullTw = await RootTW.fill(tw as any, vocabApi)
		test.deepEqual(
			fullTw,
			{
				id: 'sex',
				term: {
					type: 'categorical',
					id: 'sex',
					name: 'Sex',
					values: {
						1: { label: 'Male', color: '#e75480' },
						2: { label: 'Female' }
					},
					groupsetting: {
						disabled: true
					}
				},
				q: { type: 'values', isAtomic: true }
			},
			'should fill-in a minimal dictionary tw with only {id}'
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})
