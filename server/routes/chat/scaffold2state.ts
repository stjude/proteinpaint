/*
 * input: is Tw or TVS object
 * output: a plot state object that can be used to generate the appropriate plot
 */
export function resolveToPlotState(input: any, plotType: string) {
	// }, llm: LlmConfig) {
	const plotState: any = { type: 'plot', plot: { chartType: plotType } }

	if (plotType === 'summary') {
		plotState.childType = 'barchart' // default child type for summary plot for now
		if (input.tw1) {
			plotState.plot.term = input.tw1
		}
		if (input.tw2) {
			plotState.plot.term2 = input.tw2
		}
		if (input.tw3) {
			plotState.plot.term0 = input.tw3
		}
		if (input.filter) {
			plotState.plot.filter = input.filter
		}
	} else {
		throw 'Only summary plot type is supported for now'
	}
	return plotState
}
