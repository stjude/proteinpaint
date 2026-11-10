// Plot launchers: the actions behind the result buttons. A typed dependency object replaces the old
// `self: any`; nothing here reads or writes component state except through `LauncherDeps`.
import { fillTermWrapper } from '#termsetting'
import type { Coord, GeneLauncher } from './types.ts'
import type { ResultsPopup } from './popup.ts'
import { embedMethylationRegionPicker } from './methylationPicker.ts'

export type LauncherDeps = {
	app: any
	popup: ResultsPopup
	/** the current active nav tab, to leave the about tab when a plot is launched from it */
	getActiveTab: () => number | undefined
}

export class Launcher implements GeneLauncher {
	constructor(private deps: LauncherDeps) {}

	/** dispatch a plot and reset the search box/popup */
	async launchPlot(config: any) {
		const { app, popup, getActiveTab } = this.deps
		if (getActiveTab() == 0) await app.dispatch({ type: 'tab_set', activeTab: 1 })
		app.dispatch({ type: 'plot_create', config })
		popup.inputNode.value = ''
		popup.hide()
	}

	/** Mutated-vs-wildtype barchart for one gene, restricted to a variant data type. dtCandidates are tried
	 * in order (svfusion has two dts) until a matching predefined groupset is found, since fillTermWrapper
	 * throws when the dataset lacks a groupset for a given dt. */
	async launchGeneVariantPlot(gene: string, dtCandidates: number[]) {
		let tw: any
		let lastErr: any
		for (const dt of dtCandidates) {
			const candidate: any = {
				term: {
					id: gene,
					name: gene,
					genes: [{ kind: 'gene', id: gene, gene, name: gene, type: 'geneVariant' }],
					type: 'geneVariant'
				},
				q: { type: 'predefined-groupset', dtLst: [dt] }
			}
			try {
				await fillTermWrapper(candidate, this.deps.app.vocabApi)
				tw = candidate
				break
			} catch (e) {
				lastErr = e
			}
		}
		if (!tw) throw lastErr
		await this.launchPlot({ chartType: 'summary', term: tw })
	}

	/** Open the genome browser as a separate mass chart. blockIsProteinMode is set explicitly so each view
	 * opens as named regardless of the dataset's default gbRestrictMode.
	 * - 'protein': seeded by gene symbol
	 * - 'genomic': over a region (chr/start/stop), used for a gene's locus and a typed coordinate */
	async launchGenomeBrowserView(mode: 'protein' | 'genomic', opts: { gene?: string; coord?: Coord | null }) {
		if (mode == 'protein') {
			if (!opts.gene) throw new Error('gene symbol required for protein view')
			await this.launchPlot({
				chartType: 'genomeBrowser',
				geneSearchResult: { geneSymbol: opts.gene },
				blockIsProteinMode: true
			})
			return
		}
		if (!opts.coord) throw new Error('coordinate required for genomic view')
		await this.launchPlot({
			chartType: 'genomeBrowser',
			geneSearchResult: { chr: opts.coord.chr, start: opts.coord.start, stop: opts.coord.stop },
			blockIsProteinMode: false
		})
	}

	/** DNA methylation: show a genome browser at the gene's default coordinates inline in the popup with a
	 * "Submit Region" button; on submit, open a summary plot of the region-based dnaMethylation term. */
	async launchMethylationPlot(gene: string, coord: Coord | null) {
		// coord is the gene's default coordinate, resolved server-side (GeneMatch.coord)
		if (!coord) throw new Error(`Could not resolve coordinates for gene "${gene}"`)
		const { app, popup } = this.deps
		const holder = popup.openPicker(gene)
		await embedMethylationRegionPicker({
			holder: holder.append('div'),
			genomeObj: app.opts.genome,
			vocabApi: app.vocabApi,
			chr: coord.chr,
			start: coord.start,
			stop: coord.stop,
			callback: async (term: any) => {
				await this.launchPlot({ chartType: 'summary', term: { term } })
			}
		})
	}

	/** Open the termdb tree to pick a survival outcome term, then dispatch a survival plot with
	 * `covariateField` pre-set to `covariateTw`. survival's getPlotConfig() requires config.term to already be
	 * a resolved term wrapper, so unlike launchPlot() this can't dispatch directly: it must collect the
	 * outcome term first (mirrors charts.ts's showTree_select1term). */
	async launchSurvivalWithCovariate(covariateField: 'term2', covariateTw: any) {
		const { app, popup } = this.deps
		popup.tip.clear()
		popup.tip.showunder(popup.inputNode)
		const action: any = { type: 'plot_create', config: { chartType: 'survival', [covariateField]: covariateTw } }
		const termdb = await import('../../termdb/app')
		termdb.appInit({
			vocabApi: app.vocabApi,
			holder: popup.tip.d.append('div'),
			state: { nav: { header_mode: 'search_only' }, tree: { usecase: { target: 'survival', detail: 'term' } } },
			tree: {
				click_term: (term: any) => {
					action.config.term = term.term ? term : { term }
					popup.tip.hide()
					app.dispatch(action)
				}
			}
		})
	}
}
