import tape from 'tape'
import type { RawCatTW, GroupEntry, TermGroupSetting, CatTWValues, CatTWPredefinedGS, CatTWCustomGS } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson'
import { CategoricalBase } from '../categorical'

/*************************
 reusable helper functions
**************************/

const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })

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
	test.comment('-***- tw/categorical.unit -***-')
	test.end()
})

tape('fill(invalid tw)', async test => {
	// not typing with RawCatTW since these are not valid fill() argument
	const tw = {
		$id: 'test.$id',
		term: { id: 'abc', type: 'integer' }
	}
	{
		const msg = 'should detect an incorrect term.type'
		try {
			await CategoricalBase.fill(tw as any, { vocabApi })
			test.fail(msg)
		} catch (e: any) {
			test.true(e.includes('incorrect term.type'), msg)
		}
	}

	test.end()
})

tape(`fill() default q.type='values'`, async test => {
	const tw: RawCatTW = {
		$id: 'test.$id',
		term: termjson.diaggrp,
		q: { isAtomic: true },
		isAtomic: true
	}

	try {
		const fullTw = await CategoricalBase.fill(tw as any, { vocabApi })
		test.deepEqual(
			fullTw,
			{
				$id: 'test.$id',
				term: tw.term,
				q: {
					type: 'values',
					mode: 'discrete',
					isAtomic: true,
					hiddenValues: {}
				},
				isAtomic: true,
				type: 'CatTWValues'
			} satisfies CatTWValues,
			`should fill-in categorical q with no type with default q.type='values'`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('fill() predefined-groupset', async test => {
	const term = getTermWithGS()
	const tw: RawCatTW = {
		$id: 'test.$id',
		term,
		q: { isAtomic: true, type: 'predefined-groupset', predefined_groupset_idx: 0 },
		isAtomic: true
	}

	try {
		const fullTw = await CategoricalBase.fill(tw, { vocabApi })
		test.deepEqual(
			fullTw,
			{
				$id: 'test.$id',
				term: tw.term,
				q: {
					type: 'predefined-groupset',
					mode: 'discrete',
					predefined_groupset_idx: 0,
					isAtomic: true,
					hiddenValues: {}
				},
				isAtomic: true,
				type: 'CatTWPredefinedGS'
			} satisfies CatTWPredefinedGS,
			`should fill-in a categorical q.type='predefined-groupset'`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('fill() custom-groupset', async test => {
	const tw: RawCatTW = {
		$id: 'test.$id',
		term: termjson.diaggrp,
		q: {
			isAtomic: true,
			type: 'custom-groupset',
			name: 'AAA vs BBB',
			customset: getCustomSet()
		},
		isAtomic: true
	}

	const expected = {
		$id: 'test.$id',
		term: tw.term, // term is not filled-in, so ok to reuse raw tw.term here
		q: {
			isAtomic: true,
			type: 'custom-groupset',
			mode: 'discrete',
			name: 'AAA vs BBB',
			customset: getCustomSet(),
			hiddenValues: {}
		},
		type: 'CatTWCustomGS',
		isAtomic: true
	} satisfies CatTWCustomGS

	try {
		const fullTw = await CategoricalBase.fill(tw, { vocabApi })
		test.deepEqual(fullTw, expected, `should fill-in a categorical q.type='custom-groupset'`)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})
