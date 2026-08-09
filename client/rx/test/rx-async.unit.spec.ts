import tape from 'tape'
import { appInit, storeInit, partInit, sleep } from './testInit.ts'

/*************************
 reusable helper functions
**************************/

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- rx.core -***-')
	test.end()
})

tape('getStoreInit - async', async function (test) {
	const app = {
		opts: {
			state: {},
			debug: 1
		}
	}
	const api0 = await storeInit({ app, state: app.opts.state })
	test.equal(typeof api0.write, 'function', 'should provide a write() method')
	test.equal(typeof api0.copyState, 'function', 'should provide a copyState() method')
	test.deepEqual(
		api0.Inner?.state,
		api0.Inner?.copyMerge(api0.Inner?.defaultState, app.opts.state),
		'should have the expected initial state'
	)
	test.equal(Object.isFrozen(api0), true, 'should produce a frozen api')
	test.end()
})

tape('getCompInit - async, closured and classed', async function (test) {
	const opts = {
		app: {
			opts: {
				state: { abc: 123 },
				debug: 1
			}
		}
	}
	const part = await partInit(structuredClone(opts))
	test.equal('type' in part, true, 'should have an api.type property, even if undefined)')
	test.equal('id' in part, true, 'should set an api.id property, even if undefined')
	test.equal(typeof part.update, 'function', 'should provide an update() method')
	test.equal(typeof part.on, 'function', 'should provide an on() method')
	test.equal(typeof part.getComponents, 'function', 'should provide a getComponents() method')
	test.end()
})

tape('getAppInit -  async, closured and classed', async function (test) {
	const opts = {
		app: {},
		part: {}
	}
	const api0 = await appInit(opts)
	test.equal(typeof api0.dispatch, 'function', 'should provide a dispatch() method')
	test.equal(typeof api0.save, 'function', 'should provide a save() method')
	test.equal(typeof api0.getState, 'function', 'should provide a getState() method')
	test.equal(typeof api0.middle, 'function', 'should provide a middle() method')
	test.equal(typeof api0.on, 'function', 'should provide an on() method')
	test.equal(typeof api0.getComponents, 'function', 'should provide a getComponents() method')
	test.equal(api0.opts, opts, 'should have an opts property')
	test.end()
})

tape('detectStale()', async function (test) {
	const opts = {
		debug: 1,
		state: {
			appWait: 3
		}
	}
	const app = await appInit(structuredClone(opts))
	try {
		await Promise.all([
			(async () => {
				await sleep(0)
				await app.dispatch({ type: 'app_refresh', state: { partWait: 10 } })
			})(),
			(async () => {
				await sleep(2)
				await app.dispatch({ type: 'app_refresh', state: { partWait: 7 } })
			})(),
			(async () => {
				await sleep(4)
				await app.dispatch({ type: 'app_refresh', state: { partWait: 0 } })
			})()
		])

		test.deepEqual(
			app.getState(),
			{
				appWait: 3,
				partWait: 0,
				abortWait: 0,
				_scope_: undefined
			},
			`app should have the last dispatched state`
		)

		const part = app.getComponents('part').Inner
		test.deepEqual(
			{
				numStale: part.numStale,
				currWait: part.currWait
			},
			{
				numStale: 2,
				currWait: 0
			},
			`component should have the correct computed state`
		)
	} catch (e) {
		test.fail('error: ' + e)
	}
	test.end()
})

tape('abort previous action on update()', async function (test) {
	const verbose = false
	const opts = {
		debug: 1,
		state: {
			appWait: 3,
			cohort: 'abc'
		},
		partAbort: {
			preMain(api, part) {
				if (!verbose) return
				const sequenceId = api.getSequenceId() //; console.log(134, part)
				const signal = api.getAbortSignal()
				const cohort = part.state?.cohort
				console.log('---', part.type, 'before self.main()', sequenceId, cohort, signal.aborted)
				return { sequenceId, cohort, signal }
			},
			postMain(api, part, props) {
				if (!verbose) return
				console.log(
					'---',
					part.type,
					'after self.main()',
					props.sequenceId,
					api.getSequenceId(),
					['resolved promise=', props.cohort, `rendered=${!props.signal.aborted},`],
					[`label='${part.state.cohort}'`, `part.cohort=${part.cohort}`]
				)
			}
		}
	}
	const app = await appInit(opts)
	try {
		await Promise.all([
			(async () => {
				await sleep(0)
				await app.dispatch({ type: 'app_refresh', state: { abortWait: 50, cohort: 'abc' } })
			})(),
			(async () => {
				await sleep(10)
				await app.dispatch({ type: 'app_refresh', state: { abortWait: 30, cohort: 'qrs' } })
			})(),
			(async () => {
				await sleep(25)
				await app.dispatch({ type: 'app_refresh', state: { abortWait: 0, cohort: 'xyz' } })
			})()
		])

		test.deepEqual(
			app.getState(),
			{
				appWait: 3,
				partWait: 0,
				abortWait: 0,
				cohort: 'xyz',
				_scope_: undefined
			},
			`app should have the last dispatched state`
		)

		const part = app.getComponents('partAbort').Inner
		test.deepEqual(
			{
				numStale: part.numStale,
				currWait: part.currWait,
				cohort: part.cohort
			},
			{
				numStale: 2,
				currWait: 0,
				cohort: 'xyz'
			},
			`component should have the correct computed state`
		)
	} catch (e) {
		test.fail('error: ' + e)
	}
	test.end()
})

// stands in for the Vocab class, whose create() returns a component-scoped instance
// by prototypal inheritance, see client/termdb/Vocab.js
function getTestVocabApi() {
	return {
		appSignal: new AbortController().signal,
		getAbortSignal() {
			return this.appSignal
		},
		create(getComponentAbortSignal) {
			return Object.create(this, { getAbortSignal: { value: () => getComponentAbortSignal() } })
		}
	}
}

tape('skipPrevActionAbort() in dispatch()', async function (test) {
	const app = await appInit({
		debug: 1,
		state: { appWait: 0 },
		// only an app_refresh is assumed to affect all components in this test app
		skipPrevActionAbort: action => action?.type !== 'app_refresh'
	})
	try {
		const signal = app.getAbortSignal()
		test.equal(signal.aborted, false, `should start with a signal that is not aborted`)

		await app.dispatch({ type: 'unrelated_action' })
		test.equal(signal.aborted, false, `should not abort the app signal for a skipped action`)
		test.equal(
			app.getAbortSignal(),
			signal,
			`should keep the same controller for a skipped action, so that the requests it signaled remain cancelable`
		)

		await app.dispatch({ type: 'app_refresh', state: { partWait: 0 } })
		test.equal(signal.aborted, true, `should abort the requests that were signaled while actions were being skipped`)
		test.notEqual(app.getAbortSignal(), signal, `should replace the controller after aborting it`)
	} catch (e) {
		test.fail('error: ' + e)
	}
	test.end()
})

// NOTE: rx does not create a component-scoped vocabApi, a component gets one by extending
// PlotBase, see client/plots/test/PlotBase.unit.spec.ts. TestPart mimics PlotBase, so that
// the interaction between a component-scoped signal and a skipped app action is covered here.
tape('component abort signal versus skipped app action', async function (test) {
	const app = await appInit({
		debug: 1,
		state: { appWait: 0 },
		vocabApi: getTestVocabApi(),
		// no action affects all components in this test app
		skipPrevActionAbort: () => true
	})
	try {
		const part: any = app.getComponents('part')
		// the first update always computes a new state for the component, so prime it before
		// capturing the signals that the assertions below are about
		await app.dispatch({ type: 'part_edit', state: { partWait: 0 } })
		const appSignal = app.getAbortSignal()
		const compSignal = part.Inner.vocabApi.getAbortSignal()

		// an action that does not change this component's state, such as deleting another plot
		await app.dispatch({ type: 'unrelated_action' })
		test.equal(appSignal.aborted, false, `should not abort the app signal for a skipped action`)
		test.equal(
			compSignal.aborted,
			false,
			`should not abort a pending component request when an unrelated action is dispatched`
		)

		// an action that does change this component's state, such as editing its own config
		await app.dispatch({ type: 'part_edit', state: { partWait: 5 } })
		test.equal(appSignal.aborted, false, `should still not abort the app signal for a skipped action`)
		test.equal(compSignal.aborted, true, `should abort a pending component request when its own state changes`)
	} catch (e) {
		test.fail('error: ' + e)
	}
	test.end()
})
