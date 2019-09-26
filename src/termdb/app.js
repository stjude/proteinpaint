import * as rx from "../rx.core"
import {select} from "d3-selection"
import {treeInit} from "./tree"
import {storeInit} from "./store"
import {filterInit} from "./filter"
import {sayerror} from '../client'
//import {controlsInit} from "./controls"

class TdbApp {
	constructor(opts, holder) {
		this.opts = opts
		this.api = rx.getAppApi(this)
		this.notifyComponents = rx.notifyComponents 

		this.dom = {
			holder: holder.style("margin", "10px").style("border", "1px solid #aaa"),
			errdiv: holder.append('div')
		}

		// to catch error upon init
		try {
			this.store = storeInit(this.api)
			this.state = this.store.state()

			this.components = {
				tree: treeInit(this.api, {holder: holder.append('div')}),
				terms: filterInit(this.api, {holder: holder.append("div")})
			}
		} catch(e) {
			this.printError(e)
		}

		this.bus = new rx.Bus("app", ["postRender"], opts.callbacks, this.api)
		this.bus.emit('postRender')
	}

	main(action = {}) {
		this.notifyComponents(action)
	}

	printError(e) {
		// may need to expose this through app api
		sayerror(this.dom.errdiv, 'Error: '+(e.message||e))
		if (e.stack) console.log(e.stack)
	}
}

exports.appInit = rx.getInitFxn(TdbApp)
