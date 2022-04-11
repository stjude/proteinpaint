import * as rx from '../../rx'
import { storeInit } from './store'
import { controlsInit } from './controls'
import { tableInit } from './table'
import { select } from 'd3-selection'
import { Menu } from '../client'

/*
	ToyApp is created inside getInitFxn()
	to expose the api from its 
	parent class App.getApi()

	opts
	.genome
	.dslabel
	.debug
	.state // see toy.store for default state

	holder 
	- d3-wrapped DOM selection

	api resulting from getInitFxn(ToyApp)
	.opts (frozen)
	.state()
	.dispatch()
	.on()
*/
class ToyApp {
	constructor(opts = {}) {
		this.dom = {
			tip: new Menu()
		}
	}

	validateOpts(opts) {
		if (!opts.holder) throw `missing o.holder`
		if (!opts.state) opts.state = {}
	}

	preApiFreeze(api) {
		api.tip = this.dom.tip
	}

	async init() {
		try {
			this.dom.holder = this.opts.holder
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = this.store.copyState()
			this.components = await rx.multiInit({
				controls: controlsInit({ app: this.api, holder: this.dom.holder.append('div') }),
				table: tableInit({ app: this.api, holder: this.dom.holder.append('div') })
			})
		} catch (e) {
			throw e
		}
	}

	/*
	// optional app.main(), to be called within app.api.dispatch()
	main() {
		// may return data for child components
	}
	*/
}

export const appInit = rx.getAppInit(ToyApp)
