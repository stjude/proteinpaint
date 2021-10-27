import { RegressionInputs } from './regression.inputs'
import { RegressionResults } from './regression.results'
import { getCompInit } from '../common/rx.core'
import { select } from 'd3-selection'
import { sayerror } from '../dom/error'

/*
	Code architecture:

	regression.js
	- regression.inputs.js
		- regression.pills.js // pill.main() validates the term/q
		- regression.valuesTable.js // termsetting.validateQ()
		- may add separate code file for each non-term variable type (genotype, sample list)
	- regression.results.js
*/

class Regression {
	constructor(opts) {
		this.type = 'regression'
	}

	async init(appState) {
		this.dom = {
			header: this.opts.header, // header is optional
			errordiv: this.opts.holder.append('div'),
			inputs: this.opts.holder.append('div'),
			results: this.opts.holder.append('div').style('margin-left', '40px')
		}

		const config = appState.plots.find(p => p.id === this.id)

		this.inputs = new RegressionInputs({
			app: this.app,
			parent: this,
			id: this.id,
			holder: this.dom.inputs,
			regressionType: this.regressionType
		})

		this.results = new RegressionResults({
			app: this.app,
			parent: this,
			id: this.id,
			holder: this.dom.results,
			regressionType: config.regressionType
		})
	}

	getState(appState, sub) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		if (!config.regressionType) throw 'regressionType is required'
		// TODO change config.term to config.outcome{}
		return {
			vocab: appState.vocab,
			formIsComplete: config.term && config.independent.length,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config: {
				term: config.term,
				regressionType: config.regressionType,
				independent: config.independent,
				settings: {
					table: config.settings && config.settings.regression
				}
			}
		}
	}

	async main() {
		try {
			this.config = JSON.parse(JSON.stringify(this.state.config))
			// TODO update header upon selecting/updating outcome
			if (this.dom.header) {
				const termLabel = (this.config.term && this.config.term.term.name) || ''
				this.dom.header.html(
					termLabel +
						`<span style="opacity:.6;font-size:.7em;margin-left:10px;"> ${this.config.regressionType.toUpperCase()} REGRESSION</span>`
				)
			}
			await this.inputs.main(this.config)
			await this.results.main(this.config)
			await this.inputs.updateSubmitButton(true)
		} catch (e) {
			sayerror(this.dom.errordiv, 'Error: ' + (e.error || e))
			if (e.stack) console.log(e.stack)
		}
	}
}

export const regressionInit = getCompInit(Regression)
// this alias will allow abstracted dynamic imports
export const componentInit = regressionInit
