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
			arrowColor: { open: 'rgb(242,242,242)', closed: 'rgb(85,85,85)' }
			// appBtnActive: false,
			// drawerRendered: false
		}
	}

	// validateOpts(opts) {
	// 	console.log(opts)
	// 	return opts
	// }

	async init() {
		try {
			// this.state.drawerRendered = false,
			// this.state.drawerFullHeight = '',
			// this.state.appBtnActive = false
		} catch (e) {
			throw e
		}
	}
}

export const appDrawerStoreInit = getStoreInit(AppDrawerStore)

AppDrawerStore.prototype.actions = {
	// toggle_off(action) {
	// 	this.state.appBtnActive = false
	// 	if (action.dom)
	// }
	track_drawer_rendering(action) {
		this.state.drawerRendered = action.value
	}
}
