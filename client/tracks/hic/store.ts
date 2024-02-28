import { getStoreInit } from '#rx'

class HicStore {
	type: 'store'
	defaultState: {
		defaultNmeth: string
	}
	actions: any
	state: any

	constructor() {
		this.type = 'store'
		this.defaultState = {
			defaultNmeth: 'NONE'
		}
	}
}

export const hicStoreInit = getStoreInit(HicStore)

HicStore.prototype.actions = {
	view_change(action) {
		if (!action.view) throw Error('view_change: missing view')
		this.state.currView = action.view
	},
	view_update(action) {
		if (!action.view) throw Error('view_update: missing view')
		const opts = Object.assign(this.state[action.view], action.config)
		this.state[action.view] = opts
	}
}
