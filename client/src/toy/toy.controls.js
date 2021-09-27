import { getCompInit, multiInit } from '../common/rx.core'
import { searchInit } from './toy.search'
import { filterInit } from './toy.filter'

class ToyControls {
	constructor(opts) {
		this.type = 'controls'
	}

	async init() {
		try {
			this.dom = { holder: this.opts.holder }
			this.components = await multiInit({
				search: searchInit({ app: this.app, holder: this.opts.holder.append('div') }),
				filter: filterInit({ app: this.app, holder: this.opts.holder.append('div') })
			})
		} catch (e) {
			throw e
		}
	}

	getState(appState) {
		return appState
	}
}

export const controlsInit = getCompInit(ToyControls)
