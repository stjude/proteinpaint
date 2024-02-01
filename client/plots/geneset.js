import { getCompInit, copyMerge } from '../rx'
import { showGenesetEdit } from '../dom/genesetEdit.ts'
import { fillTermWrapper } from '#termsetting'
import { dofetch3 } from '#common/dofetch'

// This is a reactive geneset component, meant for use with
// plotApp to offer a geneset edit UI when there are no starting gene lst.
// The reactivity has to mostly to do with toggling loading overlay visibility
// and creating a new plot within the same plot app, once a valid geneset is
// obtained from the server.
// - Use dom/genesetEdit to directly use the non-reactive version.
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
		const genes = await this.getGenes()
		if (!genes?.length) this.render()
		else
			setTimeout(async () => {
				// if there are genes on initial load, then allow the plotAppInit to complete
				// by using a timeout here, otherwise it will be missing if the opts.callback() uses it
				this.opts.callback(this.api, genes)
			}, 0)
	}

	async getGenes(filter) {
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
			data = await dofetch3('gdc/topMutatedGenes', { body })
		} else if (this.opts.mode == 'expression') {
			const body = {
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel,
				maxGenes: settings.maxGenes
			}
			if (this.state.filter0) body.filter0 = this.state.filter0
			data = await dofetch3('termdb/topVariablyExpressedGenes', { body })
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
