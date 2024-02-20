import { getStoreInit } from '#rx'

class HicStore {
	type: 'store'
	defaultState: {
		nmeth: string
	}
	actions: any

	constructor() {
		this.type = 'store'
		this.defaultState = {
			nmeth: 'NONE'
		}
	}

	init() {
		//TODO
	}
}

export const hicStoreInit = getStoreInit(HicStore)

HicStore.prototype.actions = {
	view_change(action) {
		//TODO: change view and update state
	}
}
