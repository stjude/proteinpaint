import { NumericModes } from '#shared/terms.js'

export function makeChartBtnMenu(holder: any, chartsInstance: any): void {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	const numericDictTermCluster = chartsInstance.state.termdbConfig.numericDictTermCluster
	if (numericDictTermCluster?.plots) {
		for (const plot of numericDictTermCluster.plots) {
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
					const config = await chartsInstance.app.vocabApi.getNumericDictTermClusterByName(plot.name)
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
		label: numericDictTermCluster?.appName || 'Numeric Dictionary Term cluster',
		chartType: 'numericDictTermCluster',
		clickTo: chartsInstance.showTree_selectlst,
		minTermsToSubmit: 3,
		usecase: {
			target: 'numericDictTermCluster',
			detail: { exclude: numericDictTermCluster?.exclude }
		},
		updateActionBySelectedTerms: (action: any, termlst: any[]): void => {
			const twlst = termlst.map(term => ({
				term: structuredClone(term),
				q: { mode: NumericModes.continuous }
			}))
			action.config.chartType = 'hierCluster'
			action.config.dataType = twlst[0].term.type
			if (numericDictTermCluster?.appName) action.config.appName = numericDictTermCluster.appName
			action.config.termgroups = [
				{
					name: numericDictTermCluster?.settings?.termGroupName || 'Numeric Dictionary Term Cluster',
					lst: twlst,
					type: 'hierCluster'
				}
			]
		}
	}
	chartsInstance.showTree_selectlst(chart)
}
