import { getCompInit, copyMerge, sleep } from '../rx'
import { GeneSetEditUI /*, GeneSetEditArg, CallbackArg*/ } from '../dom/GeneSetEdit/GeneSetEditUI.ts'
import { fillTermWrapper } from '#termsetting'
import { dofetch3 } from '#common/dofetch'

// This is a reactive geneset component, meant for use within plotApp.
// The usage in client/gdc/oncomatrix.js and geneExpClustering.js is as follows:
//
// 1. plotApp is initialized with geneset as the first plot/component
// 2. if there are opts.genes, geneset would simply call its opts.callback right away (not even render the edit UI)
// 3. if not, then geneset would render the edit UI, and also use its opts.callback to supply the wrapped genes
// 4. in opts.[matrix | hierCluster].callbacks.firstRender,
//    the matrix/hierCluster will dispatch plot_delete to remove the geneset as the plot,
//    and also plot_create to render the target plot (like matrix, hierCluster)
//
// The reactivity is required to toggle loading overlay visibility
// and to create a new plot within the same plot app, once a valid geneset is
// obtained from the server.
//
// opts{}
// .genome     see GeneSetArg.ClientGenome
// .holder     the DOM element where the geneset edit UI will be rendered
// .genes[]    an array of strings gene symbols, see Note #2 above
// .mode       'geneVariant' | 'geneExpression', see dom/GeneSetEdit for details
// .callback   see GeneSetEditArg.callback in dom/GeneSetEdit
// .reactsTo   the state changes that this component would react to, see example in matrix opts
// .showWaitMessage(waitDiv)  optional function to display a custom message while genes are being loaded

class GenesetComp {
	// type: 'geneset'
	// dom: {
	// 	[domKey: string]: any // usually a d3-selection
	// }
	// opts: {
	// 	holder: any
	// 	genes: string[]
	// 	mode: 'geneVariant' | 'geneExpression'
	// 	callback: CallbackArg
	// 	reactsTo?: (action: any) => boolean
	// 	showWaitMessage?: (waitDiv: any) => void
	// }

	constructor(opts) {
		this.type = 'geneset'

		this.dom = {
			holder: opts.holder.style('position', 'relative').style('min-height', '300px'),
			body: opts.holder.append('div'),
			loadingOverlay: opts.holder
				.append('div')
				.attr('class', 'sjpp-spinner')
				.style('display', 'none')
				.style('position', 'absolute')
				.style('background-color', '#fff')
				.style('z-index', 10)
				.style('opacity', '0.5')
			//.style('width', '100%')
			//.style('height', '100%')
		}
	}

	init() {
		if (this.opts.reactsTo) this.reactsTo = this.opts.reactsTo
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
		this.dom.body.selectAll('*').remove()
		this.dom.loadingOverlay.style('display', '')
		// do not await, since this main may be called as part of the initial dispatch
		// in the app init(), and that app instance should return without having to wait
		// for this component to finish the initial genes request and fully render
		// NOTE: This is an important accomodation of rapid-fire cohort changes in the gdc portal
		this.noWait().catch(console.warn)
	}

	async noWait() {
		const abortCtrl = new AbortController()
		try {
			const [genes, stale] = await this.api.detectStale(() => this.getGenes({ signal: abortCtrl.signal }), {
				abortCtrl
			})
			if (stale) return
			if (!genes?.length) this.render()
			else this.opts.callback(this.api, genes)
		} catch (e) {
			// may ignore this error
			if (e == 'stale sequenceId' || e.name == 'AbortError') return
			else {
				if (this.opts.showWaitMessage) {
					this.dom.body.style('margin', '20px').html(e)
				}
				throw e
			}
		}
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
			waitDiv = this.dom.body.append('div').style('margin', '20px')
			this.opts.showWaitMessage(waitDiv)
		}

		// genes are not predefined. query to get top genes using the current cohort
		let data
		if (this.opts.mode == 'geneVariant') {
			const body = {
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel
			}
			if (settings.maxGenes) body.maxGenes = settings.maxGenes
			if (settings.geneFilter) body.geneFilter = settings.geneFilter
			if (this.state.filter0) body.filter0 = this.state.filter0
			// XXX this is optional query!! if ds is missing then should show input ui instead
			// TODO why cannot use vocab method?
			// TODO purpose of 2nd and 3rd arguments?
			data = await dofetch3('termdb/topMutatedGenes', { body, signal }, { cacheAs: 'decoded' })
		} else if (this.opts.mode == 'geneExpression') {
			const body = {
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel,
				maxGenes: settings.maxGenes
			}
			if (this.state.filter0) body.filter0 = this.state.filter0
			// XXX this is optional query!! if ds is missing then should show input ui instead
			data = await dofetch3('termdb/topVariablyExpressedGenes', { body, signal }, { cacheAs: 'decoded' })
		} else {
			throw 'unknown opts.mode [geneset.js]'
		}

		if (!data) throw 'invalid server response'
		if (data.error) throw data.error

		if (!data.genes) return [] // do not throw and halt. downstream will detect no genes and handle it by showing edit ui
		waitDiv.remove()
		this.dom.loadingOverlay?.style('display', 'none')
		return await this.getTwLst(data.genes)
	}

	async getTwLst(genes) {
		return await Promise.all(
			// do tempfix of "data.genes.slice(0,3).map" for faster testing
			genes.map(async i =>
				typeof i == 'string'
					? await fillTermWrapper({ term: { gene: i, type: this.opts.mode } }, this.app.vocabApi)
					: await fillTermWrapper({ term: { gene: i.gene || i.name, type: this.opts.mode } }, this.app.vocabApi)
			)
		)
	}

	async render() {
		if (!this.dom?.holder) return
		this.dom.body
			.append('p')
			.text(`No default genes. Please change the cohort or define a gene set to launch ${this.state.config.toolName}.`)
		new GeneSetEditUI(
			{
				holder: this.dom.body.append('div'),
				genome: this.opts.genome,
				mode: this.opts.mode,
				vocabApi: this.app.vocabApi, //  await vocabInit({ state: { genome: gdcGenome, dslabel: gdcDslabel } }),
				callback: async result => {
					const twlst = await Promise.all(
						result.geneList.map(async i => {
							return fillTermWrapper({ term: { gene: i.gene || i.name || i, type: 'geneVariant' } }, this.app.vocabApi)
						})
					)

					this.opts.callback(this.api, twlst)
				}
			} /*as GeneSetEditArg*/
		)
		this.dom.loadingOverlay?.style('display', 'none')
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
