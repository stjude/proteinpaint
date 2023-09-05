import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'

export class MassDict {
	constructor(opts) {
		this.type = 'tree'
		const mainDiv = opts.holder.append('div').style('padding', '20px')
		const treeDiv = mainDiv.insert('div').style('display', 'inline-block')
		this.dom = {
			mainDiv,
			treeDiv,
			header: opts.header
		}
	}

	async init(appState) {
		this.tree = await appInit({
			vocabApi: this.app.vocabApi,
			holder: this.dom.treeDiv,
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
	}

	getState(appState) {
		return {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			selectdTerms: appState.selectedTerms,
			customTerms: appState.customTerms,
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		if (this.dom.header) this.dom.header.html('Dictionary')
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
	const config = {}
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
