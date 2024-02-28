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
		//TODO: when data in the view changes (e.g. user changes something in the control panel), the other components are notified of the change.
	}
}
