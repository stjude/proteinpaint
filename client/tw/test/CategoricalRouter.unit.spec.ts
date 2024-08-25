import tape from 'tape'
import { RawCatTW, GroupEntry, TermGroupSetting } from '#types'
import { CategoricalRouter } from '../CategoricalRouter.ts'
import { vocabInit } from '#termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson'
import { CatValuesHandler } from '../CatValuesHandler'
import { CatPredefinedGSHandler } from '../CatPredefinedGSHandler'
import { CatCustomGSHandler } from '../CatCustomGSHandler'

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
	test.pass('-***- tw/CategoricalRouter.unit -***-')
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
			await CategoricalRouter.fill(tw as any, { vocabApi })
			test.fail(msg)
		} catch (e: any) {
			test.true(e.includes('incorrect term.type'), msg)
		}
	}

	test.end()
})

tape(`fill() default q.type='values'`, async test => {
	const tw: RawCatTW = {
		term: termjson.diaggrp,
		q: { isAtomic: true },
		isAtomic: true
	}

	try {
		const fullTw = await CategoricalRouter.fill(tw as any, { vocabApi })
		test.deepEqual(
			fullTw,
			{
				term: tw.term,
				q: {
					type: 'values',
					isAtomic: true,
					hiddenValues: {}
				},
				isAtomic: true,
				type: 'CatTWValues'
			},
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
		term,
		q: { isAtomic: true, type: 'predefined-groupset' },
		isAtomic: true
	}

	try {
		const fullTw = await CategoricalRouter.fill(tw, { vocabApi })
		test.deepEqual(
			fullTw,
			{
				term: tw.term,
				q: {
					type: 'predefined-groupset',
					predefined_groupset_idx: 0,
					isAtomic: true,
					hiddenValues: {}
				},
				isAtomic: true,
				type: 'CatTWPredefinedGS'
			},
			`should fill-in a categorical q.type='predefined-groupset'`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('fill() custom-groupset', async test => {
	const tw: RawCatTW = {
		term: termjson.diaggrp,
		q: {
			isAtomic: true,
			type: 'custom-groupset',
			name: 'AAA vs BBB',
			customset: getCustomSet()
		},
		isAtomic: true
	}

	const twCopy = structuredClone(tw)
	twCopy.q.hiddenValues = {}
	twCopy.type = 'CatTWCustomGS'
	try {
		const fullTw = await CategoricalRouter.fill(tw, { vocabApi })
		test.deepEqual(fullTw, twCopy, `should fill-in a categorical q.type='custom-groupset'`)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('init() categorical', async test => {
	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			//id: term.id,
			term,
			isAtomic: true as const,
			q: {}
		}

		const handler = await CategoricalRouter.initRaw(tw, { vocabApi }) //; console.log(186, handler.constructor.name)
		test.true(
			handler instanceof CatValuesHandler,
			`should return a matching categorical handler instance on init() with missing q or q.type`
		)
		test.equal(
			handler.router,
			CategoricalRouter,
			`should return a matching categorical handler.router on init() with missing q or q.type`
		)
	}
	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			//id: term.id,
			term,
			isAtomic: true as const,
			q: { type: 'predefined-groupset', isAtomic: true as const, hiddenValues: {} }
		}

		const handler = await CategoricalRouter.initRaw(tw, { vocabApi })
		test.true(
			handler instanceof CatPredefinedGSHandler,
			`should return a matching categorical handler instance on init() with missing q or q.type`
		)
		test.equal(
			handler.router,
			CategoricalRouter,
			`should return a matching categorical handler.router on init() with q.type='predefined-groupset'`
		)
	}

	{
		const term = getTermWithGS()
		const tw: RawCatTW = {
			//id: term.id,
			term,
			isAtomic: true as const,
			q: {
				type: 'custom-groupset',
				isAtomic: true as const,
				customset: getCustomSet()
			}
		}

		const handler = await CategoricalRouter.initRaw(tw, { vocabApi })
		test.true(
			handler instanceof CatCustomGSHandler,
			`should return a matching categorical handler instance on init() with missing q or q.type`
		)
		test.equal(
			handler.router,
			CategoricalRouter,
			`should return a matching categorical handler.router on init() with q.type='custom-groupset'`
		)
	}

	test.end()
})
