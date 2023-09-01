import { getCompInit, copyMerge } from '#rx'

/*

opts{}
	samplelst{}
		groups[]

this{}
	app{}
		vocabApi
*/

class DEanalysis {
	constructor() {
		this.type = 'DEanalysis'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder,
			controlsDiv: holder.append('div')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	async main() {
		const data = await this.app.vocabApi.runDEanalysis(this.state.config)
		console.log(data)
	}
}

export async function getPlotConfig(opts, app) {
	try {
		if (opts.samplelst.groups?.length != 2) throw 'opts.samplelst.groups[].length!=2'
		if (opts.samplelst.groups[0].values?.length < 1) throw 'group 1 not having >1 samples'
		if (opts.samplelst.groups[1].values?.length < 1) throw 'group 2 not having >1 samples'
		const config = {}
		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [DEanalysis getPlotConfig()]`
	}
}

export const DEanalysisInit = getCompInit(DEanalysis)
// this alias will allow abstracted dynamic imports
export const componentInit = DEanalysisInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
        termdbConfig is accessible at chartsInstance.state.termdbConfig{}
        mass option is accessible at chartsInstance.app.opts{}
	*/
	// to fill in menu, create options in "holder"
	// to hide menu, call chartsInstance.dom.tip.hide()
	// upon clicking an option, generate plot:
	chartsInstance.prepPlot({
		config: {
			chartType: 'DEanalysis'
		}
	})
}
