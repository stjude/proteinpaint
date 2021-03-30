import * as rx from '../common/rx.core'
import getterm from '../common/termutils'

const defaultState = {
	term0: {},
	term1: {},
	term2: {}
}

class Store {
	constructor(app) {
		this.app = app
		this.api = rx.getStoreApi(this)
		this.copyMerge = rx.copyMerge
		this.deepFreeze = rx.deepFreeze
		this.toJson = rx.toJson
		this.fromJson = rx.fromJson
		this.getterm = getterm
		if (!app.opts.state) throw 'app.opts.state{} missing'
		this.state = this.copyMerge(this.toJson(defaultState), app.opts.state)
		this.validateState()
	}
	validateState() {
		const s = this.state
		if (!s.genome) throw '.state.genome missing'
		if (!s.dslabel) throw '.state.dslabel missing'
	}
}

Store.prototype.actions = {
	app_refresh(action = {}) {
		this.state = this.copyMerge(this.toJson(this.state), action.state || {})
	},
	term_change(action) {
		if ('term0' in action) {
			this.state.term0 = action.term0
		} else if ('term1' in action) {
			this.state.term1 = action.term1
		} else if ('term2' in action) {
			this.state.term2 = action.term2
		} else {
			throw 'no term0/1/2 specified in term_change'
		}
	}
}

exports.storeInit = rx.getInitFxn(Store)
