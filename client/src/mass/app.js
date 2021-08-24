import * as rx from '../common/rx.core'
import { select } from 'd3-selection'
import { storeInit } from './store'
import { vocabInit } from '../termdb/vocabulary'
import { navInit } from './nav'
import { plotInit } from './plot'
//import { recoverInit } from '../common/recover'
import { sayerror, Menu, newSandboxDiv } from '../client'

/*
opts{}
.state{}
	required, will fill-in or override store.defaultState
.app{} .tree{} etc
see doc for full spec
https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit

*/

class MassApp {
	constructor(opts) {
		//if (coordApp) throw `TODO: termdb app does not currently support a parent coordinating app (coordApp)`
		this.type = 'app'
		this.opts = this.initOpts(opts)
		this.tip = new Menu({ padding: '5px' })
		// the TdbApp may be the root app or a component within another app
		this.api = rx.getAppApi(this)
		this.app = this.api
		this.api.vocabApi = vocabInit(this.api, this.app.opts)

		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder.append('div'),
			errdiv: opts.holder.append('div'),
			plotDiv: opts.holder.append('div')
		}

		this.eventTypes = ['postInit', 'postRender']

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
	}

	async main() {
		this.api.vocabApi.main()

		for (const plotId in this.state.tree.plots) {
			if (!(plotId in this.components.plots)) {
				const plot = this.state.tree.plots[plotId]
				const holder = newSandboxDiv(this.dom.plotDiv, () => {
					this.api.dispatch({
						type: 'plot_delete',
						id: plotId
					})
				})

				this.components.plots[plotId] = plotInit(
					this.app,
					{
						holder,
						plot
					},
					this.opts.plot
				)
			}
		}

		for (const plotId in this.components.plots) {
			if (!(plotId in this.state.tree.plots)) {
				delete this.components.plots[plotId]
			}
		}
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
					header_mode: this.state && this.state.nav && this.state.nav.header_mode,
					vocab: this.state.vocab
				},
				this.opts.nav
			),

			//recover: recoverInit(this.app, { holder: this.dom.holder, appType: 'termdb' }, this.opts.recover),
			plots: {}
		}
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

export const appInit = rx.getInitFxn(MassApp)

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
