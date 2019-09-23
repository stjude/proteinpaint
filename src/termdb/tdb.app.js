import * as rx from "../rx.core"
import {select} from "d3-selection"
import {treeInit} from "./tdb.tree"
import {storeInit} from "./tdb.store"
//import {controlsInit} from "./tdb.controls"
//import {plotInit} from "./tdb.plot"

class TdbApp {
	constructor(opts, holder) {
		this.opts = opts
		this.api = rx.getAppApi(this)
		this.notifyComponents = rx.notifyComponents 

		this.store = storeInit(this.api)
		this.dom = {
			holder: holder.style("margin", "10px").style("border", "1px solid #aaa")
		}

		this.termfilter = {
			terms: []
		}

		this.components = {
			tree: treeInit(this.api, holder.append('div'))
			//filterUi: controls.filterUiInit({}),
			//plots: []
		}
		
		// set closure methods to handle conflicting "this" contexts
		// this.yesThis()
		// this.notThis(this)

		this.bus = new rx.Bus("app", ["postRender"])
	}

	initTerm(term) {
		if (!term || term.id in this.state) return
		this.state[term.id] = { expanded: false }
	}

	main(action = {}) {
		this.notifyComponents(action)
	}
}

exports.appInit = rx.getInitFxn(TdbApp)
