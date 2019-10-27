import * as rx from '../rx.core'
import { searchInit } from './toy.search'
import { filterInit } from './toy.filter'

class ToyControls {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.notifyComponents = rx.notifyComponents
		this.getComponents = rx.getComponents
		this.app = app
		this.opts = opts.holder
		this.dom = { holder: opts.holder }
		this.components = {
			search: searchInit(app, { holder: opts.holder.append('div') }),
			filter: filterInit(app, { holder: opts.holder.append('div') })
		}
	}
}

export const controlsInit = rx.getInitFxn(ToyControls)
