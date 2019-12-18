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
	https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit
.modifiers{}
	optional
	contains key-fxn() pairs
	a component will consume a specific modifier (addressed by its key) to alter its behavior
	can run the callback supplied with results to other apps (e.g. click a term in tree)
	app and components will refer to the same frozen object of "modifiers{}", in a read-only way
component specific callbacks and customizations


******************* modifiers
TODO modifiers to be moved into opts[componentType]

a set of predefined keys, each pointing to a callback so as to supply user selected term or tvs to that callback
will also alter the appearance and behavior of UIs, so components need to access this

< no modifier >
tree: display all terms under a parent, just show name;
non-leaf terms will have a +/- button in the front
graphable terms will have a VIEW button at the back

< modifiers.tvs_select >
at barchart, click a bar to select to a tvs

Compared to previous version:
ssid is no longer a modifier, but as a customization attribute for barchart

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
			const modifiers = this.validateModifiers(this.opts.modifiers)
			this.components = {}
			if ((this.opts.tree && this.opts.tree.click_term) || modifiers.tvs_select) {
				// has modifier
			} else {
				// no modifier, show these components
				this.components.recover = recoverInit(
					this.app,
					{ holder: this.dom.holder, appType: 'termdb' },
					this.opts.recover
				)

				this.components.terms = filterInit(this.app, { holder: this.dom.holder.append('div') }, this.opts.filter)
			}
			this.components.tree = treeInit(this.app, { holder: this.dom.holder.append('div'), modifiers }, this.opts.tree)
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

	validateModifiers(tmp = {}) {
		for (const k in tmp) {
			if (typeof tmp[k] != 'function') throw 'modifier "' + k + '" not a function'
		}
		return Object.freeze(tmp)
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
