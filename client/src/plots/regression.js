import { RegressionInputs } from './regression.inputs'
import { RegressionResults } from './regression.results'
import { getCompInit } from '../common/rx.core'
import { select } from 'd3-selection'
import { sayerror } from '../dom/error'

/*
Code architecture:

	regression.js
	- regression.inputs.js
		- regression.inputs.term.js // for varClass=term
		- add new scripts for new varClass
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

		// where is this.id assigned?
		const config = appState.plots.find(p => p.id === this.id)

		this.inputs = new RegressionInputs({
			app: this.app,
			parent: this,
			id: this.id,
			holder: this.dom.inputs,
			regressionType: config.regressionType
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
		return {
			vocab: appState.vocab,
			formIsComplete: config.outcome && config.independent.length,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config
		}
	}

	/* do not set reactsTo
	so it reacts to all actions
	including filter/cohort change
	*/

	async main() {
		try {
			this.config = JSON.parse(JSON.stringify(this.state.config))
			await this.inputs.main()
			await this.results.main()
			await this.inputs.updateSubmitButton(true)
		} catch (e) {
			if (this.inputs.hasError) this.results.main(this.config) // purpose??
			sayerror(this.dom.errordiv, 'Error: ' + (e.error || e))
			if (e.stack) console.log(e.stack)
		}
	}
}

export const regressionInit = getCompInit(Regression)
// this alias will allow abstracted dynamic imports
export const componentInit = regressionInit
