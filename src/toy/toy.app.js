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
	constructor(parentApp, opts) {
		this.type = 'app'
		this.opts = opts
		// the ToyApp may be the root app or a component within another app
		this.api = parentApp ? rx.getComponentApi(this) : rx.getAppApi(this)
		this.app = parentApp ? parentApp : this.api

		if (!parentApp) this.store = storeInit(this.api)
		this.state = this.store.copyState()
		this.dom = {
			tip: new Menu(),
			holder: opts.holder
		}
		// expose the app api, not "this" directly to subcomponents
		this.components = {
			controls: controlsInit(this.app, { holder: this.dom.holder.append('div') }),
			table: tableInit(this.app, { holder: this.dom.holder.append('div') })
		}
		// set up the app api as the default argument
		// to callbacks of emitted events
		this.eventTypes = ['postInit', 'postRender']
	}

	/*
	// optional app.main(), to be called within app.api.dispatch()
	main() {
		// may return data for child components
	}
	*/
}

export const appInit = rx.getInitFxn(ToyApp)
