import { getStoreInit } from '#rx'

class AppDrawerStore {
	constructor(opts) {
		this.type = 'store'
		// this.state = ''
	}

	async init() {
		try {
			// this.opts.state = {}
			// this.defaultState = {}
		} catch (e) {
			throw e
		}
	}
}

export const storeInit = getStoreInit(AppDrawerStore)
