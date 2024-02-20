/**
 * Super class for all views
 */
export class HicView {
	type: 'view'
	store: any

	constructor() {
		this.type = 'view'
	}

	getAppState() {
		return this.store.getState()
	}

	colorizeElement() {
		//Transfer colorizeElement here
	}
}
