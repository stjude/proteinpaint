// Plot launchers shared by more than one handler. Launchers used by a single result kind (e.g. the gene
// variant plot) live in that kind's handler. A typed dependency object replaces the old `self: any`;
// nothing here reads or writes component state except through `LauncherDeps`.
import type { Coord } from './handlers/types.ts'
import type { ResultsPopup } from './popup.ts'

export type LauncherDeps = {
	app: any
	popup: ResultsPopup
	/** the current active nav tab, to leave the about tab when a plot is launched from it */
	getActiveTab: () => number | undefined
}

export class Launcher {
	constructor(private deps: LauncherDeps) {}

	/** dispatch a plot and reset the search box/popup */
	async launchPlot(config: any) {
		const { app, popup, getActiveTab } = this.deps
		if (getActiveTab() == 0) await app.dispatch({ type: 'tab_set', activeTab: 1 })
		app.dispatch({ type: 'plot_create', config })
		popup.inputNode.value = ''
		popup.hide()
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
}
