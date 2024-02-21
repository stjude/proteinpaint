import { getStoreInit } from '#rx'

class HicStore {
	type: 'store'
	defaultState: {
		defaultNmeth: string
		errList: any[]
	}
	actions: any

	constructor() {
		this.type = 'store'
		this.defaultState = {
			defaultNmeth: 'NONE',
			errList: []
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
