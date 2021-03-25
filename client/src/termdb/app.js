import * as rx from '../common/rx.core'
import { select } from 'd3-selection'
import { vocabInit } from './vocabulary'
import { navInit } from './nav'
import { treeInit } from '../../../shared/src/tree'
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
		this.api.vocabApi = vocabInit(this.api, this.app.opts)

		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder.append('div'),
			errdiv: opts.holder.append('div')
		}

		this.eventTypes = ['postInit', 'postRender']

		if (!coordApp) {
			// catch initialization error
			try {
				this.store = storeInit(this.api)
				this.store
					.copyState({ rehydrate: true })
					.then(state => {
						this.state = state
						this.setComponents()
					})
					.then(() => this.api.dispatch())
					.catch(e => this.printError(e))
			} catch (e) {
				this.printError(e)
			}
		} else {
			try {
				this.setComponents()
			} catch (e) {
				this.printError(e)
			}
		}
	}

	async main() {
		//console.log(this.state.tree.expandedTermIds)
		this.api.vocabApi.main()
	}

	initOpts(o) {
		if (!('app' in o)) o.app = {}
		return o
	}

	setComponents() {
		this.components = {
			nav: navInit(
				this.app,
				{
					holder: this.dom.topbar,
					header_mode: this.state && this.state.nav && this.state.nav.header_mode
				},
				this.opts.nav
			),
			recover: recoverInit(this.app, { holder: this.dom.holder, appType: 'termdb' }, this.opts.recover),
			tree: treeInit(this.app, { holder: this.dom.holder.append('div') }, this.opts.tree)
		}
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

export const appInit = rx.getInitFxn(TdbApp)

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

	self.showTermSrc = showTermSrc
}
