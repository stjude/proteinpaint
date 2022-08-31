import { getAppInit } from '../rx'
import { select } from 'd3-selection'
import { storeInit } from '#mass/store'
import { vocabInit } from '#termdb/vocabulary'
import { sayerror } from '#dom/error'
import { Menu } from '#dom/menu'

/*
	opts{}
	.holder 	d3-wrapped DOM container

	.vocabApi required if state.vocab is not provided
	
	.state: {
		
		// required if opts.vocabApi is not provided
		.vocab: { 
			genome
			dslabel
		}
		
		// required
		plots[{}] options for rendering 1 or more plot(s), for example:

		[{
			chartType: 'barchart',
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

class PlotApp {
	constructor(opts) {
		this.type = 'app'
		// this will create divs in the correct order
		this.dom = {
			errdiv: opts.holder.append('div'),
			plotDiv: opts.holder.append('div')
		}
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
			throw e
		}
	}

	async init() {
		// catch initialization error
		try {
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.components = {
				plots: []
			}
			await this.api.dispatch()
		} catch (e) {
			this.printError(e)
			throw e
		}
	}

	async main() {
		this.api.vocabApi.main()
		for (const [index, plot] of this.state.plots.entries()) {
			if (!plot.id) plot.id = `mds3bar_${+new Date()}_${Math.random()}`
			if (!this.components.plots.find(p => p.id === plot.id)) {
				const _ = await import(`../plots/${plot.chartType}.js`)

				const plotInstance = await _.componentInit({
					id: plot.id,
					app: this.api,
					holder: this.dom.plotDiv
				})

				this.components.plots.push(plotInstance)
			}
		}
	}

	printError(e) {
		sayerror(this.dom.errdiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

export const appInit = getAppInit(PlotApp)

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
