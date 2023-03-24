import { getAppInit } from '../rx'
import { select } from 'd3-selection'
import { storeInit } from './store'
import { vocabInit } from '#termdb/vocabulary'
import { navInit } from './nav'
import { plotInit } from './plot'
import { summaryInit } from '#plots/summary'
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
		if (opts.addLoginCallback) {
			opts.addLoginCallback(() => this.api.dispatch({ type: 'app_refresh' }))
		}

		this.type = 'app'
		// this will create divs in the correct order
		this.dom = {
			holder: opts.holder, // do not modify holder style
			topbar: opts.holder.append('div'),
			errdiv: opts.holder.append('div'),
			filterBelowMinSampleWarning: makeFilterBelowMinSampleWarning(opts.holder),
			plotDiv: opts.holder.append('div')
		}

		// track plots by ID, and assign
		this.plotIdToSandboxId = {}
	}

	validateOpts(o = {}) {
		if (!o.holder) throw `missing opts.holder in the MassApp constructor argument`
		if (!o.callbacks) o.callbacks = {}
		if (!o.state.vocab) o.state.vocab = {}
		if (typeof o.state.vocab != 'object') throw 'opts.state.vocab{} is not an object'
		if (o.state.genome) {
			o.state.vocab.genome = o.state.genome
			delete o.state.genome
		}
		if (o.state.dslabel) {
			o.state.vocab.dslabel = o.state.dslabel
			delete o.state.dslabel
		}
		return o
	}

	async preApiFreeze(api) {
		try {
			api.tip = new Menu({ padding: '5px' })
			api.printError = e => this.printError(e)
			const vocab = this.opts.state.vocab

			// TODO: only pass state.genome, dslabel to vocabInit
			api.vocabApi = await vocabInit({
				app: api,
				state: { vocab: this.opts.state.vocab },
				fetchOpts: this.opts.fetchOpts,
				getDatasetAccessToken: this.opts.getDatasetAccessToken
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
			this.components = {}
			if (this.state.nav.header_mode != 'hidden') {
				this.components.nav = await navInit({
					app: this.api,
					holder: this.dom.topbar,
					header_mode: this.state && this.state.nav && this.state.nav.header_mode,
					vocab: this.state.vocab,
					massSessionDuration: this.state.termdbConfig.massSessionDuration // this.opts.massSessionDuration
				})
			}
			this.components.plots = {}
			await this.api.dispatch()
		} catch (e) {
			this.printError(e)
			throw e
		}
	}

	async main() {
		await this.api.vocabApi.main()

		const newPlots = {}
		let sandbox
		for (const plot of this.state.plots) {
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
		if (e.filterBelowMinSample) {
			// display special message for this issue
			const w = this.dom.filterBelowMinSampleWarning
			w.holder.style('display', '')
			w.count.text(e.filterBelowMinSample.count)
			w.cutoff.text(e.filterBelowMinSample.cutoff)
			return
		}

		sayerror(this.dom.errdiv || this.opts.holder, 'Error: ' + (e.message || e))
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

function makeFilterBelowMinSampleWarning(div) {
	const holder = div
		.append('div')
		.style('display', 'none')
		.style('padding', '20px')
		.style('margin', '20px')
		.style('background', '#fae3e1')

	// line 1
	const p = holder.append('p')
	p.append('span').html('You have filtered down to&nbsp;')
	const count = p.append('span')
	p.append('span').html('&nbsp;samples, below the allowed minimum of&nbsp;')
	const cutoff = p.append('span')
	p.append('span').html(
		'.<br>The portal is now disabled for protection of individual-level data. Please widen your filter to increase the number of samples above the cutoff and reenable the portal.'
	)

	// line 2
	holder
		.append('p')
		.append('span')
		.text('Dismiss')
		.style('font-weight', 'bold')
		.attr('class', 'sja_clbtext2')
		.on('click', () => holder.style('display', 'none'))

	return { holder, count, cutoff }
}
