import { StoreApi, StoreBase } from './rx.js'

const defaultState = {
	banner: 'Default Banner Name',
	buttons: [
		{
			name: 'My Button',
			numClicks: 0
		}
	]
}

class MyStore extends StoreBase {
	static type = 'store'

	constructor(opts) {
		super(opts)
		this.type = MyStore.type
		this.defaultState = defaultState
	}

	validateOpts(opts) {
		return opts
	}

	init() {
		if (this.state.buttons) {
			//rehydrate or fill-in missing button state attributes
			for (const btn of this.state.buttons) {
				if (!('numClicks' in btn)) {
					btn.numClicks = 0
				}
			}
		}
	}
}

MyStore.prototype.actions = {
	add_btnclicks(action) {
		// console.log(18, 'store.add_btnclicks()', action)
		const btnState = this.state.buttons[action.id]
		btnState.numClicks += action.increment
	},

	set_banner(action) {
		this.state.banner = action.title
	}
}

export const storeInit = StoreApi.getInitFxn(MyStore)
