import { AppApi, type StoreApi, type ComponentApi, type RxAppInner } from '../rx'
import { AppBase } from '#plots/AppBase.ts'
import { storeInit } from './store'
import { vocabInit } from '#termdb/vocabulary'
import { navInit } from './nav'
import { plotInit } from './plot'
import { summaryInit } from '#plots/summary.js'
import { sayerror } from '../dom/sayerror.ts'
import { Menu } from '#dom/menu'
import { newSandboxDiv } from '../dom/sandbox.ts'

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

.app
	.onFilterChange
	If it is provided when the global filter is edited
	this function is called (from mass/store). Used by the profile dataset so far,
	to clear the profile local filters
                

*/

class MassApp extends AppBase implements RxAppInner {
	static type = 'app'

	// expected RxAppInner, some are already declared/set in AppBase
	api: AppApi
	type: string
	parentId?: string
	dom!: {
		[index: string]: any
	}
	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}

	wasDestroyed = false
	store!: StoreApi
	plotIdToSandboxId: { [plotId: string]: string }
	bus!: any

	// expected class-specific props

	constructor(opts, api) {
		super(opts)
		this.api = api

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

	async preApiFreeze(api) {
		try {
			api.tip = new Menu({ padding: '5px' })
			api.tip.d.on('keyup', event => {
				if (event.key == 'Escape') api.tip.hide()
			})
			api.printError = e => this.printError(e)

			// TODO: only pass state.genome, dslabel to vocabInit
			api.vocabApi = await vocabInit({
				app: api,
				state: { vocab: this.opts.state.vocab },
				fetchOpts: this.opts.fetchOpts,
				getDatasetAccessToken: this.opts.getDatasetAccessToken
			})

			api.hasWebGL = function () {
				//Copied from static/js/WEBGL.js
				try {
					const canvas = document.createElement('canvas')
					return !!(
						window.WebGLRenderingContext &&
						(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
					)
				} catch (_) {
					return false
				}
			}
			// the vocabApi's vocab may be reprocessed from the original input
			this.opts.state.vocab = api.vocabApi.vocab
		} catch (e) {
			console.log(`preApiFreeze error`, e)
			throw e
		}
	}

	async init() {
		// catch initialization error
		try {
			// TODO: may default later to having a debouncer ???
			const debounceInterval = 'debounceInterval' in this.opts ? this.opts.debounceInterval : 0
			// NOTE: Within the same browser tab, a refresh should load the embedder's intended page
			// and not the recovered session, to avoid confusing default page load behavior. If a user
			// wants to see the initial recovered state view in the embedder portal, they would have
			// to click on a link again. May revisit this approach and reactivate the commented out code below.
			const embeddedSessionState = this.opts.embeddedSessionState // || JSON.parse(sessionStorage.getItem('embeddedSessionState') || `null`)
			if (embeddedSessionState) {
				// may assume session state recovery for an embedder portal
				// see the comment about potential race-condition in childCorsMessage embedder-helpers.js
				Object.assign(this.opts.state, embeddedSessionState)
			}
			this.store = await storeInit({ app: this.api, state: this.opts.state, debounceInterval })
			this.state = await this.store.copyState()
			this.components = {}
			if (this.state.nav.header_mode != 'hidden') {
				this.components.nav = await navInit({
					app: this.api,
					holder: this.dom.topbar,
					header_mode: this.state && this.state.nav && this.state.nav.header_mode,
					vocab: this.state.vocab,
					massSessionDuration: this.state.termdbConfig.massSessionDuration, // this.opts.massSessionDuration
					pkgver: this.opts.pkgver
				})
			}
			this.components.plots = {}
			if (this.opts.app?.doNotAwaitInitRender) {
				// do not await to return the instance sooner and allow calling appApi.triggerAbort() before initial render,
				// instead of waiting for initial data loading and rendering
				this.api.dispatch()
			} else {
				await this.api.dispatch()
			}
		} catch (e) {
			this.printError(e)
			throw e
		}
	}

	async main() {
		await this.api.vocabApi.main()
		//Do not show the plots below the about tab
		this.dom.plotDiv?.style(
			'display',
			this.state.nav?.header_mode != 'hidden' && this.state.nav?.activeTab == 0 ? 'none' : 'block'
		)

		const newPlots = {}
		let sandbox
		for (const plot of this.state.plots) {
			// plots with parentId means the parent plot will trigger the plot instead of being triggered here
			if (plot.parentId) continue
			if (this.components.plots && !(plot.id in this.components.plots)) {
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
				if (plot.chartType == 'summary')
					newPlots[plot.id] = summaryInit(Object.assign({ app: this.api, holder: sandbox }, plot))
				else newPlots[plot.id] = plotInit(Object.assign({ app: this.api, holder: sandbox }, plot))
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
			}
		}

		for (const plotId in this.components.plots) {
			if (!this.state.plots.find(p => p.id === plotId)) {
				this.components.plots[plotId].destroy()
				delete this.components.plots[plotId]
			}
		}
	}

	printError(e) {
		const errdiv = e.errdiv || this.dom.errdiv
		if (errdiv) errdiv.style('display', '').html('').style('background-color', '')
		sayerror(errdiv || this.opts.holder, 'Error: ' + (e.message || e.error || e))
		if (e.stack) console.log(e.stack)
		this.bus.emit('error')
	}
}

export const appInit = AppApi.getInitFxn(MassApp)
