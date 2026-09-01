import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx' // rx plumbing
import { PlotBase } from '../PlotBase' // shared mass-plot base class
import { dofetch3 } from '#common/dofetch' // image discovery requests
import { sayerror } from '#dom' // inline error banner

/** Spatial viewer subplot of the single-cell app: for a sample that has a
 spatial image, renders the w2 direct viewer with the cell-type fills on.
 The cell types HIDDEN in the app's sibling map plots (tSNE/UMAP, i.e.
 sampleScatter legends — clicking a legend item stores the category in
 colorTW.q.hiddenValues) are hidden here too: the viewer re-renders with a
 cellTypeFilter of the remaining types whenever that hidden set changes. */
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
		const hiddenTypes = new Set<string>()
		for (const p of appState.plots) {
			if (p.chartType != 'sampleScatter') continue // only the sc map plots
			for (const k of Object.keys(p.colorTW?.q?.hiddenValues || {})) hiddenTypes.add(k)
		}
		return {
			vocab: appState.vocab, // genome + dslabel for server requests
			config, // the subplot's own config (carries the sample)
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

			// hide the types hidden in the sibling map plots; no hidden types =
			// no filter = every annotated type filled
			const hidden = new Set<string>(state.hiddenTypes)
			const shown = this.allTypes.filter(t => !hidden.has(t))
			const renderKey = JSON.stringify([sID, shown]) // what this render depends on
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
					showCellTypes: true, // the cell-type fills are this subplot's point
					// filter only when something is hidden, so colors stay stable
					cellTypeFilter: hidden.size ? shown : undefined,
					hideExpressionFills: true, // no gene overlays here; hover counts unaffected
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
