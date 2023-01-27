import { getCompInit, copyMerge } from '#rx'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { sayerror } from '#dom/error'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter/filter'
import { first_genetrack_tolist } from '#common/1stGenetk'

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
		snvindel {
			details {}
		}
	}
	termdbConfig{}
}

*/

const geneTip = new Menu({ padding: '0px' })

class genomeBrowser {
	constructor() {
		this.type = 'genomeBrowser'
	}

	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder,
			errDiv: holder.append('div'),
			controlHolder: holder.append('div'),
			blockHolder: holder.append('div')
		}
	}

	getState(appState) {
		// {plots[], termdbConfig{}, termfilter{}}
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termdbConfig: appState.termdbConfig,
			filter: getNormalRoot(appState.termfilter.filter)
		}
	}

	async main() {
		try {
			if (this.state.config?.snvindel?.details) {
				// pre-compute variant data in the app here, e.g. fisher test etc, but not in mds3 backend as the official track does
				// and launch custom mds3 tk to show the variants
				// show controls for precomputing variant data
				// controls are based on this.state and cannot be done in init() where state is not yet available
				this.mayShowControls()
				await this.launchCustomMds3tk()
				return
			}
			// launch official mds3 tk and let mds3 backend compute the data
			const tk = {
				type: 'mds3',
				filterObj: this.state.filter,
				dslabel: this.app.opts.state.dslabel
			}
			await this.launchMds3tk(tk)
		} catch (e) {
			sayerror(this.dom.errDiv, e.message || e)
			if (e.stack) console.log(e.stack)
		}
	}

	///////////////////////////////////////////
	//   rest of methods are app-specific    //
	///////////////////////////////////////////

	mayShowControls() {
		//this.dom.controlHolder.text('todo')
	}

	async launchCustomMds3tk() {
		const data = await this.preComputeData()
		if (this.state.config.snvindel.details.computeType == 'AF') {
			const tk = {
				type: 'mds3',
				name: 'Variants',
				skewerModes: [
					{
						type: 'numeric',
						byAttribute: 'AF',
						label: 'Allele frequency',
						inuse: true
					}
				],
				custom_variants: data.mlst
			}
			await this.launchMds3tk(tk)
			return
		}
		throw 'unknown snvindel.details.computeType'
	}

	async preComputeData() {
		// analysis details including cohorts and compute methods are in state.config.snvindel.details{}
		// send to back to compute and get results back
		const body = {
			genome: this.app.opts.state.genome,
			dslabel: this.app.opts.state.dslabel,
			for: 'mds3variantData',
			chr: this.state.config.geneSearchResult.chr,
			start: this.state.config.geneSearchResult.start,
			stop: this.state.config.geneSearchResult.stop,
			details: this.state.config.snvindel.details,
			filter: this.state.filter
		}
		const data = await dofetch3('termdb', { body })
		if (data.error) throw data.error
		return data
	}

	async launchMds3tk(tk) {
		// when state changes, delete existing block and relaunch new one
		// since block/tk is not state-controlled
		this.dom.blockHolder.selectAll('*').remove()

		const arg = {
			holder: this.dom.blockHolder,
			genome: this.app.opts.genome, // genome obj
			nobox: true,
			tklst: [tk]
		}
		if (this.state.termdbConfig?.queries.defaultBlock2GeneMode && this.state.config.geneSearchResult.geneSymbol) {
			// dataset config wants to default to gene view, and gene symbol is available
			// call block.init to launch gene view
			arg.query = this.state.config.geneSearchResult.geneSymbol
			const _ = await import('#src/block.init')
			await _.default(arg)
			return
		}
		// launch locus
		arg.chr = this.state.config.geneSearchResult.chr
		arg.start = this.state.config.geneSearchResult.start
		arg.stop = this.state.config.geneSearchResult.stop
		first_genetrack_tolist(this.app.opts.genome, arg.tklst)
		const _ = await import('#src/block')
		new _.Block(arg)
	}
}

export const genomeBrowserInit = getCompInit(genomeBrowser)
// this alias will allow abstracted dynamic imports
export const componentInit = genomeBrowserInit

export async function getPlotConfig(opts, app) {
	try {
		// request default queries config from dataset, and allows opts to override
		const config = await app.vocabApi.getMds3queryDetails()

		return copyMerge(config, opts)
	} catch (e) {
		throw `${e} [genomeBrowser getPlotConfig()]`
	}
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
	{
		app {
			vocabApi
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
		tip: geneTip,
		genome: genomeObj,
		row: holder.append('div').style('margin', '10px'),
		geneOnly: chartsInstance.state.termdbConfig.queries.defaultBlock2GeneMode,
		defaultCoord: chartsInstance.state.termdbConfig.queries.defaultCoord,
		callback: async () => {
			// found a gene {chr,start,stop,geneSymbol}
			// dispatch to create new plot

			// must do this as 'plot_prep' does not call getPlotConfig()
			// request default queries config from dataset, and allows opts to override
			const config = await chartsInstance.app.vocabApi.getMds3queryDetails()

			config.chartType = 'genomeBrowser'
			config.geneSearchResult = result
			const chart = { config }
			chartsInstance.prepPlot(chart)
		}
	})
}
