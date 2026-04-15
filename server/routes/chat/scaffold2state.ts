import { mayLog } from '#src/helpers.ts'

/*
 * Input: a Tw object from upstream phase (entity2twTvs)
 */
function isDictionaryTerm(term: any) {
	if (term.id) return true
	return false
}

/*
 * input: is Tw or TVS object
 * output: a plot state object that can be used to generate the appropriate plot
 */
export function resolveToPlotState(input: any, plotType: string, subplotType?: string) {
	// }, llm: LlmConfig) {
	const plotState: any = { type: 'plot', plot: { chartType: plotType } }

	if (plotType === 'summary') {
		// default to violing for summary if not provided
		plotState.plot.childType = subplotType ? subplotType : 'violin'

		// for non-dict term, it needs to be within term: {}
		// but, for dictionary term, it can be supplied as is
		if (input.tw1) {
			mayLog('input.tw1:', input.tw1)
			switch (plotState.plot.childType) {
				case 'sampleScatter':
					mayLog('Setting mode to continuous for sampleScatter plot')
					input.tw1.q.mode = 'continuous'
			}
			plotState.plot.term = isDictionaryTerm(input.tw1) ? input.tw1 : { term: input.tw1 }
		}
		if (input.tw2) {
			// overlay term
			mayLog('input.tw2:', input.tw2)
			switch (plotState.plot.childType) {
				case 'sampleScatter':
					mayLog('Setting mode to continuous for sampleScatter plot')
					input.tw2.q.mode = 'continuous'
			}
			plotState.plot.term2 = isDictionaryTerm(input.tw2) ? input.tw2 : { term: input.tw2 }
		}
		if (input.tw3) {
			// divide by term
			plotState.plot.term0 = isDictionaryTerm(input.tw3) ? input.tw3 : { term: input.tw3 }
		}
		if (input.filter) {
			plotState.plot.filter = input.filter
		}
	} else if (plotType == 'dge') {
		// default method for differential gene expression analysis
		plotState.plot.chartType = 'differentialAnalysis'
		plotState.plot.childType = 'volcano'
		plotState.plot.termType = 'geneExpression' // placeholder(can this be something else as well?)
		const groups = [input.filter1, input.filter2]
		plotState.plot.samplelst = groups
		plotState.method = 'edgeR'
	} else {
		throw 'Only summary plot type is supported for now'
	}
	return plotState
}
