import { getStoreInit } from '#rx'

/*
.opts{}

*/

class AppDrawerStore {
	constructor(opts) {
		this.type = 'store'
		this.defaultState = {
			// for apps drawer animation
			duration: 500,
			hintPos: {
				open: { btm: -42, left: 13 },
				closed: { btm: 3, rt: 5 }
			},
			hintWidth: { open: '0px', closed: '18px' },
			arrowSize: { open: 42, closed: 20 },
			arrowColor: { open: 'rgb(242,242,242)', closed: 'rgb(85,85,85)' },
			appBtnActive: false
		}
	}

	async init() {}
}

export const appDrawerStoreInit = getStoreInit(AppDrawerStore)

AppDrawerStore.prototype.actions = {
	toggle_apps_off(action) {
		this.state.appBtnActive = 'value' in action ? action.value : !this.state.appBtnActive
	}
}
