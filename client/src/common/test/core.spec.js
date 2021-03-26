import tape from 'tape'
import * as rx from '../rx.core'

/*************************
 reusable helper functions
**************************/

class TestApp {
	constructor(arg, opts) {
		this.type = 'app'
		this.arg = arg
		this.opts = opts
		if (arg.api) this.api = arg.api
		else if (arg.getApi) this.api = arg.getApi(this)

		if (arg.storeInit) {
			this.store = arg.storeInit(this)
			this.state = this.store.copyState()
		}
		if (arg.components) {
			this.components = arg.components
			for (const name in this.components) {
				if (!this.components[name].app) {
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
	constructor(app) {
		this.app = app
		this.api = rx.getStoreApi(this)
		this.copyMerge = rx.copyMerge
		this.deepFreeze = rx.deepFreeze
		this.fromJson = rx.fromJson // used in store.api.state()
		this.toJson = rx.toJson // used in store.api.state()
		this.state = app.opts.state
			? app.opts.state
			: {
					prop: 'xyz',
					todos: []
			  }
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
	constructor(app, opts = {}) {
		this.type = 'part'
		this.app = app
		this.opts = opts

		if (opts.api) this.api = opts.api
		else if (opts.getApi) this.api = opts.getApi(this)

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

tape('\n', function(test) {
	test.pass('-***- rx.core -***-')
	test.end()
})

tape('getInitFxn', function(test) {
	test.equal(typeof rx.getInitFxn, 'function', 'should be an rx.function')

	const appInit = rx.getInitFxn(TestApp)
	test.equal(typeof appInit, 'function', 'returned value should be a function')

	const arg0 = {}
	const opts = {}
	const obj0 = appInit(arg0, opts)
	test.equal(obj0.arg, arg0, 'should pass the first argument to object constructor')
	test.equal(obj0.opts, opts, 'should pass the second argument to object constructor')
	test.equal(obj0.constructor.name, 'TestApp', 'should return the object itself if it has no .api')
	test.equal(Object.isFrozen(obj0), true, 'should return the frozen object if it has no .api')

	const api1 = {}
	const arg1 = { api: api1 }
	const obj1 = appInit(arg1, {})
	test.equal(obj1, api1, "should return this object's api if constructed")
	test.equal(obj1.Inner, undefined, 'should not create an api.Inner when debug==false')
	test.equal(Object.isFrozen(obj1), true, 'should return the frozen api when constructed with an .api')

	const api2 = {}
	const arg2 = { api: api2 }
	const obj2 = appInit(arg2, { debug: 1 })
	test.equal(obj2, api2, "should return this object's api if constructed when debug==true")
	test.equal(obj2.Inner && obj2.Inner.constructor.name, 'TestApp', 'should create an api.Inner when debug==false')

	test.end()
})

tape('getStoreApi', function(test) {
	test.equal(typeof rx.getStoreApi, 'function', 'should be an rx.function')

	const storeInit = rx.getInitFxn(TestStore)
	const app = {
		opts: {
			state: { abc: 123 },
			debug: 1
		}
	}
	const store0 = storeInit(app)
	test.equal(typeof store0.write, 'function', 'should provide a write() method')
	test.equal(typeof store0.copyState, 'function', 'should provide a copyState() method')
	test.equal(store0.Inner.state, app.opts.state, 'should have the expected initial state')
	test.equal(Object.isFrozen(store0), true, 'should produce a frozen api')
	test.end()
})

tape('getComponentApi', function(test) {
	test.equal(typeof rx.getComponentApi, 'function', 'should be an rx.function')

	const partInit = rx.getInitFxn(TestPart)
	const app = {
		opts: {
			state: { abc: 123 },
			debug: 1
		}
	}
	const opts = {
		getApi: rx.getComponentApi
	}
	const part0 = partInit(app, opts)
	test.equal('type' in part0, true, 'should have an api.type property, even if undefine)')
	test.equal('id' in part0, true, 'should set an api.id property, even if undefined')
	test.equal(typeof part0.update, 'function', 'should provide an update() method')
	test.equal(typeof part0.on, 'function', 'should provide an on() method')
	test.equal(typeof part0.getComponents, 'function', 'should provide a getComponents() method')
	test.end()
})

tape('getAppApi', function(test) {
	test.equal(typeof rx.getAppApi, 'function', 'should be an rx.function')

	const appInit = rx.getInitFxn(TestApp)
	const arg0 = { getApi: rx.getAppApi }
	const opts = {}
	const api0 = appInit(arg0, opts)
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
tape('Reactive flow', async function(test) {
	test.timeoutAfter(100)
	test.plan(10)

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
	const comp2 = {
		type: 'type1',
		reactsTo(action) {
			return action.type.startsWith('todo') || action.type.startsWith('prop')
		},
		getState(appState) {
			return appState
		},
		main() {}
	}
	comp2.api = rx.getComponentApi(comp2)

	const arg0 = {
		getApi: rx.getAppApi,
		storeInit: rx.getInitFxn(TestStore),
		components: {
			comp1,
			comp2: comp2.api
		}
	}
	const appInit = rx.getInitFxn(TestApp)
	const app = appInit(arg0, { debug: 1 })

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
	comp2.main = function(state, data) {
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
		test.equal(data, null, 'dispatch() should notify a subcomponent with null data if not returned by app.main()')
	}
	const action_remove = { type: 'todo_remove', todo }
	await app.dispatch(action_remove)
	test.deepEqual(app.getState().todos.length, 0, 'dispatch() should result in the expected state change')

	// should cause child component notification wtih actual data
	updateTests.prop_edit = (action, data) => {
		test.equal(data, action_edit.prop, 'dispatch() should notify a sub-component with data if returned by app.main()')
	}
	comp2.bus = {
		emit(eventType) {
			test.equal(eventType, 'postRender', 'dispatch() should trigger an emitted postRender event on component update')
		}
	}
	const action_edit = { type: 'prop_edit', prop: 'abc' }
	await app.dispatch(action_edit)
})

tape('copyMerge', function(test) {
	const target = {
		setting: {
			color: 'red'
		},
		arr: ['x', 'y', 'z'],
		keyNotInSource: 'test'
	}
	const source = {
		name: 'name',
		setting: {
			color: 'blue',
			height: 100
		},
		arr: ['a', 'b']
	}
	const obj = rx.copyMerge(target, source)
	test.true('keyNotInSource' in obj, 'should keep target object key-values when the key is not in the source object')
	test.deepEqual(
		Object.keys(obj),
		['setting', 'arr', 'keyNotInSource', 'name'],
		'should extend the target object with new keys from the source object'
	)
	test.deepEqual(obj.setting, source.setting, 'should merge source nested key-values to target object')
	test.deepEqual(obj.arr, source.arr, 'should replace a target array value with the corresponding source array value')

	const target1 = {
		settings: {
			color: 'red'
		}
	}
	const source1 = { settings: { a: 1 } }
	test.deepEqual(
		rx.copyMerge(target1, source1, ['settings']).settings,
		source1.settings,
		'should replace a target object value instead of extending it, if the last argument is an array with a matching key'
	)

	test.end()
})

tape('matchAction', function(test) {
	// no "against" specified
	test.true(rx.matchAction({ type: 'plot_show' }, {}), "against={} should return true for empty 'against' argument")

	// prefix only
	test.true(
		rx.matchAction({ type: 'plot_show' }, { prefix: ['...', 'plot'] }),
		'against={prefix} should return true if action.type starts with any of the prefix values'
	)
	test.false(
		rx.matchAction({ type: 'plot_show' }, { prefix: ['...', 'xyz'] }),
		'against={prefix} should return false if action.type does not start with any of the prefix values'
	)

	// type only
	test.true(
		rx.matchAction({ type: 'plot_show' }, { type: ['...', 'plot_show'] }),
		'against={type} should return true if action.type equals any of the type values'
	)
	test.false(
		rx.matchAction({ type: 'plot_show' }, { type: ['...', 'plot'] }),
		'against={type} should return false if action.type does not equal any of the type values'
	)

	// fxn only
	test.true(
		rx.matchAction({ type: 'plot_show' }, { fxn: () => true }),
		'against={fxn} should return true per the function'
	)
	test.false(
		rx.matchAction({ type: 'plot_show' }, { fxn: () => false }),
		'against={fxn} should return false per the function'
	)

	// specified prefix and type
	test.true(
		rx.matchAction({ type: 'test_show' }, { prefix: ['test'], type: ['...', 'plot_show'] }),
		'against={prefix, type} should return true if either one matches'
	)
	test.false(
		rx.matchAction({ type: 'plot_show' }, { prefix: ['test'], type: ['...', 'plot'] }),
		'against={prefix, type} should return false if both does not match'
	)

	// specified prefix and type and action
	test.true(
		rx.matchAction({ type: 'test_show' }, { prefix: ['test'], type: ['...', 'plot_show'], fxn: () => true }),
		'against={prefix, type, fxn} should return true if either prefix/type matches and fxn returns true'
	)
	test.true(
		rx.matchAction({ type: 'test_show' }, { prefix: ['test'], type: ['...', 'plot_show'], fxn: () => true }),
		'against={prefix, type, fxn} should return false if fxn returns false, regardless of matched prefix or type'
	)
	test.end()
})
