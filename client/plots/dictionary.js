import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'

/*
constructor options can be one of below
TODO clarify usecase for each

opts = {
	holder: <d3 wrapped>
	header?: <d3 wrapped>
}

or:

opts = {
	holder: { app_div, body, header } // created by newSandboxDiv()
}

TODO support opts.headerText

*/

class MassDict {
	constructor(opts) {
		this.type = 'tree'
		if (opts.holder.body && opts.holder.header) {
			this.dom = {
				holder: opts.holder.body,
				header: opts.holder.header
			}
		} else {
			this.dom = {
				holder: opts.holder.style('padding', '20px'),
				header: opts.header
			}
		}
	}

	async init(appState) {
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
							term: _term.term ? _term : { term }
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
			tree: { usecase: { target: 'dictionary' } },
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			selectdTerms: appState.selectedTerms,
			customTerms: appState.customTerms
		}
	}

	main() {
		if (this.dom.header) this.dom.header.html('Data Dictionary')
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
