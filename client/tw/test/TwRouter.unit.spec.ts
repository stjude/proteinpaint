import tape from 'tape'
import { TwRouter } from '../TwRouter.ts'
import { RawCatTW, RawTW, GroupEntry, TermGroupSetting, TermWrapper } from '#types'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'
import { termjson } from '../../test/testdata/termjson'
import { CategoricalBase } from '../CategoricalTW'
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

		const handler = await TwRouter.initRaw(tw, { vocabApi })
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

		const handler = await TwRouter.initRaw(tw, { vocabApi })
		test.equal(
			handler.base,
			CategoricalBase,
			`should return a matching categorical handler.base on init() with q.type='custom-groupset'`
		)
	}

	test.end()
})

tape('handler mixin', async test => {
	// Below is an example of how to extend the handler instances that are returned
	// by TwRouter.init(), so that a plot, app, or component (consumer code) can add
	// handler methods or properties that it needs for all of its supported tw types.

	// Declare argument type(s) that are specific to a method for a particulat plot, app, or component
	type PlotTwRenderOpts = {
		aaa: string // these can be more complex types, such as for server response data, etc
		x: number
	}

	//
	// Define a custom methods type that will extend a Handler instance (not class),
	// using Object.assign().
	//
	// Note that consumer code will typically require very specific definitions
	// for mixed-in method signatures and property types. Otherwise, tsc will not be able to
	// effectively type check the use of the handler instances within consumer code.
	//
	type CustomMethods = {
		render: (arg: PlotTwRenderOpts) => void
	}
	// Below is the extended handler type.
	//
	// Ideally, the mixed-in methods will match what's already declared as optional
	// in the Handler class, to have consistent naming convention for handler-related
	// code. Also, populating optional props/methods that are already declared for a class
	// is more easily optimized for lookup by browser engines.
	//
	type TwHandler = Handler & CustomMethods

	//
	// Use a type guard to safely convert the Handler class to the mixed-in TwHandler interface,
	// otherwise the compiler will complain of a type mismatch for optional properties in Handler
	// that are required in TwHandler. The runtime checks should include for the presence of
	// the required props/methods, and return a boolean to confirm that the argument matches the target type.
	//
	function isPlotTwHandler(handler: Handler): handler is TwHandler {
		if (handler instanceof Handler && typeof handler.render == 'function') return true
		return true
	}

	// For each specialized handler class, identified by its constructor name,
	// create a mixins object that define all of the specific handler methods
	// and properties that will be needed in the consumer code
	const mixins: { [k: string]: CustomMethods } = {
		CategoricalValues: {
			render: (arg: PlotTwRenderOpts) => `render a categorical term with q.type='values'`
		},
		CategoricalPredefinedGS: {
			render: (arg: PlotTwRenderOpts) => `render a categorical term with q.type='predefined-groupset'`
		}
	}

	// Create a term.type-agnostic function for getting handler instances using TwRouter.init().
	// Then mixin using Object.assign() and use the type guard to safely return the extended handler
	function getHandler(tw): TwHandler {
		const handler = TwRouter.init(tw, { vocabApi })
		const mixin = mixins[handler.constructor.name]
		if (!mixin) throw `no mixin for '${handler.constructor.name}'`
		else Object.assign(handler, mixin)
		if (isPlotTwHandler(handler)) return handler
		else throw `mismatch`
	}

	// to test the above examples:
	// create an array of full tw's, to simulate what may be seen from app/plot state after a dispatch
	const terms: TermWrapper[] = [
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
		const handlers = terms.map(getHandler)
		test.pass(msg)
		test.deepEqual(
			Object.keys(handlers[0]).sort(),
			Object.keys(handlers[1]).sort(),
			`should have matching handler property/method names for all extended handler instances`
		)
	} catch (e) {
		test.fail(msg + ': ' + e)
	}

	test.end()
})
