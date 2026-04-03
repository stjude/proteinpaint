import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'

class MassDict {
	static type = 'tree'

	constructor(opts) {
		this.type = MassDict.type
		this.dom = {
			holder: opts.holder.style('padding', '20px'),
			header: opts.header
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const opts = {
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
							term: _term.term ? _term : { term }
						}
					})

					this.app.dispatch({
						type: 'plot_delete',
						id: this.id
					})
				}
			}
		}
		if (config?.scItem) {
			opts.tree.usecase = {
				target: 'dictionary',
				specialCase: { type: 'singleCell', config: { sample: config.scItem.sample } }
			}
		}
		this.tree = await appInit(opts)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const tree = { usecase: { target: 'dictionary' } }
		if (config?.scItem?.sample)
			tree.usecase.specialCase = { type: 'singleCell', config: { sample: config.scItem.sample } }
		return {
			tree,
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			selectdTerms: appState.selectedTerms,
			customTerms: appState.customTerms
		}
	}

	main() {
		if (this.dom.header) this.dom.header.text('Data Variables')
		this.tree.dispatch({
			type: 'app_refresh',
			state: this.state
		})
	}
}

export const dictInit = getCompInit(MassDict)
export const componentInit = dictInit

export function getPlotConfig(opts, app) {
	// currently, there are no configurations options for
	// the dictionary tree; may add appearance, styling options later
	const config = { hidePlotFilter: true }
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
