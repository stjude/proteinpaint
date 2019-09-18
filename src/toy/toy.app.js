import {App, Bus, getInitFxn} from "../rx.core"
import {ToyStore} from "./toy.store"
import {controlsInit} from "./toy.controls"
import {tableInit} from "./toy.table"
import {select} from "d3-selection"

class ToyApp extends App {
	constructor(opts, holder) {
		super()
		this.opts = opts
		this.app = this.getApi(opts)
		this.store = new ToyStore(this.app, opts.state)
		this.store.deepFreeze(this.opts)
		this.state = this.store.copy()
		this.dom = {holder}
		// will not expose "this" directly to subcomponents
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
