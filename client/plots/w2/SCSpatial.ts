import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx' // rx plumbing
import { PlotBase } from '../PlotBase' // shared mass-plot base class
import { dofetch3 } from '#common/dofetch' // image discovery requests
import { sayerror } from '#dom' // inline error banner
import { SINGLECELL_GENE_EXPRESSION } from '#types' // the gene-colored map term type

/** Spatial viewer subplot of the single-cell app: for a sample that has a
 spatial image, renders the w2 direct viewer mirroring the sibling map
 plots (tSNE/UMAP, i.e. sampleScatter):
 - their Color pill decides the overlay — the cell-type term shows the
   cell-type fills, a gene expression term shows that gene's expression
   fills instead, switching whenever the user toggles the pill;
 - in cell-type mode, the cell types HIDDEN in the map legends (clicking a
   legend item stores the category in colorTW.q.hiddenValues) are hidden
   here too, via a cellTypeFilter of the remaining types. */
class SCSpatial extends PlotBase implements RxComponent {
	static type = 'scSpatial' // rx chart type name

	type: string // instance copy of the chart type
	dom: { div: any; error: any; viewer: any } // the subplot's own divs
	/** the sample's spatial image entry from termdb/wsiBySample, fetched once */
	private image?: any
	/** every cell type of the image, from the meta type discovery */
	private allTypes: string[] = []
	/** what the last render showed, to skip re-render when nothing changed */
	private lastRenderKey = ''

	constructor(opts: any, api: ComponentApi) {
		super(opts, api) // PlotBase wires app/id/opts
		this.type = SCSpatial.type // rx uses this to route state updates
		const holder = opts.holder?.viz || opts.holder // DynamicSubplot passes {viz}; direct embeds a div
		const div = holder.append('div').style('padding', '5px') // the subplot's container
		this.dom = {
			div,
			error: div.append('div').style('opacity', 0.75), // inline errors
			viewer: div.append('div') // the wsi.direct mount
		}
	}

	getState(appState: any) {
		const config = appState.plots.find((p: any) => p.id === this.id) // this subplot's config
		if (!config) throw `No plot with id='${this.id}' found [scSpatial getState()]`
		// union of the cell types hidden in the app's map plots (tSNE/UMAP):
		// their legends store hidden categories in colorTW.q.hiddenValues
		// the map plots' Color pill decides this viewer's overlay: a gene
		// expression term shows that gene's spatial expression fills, anything
		// else (the cell-type term) shows the cell-type fills. The first map
		// plot decides when several exist
		const firstMap = appState.plots.find((p: any) => p.chartType == 'sampleScatter')
		const colorGene = firstMap?.colorTW?.term?.type == SINGLECELL_GENE_EXPRESSION ? firstMap.colorTW.term.gene : null
		// in cell-type mode, the map's colorTW + plot name let this subplot
		// fetch the exact category colors the map shows, for consistency
		const mapColorTW = colorGene ? null : firstMap?.colorTW || null
		const mapPlotName = firstMap?.singleCellPlot?.name || null
		const hiddenTypes = new Set<string>()
		for (const p of appState.plots) {
			if (p.chartType != 'sampleScatter') continue // only the sc map plots
			for (const k of Object.keys(p.colorTW?.q?.hiddenValues || {})) hiddenTypes.add(k)
		}
		return {
			vocab: appState.vocab, // genome + dslabel for server requests
			config, // the subplot's own config (carries the sample)
			colorGene, // non-null = mirror the maps' gene expression coloring
			mapColorTW, // the map's cell-type term, for matching its colors
			mapPlotName, // which sc plot's legend to match
			hiddenTypes: [...hiddenTypes].sort() // sorted for stable state diffing
		}
	}

	async main() {
		const state = this.state // computed by getState above
		this.dom.error.text('') // clear any previous error banner
		try {
			const sID = state.config.sample?.sID // the sc app's selected sample
			if (!sID) throw new Error('no sample for the spatial subplot')
			if (!this.image) await this.fetchImage(sID) // discover the spatial image once
			if (!this.image) throw new Error(`no spatial image for sample ${sID}`)

			// gene mode when the maps color by a gene, cell-type mode otherwise;
			// in cell-type mode, hide the types hidden in the sibling map plots
			// (no hidden types = no filter = every annotated type filled)
			const gene: string | null = state.colorGene
			const hidden = new Set<string>(state.hiddenTypes)
			const shown = this.allTypes.filter(t => !hidden.has(t))
			// in cell-type mode, use the same per-type colors the map shows
			const typeColors = gene ? undefined : await this.fetchMapColors(sID, state)
			const renderKey = JSON.stringify([sID, gene, shown, typeColors]) // what this render depends on
			if (renderKey == this.lastRenderKey) return // nothing changed for the viewer
			this.lastRenderKey = renderKey

			this.dom.viewer.selectAll('*').remove() // rebuild the viewer
			const v = state.vocab // addresses the dataset in wsitiles queries
			const direct = await import('./wsi.direct') // lazy-load the viewer
			await direct.init(
				{
					// same slide addressing the w2 plot uses (no direct-path gate)
					slideQuery:
						`wsimage=${encodeURIComponent(this.image.fileName)}&dslabel=${v.dslabel}&genome=${v.genome}` +
						`&sample_id=${encodeURIComponent(sID)}&imageType=spatial`,
					label: this.image.fileName, // display name in the info line
					spatialData: this.image.spatialData, // the consolidated h5ad
					// mirror the maps' Color pill: cell-type fills, or the colored
					// gene's expression fills (never both — mutually exclusive)
					showCellTypes: !gene,
					// filter only when something is hidden, so colors stay stable
					cellTypeFilter: !gene && hidden.size ? shown : undefined,
					cellTypeColors: typeColors, // match the map's legend colors

					geneExpression: gene || undefined, // the maps' colored gene, when any
					hideExpressionFills: !gene, // hover counts unaffected either way
					annotationLevel: this.image.annotationLevel, // dataset default
					width: '100%', // fill the sandbox
					height: '70vh'
				},
				this.dom.viewer
			)
		} catch (e: any) {
			sayerror(this.dom.error, e.message || String(e)) // surface, keep the app alive
		}
	}

	/** cached per-type colors matching the map plot's legend */
	private mapColors?: { key: string; colors?: { [type: string]: string } }

	/** The exact category colors the map plot shows, from the same server
	 route that assigned them (termdb/singleCellPlots), so both views color a
	 cell type identically — including user recolors saved into the map's
	 colorTW.term.values. No map plot (or a failure) = undefined = the
	 viewer's built-in palette. */
	private async fetchMapColors(sID: string, state: any): Promise<{ [type: string]: string } | undefined> {
		if (!state.mapColorTW || !state.mapPlotName) return
		// hiddenValues churn constantly (the hide sync); colors only depend on
		// the term's values (user recolors) and the plot, so key on those
		const key = JSON.stringify([sID, state.mapPlotName, state.mapColorTW.term?.values])
		if (this.mapColors?.key == key) return this.mapColors.colors
		let colors: { [type: string]: string } | undefined
		try {
			const v = state.vocab // genome + dslabel
			const r: any = await dofetch3('termdb/singleCellPlots', {
				body: {
					genome: v.genome,
					dslabel: v.dslabel,
					colorTW: state.mapColorTW,
					singleCellPlot: { name: state.mapPlotName, sample: { sID } },
					// the route requires concrete canvas numbers even though only
					// the legend is used here; matches the route's own defaults
					canvasSettings: {
						cutoff: 10000,
						width: 800,
						height: 600,
						radius: 3,
						startColor: '#d3d3d3',
						stopColor: '#ff0000'
					}
				}
			})
			const legend = r?.result?.Default?.colorLegend // [category, {color}] entries
			if (Array.isArray(legend)) {
				colors = {}
				for (const [category, item] of legend) colors[category] = item?.color
			}
		} catch (e) {
			console.warn('failed to fetch the map colors, using the built-in palette', e)
		}
		this.mapColors = { key, colors }
		return colors
	}

	/** the sample's first spatial image and its cell types, fetched once */
	private async fetchImage(sID: string) {
		const v = this.state.vocab // genome + dslabel for the requests
		const body = { genome: v.genome, dslabel: v.dslabel, sample_id: sID }
		const r = await dofetch3('termdb/wsiBySample', { body }) // the sample's images
		this.image = (r?.images || []).find((i: any) => i.type == 'spatial' && i.spatialData) // first spatial one
		if (!this.image) return
		// the image's cell types, for computing the shown list from the hidden set
		const params =
			`wsimage=${encodeURIComponent(this.image.fileName)}&dslabel=${v.dslabel}&genome=${v.genome}` +
			`&sample_id=${encodeURIComponent(sID)}&imageType=spatial&cellAnnotations=${encodeURIComponent(
				this.image.spatialData
			)}`
		const meta = await dofetch3(`wsitiles/meta?${params}`).catch(() => null)
		this.allTypes = Array.isArray(meta?.cellTypes) ? meta.cellTypes : []
	}
}

export const scSpatialInit = getCompInit(SCSpatial) // the rx component factory
export const componentInit = scSpatialInit // alias the plot loader expects

/** initial subplot config when the Spatial button is clicked */
export function getPlotConfig(opts: any, _app: any) {
	return copyMerge({ chartType: 'scSpatial' }, opts) // button opts win
}
