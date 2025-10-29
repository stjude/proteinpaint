import { type ComponentApi } from './ComponentApi.ts'
import { Bus } from './Bus.ts'
import { notifyComponents, getComponents } from './utils.ts'

export interface RxApp {
	type: string
	api?: AppApi
	id: any
	opts: any
	state: any
	store: any
	debug?: boolean
	// should require dom to automate destroy()
	dom: {
		[index: string]: any
	}
	components: ComponentApi[] | { [name: string]: ComponentApi | { [name: string]: ComponentApi } }
	preApiFreeze?: (api: AppApi) => Promise<void>
	init: () => Promise<void>
	reactsTo?: (action: { type: string; [key: string]: any }) => boolean
	getState?: (appState: any) => any
	hasStatePreMain?: boolean
	main: (arg?: any) => void
	mainArg?: any
	printError?: (any) => void
	destroy?: () => void

	bus: Bus
	eventTypes?: string[]
	customEvents?: string[]
	wasDestroyed: boolean
}

export class AppApi {
	type = 'app'
	id: string
	opts: any
	vocabApi: any
	#App: RxApp
	Inner?: RxApp // only in debugmode
	#middlewares: any[] = []
	state: any

	#latestActionSequenceId: number
	#abortControllers: Set<AbortController>
	#componentsByType: {
		[chartType: string]: {
			[plotId: string]: ComponentApi
		}
	} = {}

	static getInitFxn(__Class__) {
		return async opts => {
			const api = new AppApi(opts, __Class__)
			await api.init()
			return api
		}
	}

	constructor(opts, __Class__) {
		// the component type + id may be used later to
		// simplify getting its state from the store
		const self: RxApp = new __Class__(opts)
		self.opts = opts
		if (!self.id) self.id = opts.id || self.opts?.id
		if (!self.type) self.type = __Class__.type
		self.api = this

		this.#App = self
		this.id = self.id
		this.type = self.type || __Class__.type
		this.opts = opts

		// make it easy to access the private instance in debug mode, for testing
		if (self.debug || (self.opts && self.opts.debug)) this.Inner = self

		if (!self.eventTypes) self.eventTypes = ['preDispatch', 'postInit', 'postRender', 'firstRender', 'error']
		if (self.customEvents) self.eventTypes.push(...self.customEvents)
		self.bus = new Bus(this, self.eventTypes, opts.callbacks)

		this.#latestActionSequenceId = 0
		this.#abortControllers = new Set()
	}

	async init() {
		if (this.#App.preApiFreeze) await this.#App.preApiFreeze(this)
		await this.#App.init()
		if (this.#App.bus) this.#App.bus.emit('postInit')
	}

	async dispatch(action?: any) {
		const self = this.#App
		self.bus.emit('preDispatch')
		try {
			if (this.#middlewares.length) {
				for (const fxn of this.#middlewares.slice()) {
					const result = await fxn(action)
					if (result) {
						if (result.cancel) return
						if (result.error) throw result.error
						if (result.deactivate) {
							this.#middlewares.splice(this.#middlewares.indexOf(fxn), 1)
						}
					}
				}
			}

			// expect store.write() to be debounced and handle rapid succession of dispatches
			// replace app.state if there is an action
			if (action) self.state = await self.store.write(action)
			this.#latestActionSequenceId = action?.sequenceId
			// TODO: may need to group calls to this.main by action type and plot.id,
			// in order to debounce correctly
			if (self.main) await self.main()
			const current = { action, appState: self.state }
			await notifyComponents(current.action?._notificationRoot_ || self.components, current)
		} catch (e) {
			if (self.wasDestroyed) return
			if (self.bus && this.#latestActionSequenceId == action?.sequenceId) self.bus.emit('error')
			if (self.printError) self.printError(e)
			else console.log(e)
		}
		// do not emit a postRender event if the action has become stale
		if (self.bus && this.#latestActionSequenceId == action?.sequenceId) self.bus.emit('postRender')
	}

	// action: RxAction
	async save(action) {
		const self = this.#App
		if (self.wasDestroyed) return
		// save changes to store, do not notify components
		self.state = await self.store.write(action)
		// TODO: may generalize to use the key instead of hardcoding to only .recover
		if (this.#componentsByType.recover) {
			for (const id in this.#componentsByType.recover) {
				const api = this.#componentsByType.recover[id]
				// note: store.write() returns a frozen state, so safe to pass as argument
				if (api.replaceLastState) api.replaceLastState(self.state)
			}
		}
	}

	getState() {
		return this.#App.state
	}
	// fxn: RxAction => void
	middle(fxn) {
		/*
		add #middlewares prior to calling dispatch()
		
		fxn(action: RxAction) 
		- called in the order of being added to #middlewares array
		- must accept an action{} argument
		- do not return any value to eventually reach dispatch()
		  - OR -
		- optionally return an object{}
			.error: "string" will throw
			.cancel: true will cancel dispatch
			.deactivate: true will remove the fxn from the #middlewares array
		*/
		if (typeof fxn !== 'function') throw `a middleware must be a function`
		if (this.#middlewares.includes(fxn)) throw `the function is already in the #middlewares array`
		this.#middlewares.push(fxn)
		return this
	}

	// must not expose this.bus directly since that
	// will also expose bus.emit() which should only
	// be triggered by this component
	on(eventType, callback) {
		const self = this.#App
		if (!self.eventTypes) throw `no eventTypes[] for ${self.type} component`
		self.bus.on(eventType, callback)
		return this
	}

	getComponents(dotSepNames = '') {
		return getComponents(this.#App.components, dotSepNames)
	}

	register(api) {
		if (!this.#componentsByType[api.type]) this.#componentsByType[api.type] = {}
		this.#componentsByType[api.type][api.id] = api
	}

	deregister(api) {
		if (this.#componentsByType[api.type]?.[api.id]) delete this.#componentsByType[api.type][api.id]
	}

	triggerAbort(reason = '') {
		const self = this.#App
		if (reason) if (reason) console.info(`triggerAbort()`, reason)
		for (const name of Object.keys(self.components)) {
			const component = self.components[name]
			if (!component) continue
			if (Array.isArray(component)) {
				for (const c of component) c.triggerAbort()
			} else if (typeof component == 'object') {
				if (Object.keys(component).includes('triggerAbort')) {
					component.triggerAbort()
				} else if (!component.main) {
					for (const subname of Object.keys(component)) {
						if (typeof component[subname].triggerAbort == 'function') {
							component[subname].triggerAbort()
						}
					}
				}
			}
		}
	}

	destroy() {
		const self = this.#App
		// delete references to other objects to make it easier
		// for automatic garbage collection to find unreferenced objects
		for (const key in self.components) {
			const component = self.components[key]
			if (typeof component.destroy == 'function') {
				component.destroy()
			} else if (component.holder) {
				component.holder.selectAll('*').remove()
			}
			delete self.components[key]
		}
		if (typeof self.destroy == 'function') self.destroy()
		if (self.dom) {
			if (self.dom.holder) self.dom.holder.selectAll('*').remove()
			for (const key in self.dom) {
				delete self.dom[key]
			}
		}
		if (self.bus) self.bus.destroy()
		delete self.store
		if (self.api) delete self.api
		self.wasDestroyed = true
	}

	printError(e) {
		if (this.#App.printError) this.#App.printError(e)
		else alert(e)
	}
}
