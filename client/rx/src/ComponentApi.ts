import type { AppApi } from './AppApi.ts'
import { deepEqual, notifyComponents, copyMerge, getComponents } from './utils.ts'
import { Bus } from './Bus.ts'

export interface RxComponent {
	type: string
	api?: ComponentApi
	app: AppApi
	id: any
	parentId?: string
	opts: any
	state: any
	debug?: boolean
	// should require dom to automate destroy()
	dom: {
		[index: string]: any
	}
	components?: ComponentApi[] | { [name: string]: ComponentApi | { [name: string]: ComponentApi } }
	preApiFreeze?: (api: ComponentApi) => void
	init?: (appState: any) => Promise<void>
	reactsTo?: (action: { type: string; [key: string]: any }) => boolean
	getState?: (appState: any) => any
	hasStatePreMain?: boolean
	main: (arg?: any) => void
	mainArg?: any
	printError?: (any) => void
	destroy?: () => void
	getChartImages?: () => any

	bus?: any
	eventTypes?: string[]
	customEvents?: string[]
}

export class ComponentApi {
	type: string
	id?: string

	#Component: RxComponent
	Inner?: RxComponent // only in debugmode
	#latestActionSequenceId: number
	#abortControllers: Set<AbortController>
	#bus?: Bus

	static getInitFxn(__Class__) {
		return async opts => {
			const api = new ComponentApi(opts, __Class__)
			await api.init()
			return api
		}
	}

	constructor(_opts, __Class__) {
		const opts = this.#validateOpts(_opts, __Class__)
		// the component type + id may be used later to
		// simplify getting its state from the store
		const self: RxComponent = new __Class__(opts, this)
		self.opts = opts
		if (!self.id) self.id = opts.id || self.opts?.id
		if (!self.type) self.type = __Class__.type
		self.app = opts.app
		self.api = this

		this.#Component = self
		this.id = self.id
		this.type = self.type || __Class__.type

		// make it easy to access the private instance in debug mode, for testing
		if (self.debug || (self.opts && self.opts.debug)) this.Inner = self

		if (!self.eventTypes) self.eventTypes = ['preDispatch', 'postInit', 'postRender', 'firstRender', 'error']
		if (self.customEvents) self.eventTypes.push(...self.customEvents)
		self.bus = new Bus(this, self.eventTypes, opts.callbacks)

		this.#latestActionSequenceId = 0
		this.#abortControllers = new Set()
	}

	#validateOpts(opts, __Class__) {
		const optKeys = Object.keys(opts)
		if (!optKeys.includes('app')) throw `missing opts.app`
		if (!optKeys.includes('debug')) opts.debug = opts.app.debug ?? opts.app.opts?.debug ?? false
		if (__Class__.type && opts.app.opts?.[__Class__.type]) {
			copyMerge(opts, opts.app.opts[__Class__.type])
		}
		return opts
	}

	async init() {
		const self = this.#Component
		// an instance may want to add or modify api properties before it is frozen
		if (self.preApiFreeze) await self.preApiFreeze(this)
		// freeze the api's properties and methods before exposing
		Object.freeze(this)

		if (self.init) await self.init(this.#Component.app.getState())
		// lessen confusing behavior
		if (self.state && !self.hasStatePreMain) {
			delete self.state
			console.warn(
				`${self.type}: rx deleted this.state after init()` +
					`to avoid confusing behavior, such as the component not rendering initially ` +
					`because this.state would not have changed between init() and the first time ` +
					`main() is called. To skip this warning and retain this.state after init(), ` +
					`set this.hasStatePreMain = true in the ${self.type} constructor.`
			)
		}
	}

	// current: {action: RxAction, appState}
	async update(current) {
		const self = this.#Component
		if (current.action && self.reactsTo && !self.reactsTo(current.action)) return
		const componentState = self.getState ? self.getState(current.appState) : current.appState
		// no new state computed for this component
		if (!componentState) return
		// force update if there is no action, or
		// if the current and pending state is not equal
		if (!current.action || !deepEqual(componentState, self.state)) {
			if (current.action) this.#latestActionSequenceId = current.action.sequenceId
			if (self.mainArg == 'state') {
				// some components may require passing state to its .main() method,
				// for example when extending a simple object class into an rx-component
				await self.main(componentState)
			} else {
				self.state = componentState
				if (self.main) {
					try {
						await self.main()
					} catch (e) {
						if (self.bus) self.bus.emit('error')
						throw e
					}
				}
			}
		}
		try {
			// notify children
			await notifyComponents(self.components, current)
			if (self.bus && (!current.action || current.action.sequenceId === this.#latestActionSequenceId))
				self.bus.emit('postRender')
			return this
		} catch (e: any) {
			if (self.printError) self.printError(e)
			else if (self.dom?.errdiv) throw { message: e.message || e.error || e, errdiv: self.dom?.errdiv }
			else throw e
		}
	}

	getComponents(dotSepNames = '') {
		return getComponents(this.#Component.components, dotSepNames)
	}

	// must not expose self.bus directly since that
	// will also expose bus.emit() which should only
	// be triggered by this component
	on(eventType, callback) {
		const self = this.#Component
		if (!self.eventTypes) throw `no eventTypes[] for ${self.type} component`
		self.bus.on(eventType, callback)
		return this
	}

	// getComponents(dotSepNames = '') {
	// 	return getComponents(self.components, dotSepNames)
	// }
	//

	// When an async function takes a while to resolve, such as for server requests,
	// a subsequent action may trigger another request before the first one resolves,
	// in that case should ignore the stale response/result from the async function.
	// This is an api function so that code that has access to this component api
	// can also tie-in a function call to the fresheness of the component action.
	//
	async detectStale(asyncFxn, opts: { abortCtrl?: AbortController; wait?: number } = {}) {
		const abortControllers = this.#abortControllers
		//let errMsg = ''
		try {
			const actionSequenceId = this.#latestActionSequenceId
			const promises: Promise<any>[] = []
			let i, promResolve
			if (opts.abortCtrl) {
				abortControllers.add(opts.abortCtrl)
				promises.push(
					new Promise((resolve, reject) => {
						promResolve = resolve
						i = setInterval(() => {
							if (actionSequenceId !== this.#latestActionSequenceId) {
								clearInterval(i)
								try {
									opts.abortCtrl?.abort()
									throw `stale sequenceId`
								} catch (e) {
									reject(e)
								}
							}
						}, opts.wait || 100)
					})
				)
			}
			promises.push(asyncFxn())
			// the setInterval does not resolve, so Promise.race can only be "won" by the asyncFxn() result,
			// but the race can be aborted by the reject() inside the setInterval
			const result = await Promise.race(promises)
			if (i) clearInterval(i)
			if (promResolve) promResolve()
			if (opts.abortCtrl && abortControllers.has(opts.abortCtrl)) abortControllers.delete(opts.abortCtrl)
			if (this.#latestActionSequenceId !== actionSequenceId) {
				// another state change has been dispatched between the start and completion of the server request
				console.warn('aborted state update, the returned data corresponds to a stale action.sequenceId')
				if (opts.abortCtrl) opts.abortCtrl.abort()
				return [result, true]
			}
			return [result]
		} catch (e) {
			if (typeof e == 'string' && e.includes('sequenceId')) console.warn(e)
			throw e
		}
	}

	triggerAbort(reason = '') {
		if (reason) console.info(`triggerAbort()`, reason)
		for (const c of this.#abortControllers.values()) {
			try {
				c.abort()
				this.#abortControllers.delete(c)
			} catch (e) {
				// ok to
				console.warn('unable to cancel fetch: ', e)
				this.#abortControllers.delete(c)
			}
		}
		const self = this.#Component
		if (!self.components) return
		for (const name of Object.keys(self.components)) {
			const component = self.components[name]
			if (Array.isArray(component)) {
				for (const c of component) c.triggerAbort()
			} else if (Object.keys(component).includes('triggerAbort')) {
				component.triggerAbort()
			} else if (component && typeof component == 'object' && !component.main) {
				for (const subname of Object.keys(component)) {
					if (typeof component[subname].triggerAbort == 'function') {
						component[subname].triggerAbort()
					}
				}
			}
		}
	}

	destroy() {
		const self = this.#Component
		// delete references to other objects to make it easier
		// for automatic garbage collection to find unreferenced objects
		self.app.deregister(self.api)
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
				if (typeof self.dom[key]?.remove == 'function') self.dom[key].remove()
				delete self.dom[key]
			}
		}
		if (self.bus) self.bus.destroy()
		if (self.api) delete self.api
	}

	// defaults for optional preApiFreeze addons
	replaceLastState(_) {}

	getChartImages() {
		return this.#Component.getChartImages ? this.#Component.getChartImages() : null
	}
}
