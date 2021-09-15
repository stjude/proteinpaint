import * as rx from '../common/rx.core'
import { select } from 'd3-selection'
import { vocabInit } from './vocabulary'
import { navInit } from './nav'
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
	constructor(opts = {}) {
		this.type = 'app'
		this.opts = this.validateOpts(opts)
		this.tip = new Menu({ padding: '5px' })
		// the TdbApp may be the root app or a component within another app
		this.api = rx.getAppApi(this)
		this.api.vocabApi = vocabInit(this.api, this.opts)

		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder.append('div'),
			errdiv: opts.holder.append('div')
		}

		this.eventTypes = ['postInit', 'postRender']

		// catch initialization error
		try {
		} catch (e) {
			this.printError(e)
		}
	}

	validateOpts(o) {
		if (!o.callbacks) o.callbacks = {}
		return o
	}

	async init() {
		try {
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.setComponents()
			this.api.dispatch()
		} catch (e) {
			this.printError(e)
		}
	}

	async main() {
		this.api.vocabApi.main()
	}

	setComponents() {
		this.components = {
			nav: navInit({
				app: this.api,
				holder: this.dom.topbar,
				header_mode: this.state && this.state.nav && this.state.nav.header_mode
			}),
			recover: recoverInit({
				app: this.api,
				holder: this.dom.holder,
				appType: 'termdb'
			}),
			tree: treeInit({
				app: this.api,
				holder: this.dom.holder.append('div')
			})
		}
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

// must use the await keyword when using this appInit()
export const appInit = rx.getInitFxn(TdbApp)

function setInteractivity(self) {
	self.downloadView = id => {
		const components = app.getComponents('plots.' + opts.id)
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
