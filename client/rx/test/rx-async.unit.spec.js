import tape from 'tape'
import * as rx from '../index.js'

/*************************
 reusable helper functions
**************************/

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

class TestApp {
	constructor(opts) {
		this.type = 'app'
	}

	async init() {
		this.store = await storeInit({ app: this.api, state: this.opts.state })
		this.components = {
			part: await partInit({ app: this.api })
		}
	}

	async main() {}
}

const appInit = rx.getAppInit(TestApp)

class TestStore {
	constructor(opts) {
		this.type = 'store'
		this.defaultState = {
			appWait: 0,
			partWait: 0
		}
	}
}

TestStore.prototype.actions = {
	app_refresh(action) {
		rx.copyMerge(this.state, action.state)
	}
}

const storeInit = rx.getStoreInit(TestStore)

class TestPart {
	constructor(opts = {}) {
		this.type = 'part'
		this.numStale = 0
	}
	getState(appState) {
		return { wait: appState.partWait || 0 }
	}
	async main() {
		try {
			const [a, stale] = await this.api.detectStale(() => sleep(this.state.wait))
			if (stale) this.numStale++
			else this.currWait = this.state.wait
		} catch (e) {
			throw e
		}
	}
}

const partInit = rx.getCompInit(TestPart)

class TestPart2 extends TestPart {
	static type = 'part2'

	constructor(opts) {
		super(opts)
		this.type = 'part2'
	}
}

const part2Init = rx.getCompInit(TestPart2)

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
	const store0 = await storeInit({ app, state: app.opts.state })
	test.equal(typeof store0.write, 'function', 'should provide a write() method')
	test.equal(typeof store0.copyState, 'function', 'should provide a copyState() method')
	test.deepEqual(
		store0.Inner.state,
		rx.copyMerge({}, store0.Inner.defaultState, app.opts.state),
		'should have the expected initial state'
	)
	test.equal(Object.isFrozen(store0), true, 'should produce a frozen api')
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

	let part0
	{
		part0 = await partInit(structuredClone(opts))
		test.equal('type' in part0, true, 'should have an api.type property, even if undefined)')
		test.equal('id' in part0, true, 'should set an api.id property, even if undefined')
		test.equal(typeof part0.update, 'function', 'should provide an update() method')
		test.equal(typeof part0.on, 'function', 'should provide an on() method')
		test.equal(typeof part0.getComponents, 'function', 'should provide a getComponents() method')
	}

	{
		const part2 = await part2Init(structuredClone(opts))
		const missingKeys = []
		for (const key of Object.keys(part0)) {
			if (part0[key] !== undefined && part2[key] === undefined) missingKeys.push(key)
		}
		test.deepEqual(
			missingKeys,
			[],
			`should have the same api properties and methods between closured and classed component api's`
		)
	}

	test.end()
})

tape('getAppInit - async', async function (test) {
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

tape('AppApi.getInitFxn()', async function (test) {
	const appInit = rx.AppApi.getInitFxn(TestApp)
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
		const d = await Promise.all([
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
