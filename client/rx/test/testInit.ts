import { AppApi, type RxApp } from '../src/AppApi.ts'
import { StoreApi, type RxStore } from '../src/StoreApi.ts'
import { StoreBase } from '../src/StoreBase.ts'
import { ComponentApi, type RxComponent } from '../src/ComponentApi.js'

/*************************
 reusable helper functions
**************************/

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

export class AppBase {
	//type: string
	//id: string
	opts: any
	id: string
	state: any
	// dom: any
	// config: any

	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.id = opts.id
	}

	validateOpts(opts) {
		return opts
	}
}

class TestApp extends AppBase implements RxApp {
	static type = 'app'

	// expected RxApp, some are already declared/set in AppBase
	api: AppApi
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}

	wasDestroyed = false
	store!: StoreApi
	bus!: any

	// expected class-specific props
	constructor(opts, api) {
		super(opts)
		this.type = 'app'
		this.api = api
	}

	async init() {
		this.store = await storeInit({ app: this.api, state: this.opts.state })
		this.components = {
			part: await partInit({ app: this.api }),
			partAbort: await partAbort({ app: this.api })
		}
	}

	async main() {}
}

export const appInit = AppApi.getInitFxn(TestApp)

class TestStore extends StoreBase implements RxStore {
	static type = 'store'

	// expected RxStore, some are already declared/set in StoreBase
	//app: AppApi
	api: StoreApi
	//type: string

	// expected class-specific props
	defaultState = {
		appWait: 0,
		partWait: 0,
		abortWait: 0
	}
	actions!: {
		[actionType: string]: (action: { type: string; [prop: string]: any }) => void | Promise<void>
	}

	constructor(opts, api) {
		super(opts)
		this.api = api
		this.state = this.copyMerge(this.toJson(this.defaultState), opts.state)
	}

	init() {}
}

TestStore.prototype.actions = {
	app_refresh(this: TestStore, action) {
		this.copyMerge(this.state, action.state)
	}
}

export const storeInit = StoreApi.getInitFxn(TestStore)

class TestPart implements RxComponent {
	static type = 'part'

	// expected RxComponent props, some are already declared/set in PlotBase
	opts: any
	app: AppApi
	id: string
	api: ComponentApi
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}
	state: any

	// expected class-specific props
	numStale: number = 0
	currWait?: number

	constructor(opts, api) {
		this.opts = opts
		this.app = opts.app
		this.id = opts.id
		this.api = api
		this.type = 'part'
	}
	getState(appState) {
		return { wait: appState.partWait || 0 }
	}
	async main() {
		const result = await this.api.detectStale(() => sleep(this.state.wait))
		const stale = result[1]
		if (stale) this.numStale++
		else this.currWait = this.state.wait
	}
}

export const partInit = ComponentApi.getInitFxn(TestPart)

class TestUpdateAbort implements RxComponent {
	static type = 'partAbort'

	// expected RxComponent props, some are already declared/set in PlotBase
	opts: any
	app: AppApi
	id: string
	api: ComponentApi
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}
	state: any

	// expected class-specific props
	numStale: number = 0
	currWait?: number
	cohort?: string = ''

	constructor(opts, api) {
		this.type = 'partAbort'
		this.opts = opts
		this.app = opts.app
		this.id = opts.id
		this.api = api
	}
	getState(appState) {
		// will not abort after waitMax
		return {
			wait: appState.abortWait,
			waitMax: appState.abortWait ? appState.abortWait + 20 : 0,
			cohort: appState.cohort
		}
	}
	async main() {
		const signal = this.api.getAbortSignal()
		const cohort = this.state.cohort
		try {
			if (this.state.wait) {
				// this simulates a cohort change
				setTimeout(() => this.api.triggerAbort(), this.state.wait)
			}
			// this simulates an awaited step like a fetch request
			const cohortToRender = await this.longRunningStep(signal, cohort, this.state.waitMax)
			// console.log(185, {cohortToRender})
			// this simulate a plot's "rendered" cohort data, whereas
			// appState.cohort is the active cohort label shown in the portal UI
			this.cohort = cohortToRender
			this.currWait = this.state.wait
		} catch (e) {
			// console.log(189, e)
			if (String(e).includes('stale sequenceId')) return
			else throw e
		}
	}
	longRunningStep(signal, cohort, waitMax) {
		if (!waitMax) return cohort
		return new Promise((resolve, reject) => {
			const increment = 5
			let elapsed = 0
			const interval = setInterval(() => {
				elapsed += increment
				if (elapsed >= waitMax) {
					clearInterval(interval)
					resolve(cohort)
				} else if (signal.aborted) {
					clearInterval(interval)
					this.numStale++
					reject(`stale sequenceId, cohort='${cohort}'`)
				}
			}, increment)
		})
	}
}

export const partAbort = ComponentApi.getInitFxn(TestUpdateAbort)
