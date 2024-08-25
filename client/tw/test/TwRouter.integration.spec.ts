import tape from 'tape'
import { TwRouter } from '../TwRouter.ts'
import { GroupEntry, TermGroupSetting } from '#types'
import { TermWrapper } from '#updated-types'
import { vocabInit } from '#termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson'
import { FakeAppByAddons } from './fakeApp/fakeAppByAddons.ts'
import { FakeAppByCls } from './fakeApp/fakeAppByCls.ts'

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

const softTwsLimit = 2 //5000
async function getTws() {
	// create an array of full tw's, to simulate what may be seen from app/plot state after a dispatch
	const twlst: TermWrapper[] = [
		Object.freeze(await TwRouter.fill({ id: 'sex' }, { vocabApi })),
		Object.freeze({
			type: 'CatTWPredefinedGS',
			term: getTermWithGS(),
			isAtomic: true as const,
			q: {
				type: 'predefined-groupset' as const,
				predefined_groupset_idx: 0,
				isAtomic: true as const
			}
		})
	]
	while (twlst.length < softTwsLimit) {
		twlst.push(...twlst)
	}
	Object.freeze(twlst)
	return twlst
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- tw/TwRouter.integration -***-')
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
						2: { label: 'Female', color: 'blue' }
					},
					groupsetting: {
						disabled: true
					},
					isleaf: true,
					sample_type: '1',
					hashtmldetail: true
				},
				q: { type: 'values', isAtomic: true, hiddenValues: {} },
				type: 'CatTWValues'
			},
			'should fill-in a minimal dictionary tw with only {id}'
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

let twlst // ok to share between test suites because it's frozen

tape('handler with addons', async test => {
	twlst = await getTws()

	const msg = 'should convert handler instances to the extended interface'
	try {
		const data = {
			sample1: { sex: 1, diaggrp: 'ALL' },
			sample2: { sex: 2, diaggrp: 'NBL' }
		}
		//const handlers = terms.map(getHandler)
		const start = Date.now()
		const app = new FakeAppByAddons({ twlst, vocabApi })
		app.main(data)
		test.pass(msg)
		if (twlst.length > 100) {
			// indicates benchmark test
			console.log(142, `addons time, twlst.length=${twlst.length}`, Date.now() - start)
			test.end()
			return
		}

		const Inner = app.getInner()
		test.deepEqual(
			Object.keys(Inner.handlers[0]).sort(),
			Object.keys(Inner.handlers[1]).sort(),
			`should have matching handler property/method names for all extended handler instances`
		)

		test.equal(
			Inner.dom.svg,
			`<svg>` +
				`<text>sample1, Male</text><circle r=1></cicle>` +
				`<text>sample2, Female</text><circle r=2></cicle>` +
				`<text>sample1, ALL</text><rect width=10 height=10></rect>` +
				`<text>sample2, NBL</text><rect width=10 height=10></rect>` +
				`</svg>`,
			`should render an svg with fake data`
		)
	} catch (e) {
		test.fail(msg + ': ' + e)
	}

	test.end()
})

tape('handler by class', async test => {
	const msg = 'should convert handler instances to the extended interface'
	try {
		const data = {
			sample1: { sex: 1, diaggrp: 'ALL' },
			sample2: { sex: 2, diaggrp: 'NBL' }
		}
		//const handlers = terms.map(getHandler)
		const start = Date.now()
		const app = new FakeAppByCls({ twlst, vocabApi })
		app.main(data)
		test.pass(msg)
		if (twlst.length > 100) {
			// indicates benchmark test
			console.log(203, `class time, twlst.length=${twlst.length}`, Date.now() - start)
			test.end()
			return
		}

		const Inner = app.getInner()
		test.deepEqual(
			Object.keys(Inner.handlers[0]).sort(),
			Object.keys(Inner.handlers[1]).sort(),
			`should have matching handler property/method names for all extended handler instances`
		)

		test.equal(
			Inner.dom.svg,
			`<svg>` +
				`<text>sample1, Male</text><circle r=1></cicle>` +
				`<text>sample2, Female</text><circle r=2></cicle>` +
				`<text>sample1, ALL</text><rect width=10 height=10></rect>` +
				`<text>sample2, NBL</text><rect width=10 height=10></rect>` +
				`</svg>`,
			`should render an svg with fake data`
		)
	} catch (e) {
		test.fail(msg + ': ' + e)
	}

	test.end()
})
