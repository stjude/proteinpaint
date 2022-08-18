import { getAppInit } from '../rx'
import { select } from 'd3-selection'
import { storeInit } from './store'
import { vocabInit } from '#termdb/vocabulary'
import { navInit } from './nav'
import { plotInit } from './plot'
import { sayerror } from '#dom/error'
import { Menu } from '#dom/menu'
import { newSandboxDiv } from '#dom/sandbox'
import { dofetch3 } from '#common/dofetch'

/*
opts{}
.genome{}
	client-side genome object
	should be required
.state{}
	required, will fill-in or override store.defaultState
 	.genome
 	.dslabel
 	.tree{} etc
	see doc for full spec
	https://docs.google.com/document/d/1gTPKS9aDoYi4h_KlMBXgrMxZeA_P4GXhWcQdNQs3Yp8/edit

*/

class MassApp {
	constructor(opts) {
		// just a test
		if (opts.getDatasetAccessToken) {
			// should return a jwt token, to be used in headers of certain queries from mass to ppserver
			if (typeof opts.getDatasetAccessToken !== 'function') throw `opts.getDatasetAccessToken must be a function`
			console.log('has getDatasetAccessToken() function')
		}
		if (opts.addLoginCallback) {
			opts.addLoginCallback(() => this.api.dispatch({ type: 'app_refresh' }))
		}

		this.type = 'app'
		// this will create divs in the correct order
		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder.append('div'),
			errdiv: opts.holder.append('div'),
			plotDiv: opts.holder.append('div')
		}

		// track plots by ID, and assign
		this.plotIdToSandboxId = {}
	}

	validateOpts(o = {}) {
		if (!o.holder) throw `missing opts.holder in the MassApp constructor argument`
		if (!o.callbacks) o.callbacks = {}
		return o
	}

	async preApiFreeze(api) {
		try {
			api.tip = new Menu({ padding: '5px' })
			api.printError = e => this.printError(e)
			api.getVerifiedToken = () => this.verifiedToken

			const vocab = this.opts.state.vocab

			// TODO: only pass state.genome, dslabel to vocabInit
			api.vocabApi = await vocabInit({
				app: api,
				state: {
					vocab: {
						// either (genome + dslabel) XOR (terms) can be undefined
						genome: vocab?.genome || this.opts.state.genome,
						dslabel: vocab?.dslabel || this.opts.state.dslabel,
						terms: vocab?.terms
					}
				},
				fetchOpts: this.opts.fetchOpts
			})

			// the vocabApi's vocab may be reprocessed from the original input
			this.opts.state.vocab = api.vocabApi.vocab
		} catch (e) {
			throw e
		}
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
			throw e
		}
	}

	async main() {
		this.api.vocabApi.main()
		await this.maySetVerifiedToken()

		const newPlots = {}
		let sandbox
		for (const [index, plot] of this.state.plots.entries()) {
			if (!(plot.id in this.components.plots)) {
				sandbox = newSandboxDiv(this.dom.plotDiv, {
					close: () => {
						this.api.dispatch({
							type: 'plot_delete',
							id: plot.id
						})
					},
					plotId: plot.id,
					beforePlotId: plot.insertBefore || null,
					style: {
						width: '98.5%'
					}
				})
				newPlots[plot.id] = plotInit(Object.assign({}, { app: this.api, holder: sandbox }, plot))
			}
		}

		// simultaneous initialization of multiple new plots;
		// if done inside the for-of loop above, the await kewyword
		// will delay subsequent plot initializations
		const numNewPlots = Object.keys(newPlots).length
		if (numNewPlots) {
			await Promise.all(Object.values(newPlots))
			for (const plotId in newPlots) {
				this.components.plots[plotId] = await newPlots[plotId]
				if (numNewPlots === 1) {
					select(`#${sandbox.id}`)
						.node()
						.scrollIntoView({ behavior: 'smooth' })
				}
			}
		}

		for (const plotId in this.components.plots) {
			if (!this.state.plots.find(p => p.id === plotId)) {
				this.components.plots[plotId].destroy()
				delete this.components.plots[plotId]
			}
		}
	}

	async maySetVerifiedToken() {
		if (this.verifiedToken) return
		try {
			const dslabel = this.state.dslabel
			const auth = this.state.termdbConfig.requiredAuth
			if (!auth) return
			if (auth.type === 'jwt') {
				const token = this.opts.getDatasetAccessToken()
				if (!token) {
					delete this.verifiedToken
					return
				}
				const data = await dofetch3('/jwt-status', {
					method: 'POST',
					headers: {
						[auth.headerKey]: token
					},
					body: {
						dslabel,
						embedder: location.hostname
					}
				})
				// TODO: later may check against expiration time in response if included
				this.verifiedToken = data.status === 'ok' && token
			} else {
				throw `unsupported requiredAuth='${auth.type}'`
			}
		} catch (e) {
			throw e
		}
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

export const appInit = getAppInit(MassApp)

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
