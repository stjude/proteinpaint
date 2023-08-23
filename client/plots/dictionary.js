import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'

class MassDict {
	constructor(opts) {
		this.type = 'tree'
		const div = opts.holder.append('div').style('display', 'flex')
		const holder = div.append('div').style('padding', '20px').style('width', '30%')
		const contentDiv = div.append('div')
		this.dom = {
			holder,
			contentDiv,
			header: opts.header
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		this.sample = config.sample
		this.showContent = config.showContent
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
		if (this.sample && this.showContent) {
			this.dom.holder
				.style('border-right', '1px solid gray')
				.style('overflow', 'scroll')
				.attr('class', 'sjpp_hide_scrollbar')
			this.dom.contentDiv
				.style('width', '60%')
				.style('min-height', '500px')
				.style('display', 'flex')
				.style('flex-direction', 'column')
				.style('justify-content', 'center')
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
		if (this.sample && this.showContent) {
			if (this.state.termdbConfig.queries?.singleSampleMutation) {
				const div = this.dom.contentDiv.append('div')
				div.style('font-weight', 'bold').style('padding', '20px').text('Disco plot')
				const discoPlotImport = await import('./plot.disco.js')
				discoPlotImport.default(
					this.state.termdbConfig,
					this.state.vocab.dslabel,
					this.sample,
					this.dom.contentDiv.append('div'),
					this.app.opts.genome
				)
			}
			if (this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
				for (const k in this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
					const div = this.dom.contentDiv.append('div').style('padding', '20px')
					const label = k.match(/[A-Z][a-z]+|[0-9]+/g).join(' ')
					div.append('div').style('font-weight', 'bold').text(label)

					const ssgqImport = await import('./plot.ssgq.js')
					await ssgqImport.plotSingleSampleGenomeQuantification(
						this.state.termdbConfig,
						this.state.vocab.dslabel,
						k,
						this.sample,
						div,
						this.app.opts.genome
					)
				}
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
