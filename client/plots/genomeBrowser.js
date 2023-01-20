import { getCompInit, copyMerge } from '../rx'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'

/*

*/

class genomeBrowser {
	constructor() {
		this.type = 'genomeBrowser'
	}

	async init(opts) {
		const holder = this.opts.holder.append('div')

		this.dom = {
			holder
		}

		this.dom.holder.append('div').text('TODO')
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config
		}
	}

	// called in relevant dispatch when reactsTo==true
	// or current.state != replcament.state
	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const config = {}

		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [genomeBrowser getPlotConfig()]`
	}
}

export const genomeBrowserInit = getCompInit(genomeBrowser)
// this alias will allow abstracted dynamic imports
export const componentInit = genomeBrowserInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	// genome obj is needed for gene search box
	const genomeObj = chartsInstance.app.opts.genome
	if (typeof genomeObj != 'object') throw 'chartsInstance.app.opts.genome not an object'
	const result = addGeneSearchbox({
		tip: new Menu(),
		genome: genomeObj,
		row: holder.append('div').style('margin', '10px'),
		callback: async () => {
			// found a gene {chr,start,stop,geneSymbol}
			// dispatch to create new plot
			const chart = {
				config: {
					chartType: 'genomeBrowser'
				}
			}
			chartsInstance.prepPlot(chart)
		}
	})
}
