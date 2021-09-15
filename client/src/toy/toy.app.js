import * as rx from '../common/rx.core'
import { storeInit } from './toy.store'
import { controlsInit } from './toy.controls'
import { tableInit } from './toy.table'
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
	constructor(opts) {
		this.type = 'app'
		this.opts = opts //rx.getOpts(opts, this)
		// the ToyApp may be the root app or a component within another app
		this.api = rx.getAppApi(this)
		// set up the app api as the default argument
		// to callbacks of emitted events
		this.eventTypes = ['postInit', 'postRender']
		this.dom = {
			tip: new Menu(),
			holder: opts.holder
		}
	}

	async init() {
		this.store = await storeInit({ app: this.api })
		this.state = this.store.copyState()
		this.components = await rx.multiInit({
			controls: controlsInit({ app: this.api, holder: this.dom.holder.append('div') }),
			table: tableInit({ app: this.api, holder: this.dom.holder.append('div') })
		})
	}

	/*
	// optional app.main(), to be called within app.api.dispatch()
	main() {
		// may return data for child components
	}
	*/
}

export const appInit = rx.getInitFxn(ToyApp)
