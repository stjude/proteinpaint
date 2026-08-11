import { RegressionInputs } from './regression.inputs'
import { RegressionResults } from './regression.results'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi, type AppApi } from '#rx'
import { sayerror } from '#dom'
import { fillTermWrapper } from '#termsetting'
import { getCombinedTermFilter } from '#filter'
import { PlotBase } from '#plots/PlotBase.js'
import { numericTypes, dictionaryNumericTypes } from '#shared'
import { getActiveCohortStr } from '#mass/charts'
import type { ClientGenome } from '../../types/clientGenome'
import type { Filter } from '#types'

/*
Code architecture:

regression.js
	regression.inputs.js
		regression.inputs.term.js
			regression.inputs.values.table.js
	regression.results.js
*/

class Regression extends PlotBase implements RxComponent{
	static type = 'regression'

	type: string
	genomeObj: ClientGenome
	inputs!: RegressionInputs
	results!: RegressionResults
	filter!: Filter
	config: any

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = Regression.type
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

	getState(appState) {
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
		} catch (e: any) {
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
		const filters: unknown[] = []

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
		this.filter = { type: 'tvslst', join: 'and', lst: filters as any } as Filter
	}
}

export const regressionInit = getCompInit(Regression)
// this alias will allow abstracted dynamic imports
export const componentInit = regressionInit

let _ID_ = 1

export async function getPlotConfig(opts: any, app: AppApi, activeCohort: number) {
	// TODO need to supply term filter of app to fillTermWrapper
	if (!opts.outcome) opts.outcome = mayGetLoneOutcome(opts.regressionType, app, activeCohort)

	const id = 'id' in opts ? opts.id : `_REGRESSION_${_ID_++}`
	const config: any = { id }
	// without an outcome, config.outcome is left unset rather than "outcome:undefined",
	// so that the input ui shows a blank outcome pill for user to fill in
	if (opts.outcome) {
		await fillTermWrapper(opts.outcome, app.vocabApi, get_defaultQ4fillTW(opts.regressionType, 'outcome'))
		config.outcome = opts.outcome
	}

	if (opts.independent) {
		if (!Array.isArray(opts.independent)) throw '.independent[] is not array'
		for (const t of opts.independent) {
			await fillTermWrapper(
				t,
				app.vocabApi,
				t.q?.mode ? undefined : get_defaultQ4fillTW(opts.regressionType, 'independent')
			)
		}
		config.independent = opts.independent
	} else {
		config.independent = []
	}
	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}

/*
returns a tw-shaped {term} when the dataset offers just one term usable as this method's outcome,
so the outcome pill is prefilled rather than making user open the tree to pick the only choice
(e.g. gdc, with its single hardcoded "Overall Survival" term); otherwise returns undefined

only applies to cox, whose outcome is a survival or condition term. linear and logistic accept
numeric/categorical terms too, so they always have more than one candidate.

termdbConfig.loneTermByType{} is computed at server launch, keyed by cohort; see findLoneTermByType()
*/
function mayGetLoneOutcome(regressionType, app, activeCohort) {
	if (regressionType != 'cox') return
	const byType = getLoneTermByType(app.vocabApi.termdbConfig, activeCohort)
	const t1 = byType?.survival
	const t2 = byType?.condition
	if (t1 && t2) return // has both. no preference thus do not auto select one
	if (t1) return { term: structuredClone(t1) }
	if (t2) return { term: structuredClone(t2) }
	return
}

// term types accepted as cox outcome, per getUsecaseSupportedTerms() of termdb.usecase.ts
const coxOutcomeTypes = ['survival', 'condition']

// returns termdbConfig.loneTermByType{} entry for the active cohort, or undefined when the ds has
// no lone term or the cohort key cannot be determined
function getLoneTermByType(termdbConfig, activeCohort?) {
	if (!termdbConfig?.loneTermByType) return // no lone term in this dataset
	// a caller may not know the active cohort (e.g. getPlotConfig() when restoring a session),
	// in which case the cohort key cannot be determined for a ds with subcohorts
	if (termdbConfig.selectCohort && !Number.isInteger(activeCohort)) return
	return termdbConfig.loneTermByType[getActiveCohortStr({ termdbConfig, activeCohort })]
}

/*
returns true when the dataset has only one term usable as this method's outcome, so the input ui
must not offer "Replace" on the outcome pill: the term tree would have nothing else to show

a term type is absent from loneTermByType{} when the cohort has either 0 or 2+ terms of it, so a
lone term of one type only proves there is no alternative if the ds has no term of the other type
at all; that is what allowedTermTypes[] reports. when in doubt "Replace" is kept, as offering it
needlessly is much less confusing than withholding it while other outcome terms exist
*/
export function isLoneOutcome(regressionType, termdbConfig, activeCohort?) {
	if (regressionType != 'cox') return false // other methods also accept numeric/categorical terms
	const byType = getLoneTermByType(termdbConfig, activeCohort)
	if (!byType) return false
	const loneTypes = coxOutcomeTypes.filter(type => byType[type])
	if (loneTypes.length != 1) return false // no lone term, or one of each type thus replaceable
	const otherType = coxOutcomeTypes.find(type => type != loneTypes[0])
	return !termdbConfig.allowedTermTypes?.includes(otherType)
}

export function get_defaultQ4fillTW(regressionType, useCase = '') {
	const defaultQ: any = {}

	// numeric term
	defaultQ['numeric'] = regressionType == 'logistic' && useCase == 'outcome' ? { mode: 'binary' } : { mode: 'discrete' }

	// non-dictionary numeric terms will default to 2-bin using median cutoff
	for (const t of numericTypes) {
		if (dictionaryNumericTypes.has(t)) continue // already covered by defaultQ['numeric']
		defaultQ[t] =
			regressionType == 'logistic' && useCase == 'outcome'
				? { mode: 'binary' }
				: { mode: 'discrete', type: 'custom-bin', preferredBins: 'median' }
	}

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

export async function makeChartBtnMenu(holder, chartsInstance) {
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
		chartsInstance.prepPlot({ config: await getPrepConfig(useMethods[0].type, chartsInstance) })
		return
	}
	// multiple methods. show menu to list them
	for (const { label, type } of useMethods) {
		holder
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(label)
			.on('click', async () => {
				chartsInstance.dom.tip.hide()
				chartsInstance.prepPlot({ config: await getPrepConfig(type, chartsInstance) })
			})
	}
}

/*
config for the input ui of a regression method, launched by the "plot_prep" action

the outcome is filled in here rather than in getPlotConfig(), as "plot_prep" only calls
getPlotConfig() for a config holding nothing but the chart type (see plot_prep in mass/store.ts)
*/
async function getPrepConfig(regressionType, chartsInstance) {
	const config: any = { chartType: 'regression', regressionType, independent: [] }
	const { app, state } = chartsInstance
	const outcome = mayGetLoneOutcome(regressionType, app, state.activeCohort)
	if (!outcome) return config
	try {
		await fillTermWrapper(outcome, app.vocabApi, get_defaultQ4fillTW(regressionType, 'outcome'))
		config.outcome = outcome
	} catch (e) {
		// prefilling is a convenience; on failure launch the ui with a blank outcome pill
		console.error(`cannot prefill ${regressionType} outcome with "${outcome.term.id}": ${e}`)
	}
	return config
}
