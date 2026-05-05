import { mayLog } from '#src/helpers.ts'
import { isNumericTerm } from '#shared/terms.js'
/*
 * Input: a Tw object from upstream phase (entity2twTvs)
 */
function isDictionaryTerm(term: any) {
	if (term.id) return true
	return false
}

function isValidSubplot(subplotType: string, input: any): boolean {
	const validSubplots = ['barchart', 'violin', 'boxplot', 'sampleScatter']
	if (!validSubplots.includes(subplotType)) {
		mayLog(`Subplot type: "${subplotType}" is not supported. Supported subplot types are: ${validSubplots.join(', ')}`)
		return false
	}

	// Barchart: Only one term required; anything from the TermTypeSearch list
	if (subplotType === 'barchart') {
		if (!input.tw1) {
			throw 'Barchart subplot requires one term (tw1), but it is missing in the input.'
			// return false
		}
		// Violin/Box plot: 2 terms required: One term must be numeric and continuous. The other: anything from the TermTypeSearch list
	} else if (subplotType === 'violin' || subplotType === 'boxplot') {
		// requires at least 2 terms
		if (!input.tw1 || !input.tw2) {
			mayLog(`${subplotType} subplot requires two terms (tw1 and tw2), but one or both are missing in the input.`)
			throw `${subplotType} subplot requires two terms (tw1 and tw2), but one or both are missing in the input.`
			// return false
		}
		// One term must be numeric and continuous
		if (!isNumericTerm(input.tw1) && !isNumericTerm(input.tw2)) {
			mayLog(`For ${subplotType} subplot, one of the two terms must be numeric and continuous.`)
			throw `For ${subplotType} subplot, one of the two terms must be numeric and continuous.`
			// return false
		}
		// set the numeric term's q.mode to continuous
		if (isNumericTerm(input.tw1)) input.tw1.q.mode = 'continuous'
		else if (isNumericTerm(input.tw2)) input.tw2.q.mode = 'continuous'
		// Scatter: 2 numeric, continuous terms are required.
	} else if (subplotType === 'sampleScatter') {
		// requires 2 terms
		if (!input.tw1 || !input.tw2) {
			mayLog('Sample scatter subplot requires two terms (tw1 and tw2), but one or both are missing in the input.')
			throw 'Sample scatter subplot requires two terms (tw1 and tw2), but one or both are missing in the input.'
			// return false
		}
		if (!isNumericTerm(input.tw1) || !isNumericTerm(input.tw2)) {
			mayLog('For scatter subplot, both terms must be numeric and continuous.')
			throw 'For scatter subplot, both terms must be numeric and continuous.'
			// return false
		}
		input.tw1.q.mode = 'continuous'
		input.tw2.q.mode = 'continuous'
	}
	return true
}

/*
 * input: is Tw or TVS object
 * output: a plot state object that can be used to generate the appropriate plot
 */
export function resolveToPlotState(input: any, plotType: string, subplotType?: string) {
	// }, llm: LlmConfig) {
	const plotState: any = { type: 'plot', plot: { chartType: plotType } }

	if (plotType === 'summary') {
		// default to violin for summary if not provided
		if (subplotType) {
			plotState.plot.childType = subplotType
			if (!isValidSubplot(subplotType, input)) {
				mayLog(`Invalid subplot type "${subplotType}" for summary plot.`)
				return
			}
		}

		// for non-dict term, it needs to be within term: {}
		// but, for dictionary term, it can be supplied as is
		if (input.tw1) {
			plotState.plot.term = isDictionaryTerm(input.tw1) ? input.tw1 : { term: input.tw1 }
		}
		if (input.tw2) {
			// overlay term
			plotState.plot.term2 = isDictionaryTerm(input.tw2) ? input.tw2 : { term: input.tw2 }
		}
		if (input.tw3) {
			// divide by term
			plotState.plot.term0 = isDictionaryTerm(input.tw3) ? input.tw3 : { term: input.tw3 }
		}
		if (input.filter) {
			plotState.plot.filter = input.filter
		}
	} else if (plotType === 'dge') {
		// default method for differential gene expression analysis
		plotState.plot.chartType = 'differentialAnalysis'
		plotState.plot.childType = 'volcano'
		plotState.plot.termType = 'geneExpression' // placeholder(can this be something else as well?)
		const groups = [input.filter1, input.filter2]
		plotState.plot.samplelst = groups
		plotState.method = 'edgeR'
	} else if (plotType === 'hiercluster') {
		plotState.plot.chartType = 'hierCluster'
		// DictPhrases is an array of tw objects produced by resolveToTw() for dictionary terms
		const DictPhrases = input.DictPhrases || []
		const termgroups: any = []
		const termgroup: any = {}
		termgroup.lst = DictPhrases
		termgroup.type = 'hiercluster'
		termgroup.name = 'Clinical Variables'
		termgroups.push(termgroup)
		console.log('termgroups:', termgroups)
		plotState.plot.termgroups = termgroups
		plotState.plot.dataType = 'numericDictTerm'
		if (input.filter) {
			plotState.plot.filter = input.filter
		}
	} else if (plotType === 'matrix') {
		if (input.twLst && Array.isArray(input.twLst)) {
			plotState.plot.termgroups = [{ name: '', lst: input.twLst.map((tw: any) => (tw.term ? tw : { term: tw })) }]
		} else {
			mayLog('Matrix plot requires a list of terms (twLst), but it is missing or not an array in the input.')
			throw 'Matrix plot requires a list of terms (twLst), but it is missing or not an array in the input.'
		}

		if (input.divideBy) {
			plotState.plot.divideBy = isDictionaryTerm(input.divideBy) ? input.divideBy : { term: input.divideBy }
		}

		if (input.filter) {
			plotState.plot.filter = input.filter
		}
	} else if (plotType === 'prebuiltscatter') {
		plotState.plot.chartType = 'sampleScatter'
		// if (input.name === 't-SNE')
		// plotState.plot.name = 'TermdbTest TSNE'
		plotState.plot.name = input.name
		mayLog('Prebuilt scatter scaffold input:', input)
		if (input.colorBy && input.colorBy === 'null') {
			plotState.plot.colorTW = null
		} else if (input.colorBy) {
			plotState.plot.colorTW = isDictionaryTerm(input.colorBy) ? input.colorBy : { term: input.colorBy }
		}

		if (input.shapeBy && input.shapeBy === 'null') {
			plotState.plot.shapeTW = null
		} else if (input.shapeBy) {
			plotState.plot.shapeTW = isDictionaryTerm(input.shapeBy) ? input.shapeBy : { term: input.shapeBy }
		}

		if (input.filter) {
			plotState.plot.filter = input.filter
		}
	} else {
		throw 'Only summary plot type is supported for now'
	}

	mayLog('Final plot state:', plotState)
	return plotState
}
