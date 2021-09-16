import * as rx from '../common/rx.core'
import { select } from 'd3-selection'
import { storeInit } from './store'
import { vocabInit } from '../termdb/vocabulary'
import { navInit } from './nav'
import { plotInit } from './plot'
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
		this.type = 'app'
		// set this.id, .opts, .api
		rx.prepApp(this, opts)
		this.api.vocabApi = vocabInit(this.api, this.opts)

		this.tip = new Menu({ padding: '5px' })
		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder.append('div'),
			errdiv: opts.holder.append('div'),
			plotDiv: opts.holder.append('div')
		}
	}

	validateOpts(o) {
		if (!o.callbacks) o.callbacks = {}
		return o
	}

	async init() {
		// catch initialization error
		try {
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.components = {
				nav: await navInit({
					app: this.api,
					holder: this.dom.topbar,
					header_mode: this.state && this.state.nav && this.state.nav.header_mode,
					vocab: this.state.vocab
				}),
				plots: {}
			}
			await this.api.dispatch()
		} catch (e) {
			this.printError(e)
		}
	}

	async main() {
		this.api.vocabApi.main()

		const newPlots = {}
		for (const plot of this.state.plots) {
			if (!(plot.id in this.components.plots)) {
				const holder = newSandboxDiv(this.dom.plotDiv, () => {
					this.api.dispatch({
						type: 'plot_delete',
						id: plotId
					})
				})

				newPlots[plot.id] = plotInit({
					app: this.api,
					holder,
					plot
				})
			}
		}

		// simultaneous initialization of multiple new plots;
		// if done inside the for-of loop above, the await kewyword
		// will delay subsequent plot initializations
		if (Object.keys(newPlots).length) {
			await Promise.all(Object.values(newPlots))
			for (const plotId in newPlots) {
				this.components.plots[plotId] = await newPlots[plotId]
			}
		}

		for (const plotId in this.components.plots) {
			if (!this.state.plots.find(p => p.id === plotId)) {
				delete this.components.plots[plotId]
			}
		}
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

// must use the await keyword when using this appInit()
export const appInit = rx.getInitFxn(MassApp)

function setInteractivity(self) {
	self.downloadView = id => {
		const components = this.api.getComponents('plots.' + opts.id)
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
