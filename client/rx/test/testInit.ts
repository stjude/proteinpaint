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
			part: await partInit({ app: this.api })
		}
	}

	async main() {}
}

export const appInit = AppApi.getInitFxn(TestApp)

class TestStore extends StoreBase implements RxStore {
	// expected RxStore, some are already declared/set in StoreBase
	//app: AppApi
	api: StoreApi
	//type: string

	// expected class-specific props
	defaultState = {
		appWait: 0,
		partWait: 0
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
