import type { AppApi } from './AppApi.ts'
import { deepEqual, notifyComponents, copyMerge } from './utils.ts'
import { Bus } from './Bus.ts'

export interface RxComponentInner {
	type: string
	api?: any
	app: AppApi
	id: any
	parentId?: string

	opts: any
	state: any
	// should require dom to automate destroy()
	dom: {
		[index: string]: any
	}
	components?: ComponentApi[] | { [name: string]: ComponentApi }
	init?: (appState: any) => void
	reactsTo?: (action: { type: string; [key: string]: any }) => boolean
	getState: (appState: any) => any
	hasStatePreMain?: boolean
	main: (arg?: any) => void
	mainArg?: any
	printError?: (any) => void
	destroy?: () => void

	bus?: any
	eventTypes?: string[]
	customEvents?: string[]
}

export class ComponentApi {
	type: string
	id?: string
	app: AppApi
	opts: any

	#Inner: RxComponentInner
	Inner?: RxComponentInner // only in debugmode
	#latestActionSequenceId: number
	#abortControllers: Set<AbortController>
	#bus: Bus

	static getInitFxn(__Class__) {
		return async opts => {
			const api = new ComponentApi(opts, __Class__)
			await api.init()
			return api
		}
	}

	constructor(_opts, __Class__) {
		const opts = this.#validateOpts(_opts, __Class__)
		this.app = opts.app
		this.opts = opts
		// the component type + id may be used later to
		// simplify getting its state from the store
		this.id = opts.id
		const Inner = new __Class__(opts)
		this.#Inner = Inner
		this.type = Inner.type || __Class__.type
		Inner.opts = opts
		Inner.id = opts.id
		Inner.app = opts.app
		Inner.api = this
		if (Inner.debug || (Inner.opts && Inner.opts.debug)) this.Inner = Inner

		if (!Inner.eventTypes) Inner.eventTypes = ['preDispatch', 'postInit', 'postRender', 'firstRender', 'error']
		if (this.#Inner.customEvents) Inner.eventTypes.push(...Inner.customEvents)
		Inner.bus = new Bus(this, Inner.eventTypes, opts.callbacks)

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
		const self = this.#Inner
		if (!self.init) return
		await self.init(this.app.getState())
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
		const self = this.#Inner
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
		} catch (e) {
			if (self.printError) self.printError(e)
			else if (self.dom?.errdiv) throw { message: e.message || e.error || e, errdiv: self.dom?.errdiv }
			else throw e
		}
	}

	// must not expose self.bus directly since that
	// will also expose bus.emit() which should only
	// be triggered by this component
	on(eventType, callback) {
		const self = this.#Inner
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
		const self = this.#Inner
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
		const self = this.#Inner
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
}
