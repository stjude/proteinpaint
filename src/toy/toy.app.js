import * as rx from "../rx.core"
import {storeInit} from "./toy.store"
import {controlsInit} from "./toy.controls"
import {tableInit} from "./toy.table"
import {select} from "d3-selection"
import {Menu} from '../client'

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
		this.notifyComponents = rx.notifyComponents
		this.getComponents = rx.getComponents

		this.store = storeInit(this.api)
		this.state = this.store.state()
		this.dom = {
			tip: new Menu(),
			holder
		}
		// expose the app api, not "this" directly to subcomponents
		this.components = {
			controls: controlsInit(this.api, holder.append("div")),
			table: tableInit(this.api, holder.append("div"))
		}
		// set up the app api as the default argument 
		// to callbacks of emitted events
		this.bus = new rx.Bus('app', ['postInit', 'postNotify'], opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	main(action) {
		this.notifyComponents(action)
		this.bus.emit('postNotify', this.app)
	}
}

export const appInit = rx.getInitFxn(ToyApp)
