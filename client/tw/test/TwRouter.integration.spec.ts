import tape from 'tape'
import { TwRouter } from '../TwRouter.ts'
import { GroupEntry, TermGroupSetting } from '#types'
import { TermWrapper } from '#updated-types'
import { vocabInit } from '#termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson'
import { FakeApp } from './fakeApp/fakeApp.ts'
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
				q: { type: 'values', isAtomic: true }
			},
			'should fill-in a minimal dictionary tw with only {id}'
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape('handler with addons', async test => {
	// to test the above examples:
	// create an array of full tw's, to simulate what may be seen from app/plot state after a dispatch
	const twlst: TermWrapper[] = [
		await TwRouter.fill({ id: 'sex' }, { vocabApi }),
		{
			term: getTermWithGS(),
			isAtomic: true as const,
			q: {
				type: 'predefined-groupset' as const,
				predefined_groupset_idx: 0,
				isAtomic: true as const
			}
		}
	]

	const msg = 'should convert handler instances to the extended interface'
	try {
		const data = {
			sample1: { sex: 1, diaggrp: 'ALL' },
			sample2: { sex: 2, diaggrp: 'NBL' }
		}
		//const handlers = terms.map(getHandler)
		const app = new FakeApp({ twlst, vocabApi })
		app.main(data)
		const Inner = app.getInner()

		test.pass(msg)
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
	// to test the above examples:
	// create an array of full tw's, to simulate what may be seen from app/plot state after a dispatch
	const twlst: TermWrapper[] = [
		await TwRouter.fill({ id: 'sex' }, { vocabApi }),
		{
			term: getTermWithGS(),
			isAtomic: true as const,
			q: {
				type: 'predefined-groupset' as const,
				predefined_groupset_idx: 0,
				isAtomic: true as const
			}
		}
	]

	const msg = 'should convert handler instances to the extended interface'
	try {
		const data = {
			sample1: { sex: 1, diaggrp: 'ALL' },
			sample2: { sex: 2, diaggrp: 'NBL' }
		}
		//const handlers = terms.map(getHandler)
		const app = new FakeAppByCls({ twlst, vocabApi })
		app.main(data)
		const Inner = app.getInner()

		test.pass(msg)
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
