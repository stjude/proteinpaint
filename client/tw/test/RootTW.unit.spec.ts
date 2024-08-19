import tape from 'tape'
//import { CategoricalTW } from '#types'
import { RootTW } from '../RootTW.ts'
import { RawCatTW, RawTW } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { termjson } from '../../test/testdata/termjson'

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

tape('fill({id}) no tw.term, no tw.q', async test => {
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
					},
					isleaf: true,
					hashtmldetail: true
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

tape('fill({id, q}) nested q.groupsetting (legacy support)', async test => {
	const tw: RawTW = {
		id: 'diaggrp',
		q: {
			type: 'predefined-groupset',
			groupsetting: {
				inuse: true,
				predefined_groupset_idx: 1
			}
		}
	}

	try {
		const fullTw = await RootTW.fill(tw, vocabApi)
		test.deepEqual(
			fullTw.q,
			{
				type: 'predefined-groupset',
				predefined_groupset_idx: 1,
				isAtomic: true
			},
			`should reshape a legacy nested q.groupsetting`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})
