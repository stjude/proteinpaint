import { RegressionInputs } from './regression.inputs'
import { RegressionResults } from './regression.results'
import { getCompInit, copyMerge } from '../common/rx.core'
import { select } from 'd3-selection'
import { sayerror } from '../dom/error'
import { fillTermWrapper } from '../common/termsetting'

/*
Code architecture:

regression.js
	regression.inputs.js
		regression.inputs.term.js
			regression.inputs.values.table.js
	regression.results.js
*/

class Regression {
	constructor(opts) {
		this.type = 'regression'
		this.genomeObj = opts.app.opts.genome
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
			config,
			allowedTermTypes: appState.termdbConfig.allowedTermTypes
		}
	}

	/* do not set reactsTo
	so it reacts to all actions matching with the plot id (controlled by store method)
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
			(o ? o.term.name : '') +
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
	// TODO need to supply term filter of app to fillTermWrapper
	if (!opts.outcome) {
		opts.outcome = {}
	}

	{
		/* for condition term as outcome, it will have q.mode='binary', rather than default "discrete"
		as required by logistic/cox regression
		*/
		const plot = app.opts.state.plots.find(i => i.chartType == 'regression')
		if (!plot) throw 'regression plot missing in state'
		await fillTermWrapper(opts.outcome, app.vocabApi, get_defaultQ4fillTW(plot.regressionType, true))
	}

	const id = 'id' in opts ? opts.id : `_REGRESSION_${_ID_++}`
	const config = { id }
	config.outcome = opts.outcome

	if (opts.independent) {
		if (!Array.isArray(opts.independent)) throw '.independent[] is not array'
		for (const t of opts.independent) {
			// condition term cannot be used as independent terms
			// thus no need to specify context
			await fillTermWrapper(t, app.vocabApi)
		}
		config.independent = opts.independent
		delete opts.independent
	} else {
		config.independent = []
	}
	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}

export function get_defaultQ4fillTW(regressionType, isOutcome) {
	if (!isOutcome) return
	// need default q{} for condition term
	const q = { mode: 'binary' }
	if (regressionType == 'cox') {
		q.timeScale = 'year'
	}
	return { condition: q }
}
