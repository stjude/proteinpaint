import * as rx from '../rx.core'
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
	constructor(opts, holder) {
		this.opts = opts
		this.api = rx.getAppApi(this)

		this.store = storeInit(this.api)
		this.state = this.store.copyState()
		this.dom = {
			tip: new Menu(),
			holder
		}
		// expose the app api, not "this" directly to subcomponents
		this.components = {
			controls: controlsInit(this.api, { holder: holder.append('div') }),
			table: tableInit(this.api, { holder: holder.append('div') })
		}
		// set up the app api as the default argument
		// to callbacks of emitted events
		this.bus = new rx.Bus('app', ['postInit', 'postRender'], opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	async main(state, action) {
		this.state = state
		try {
			await rx.notifyComponents(this.components, action)
		} catch (e) {
			console.log(e)
			if (e.stack) console.log(e.stack)
		}
		this.bus.emit('postRender')
	}
}

ToyApp.prototype.subState = {
	filter: {
		reactsTo: {
			prefix: ['term']
		},
		get(state, sub) {
			return {
				rows: state.controls.rows
			}
		}
	}
}

export const appInit = rx.getInitFxn(ToyApp)
