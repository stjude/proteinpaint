import tape from 'tape'
import { TwRouter } from '../TwRouter.ts'
import { RawCatTW, RawTW, GroupEntry, TermGroupSetting } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { termjson } from '../../test/testdata/termjson'
import { CategoricalBase } from '../CategoricalTW'

const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })

/*************************
 reusable helper functions
**************************/

function getCustomSet() {
	const groups: GroupEntry[] = [
		{
			name: 'AAA',
			type: 'values',
			values: [
				{
					key: 'ALL',
					label: 'Acute Lymphoblastic Leukemia'
				},
				{
					key: 'AML',
					label: 'AML'
				}
			]
		},
		{
			name: 'BBB',
			type: 'values',
			values: [
				{
					key: `Hodgkin's Lymphoma`,
					label: `Hodgkin's Lymphoma`
				},
				{
					key: `Non-hodgkin's Lymphoma`,
					label: `Non-hodgkin's Lymphoma`
				}
			]
		}
	]
	return { groups }
}

function getTermWithGS() {
	const term = structuredClone(termjson.diaggrp)
	term.groupsetting = {
		lst: [
			{
				name: 'AAA vs BBB',
				groups: getCustomSet().groups
			}
		]
	} satisfies TermGroupSetting
	return term
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- tw/TwRouter -***-')
	test.end()
})

tape('fill({id}) no tw.term, no tw.q', async test => {
	const tw /*: RawTW*/ = {
		id: 'sex'
	}

	try {
		const fullTw = await TwRouter.fill(tw as any, { vocabApi })
		test.deepEqual(
			fullTw,
			{
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
	const term = getTermWithGS()
	const tw: RawTW = {
		term,
		q: {
			type: 'predefined-groupset',
			groupsetting: {
				inuse: true,
				predefined_groupset_idx: 0
			}
		}
	}

	try {
		const fullTw = await TwRouter.fill(tw, { vocabApi })
		test.deepEqual(
			fullTw.q,
			{
				type: 'predefined-groupset',
				predefined_groupset_idx: 0,
				isAtomic: true
			},
			`should reshape a legacy nested q.groupsetting`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('init() categorical', async test => {
	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			term,
			isAtomic: true as const,
			q: {}
		}

		const handler = await TwRouter.init(tw, { vocabApi })
		test.equal(
			handler.base,
			CategoricalBase,
			`should return a matching categorical handler.base on init() with missing q or q.type`
		)
	}
	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			term,
			isAtomic: true as const,
			q: { type: 'predefined-groupset', isAtomic: true as const }
		}

		const handler = await TwRouter.init(tw, { vocabApi })
		test.equal(
			handler.base,
			CategoricalBase,
			`should return a matching categorical handler.base on init() with q.type='predefined-groupset'`
		)
	}

	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			term,
			isAtomic: true as const,
			q: {
				type: 'custom-groupset',
				isAtomic: true as const,
				customset: getCustomSet()
			}
		}

		const handler = await TwRouter.init(tw, { vocabApi })
		test.equal(
			handler.base,
			CategoricalBase,
			`should return a matching categorical handler.base on init() with q.type='custom-groupset'`
		)
	}

	test.end()
})
