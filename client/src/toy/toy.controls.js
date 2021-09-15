import * as rx from '../common/rx.core'
import { searchInit } from './toy.search'
import { filterInit } from './toy.filter'

class ToyControls {
	constructor(opts) {
		this.type = 'controls'
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		this.api = rx.getComponentApi(this)
		this.dom = { holder: this.opts.holder }
	}

	async init() {
		this.components = await rx.multiInit({
			search: searchInit({ app: this.app, holder: this.opts.holder.append('div') }),
			filter: filterInit({ app: this.app, holder: this.opts.holder.append('div') })
		})
	}

	getState(appState) {
		return appState
	}
}

export const controlsInit = rx.getInitFxn(ToyControls)
