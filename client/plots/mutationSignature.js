import { NumericModes } from '#shared/terms.js'

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
    holder: the holder in the tooltip
    chartsInstance: MassCharts instance
        termdbConfig is accessible at chartsInstance.state.termdbConfig{}
        mass option is accessible at chartsInstance.app.opts{}
    */

	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	const mutSigPreBuiltPlots = chartsInstance.state.termdbConfig.numericTermCollections?.find(
		ntc => ntc.name == 'Mutation Signature'
	)?.plots
	if (mutSigPreBuiltPlots) {
		for (const plot of mutSigPreBuiltPlots) {
			/* plot: 
			{
				name=str
			}
			*/
			menuDiv
				.append('button')
				.style('margin', '10px')
				.style('padding', '10px 15px')
				.style('border-radius', '20px')
				.style('border-color', '#ededed')
				.style('display', 'inline-block')
				.text(plot.name)
				.on('click', async () => {
					chartsInstance.dom.tip.hide()
					const config = await chartsInstance.app.vocabApi.getMutationSignatureByName(plot.name)
					//add pre-built plot name to config to be shown in the sandbox header
					config.preBuiltPlotTitle = plot.name
					chartsInstance.app.dispatch({
						type: 'plot_create',
						config
					})
				})
		}
	}

	const chart = {
		//use the app name defined in dataset file
		label: 'Mutation Signature',
		chartType: 'mutationSignature',
		clickTo: self.showTree_selectlst,
		usecase: {
			target: 'numericTermCollections',
			detail: {
				...chartsInstance.state.termdbConfig.numericTermCollections.find(ntc => ntc.name == 'Mutation Signature')
			}
		},
		updateActionBySelectedTerms: (action, termlst) => {
			if (termlst.length == 1) {
				// violin
				action.config.chartType = 'summary'
				action.config.term = {
					term: structuredClone(termlst[0]),
					q: { mode: NumericModes.continuous }
				}
				return
			}
			// 2 or more terms, launch matrix
			const termNames = termlst.map(o => o.id).join(',')
			const termNameLabel = `Mutation Signature (%SNVs,${termNames})`
			const termName = termNameLabel.length <= 26 ? termNameLabel : termNameLabel.slice(0, 26) + '...'
			const term = { name: termName, type: 'termCollection', isleaf: true, termlst }

			action.config.chartType = 'matrix'
			action.config.termgroups = [
				{
					name: 'Mutation Signature',
					lst: [{ term, type: 'termCollection' }]
				}
			]
		}
	}
	chartsInstance.showTree_selectlst(chart)
}
