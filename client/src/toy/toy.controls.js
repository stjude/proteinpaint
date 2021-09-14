import * as rx from '../common/rx.core'
import { searchInit } from './toy.search'
import { filterInit } from './toy.filter'

class ToyControls {
	constructor(opts) {
		this.type = 'controls'
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		this.api = rx.getComponentApi(this)
		this.dom = { holder: opts.holder }
		this.components = {
			search: searchInit({ app: this.app, holder: opts.holder.append('div') }),
			filter: filterInit({ app: this.app, holder: opts.holder.append('div') })
		}
	}

	getState(appState) {
		return appState
	}
}

export const controlsInit = rx.getInitFxn(ToyControls)
