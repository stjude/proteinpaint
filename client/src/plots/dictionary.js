import { getCompInit, copyMerge } from '../common/rx.core'
import { appInit } from '../../termdb/app'

class MassDict {
	constructor(opts) {
		this.type = 'tree'
		this.dom = {
			holder: opts.holder.style('padding', '20px'),
			header: opts.header
		}
	}

	async init(appState) {
		this.tree = await appInit({
			holder: this.dom.holder,
			state: this.getState(appState),
			tree: {
				click_term: term => {
					this.app.dispatch({
						type: 'plot_create',
						config: {
							chartType: term.type == 'survival' ? 'survival' : 'barchart',
							term: { id: term.id, term }
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
			termfilter: appState.termfilter
		}
	}

	main() {
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
