import { RegressionInputs } from './regression.inputs'
import { RegressionResults } from './regression.results'
import { getCompInit, copyMerge } from '../rx'
import { sayerror } from '../dom/sayerror.ts'
import { fillTermWrapper } from '#termsetting'
import { getCombinedTermFilter } from '#filter'
import { PlotBase } from '#plots/PlotBase.js'

/*
Code architecture:

regression.js
	regression.inputs.js
		regression.inputs.term.js
			regression.inputs.values.table.js
	regression.results.js
*/

class Regression extends PlotBase {
	constructor(opts) {
		super(opts)
		this.type = 'regression'
		this.genomeObj = opts.app.opts.genome
	}

	async init(appState) {
		this.dom = {
			header: this.opts.header, // header is optional
			errordiv: this.opts.holder.append('div'),
			inputs: this.opts.holder.append('div').style('margin', '20px 10px'),
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
		const parentConfig = this.parentId && appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)
		return {
			vocab: appState.vocab,
			formIsComplete: config.outcome && config.independent.length,
			activeCohort: appState.activeCohort,
			termfilter,
			config,
			allowedTermTypes: appState.termdbConfig.allowedTermTypes,
			minTimeSinceDx: appState.termdbConfig.minTimeSinceDx
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
			this.getFilter()
			await this.inputs.main()
			await this.results.main()
			this.inputs.resetSubmitButton()
			this.inputs.mayShowUnivariateCheckbox()
			this.inputs.mayShowSubmitMsgs()
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

	getFilter() {
		// regression analysis may have multiple
		// filters (e.g. term filter + restrict ancestry filter)
		// so track all filters here
		const filters = []

		// term filter
		if (this.state.termfilter?.filter) filters.push(this.state.termfilter.filter)

		// restrict ancestry filter
		const tws = [this.config.outcome, ...this.config.independent]
		const tws_restrictAncestry = tws.filter(tw => tw?.q.restrictAncestry)
		if (tws_restrictAncestry.length) {
			if (tws_restrictAncestry.length > 1) {
				const ancestries = new Set(tws_restrictAncestry.map(tw => tw.q.restrictAncestry.name))
				if (ancestries.size > 1) throw 'samples cannot be restricted to more than 1 ancestry'
			}
			const tw = tws_restrictAncestry[0]
			filters.push({ type: 'tvs', tvs: tw.q.restrictAncestry.tvs })
			// notify user that samples will be restricted by ancestry
			this.inputs.submitMsgs.restrictAncestry = `Restricting analysis to samples of ${tw.q.restrictAncestry.name}`
		} else {
			delete this.inputs.submitMsgs.restrictAncestry
		}

		// store filters
		// vocabApi will use getNormalFilter() to remove any empty filters and convert a single entry tvslst into a tvs
		this.filter = { type: 'tvslst', join: 'and', lst: filters }
	}
}

export const regressionInit = getCompInit(Regression)
// this alias will allow abstracted dynamic imports
export const componentInit = regressionInit

let _ID_ = 1

export async function getPlotConfig(opts, app) {
	// TODO need to supply term filter of app to fillTermWrapper
	if (!opts.outcome) opts.outcome = {}

	{
		/* for condition term as outcome, it will have q.mode='binary', rather than default "discrete"
		as required by logistic/cox regression
		*/
		// const plot = app.opts.state.plots.find(i => i.chartType == 'regression')
		// if (!plot) throw 'regression plot missing in state'
		// await fillTermWrapper(opts.outcome, app.vocabApi, get_defaultQ4fillTW(plot.regressionType, 'outcome'))

		// !!!
		// the code above assumes that a regression plot exists, and that the first one
		// relates to this particular opts.outcome, which may not be true when recovering a saved session
		// with multiple regression plots
		// !!!
		// should check that the conditions are actually matched before using fillTermWrapper
		await fillTermWrapper(opts.outcome, app.vocabApi, get_defaultQ4fillTW(opts.regressionType, 'outcome'))
	}

	const id = 'id' in opts ? opts.id : `_REGRESSION_${_ID_++}`
	const config = { id }
	config.outcome = opts.outcome

	if (opts.independent) {
		if (!Array.isArray(opts.independent)) throw '.independent[] is not array'
		for (const t of opts.independent) {
			// for numeric variables, set default mode to continuous
			const defaultQ = !t.q?.mode ? { numeric: { mode: 'continuous' } } : undefined
			await fillTermWrapper(t, app.vocabApi, defaultQ)
		}
		config.independent = opts.independent
		//delete opts.independent // not sure why this has to be deleted? it causes an issue with file-based session recovery
	} else {
		config.independent = []
	}
	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}

export function get_defaultQ4fillTW(regressionType, useCase = '') {
	const defaultQ = {}

	// numeric term
	defaultQ['numeric'] = regressionType == 'logistic' && useCase == 'outcome' ? { mode: 'binary' } : { mode: 'discrete' }

	// categorical term
	defaultQ['categorical'] =
		regressionType == 'logistic' && useCase == 'outcome' ? { mode: 'binary' } : { mode: 'discrete' }

	// condition term
	if (useCase == 'outcome') {
		if (regressionType == 'cox') {
			// do not preset timeScale to 'time' here because
			// that can cause copyMerge to overwrite saved setting
			// fillTW will auto fill missing value
			defaultQ.condition = { mode: 'cox' }
		}
		if (regressionType == 'logistic') {
			defaultQ.condition = { mode: 'binary' }
		}
	}

	// geneVariant term
	defaultQ['geneVariant'] = { type: 'predefined-groupset' }

	return defaultQ
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
	*/
	const allMethods = [
		{ label: 'Linear', type: 'linear' },
		{ label: 'Logistic', type: 'logistic' },
		{ label: 'Cox', type: 'cox' }
	]
	const useMethods = allMethods.filter(i => chartsInstance.state.currentCohortChartTypes.includes(i.type))
	if (useMethods.length == 0) return holder.append('div').text('Error: no methods available')
	if (useMethods.length == 1) {
		// only 1 method supported. directly show ui for this method but not menu
		chartsInstance.dom.tip.hide()
		chartsInstance.prepPlot({
			config: {
				chartType: 'regression',
				regressionType: useMethods[0].type,
				independent: []
			}
		})
		return
	}
	// multiple methods. show menu to list them
	for (const { label, type } of useMethods) {
		holder
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(label)
			.on('click', () => {
				chartsInstance.dom.tip.hide()
				chartsInstance.prepPlot({
					config: {
						chartType: 'regression',
						regressionType: type,
						independent: []
					}
				})
			})
	}
}
