import {App, Bus, getInitFxn} from "../rx.core"
import {ToyStore} from "./toy.store"
import {controlsInit} from "./toy.controls"
import {tableInit} from "./toy.table"
import {select} from "d3-selection"

class ToyApp extends App {
	constructor(opts, holder) {
		super()
		this.isApp = true
		this.opts = opts
		const app = this.api(opts)
		this.app = app
		this.store = new ToyStore(app, opts.state)
		this.state = this.store.copy()
		this.dom = {holder}
		// will not expose "this" directly to subcomponents
		this.components = {
			controls: controlsInit(app, holder.append("div")),
			table: tableInit(app, holder.append("div"))
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
