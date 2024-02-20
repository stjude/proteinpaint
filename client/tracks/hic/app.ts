import { getAppInit } from '#rx'
import { hicStoreInit } from './store'

class HicApp {
	type: 'app'
	store: any

	constructor() {
		this.type = 'app'
	}

	async init() {
		this.store = await hicStoreInit()
	}

	main() {
		//TODO
	}
}

export const hicInit = getAppInit(HicApp)
