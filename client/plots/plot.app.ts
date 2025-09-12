import { AppApi, type RxApp, type ComponentApi } from '../rx'
import { AppBase } from '#plots/AppBase.ts'
import { storeInit } from '#mass/store'
import { vocabInit } from '#termdb/vocabulary'
import { recoverInit } from '../rx/src/recover'
import { sayerror, Menu } from '#dom'
import { importPlot } from '#plots/importPlot.js'

/*
the purpose of this wrapper is to allow a mass plot to be used with control options outside of mass app

TODO allow to hide controls. e.g. in the cuminc plot integrated into cox-snplocus, allowing to get rid of duplicating code of Cuminc class in cuminc.js

FIXME convert to ts and fully type opts

constructor options (opts)

	.holder
		d3-wrapped DOM container

	.vocabApi
		required if state.vocab is not provided

	.violin{}
		.mode='minimal'??

	.app{}
		.features{}
		.getPlotHolder() ??

	.fetchOpts{}
	.state: {
		
		// required if opts.vocabApi is not provided
		.vocab: { 
			genome
			dslabel
		}
		
		// required
		plots[{}] options for rendering 1 or more plot(s), for example:

		[{
			chartType: 'summary',
			childType: 'barchart',
			term: {},
			term2: {},
			settings: {
				barchart: {
					unit: 'pct'
				}
			}
		}]
	}
*/

class PlotApp extends AppBase implements RxApp {
	// expected RxApp, some are already declared/set in AppBase
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
	store: any
	bus!: any

	constructor(opts, api) {
		super(opts)
		this.api = api
		this.type = 'app'
		this.dom = this.getDom(opts)
	}

	getDom(opts) {
		// this will create divs in the correct stacking order
		const dom: { [index: string]: any } = {
			holder: opts.holder,
			errdiv: opts.holder.append('div'),
			plotDiv: opts.holder.append('div')
		}
		const controls = opts.violin?.mode == 'minimal' ? null : opts.holder.append('div').style('white-space', 'nowrap')
		if (controls) {
			dom.plotControls = controls.append('div').style('display', 'inline-block')
			dom.recoverControls = controls.append('div').style('display', 'inline-block')
		}
		return dom
	}

	async preApiFreeze(api) {
		try {
			api.tip = new Menu({ padding: '5px' })
			api.printError = e => this.printError(e)

			const vocab = this.opts.state.vocab

			api.vocabApi = this.opts.vocabApi
				? this.opts.vocabApi
				: await vocabInit({
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
			console.log(`preApiFreeze error`, e)
			throw e
		}
	}

	async init() {
		// catch initialization error
		try {
			// this plot.app does not create a this.components.nav, unlike mass/app.js
			// so the nav is always hidden, can be hardcoded here
			this.opts.state.nav = { header_mode: 'hidden' }
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.components = {
				plots: {}
			}
			if (this.opts.app?.features?.includes('recover'))
				this.components.recover = await recoverInit({
					app: this.api,
					holder: this.dom.recoverControls,
					// TODO: ???? may limit the tracked state to only the filter, activeCohort ???
					getState: appState => appState,
					//reactsTo: action => true, //action.type != 'plot_edit' || action.type == 'app_refresh',
					maxHistoryLen: 10
				})

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
		this.api.vocabApi.main()

		for (const id in this.components.plots) {
			const plot = this.components.plots[id]
			if (!this.state.plots.find(p => p.id === plot.id)) {
				plot.destroy()
				delete this.components.plots[id]
			}
		}

		for (const plot of this.state.plots.values()) {
			if (!this.components.plots[plot.id]) {
				const holder = this.opts?.app?.getPlotHolder
					? this.opts.app.getPlotHolder(plot, this.dom.holder)
					: this.dom.holder.append('div')

				// quick fix to only track the plotDiv for the first plot
				// TODO: reliably handle the case where a plotApp instance may have multiple plots/holders
				if (!this.dom.plotDiv) this.dom.plotDiv = holder
				const { componentInit } = await importPlot(plot.chartType)
				const plotApi = await componentInit({
					id: plot.id,
					app: this.api,
					holder,
					controls: this.dom.plotControls
				})
				this.components.plots[plot.id] = plotApi
			}
		}
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
		this.bus.emit('error')
	}

	destroy() {
		if (this.dom?.holder) this.dom.holder.selectAll('*').remove()
	}
}

export const appInit = AppApi.getInitFxn(PlotApp)
