import * as rx from '../common/rx.core'
import { searchInit } from './toy.search'
import { filterInit } from './toy.filter'

class ToyControls {
	constructor(app, opts) {
		this.type = 'controls'
		this.api = rx.getComponentApi(this)
		this.notifyComponents = rx.notifyComponents
		this.getComponents = rx.getComponents
		this.app = app
		this.opts = opts.holder
		this.dom = { holder: opts.holder }
		this.components = {
			search: searchInit(app, { holder: opts.holder.append('div') }, app.opts.search),
			filter: filterInit(app, { holder: opts.holder.append('div') }, app.opts.filter)
		}
	}

	getState(appState) {
		return appState
	}
}

export const controlsInit = rx.getInitFxn(ToyControls)
