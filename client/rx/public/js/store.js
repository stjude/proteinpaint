import { getStoreInit } from './rx.js'

const defaultState = {
	banner: 'Default Banner Name',
	btn: {
		numClicks: 0
	}
}

class MyStore {
	constructor(opts) {
		this.type = 'store'
		this.defaultState = defaultState
	}
}

MyStore.prototype.actions = {
	add_btnclicks(action) {
		console.log(18, 'store.add_btnclicks()', action)
		this.state.btn.numClicks += action.increment
	},

	set_banner(action) {
		this.state.banner = action.title
	}
}

export const storeInit = getStoreInit(MyStore)
