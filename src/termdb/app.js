import * as rx from '../common/rx.core'
import { select } from 'd3-selection'
import { treeInit } from './tree'
import { storeInit } from './store'
import { filterInit } from './filter2'
import { recoverInit } from '../common/recover'
import { sayerror, Menu } from '../client'

/*
opts{}
.state{}
	required, will fill-in or override store.defaultState
.app{} .tree{} etc
see doc for full spec
https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit

*/

class TdbApp {
	constructor(coordApp, opts) {
		// moving to component.getState() breaks previous assumptions with app.subState[component.type].get();
		// this issue DOES NOT affect uncoordinated, standalone use of the termdb app
		// such as in the blue pill - shoul still be okay
		if (coordApp) throw `TODO: termdb app does not currently support a parent coordinating app (coordApp)`
		this.type = 'app'
		this.opts = this.initOpts(opts)
		this.tip = new Menu({ padding: '5px' })
		// the TdbApp may be the root app or a component within another app
		this.api = coordApp ? rx.getComponentApi(this) : rx.getAppApi(this)
		this.app = coordApp ? coordApp : this.api

		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder
				.append('div')
				.style('position', 'sticky')
				.style('top', '12px')
				.style('right', '20px')
				.style('margin', '5px')
				.style('text-align', 'right'),

			errdiv: opts.holder.append('div')
		}

		this.eventTypes = ['postInit', 'postRender']

		// catch initialization error
		try {
			if (!coordApp) this.store = storeInit(this.api)
			this.components = {}

			this.components.recover = recoverInit(this.app, { holder: this.dom.holder, appType: 'termdb' }, this.opts.recover)
			this.components.terms = filterInit(this.app, { holder: this.dom.holder.append('div') }, this.opts.filter)
			this.components.tree = treeInit(this.app, { holder: this.dom.holder.append('div') }, this.opts.tree)
		} catch (e) {
			this.printError(e)
		}

		this.eventTypes = ['postInit', 'postRender']

		if (this.store) {
			// trigger the initial render after initialization, store state is ready
			this.store
				.copyState({ rehydrate: true })
				.then(state => {
					this.state = state
				})
				.then(() => this.api.dispatch())
				.catch(e => this.printError(e))
		}
	}
	/*
	async main() { //console.log(this.state.tree.expandedTermIds)
		// may add other logic here or return data as needed,
		// for example request and cache metadata that maybe throughout
		// the app by many components; the metadata may be exposed
		// later via something like app.api.lookup, to-do
		// if (this.projectName) this.saveState()
	}*/

	initOpts(o) {
		if (!o.fetchOpts) o.fetchOpts = {}
		if (!o.fetchOpts.serverData) o.fetchOpts.serverData = {}
		return o
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

exports.appInit = rx.getInitFxn(TdbApp)

function setInteractivity(self) {
	self.downloadView = id => {
		const components = app.getComponents('tree.plots.' + opts.id)
		for (const name in self.components) {
			// the download function in each component will be called,
			// but should first check inside that function
			// whether the component view is active before reacting
			if (typeof self.components[name].download == 'function') {
				components[name].download()
			}
		}
	}
}
