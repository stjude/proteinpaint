import tape from 'tape'
import * as rx from '../index.js'

/*************************
 reusable helper functions
**************************/

class TestApp {
	static type = 'app'

	constructor(opts) {
		this.type = 'app'
		this.opts = opts
		//this.api = rx.getAppApi(this)
	}

	async init() {
		const opts = this.opts
		if (opts.storeInit) {
			this.store = await opts.storeInit({ app: this.api })
			this.state = this.store.copyState()
		}
		if (opts.components) {
			this.components = opts.components
			for (const [name, obj] of Object.entries(this.components)) {
				if (!obj) continue
				if (obj.initFxn) {
					this.components[name] = await obj.initFxn({ app: this.api })
					delete obj.initFxn
				} else if (!obj.app) {
					this.components[name].app = this.api
				}
			}
		}
	}

	main(state) {
		if (state) this.state = state
		if (this.state.prop !== 'xyz') return this.state.prop
	}
}

class TestStore {
	static type = 'store'
	sequenceId = 0

	constructor(opts) {
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		//this.api = rx.getStoreApi(this)
		this.deepFreeze = rx.deepFreeze
		this.fromJson = rx.fromJson // used in store.api.copyState()
		this.toJson = rx.toJson // used in store.api.copyState()
		this.state = opts.state ? opts.state : { prop: 'xyz', todos: [] }
	}
}

TestStore.prototype.actions = {
	todo_add(action) {
		const i = this.state.todos.findIndex(d => d.id == action.todo.id)
		if (i == -1) {
			this.state.todos.push(action.todo)
		}
	},
	todo_remove(action) {
		const i = this.state.todos.findIndex(d => d.id == action.todo.id)
		if (i !== -1) {
			this.state.todos.splice(i, 1)
		}
	},
	prop_edit(action) {
		this.state.prop = action.prop
	},
	fake_add(action) {}
}

class TestPart {
	static type = 'part'

	constructor(opts = {}) {
		this.type = 'part'
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		this.api = rx.ComponentApi.getInitFxn(this)

		if (opts.components) this.components = opts.components
	}
	getState(appState) {
		return appState
	}
	main(state) {
		this.state = state
		if (this.state.prop !== 'xyz') return this.state.prop
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- rx.core -***-')
	test.end()
})

tape('getOpts', function (test) {
	// this app object will be its own appApi
	const app = {
		opts: {
			debug: 1,
			abc: {
				callbacks: {
					postInit() {}
				},
				random: []
			}
		}
	}
	const absInstance = { type: 'abc', app }
	const opts0 = { app, testKey: 'xyz' }
	const opts1 = rx.getOpts(opts0, absInstance)
	test.deepEqual(
		opts1,
		{
			app,
			testKey: opts0.testKey,
			callbacks: app.opts.abc.callbacks,
			debug: 1,
			random: app.opts.abc.random
		},
		'should copyMerge options by component type'
	)
	test.end()
})

tape('getInitFxn', function (test) {
	test.equal(typeof rx.getInitFxn, 'function', 'should be an rx.function')

	const appInit0 = rx.getInitFxn(
		class AppCls0 {
			constructor(opts) {
				this.opts = opts
			}
		}
	)
	test.equal(typeof appInit0, 'function', 'returned value should be a function')

	const opts = {}
	const obj0 = appInit0(opts)
	test.deepEqual(obj0.opts, opts, 'should pass the only argument to object constructor')
	test.equal(obj0.constructor.name, 'AppCls0', 'should return the object itself if it has no .api')
	test.equal(Object.isFrozen(obj0), true, 'should return a frozen object if it has no .api')

	const appInit1 = rx.getInitFxn(
		class AppCls1 {
			constructor(opts) {
				this.opts = opts
				this.api = opts.api
			}
		}
	)
	const opts1a = { api: { main() {} } }
	const obj1a = appInit1(opts1a)
	test.equal(obj1a, opts1a.api, "should return this object's api if constructed")
	test.equal(obj1a.Inner, undefined, 'should not create an api.Inner when debug==false')
	test.equal(Object.isFrozen(obj1a), true, 'should return the frozen api when constructed with an .api')

	const opts1b = { api: { main() {} }, debug: 1 }
	const obj1b = appInit1(opts1b)
	test.equal(obj1b.Inner && obj1b.Inner.constructor.name, 'AppCls1', 'should create an api.Inner when debug==true')
	test.end()
})

tape('getComponentApi', async function (test) {
	test.equal(typeof rx.ComponentApi.getInitFxn, 'function', 'should be an rx.function')

	const partInit = rx.ComponentApi.getInitFxn(TestPart)
	const opts = {
		app: {
			opts: {
				state: { abc: 123 },
				debug: 1
			}
		},
		getApi: rx.ComponentApi.getInitFxn
	}
	const part0 = await partInit(opts)
	test.equal('type' in part0, true, 'should have an api.type property, even if undefined)')
	test.equal('id' in part0, true, 'should set an api.id property, even if undefined')
	test.equal(typeof part0.update, 'function', 'should provide an update() method')
	test.equal(typeof part0.on, 'function', 'should provide an on() method')
	test.equal(typeof part0.getComponents, 'function', 'should provide a getComponents() method')
	test.equal(typeof part0.detectStale, 'function', 'should provide a detectStale() method')
	test.end()
})

tape('getAppApi', async function (test) {
	test.equal(typeof rx.AppApi.getInitFxn, 'function', 'should be an rx.function')

	const appInit = await rx.AppApi.getInitFxn(TestApp)
	const opts = {}
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

/* 
	integrated tests for rx.methods, where the
	reactive update flow calls various rx apis
	and methods
*/
tape('Reactive flow', async function (test) {
	test.timeoutAfter(100)
	test.plan(8)

	const comp1 = {
		type: 'type1',
		update(current, data) {
			const action = current.action
			if (!updateTests[action.type]) {
				test.fail(`missing test for action.type=${action.type}`)
			} else {
				updateTests[action.type](action, data)
			}
		},
		Inner: {
			getState(appState) {
				return appState.prop
			}
		}
	}
	class Comp2 {
		static type = 'comp2'
		constructor() {
			this.type = Comp2.type
		}
		reactsTo(action) {
			return action.type.startsWith('todo') || action.type.startsWith('prop')
		}
		getState(appState) {
			return appState
		}
		main() {}
	}
	Comp2.initFxn = await rx.ComponentApi.getInitFxn(Comp2)

	const arg0 = {
		getApi: rx.AppApi.getInitFxn,
		storeInit: await rx.StoreApi.getInitFxn(TestStore),
		components: {
			comp1,
			comp2: Comp2
		},
		debug: 1
	}
	const appInit = await rx.AppApi.getInitFxn(TestApp)
	const app = await appInit(arg0)

	const todo = { id: 1 }
	const updateTests = {}

	// save() should not cause notification of child components
	updateTests.todo_add = (action, data) => {
		test.fail('must not notify a sub-component with save()')
	}
	const action_add = { type: 'todo_add', todo }
	await app.save(action_add)
	test.deepEqual(
		app.getState().todos.length && app.getState().todos[0],
		todo,
		'save() should result in the expected state change'
	)
	test.equal(Object.isFrozen(app.getState()), true, 'should have a frozen state from app.getState()')
	test.deepEqual(
		comp1.Inner.getState(app.getState()),
		app.Inner.state.prop,
		'should return the expected subState for a component'
	)
	test.equal(
		Object.isFrozen(comp1.Inner.getState(app.getState())),
		true,
		'should have a frozen state from app.getState()'
	)

	// comp1.type == 'type1', which only reacts to todo_* and prop_*
	const action_fake = { type: 'fake_add', todo }
	updateTests.fake_add = (action, data) => {
		test.equal(
			action,
			action_fake,
			'dispatch() should trigger component.api.update() but not necessarily component.main()'
		)
	}
	const comp2 = app.getComponents('comp2').Inner
	comp2.main = function (state, data) {
		test.fail(`must not trigger component.main() when its type's reactsTo.prefix is not matched`)
	}
	await app.dispatch(action_fake)
	comp2.main = () => {} // tear-down for next tests

	// should cause child component notification wtih null data
	updateTests.todo_remove = (action, data) => {
		test.equal(
			action,
			action_remove,
			'dispatch() should notify a subcomponent of a dispatched action via its api.update'
		)
		/*** DEPRECATED: all components will request its own data instead of the option for a parent to provide it ***/
		//test.equal(data, null, 'dispatch() should notify a subcomponent with null data if not returned by app.main()')
	}
	const action_remove = { type: 'todo_remove', todo }
	await app.dispatch(action_remove)
	test.deepEqual(app.getState().todos.length, 0, 'dispatch() should result in the expected state change')

	// should cause child component notification wtih actual data
	updateTests.prop_edit = (action, data) => {
		/*** DEPRECATED: all components will request its own data instead of the option for a parent to provide it ***/
		// test.equal(data, action_edit.prop, 'dispatch() should notify a sub-component with data if returned by app.main()')
	}
	comp2.bus = {
		emit(eventType) {
			test.equal(eventType, 'postRender', 'dispatch() should trigger an emitted postRender event on component update')
		}
	}
	const action_edit = { type: 'prop_edit', prop: 'abc' }
	await app.dispatch(action_edit)
})
