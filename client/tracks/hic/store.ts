import { getStoreInit } from '#rx'

class HicStore {
	type: 'store'
	defaultState: {
		defaultNmeth: string
		currView: string
	}
	actions: any
	state: any

	constructor(opts) {
		this.type = 'store'
		this.defaultState = {
			defaultNmeth: 'NONE',
			currView: this.determineView(opts)
		}
	}

	determineView(opts) {
		//console.log(opts) // so ts stops complaining
		//TODO figure out view based on opts
		//Will be useful when runpp() for chrPair and detailed view is implemented
		return 'genome'
	}

	init() {
		//TOOD: maybe?
	}
}

export const hicStoreInit = getStoreInit(HicStore)

HicStore.prototype.actions = {
	view_change(action) {
		if (!action.view) throw Error('view_change: missing view')
		this.state.currentView = action.view
	}
	// view_refresh(action) {
	// 	//TODO: when data in the view changes (e.g. user changes something in the control panel), the other components are notified of the change.
	// }
}
