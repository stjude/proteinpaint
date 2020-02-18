import * as rx from '../common/rx.core'
import { select } from 'd3-selection'
import { navInit } from './nav'
import { searchInit } from './search'
import { filterInit } from './filter3'
import { treeInit } from './tree'
import { storeInit } from './store'
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
		if (coordApp) throw `TODO: termdb app does not currently support a parent coordinating app (coordApp)`
		this.type = 'app'
		this.opts = this.initOpts(opts)
		this.tip = new Menu({ padding: '5px' })
		// the TdbApp may be the root app or a component within another app
		this.api = coordApp ? rx.getComponentApi(this) : rx.getAppApi(this)
		this.app = coordApp ? coordApp : this.api

		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder.append('div'),
			errdiv: opts.holder.append('div')
		}

		this.eventTypes = ['postInit', 'postRender']

		// catch initialization error
		try {
			if (!coordApp) this.store = storeInit(this.api)
			this.components = {
				nav: navInit(this.app, { holder: this.dom.topbar, enabled: this.opts.app.standalone }, this.opts.nav)
			}

			this.navDom = this.components.nav.getDom()
			this.components.recover = recoverInit(this.app, { holder: this.dom.holder, appType: 'termdb' }, this.opts.recover)

			this.components.search = searchInit(
				this.app,
				{
					holder: this.opts.app.standalone ? this.navDom.searchDiv : this.dom.holder.append('div'),
					resultsHolder: this.opts.app.standalone ? this.navDom.subheader.search : null
				},
				rx.copyMerge(
					{
						click_term: this.opts.tree && this.opts.tree.click_term,
						disable_terms: this.opts.tree && this.opts.tree.disable_terms,
						callbacks: {
							'postSearch.nav': this.components.nav.clearSubheader
						}
					},
					this.app.opts.search
				)
			)

			this.components.terms = filterInit(
				this.app,
				{
					holder: this.opts.app.standalone ? this.navDom.subheader.filter.append('div') : this.dom.holder.append('div'),
					hideLabel: this.opts.app.standalone
				},
				this.opts.filter
			)

			this.components.tree = treeInit(
				this.app,
				{
					holder: this.dom.holder.append('div')
				},
				this.opts.tree
			)
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
					//console.log(this.state.termdbConfig)
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
		if (!('app' in o)) o.app = {}
		if (!('standalone' in o.app)) o.app.standalone = false
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
