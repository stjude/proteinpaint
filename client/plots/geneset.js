import { getCompInit, copyMerge } from '../rx'
import { showGenesetEdit } from '../dom/genesetEdit.ts'
import { fillTermWrapper } from '#termsetting'
import { dofetch3 } from '#common/dofetch'

// This is a reactive geneset component, meant for use within plotApp.
//
// 1. plotApp is initialized with geneset as the first plot/component
// 2. if there are opts.genes, geneset would simply call its opts.callback right away (not even render the edit UI)
// 3. if not, then geneset would render the edit UI, and also use its opts.callback to supply the wrapped genes
// 4. in the opts.callback, the matrix/hierCluster will dispatch plot_delete to remove the geneset as the plot,
//    and also plot_create to render the target plot (like matrix, hierCluster)
//
// The reactivity is rquired to toggle loading overlay visibility
// and to create a new plot within the same plot app, once a valid geneset is
// obtained from the server.
//

class GenesetComp {
	constructor(opts) {
		this.type = 'geneset'
		this.dom = {
			holder: opts.holder
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			vocab: appState.vocab,
			filter0: appState.termfilter.filter0,
			config
		}
	}

	async main() {
		this.dom.holder.selectAll('*').remove()
		// do not await, since this main may be called as part of the initial dispatch
		// in the app init(), and that app instance should return without having to wait
		// for this component to finish the initial genes request and fully render
		// NOTE: This is an important accomodation of rapid-fire cohort changes in the gdc portal
		this.noWait()
	}

	async noWait() {
		const abortCtrl = new AbortController()
		const [genes, stale] = await this.api.detectStale(() => this.getGenes({ signal: abortCtrl.signal }), { abortCtrl })
		if (stale) return
		if (!genes?.length) this.render()
		else this.opts.callback(this.api, genes)
	}

	async getGenes({ signal }) {
		const genes = this.opts.genes
		const settings = this.state.config.settings
		if (this.opts.genes) {
			// genes are predefined
			if (!Array.isArray(this.opts.genes) || this.opts.genes.length == 0) throw '.genes[] is not non-empty array'
			return await this.getTwLst(this.opts.genes)
		}

		let waitDiv
		if (this.opts.showWaitMessage) {
			waitDiv = this.dom.holder.append('div').style('margin', '20px')
			this.opts.showWaitMessage(waitDiv)
		}

		// genes are not predefined. query to get top genes using the current cohort
		let data
		if (this.opts.mode == 'mutation') {
			const body = {}
			if (settings.maxGenes) body.maxGenes = settings.maxGenes
			if (settings.geneFilter) body.geneFilter = settings.geneFilter
			if (this.state.filter0) body.filter0 = this.state.filter0
			// TODO change to /termdb/topMutatedGenes
			// XXX this is optional query!! if ds is missing then should show input ui instead
			data = await dofetch3('gdc/topMutatedGenes', { body, signal }, { cacheAs: 'decoded' })
		} else if (this.opts.mode == 'expression') {
			const body = {
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel,
				maxGenes: settings.maxGenes
			}
			if (this.state.filter0) body.filter0 = this.state.filter0
			// XXX this is optional query!! if ds is missing then should show input ui instead
			data = await dofetch3('termdb/topVariablyExpressedGenes', { body, signal }, { cacheAs: 'decoded' })
		}

		if (!data) throw 'invalid server response'
		if (data.error) throw data.error

		// uncomment for testing only
		// if (!this.i) {
		// 	data.genes = []
		// 	this.i = 1
		// }

		if (!data.genes) return [] // do not throw and halt. downstream will detect no genes and handle it by showing edit ui
		waitDiv.remove()
		return await this.getTwLst(data.genes)
	}

	async getTwLst(genes) {
		return await Promise.all(
			// do tempfix of "data.genes.slice(0,3).map" for faster testing
			genes.map(async i =>
				typeof i == 'string'
					? await fillTermWrapper({ term: { name: i, type: 'geneVariant' } })
					: await fillTermWrapper({ term: { name: i.gene || i.name, type: 'geneVariant' } })
			)
		)
	}

	async render() {
		this.dom.holder
			.append('p')
			.text(`No default genes. Please change the cohort or define a gene set to launch ${this.state.config.toolName}.`)
		showGenesetEdit({
			holder: this.dom.holder.append('div'),
			genome: this.opts.genome,
			mode: this.opts.mode,
			vocabApi: this.app.vocabApi, //  await vocabInit({ state: { genome: gdcGenome, dslabel: gdcDslabel } }),
			callback: async result => {
				const twlst = await Promise.all(
					result.geneList.map(async i => {
						return await fillTermWrapper({ term: { name: i.gene || i.name || i, type: 'geneVariant' } })
					})
				)

				this.opts.callback(this.api, twlst)
			}
		})
	}

	destroy() {
		// the dom.holder itself is not a d3-selection,
		// so need to specify a destroy function here
		// since the default rx.componentApi.destroy()
		// does not work when dom.holder is not a d3-selection
		this.dom.holder.selectAll('*').remove()
		this.dom.holder.remove()
		for (const key in this.dom) {
			delete this.dom[key]
		}
	}
}

export const genesetInit = getCompInit(GenesetComp)
// this alias will allow abstracted dynamic imports
export const componentInit = genesetInit

export async function getPlotConfig(opts = {}, app) {
	const config = copyMerge(
		{
			chartType: 'geneset'
		},
		opts
	)

	return config
}
