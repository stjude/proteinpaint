import * as rx from "../rx.core"
import {select} from "d3-selection"
import {treeInit} from "./tdb.tree"
import {storeInit} from "./tdb.store"
import {filterInit} from "./tdb.filter"
//import {controlsInit} from "./tdb.controls"

class TdbApp {
	constructor(opts, holder) {
		this.opts = opts
		this.api = rx.getAppApi(this)
		this.notifyComponents = rx.notifyComponents 

		this.store = storeInit(this.api)
		this.state = this.store.state()
		this.dom = {
			holder: holder.style("margin", "10px").style("border", "1px solid #aaa")
		}

		this.termfilter = {
			// terms: []
			terms: filterInit(this.api, {holder: holder.append("div")})
		}

		this.components = {
			tree: treeInit(this.api, {holder: holder.append('div')})
		}

		this.bus = new rx.Bus("app", ["postRender"])
	}

	main(action = {}) {
		this.notifyComponents(action)
	}
}

exports.appInit = rx.getInitFxn(TdbApp)
