import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'

class MassDict {
	constructor(opts) {
		this.type = 'tree'
		const div = opts.holder.append('div').style('display', 'flex')
		const holder = div.append('div').style('padding', '20px')
		const contentDiv = div.append('div').style('width', '70%')
		this.dom = {
			holder,
			contentDiv,
			header: opts.header
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		this.sample = config.sample
		this.tree = await appInit({
			vocabApi: this.app.vocabApi,
			holder: this.dom.holder,
			state: this.getState(appState),
			tree: {
				click_term: _term => {
					const term = _term.term || _term
					this.app.dispatch({
						type: 'plot_create',
						config: {
							chartType: term.type == 'survival' ? 'survival' : 'summary',
							term: _term.term ? _term : 'id' in term ? { id: term.id, term } : { term }
						}
					})

					this.app.dispatch({
						type: 'plot_delete',
						id: this.id
					})
				}
			}
		})
		if (this.sample) {
			this.dom.holder.style('width', '30%').style('border-right', '1px solid gray')
		}
	}

	getState(appState) {
		return {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			selectdTerms: appState.selectedTerms,
			customTerms: appState.customTerms,
			termdbConfig: appState.termdbConfig,
			sampleId: this.sample?.sampleId
		}
	}

	async main() {
		if (this.dom.header) this.dom.header.html(this.sample ? `${this.sample.sample} Dictionary` : 'Dictionary')
		this.tree.dispatch({
			type: 'app_refresh',
			state: this.state
		})
		if (this.sample) {
			if (this.state.termdbConfig.queries?.singleSampleMutation) {
				const discoPlotImport = await import('./plot.disco.js')
				discoPlotImport.default(
					this.state.termdbConfig,
					this.state.vocab.dslabel,
					this.sample,
					this.dom.contentDiv,
					this.app.opts.genome
				)
			}
		}
	}
}

export const dictInit = getCompInit(MassDict)
export const componentInit = dictInit

export function getPlotConfig(opts, app) {
	// currently, there are no configurations options for
	// the dictionary tree; may add appearance, styling options later
	const config = {}
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
