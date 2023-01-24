import { getCompInit, copyMerge } from '../rx'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'

/*

brief notes about structures of this.app and this.state

this.app {
	opts {
		genome{} // client-side genome obj
		state {
			dslabel:str
			genome:str
		}
	}
}

this.state {
	config {
		geneSearchResult{}
	}
	termdbConfig{}
}

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
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		if (this.state.termdbConfig?.queries.defaultBlock2GeneMode) {
			await this.launchGeneView()
			return
		}
		await this.launchLocusView()
	}

	async launchGeneView() {
		const arg = this.getArg_geneView()
		const _ = await import('#src/block.init')
		await _.default(arg)
	}

	async launchLocusView() {}

	getArg_geneView() {
		const tk = {
			// mds3 tk obj
			type: 'mds3',
			dslabel: this.app.opts.state.dslabel
		}
		const c = {
			holder: this.dom.holder,
			genome: this.app.opts.genome,
			tklst: [tk]
		}
		if (this.state.config.geneSearchResult.geneSymbol) {
			c.query = this.state.config.geneSearchResult.geneSymbol
		} else {
			throw 'no gene'
		}
		return c
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
	{
		app {
			opts { // the mass ui options
				genome{} // client-side genome object
			}
		}
		state {
			termdbConfig{}
		}
	}
	*/
	const genomeObj = chartsInstance.app.opts.genome
	if (typeof genomeObj != 'object') throw 'chartsInstance.app.opts.genome not an object and needed for gene search box'
	const result = addGeneSearchbox({
		tip: new Menu(),
		genome: genomeObj,
		row: holder.append('div').style('margin', '10px'),
		callback: async () => {
			// found a gene {chr,start,stop,geneSymbol}
			// dispatch to create new plot
			const chart = {
				config: {
					chartType: 'genomeBrowser',
					geneSearchResult: result
				}
			}
			chartsInstance.prepPlot(chart)
		}
	})
}
