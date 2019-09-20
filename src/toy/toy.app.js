import {App, Bus, getInitFxn} from "../rx.core"
import {storeInit} from "./toy.store"
import {controlsInit} from "./toy.controls"
import {tableInit} from "./toy.table"
import {select} from "d3-selection"

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
class ToyApp extends App {
	constructor(opts, holder) {
		super()
		this.opts = opts
		// get the instance.api here to pass along as
		// the "app" argument to other components
		this.app = this.getApi(opts)
		this.store = storeInit(this.app)
		// this.deepFreeze(this.opts)
		this.state = this.store.copy()
		this.dom = {holder}
		// expose the app api, not "this" directly to subcomponents
		this.components = {
			controls: controlsInit(this.app, holder.append("div")),
			table: tableInit(this.app, holder.append("div"))
		}
		this.bus = new Bus('app', ['postInit', 'postMain'], opts.callbacks, this)
		this.bus.emit('postInit', this.app)
	}

	main(action) {
		this.notifyComponents(action)
		this.bus.emit('postMain', this.app)
	}
}

export const appInit = getInitFxn(ToyApp)
