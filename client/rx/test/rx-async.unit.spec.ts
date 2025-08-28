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

tape('detectStale', async function (test) {
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
				partWait: 0
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
