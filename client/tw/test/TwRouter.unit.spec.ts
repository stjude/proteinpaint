import tape from 'tape'
import { TwRouter } from '../TwRouter.ts'
import type { RawQualTW, RawTW, GroupEntry, TermGroupSetting } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson'
import { QualValues, QualPredefinedGS, QualCustomGS } from '../qualitative.ts'

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
		disabled: false,
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
	test.comment('-***- tw/TwRouter.unit -***-')
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
				isAtomic: true,
				hiddenValues: {},
				mode: 'discrete'
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
		const tw: RawQualTW = {
			$id: 'test.$id',
			term,
			isAtomic: true as const,
			q: {}
		}

		const xtw = await TwRouter.initRaw(tw, { vocabApi })
		test.true(xtw instanceof QualValues, `should return a matching categorical xtw on init() with missing q or q.type`)
	}
	{
		const term = getTermWithGS()
		const tw: RawQualTW = {
			$id: 'test.$id',
			term,
			isAtomic: true as const,
			q: { type: 'predefined-groupset', isAtomic: true as const, predefined_groupset_idx: 0 }
		}

		const xtw = await TwRouter.initRaw(tw, { vocabApi })
		test.true(
			xtw instanceof QualPredefinedGS,
			`should return a matching categorical xtw on init() with q.type='predefined-groupset'`
		)
		test.deepEqual(
			Object.keys(xtw).sort(),
			['$id', 'isAtomic', 'q', 'term', 'type'],
			`should have the expected enumerable keys`
		)
	}

	{
		const term = getTermWithGS()
		const tw: RawQualTW = {
			$id: 'test.$id',
			term,
			isAtomic: true as const,
			q: {
				type: 'custom-groupset',
				isAtomic: true as const,
				customset: getCustomSet(),
				mode: 'discrete'
			}
		}

		const xtw = await TwRouter.initRaw(tw, { vocabApi })
		test.true(
			xtw instanceof QualCustomGS,
			`should return a matching categorical xtw on init() with q.type='custom-groupset'`
		)
		test.deepEqual(
			Object.keys(xtw).sort(),
			['$id', 'isAtomic', 'q', 'term', 'type'],
			`should have the expected enumerable keys`
		)
	}

	test.end()
})
