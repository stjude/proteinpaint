import { RegressionInputs } from './regression.inputs'
import { RegressionResults } from './regression.results'
import { getCompInit, copyMerge } from '../common/rx.core'
import { select } from 'd3-selection'
import { sayerror } from '../dom/error'
import { fillTermWrapper } from '../common/termsetting'

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

		// this.id is from opts.id and assigned by rx
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
			this.mayUpdateSandboxHeader()
			await this.inputs.main()
			await this.results.main()
			this.inputs.resetSubmitButton()
		} catch (e) {
			if (this.inputs.hasError) {
				// will hide the results ui
				this.results.main()
			}
			sayerror(this.dom.errordiv, 'Error: ' + (e.error || e))
			if (e.stack) console.log(e.stack)
		}
	}

	mayUpdateSandboxHeader() {
		if (!this.dom.header) return
		// based on data in config state, but not section
		const o = this.config.outcome
		this.dom.header.html(
			(o ? o[o.varClass].name : '') +
				'<span style="opacity:.6;font-size:.7em;margin-left:10px;">' +
				this.config.regressionType.toUpperCase() +
				' REGRESSION</span>'
		)
	}
}

export const regressionInit = getCompInit(Regression)
// this alias will allow abstracted dynamic imports
export const componentInit = regressionInit

let _ID_ = 1

export async function getPlotConfig(opts, app) {
	if (!opts.outcome) {
		opts.outcome = {}
	}
	if (!opts.outcome.varClass) {
		// FIXME: harcoded empty varClass, for now
		opts.outcome.varClass = 'term'
	}
	if (opts.outcome.varClass == 'term') {
		await fillTermWrapper(opts.outcome, app.vocabApi)
	} else {
		throw 'unknown outcome.varClass'
	}

	const id = 'id' in opts ? opts.id : `_REGRESSION_${_ID_++}`
	const config = { id }
	config.outcome = opts.outcome

	if (opts.independent) {
		for (const t of opts.independent) {
			if (t.varClass == 'term') {
				await fillTermWrapper(t, app.vocabApi)
			} else {
				throw 'unknown independent.varClass'
			}
		}
		config.independent = opts.independent
		delete opts.independent
	} else {
		config.independent = []
	}
	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
