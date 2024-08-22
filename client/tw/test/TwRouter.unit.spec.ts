import tape from 'tape'
import { TwRouter } from '../TwRouter.ts'
import { RawCatTW, RawTW, GroupEntry, TermGroupSetting, CategoricalTW } from '#types'
import { TermWrapper } from '#updated-types'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { termjson } from '../../test/testdata/termjson'
import { CategoricalRouter, CategoricalInstance } from '../CategoricalRouter'
import { CategoricalValues } from '../CategoricalValues'
import { CategoricalPredefinedGS } from '../CategoricalPredefinedGS'
import { CategoricalCustomGS } from '../CategoricalCustomGS'
import { Handler } from '../Handler'

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

tape('initRaw() categorical', async test => {
	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			term,
			isAtomic: true as const,
			q: {}
		}

		const handler = await TwRouter.initRaw(tw, { vocabApi })
		test.equal(
			handler.router,
			CategoricalRouter,
			`should return a matching categorical handler.router on init() with missing q or q.type`
		)
	}
	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			term,
			isAtomic: true as const,
			q: { type: 'predefined-groupset', isAtomic: true as const }
		}

		const handler = await TwRouter.initRaw(tw, { vocabApi })
		test.equal(
			handler.router,
			CategoricalRouter,
			`should return a matching categorical handler.router on init() with q.type='predefined-groupset'`
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

		const handler = await TwRouter.initRaw(tw, { vocabApi })
		test.equal(
			handler.router,
			CategoricalRouter,
			`should return a matching categorical handler.router on init() with q.type='custom-groupset'`
		)
	}

	test.end()
})
