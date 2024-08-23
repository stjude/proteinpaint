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

tape('handler addons', async test => {
	// Below is an example of how to extend the handler instances that are returned
	// by TwRouter.init(), so that a plot, app, or component (consumer code) can add
	// handler methods or properties that it needs for all of its supported tw types.

	// Declare argument type(s) that are specific to a method for a particulat plot, app, or component
	type PlotTwRenderOpts = {
		aaa: string // these can be more complex types, such as for server response data, etc
		x: number
	}

	//
	// Define an addons type that will extend a Handler instance (not class),
	// using Object.assign().
	//
	// Note that consumer code will typically require very specific definitions
	// for addon method signatures and property types. Otherwise, tsc will not be able to
	// effectively type check the use of the handler instances within consumer code.
	//
	type Addons = {
		render: (this: any, arg: PlotTwRenderOpts) => void
	}
	// Below is the extended handler type.
	//
	// Ideally, the addon method names will match what's already declared as optional
	// in the Handler class, to have consistent naming convention for handler-related
	// code. Also, populating optional props/methods that are already declared for a class
	// is more easily optimized for lookup by browser engines.
	//
	type TwHandler = Handler & Addons

	//
	// Use a type guard to safely convert the Handler class to the addon TwHandler interface,
	// otherwise the compiler will complain of a type mismatch for optional properties in Handler
	// that are required in TwHandler. The runtime checks should verify the presence of
	// required props/methods, and return a boolean to confirm that the argument matches the target type.
	//
	function isPlotTwHandler(handler: Handler): handler is TwHandler {
		if (handler instanceof Handler && typeof handler.render == 'function') return true
		return true
	}

	// For each specialized handler class, identified by its constructor name,
	// create a addons object that define all of the specific handler methods
	// and properties that will be needed in the consumer code
	const addons: { [className: string]: Addons } = {
		CategoricalValues: {
			// since these addons are appended to an object instance instead of the class/object prototype,
			// the `this` context must be set
			render: function (this: CategoricalValues, arg: PlotTwRenderOpts): void {
				//
				// *** List of benefits (the goal of this tw routing and handler refactor) ***
				//
				// All code inside this function can be coded safely againt the type of `this`,
				// no need for if-else branches, type casting, or other workarounds.
				//
				// Consumer code can easily call these added methods easily, without the need
				// for static or runtime checks for tw type.
				//
				// Common methods, for example counting samples by categorical values or groups,
				// can also be inherited by specialized handler from a base handler class, therefore
				// keeping related logic close together instead of being spread out or duplicated.
				//
			}
		},
		CategoricalPredefinedGS: {
			render: function (this: CategoricalPredefinedGS, arg: PlotTwRenderOpts) {
				// console.log(`render a categorical term with q.type='predefined-groupset'`)
			}
		}
	}

	// Create a tw-type agnostic function for getting handler instances using TwRouter.init().
	// Then apply addons using Object.assign() and use the type guard to safely return the extended handler.
	function getHandler(tw): TwHandler {
		const handler = TwRouter.init(tw, { vocabApi })
		const adds = addons[handler.constructor.name]
		if (!addons) throw `no addons for '${handler.constructor.name}'`
		else Object.assign(handler, adds)
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
