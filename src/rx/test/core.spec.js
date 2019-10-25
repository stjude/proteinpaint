const tape = require('tape')
const rx = require('../../rx.core')

/*************************
 reusable helper functions
**************************/

class TestApp {
	constructor(arg, opts) {
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
			for(const name in this.components) {
				if (!this.components[name].app) {
					this.components[name].app = this.api
				}
			}
		}
	}
	main(state) {
		this.state = state
		if (this.state.prop !== "xyz") return this.state.prop
	}
}

TestApp.prototype.subState = {
	type1: {
		get(appState, sub) {
			return appState.prop
		}
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
		this.state = app.opts.state ? app.opts.state : {
			prop: 'xyz',
			todos: []
		}
	}
}

class TestPart {
	constructor(app, opts={}) {
		this.app = app
		this.opts = opts

		if (opts.api) this.api = opts.api
		else if (opts.getApi) this.api = opts.getApi(this)
		
		if (opts.components) this.components = opts.components
	}
	main(state) {
		this.state = state
		if (this.state.prop !== "xyz") return this.state.prop
	}
}

TestStore.prototype.actions = {
	todo_add(action) {
		const i = this.state.todos.findIndex(d=>d.id == action.todo.id)
		if (i == -1) {
			this.state.todos.push(action.todo)
		}
	},
	todo_remove(action) {
		const i = this.state.todos.findIndex(d=>d.id == action.todo.id)
		if (i !== -1) {
			this.state.todos.splice(i, 1)
		}
	},
	prop_edit(action) {
		this.state.prop = action.prop
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
	test.equal(typeof rx.getInitFxn, 'function', "should be an rx.function")
	
	const appInit = rx.getInitFxn(TestApp)
	test.equal(typeof appInit, "function", "returned value should be a function")

	const arg0 = {}
	const opts = {}
	const obj0 = appInit(arg0, opts)
	test.equal(obj0.arg, arg0, "should pass the first argument to object constructor")
	test.equal(obj0.opts, opts, "should pass the second argument to object constructor")
	test.equal(obj0.constructor.name, "TestApp", "should return the object itself if it has no .api")
	test.equal(Object.isFrozen(obj0), true, "should return the frozen object if it has no .api")

	const api1 = {}
	const arg1 = {api: api1}
	const obj1 = appInit(arg1, {})
	test.equal(obj1, api1, "should return this object's api if constructed")
	test.equal(obj1.Inner, undefined, "should not create an api.Inner when debug==false")
	test.equal(Object.isFrozen(obj1), true, "should return the frozen api when constructed with an .api")

	const api2 = {}
	const arg2 = {api: api2}
	const obj2 = appInit(arg2, {debug:1})
	test.equal(obj2, api2, "should return this object's api if constructed when debug==true")
	test.equal(obj2.Inner && obj2.Inner.constructor.name, 'TestApp', "should create an api.Inner when debug==false")

	test.end()
})

tape('getStoreApi', function(test) {
	test.equal(typeof rx.getStoreApi, 'function', "should be an rx.function")

	const storeInit = rx.getInitFxn(TestStore)
	const app = {
		opts:{
			state:{abc:123}, 
			debug:1
		}
	}
	const store0 = storeInit(app)
	test.equal(typeof store0.write, 'function', "should provide a write() method")
	test.equal(typeof store0.copyState, 'function', "should provide a copyState() method")
	test.equal(store0.Inner.state, app.opts.state, "should have the expected initial state")
	test.equal(Object.isFrozen(store0), true, "should produce a frozen api")
	test.end()
})

tape('getComponentApi', function(test) {
	test.equal(typeof rx.getComponentApi, 'function', "should be an rx.function")

	const partInit = rx.getInitFxn(TestPart)
	const app = {
		opts:{
			state:{abc:123}, 
			debug:1
		}
	}
	const opts = {
		getApi: rx.getComponentApi
	}
	const part0 = partInit(app, opts)
	test.equal('type' in part0, true, "should have an api.type property, even if undefine)")
	test.equal('id' in part0, true, "should set an api.id property, even if undefined")
	test.equal(typeof part0.update, 'function', "should provide an update() method")
	test.equal(typeof part0.on, 'function', "should provide an on() method")
	test.equal(typeof part0.getComponents, 'function', "should provide a getComponents() method")
	test.end()
})

tape('getAppApi', function(test) {
	test.equal(typeof rx.getAppApi, 'function', "should be an rx.function")

	const appInit = rx.getInitFxn(TestApp)
	const arg0 = {getApi: rx.getAppApi}
	const opts = {}
	const api0 = appInit(arg0, opts)
	test.equal(typeof api0.dispatch, 'function', "should provide a dispatch() method")
	test.equal(typeof api0.save, 'function', "should provide a save() method")
	test.equal(typeof api0.getState, 'function', "should provide a getState() method")
	test.equal(typeof api0.middle, 'function', "should provide a middle() method")
	test.equal(typeof api0.on, 'function', "should provide an on() method")
	test.equal(typeof api0.getComponents, 'function', "should provide a getComponents() method")
	test.equal(api0.opts, opts, "should have an opts property")
	test.end()
})

tape('Reactive flow', async function(test) {
	test.timeoutAfter(100)
	test.plan(7)

	const appInit = rx.getInitFxn(TestApp)
	const comp1 = {
		type: 'type1',
		update(action, data) {
			if (!updateTests[action.type]) {
				test.fail(`missing test for action.type=${action.type}`)
			} else {
				updateTests[action.type](action, data)
			}
		}
	}
	const comp2 = {main() {}}
	comp2.api = rx.getComponentApi(comp2)

	const arg0 = {
		getApi: rx.getAppApi, 
		storeInit: rx.getInitFxn(TestStore),
		components: {
			comp1,
			comp2
		}
	}
	const app = appInit(arg0, {debug: 1})

	const todo = {id: 1}
	const updateTests = {}
	// should not cause notification of child components
	updateTests.todo_add = (action, data) =>{
		test.fail('must not notify a sub-component with save()')
	}
	const action_add = {type: 'todo_add', todo}
	await app.save(action_add)
	test.deepEqual(
		app.getState().todos.length && app.getState().todos[0], 
		todo, 
		"save(action) should result in the expected state change"
	)

	test.deepEqual(
		app.getState(comp1),
		app.Inner.state.prop,
		"should return the expected subState for a component"
	)

	// should cause child component notification wtih null data
	updateTests.todo_remove = (action, data) => {
		test.equal(
			action, 
			action_remove, 
			'should notify a subcomponent of a dispatched action via its api.update'
		)
		test.equal(
			data, 
			null, 
			'should notify a subcomponent with null data if not returned by app.main()'
		)
	}
	const action_remove = {type: 'todo_remove', todo}
	await app.dispatch(action_remove)
	test.deepEqual(
		app.getState().todos.length, 
		0, 
		"dispatch(action) should result in the expected state change"
	)

	// should cause child component notification wtih actual data 
	updateTests.prop_edit = (action, data) => {
		test.equal(
			data, 
			action_edit.prop, 
			'should notify a sub-component with data if returned by app.main()'
		)
	}
	comp2.bus = {
		emit(eventType) {
			test.equal(
				eventType,
				'postRender',
				'should emit a postRender event on component update'
			)
		}
	}
	const action_edit = {type: 'prop_edit', prop: 'abc'}
	await app.dispatch(action_edit)
})
