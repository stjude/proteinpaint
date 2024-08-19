import tape from 'tape'
import { CategoricalTW, RawCatTW, GroupEntry } from '#types'
import { CategoricalBase } from '../CategoricalTW.ts'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { termjson } from '../../test/testdata/termjson'

const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })

/*************************
 reusable helper functions
**************************/

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

tape(`fill() default q.type='values'`, async test => {
	const id = 'diaggrp'
	const tw: RawCatTW = {
		id,
		term: termjson.diaggrp,
		q: { isAtomic: true },
		isAtomic: true
	}

	try {
		const fullTw = await CategoricalBase.fill(tw as any, vocabApi)
		const testedKeys = new Set()
		test.deepEqual(
			fullTw,
			{
				id,
				term: tw.term,
				q: {
					type: 'values',
					isAtomic: true
				},
				isAtomic: true
			},
			`should fill-in categorical q with no type with default q.type='values'`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('fill() predefined-groupset', async test => {
	const id = 'diaggrp'
	const tw: RawCatTW = {
		id,
		term: termjson.diaggrp,
		q: { isAtomic: true, type: 'predefined-groupset' },
		isAtomic: true
	}

	try {
		const fullTw = await CategoricalBase.fill(tw as any, vocabApi)
		const testedKeys = new Set()
		test.deepEqual(
			fullTw,
			{
				id,
				term: tw.term,
				q: {
					type: 'predefined-groupset',
					predefined_groupset_idx: 0,
					isAtomic: true
				},
				isAtomic: true
			},
			`should fill-in a categorical q.type='predefined-groupset'`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('fill() custom-groupset', async test => {
	const id = 'diaggrp'
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

	const tw: RawCatTW = {
		id,
		term: termjson.diaggrp,
		q: {
			isAtomic: true,
			type: 'custom-groupset',
			name: 'AAA vs BBB',
			customset: { groups }
		},
		isAtomic: true
	}

	const twCopy = structuredClone(tw)

	try {
		const fullTw = await CategoricalBase.fill(tw as any, vocabApi)
		const testedKeys = new Set()
		test.deepEqual(fullTw, twCopy, `should fill-in a categorical q.type='custom-groupset'`)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('init', async test => {
	const tw: RawCatTW = {
		term: termjson.diaggrp
	}

	const handler = await CategoricalBase.init(tw)
	test.true(handler instanceof CategoricalBase, `should return a CategoricalTW instance on init()`)
	test.deepEqual(Object.keys(handler.tw || {}).sort(), ['id', 'q', 'term'], `must have the expected handler properties`)

	test.end()
})
