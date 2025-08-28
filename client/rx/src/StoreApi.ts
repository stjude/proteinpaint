export interface RxStoreInner {
	type: string
	api?: StoreApi
	id: any
	parentId?: string
	opts: any
	defaultState: any
	state: any
	debug?: boolean
	sequenceId: number
	numPromisedWrites: number

	init: () => void
	validateState?: () => void
	fromJson: (s: string) => any
	toJson: (o: any) => string
	deepFreeze: (o: any) => void
	copyMerge: (_, __) => any
}

export class StoreApi {
	type: string
	id?: string
	opts: any

	#Inner: RxStoreInner
	Inner?: RxStoreInner // only in debugmode

	static getInitFxn(__Class__) {
		return async opts => {
			const api = new StoreApi(opts, __Class__)
			await api.init()
			return api
		}
	}

	constructor(_opts, __Class__) {
		const opts = this.#validateOpts(_opts, __Class__)
		//this.app = opts.app
		//this.opts = opts
		// the component type + id may be used later to
		// simplify getting its state from the store
		const self: RxStoreInner = new __Class__(opts, this)
		//self.opts = opts
		//self.app = opts.app
		if (!self.id) self.id = opts.id || self.opts?.id
		if (!self.type) self.type = __Class__.type
		self.api = this
		this.#Inner = self
		this.id = self.id
		this.type = self.type || __Class__.type

		// make it easy to access the private instance in debug mode, for testing
		if (self.debug || self.opts?.debug) this.Inner = self
	}

	#validateOpts(opts, __Class__) {
		const optKeys = Object.keys(opts)
		if (!optKeys.includes('app')) throw `missing opts.app`
		if (!optKeys.includes('debug')) opts.debug = opts.app.debug ?? opts.app.opts?.debug ?? false
		return opts
	}

	async init() {
		if (this.#Inner.init) await this.#Inner.init()
		if (this.#Inner.validateState) this.#Inner.validateState()
		Object.freeze(this)
	}

	async write(action) {
		const self = this.#Inner

		// to allow an app or chart code to fail due to race condition,
		// hardcode a constant value or comment out the ++ for the sequenceID
		// !!! CRITICAL TO INCREMENT THIS !!!
		action.sequenceId = this.#Inner.sequenceId++
		// avoid calls to inherited methods
		const actions = self.constructor.prototype.actions
		if (!actions) {
			throw `no store actions specified`
		}
		if (!Object.keys(actions).includes(action.type)) {
			throw `Action=${action.type} must be declared in an "actions" property of a class.`
		}
		if (typeof actions[action.type] !== 'function') {
			throw `invalid action type=${action.type}`
		}
		await actions[action.type].call(self, action)
		// quick fix?? add custom state properties to the state to trigger special action-related handling
		// _scope_:
		self.state._scope_ = action._scope_
		if (!self.opts.debounceInterval) return this.copyState()

		// track the #
		self.numPromisedWrites += 1
		let decrement = -1
		return new Promise(resolve => {
			const interval = setInterval(() => {
				self.numPromisedWrites += decrement
				decrement = 0
				if (self.numPromisedWrites > 0) return
				clearInterval(interval)
				resolve(this.copyState())
			}, self.opts.debounceInterval)
		})
	}

	async copyState() {
		const self = this.#Inner
		const stateCopy = self.fromJson(self.toJson(self.state))
		self.deepFreeze(stateCopy)
		return stateCopy
	}
}
