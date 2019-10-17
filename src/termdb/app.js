import * as rx from "../rx.core"
import {select} from "d3-selection"
import {treeInit} from "./tree"
import {storeInit} from "./store"
import {filterInit} from "./filter"
import {sayerror} from '../client'

/*
opts{}
.state{}
	required, will fill-in or override store.defaultState
	https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit
.modifiers{}
	optional
	contains key-fxn() pairs
	a component will consume a specific modifier (addressed by its key) to alter its behavior
	can run the callback supplied with results to other apps (e.g. click a term in tree)
	app and components will refer to the same frozen object of "modifiers{}", in a read-only way
}


******************* modifiers
< no modifier >
tree: display all terms under a parent, just show name;
non-leaf terms will have a +/- button in the front
graphable terms will have a VIEW button at the back

< modifiers.click_term >
tree: display graphable terms as blue buttons for selecting, no VIEW button
as in selecting term2 in barchart
tree.search: display found terms as blue buttons

< modifiers.ssid_barchart >
TODO

< modifiers.tvs_select >
TODO
*/

class TdbApp {
	constructor(opts, holder) {
		this.opts = opts
		this.api = rx.getAppApi(this)
		this.notifyComponents = rx.notifyComponents
		this.getComponents = rx.getComponents

		this.dom = {
			holder: holder.style("margin", "10px").style("border", "1px solid #aaa"),
			errdiv: holder.append('div')
		}

		// catch initialization error
		try {
			this.store = storeInit(this.api)
			this.state = this.store.state()
			const modifiers = validate_modifiers(opts.modifiers)
			this.components = {
				tree: treeInit( this.api, { holder: holder.append('div'), modifiers}),
				terms: filterInit(this.api, {holder: holder.append("div")})
			}
		} catch(e) {
			this.printError(e)
			if (e.stack) console.log(e.stack)
		}

		this.bus = new rx.Bus("app", ["postInit",'postRender'], opts.callbacks, this.api)
		this.bus.emit('postInit')
		// trigger the initial render after initialization
		// no need to supply an action.state{} at this point
		this.main({type: 'app_refresh'}).catch(this.printError)
	}

	async main(action = {}) {
		// catch runtime error from components
		try {
			await this.notifyComponents(action)
		} catch(e) {
			this.printError(e)
			if (e.stack) console.log(e.stack)
		}
		this.bus.emit('postRender')
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: '+(e.message||e))
		if (e.stack) console.log(e.stack)
	}
}

exports.appInit = rx.getInitFxn(TdbApp)

function validate_modifiers(tmp={}){
	for(const k in tmp) {
		if(typeof tmp[k] != 'function') throw 'modifier "'+k+'" not a function'
	}
	return Object.freeze(tmp)
}
