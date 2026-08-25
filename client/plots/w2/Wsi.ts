import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import type { BasePlotConfig, MassState } from '#mass/types/mass'
import type { SpatialImage } from '#types'
import { dofetch3 } from '#common/dofetch' // gene-name discovery from the expression h5
import { controlsInit } from '../controls'
import type Settings from './Settings.ts'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'
import { WsiInteractions } from './interactions/WsiInteractions'

/** Mass plot listing every sample in the dataset that has whole-slide images
 (the wsisamples route performs the per-sample check), with a pan/zoom viewer
 for the selected sample's slide. Architecture mirrors plots/corrVolcano:
 Model (server data) -> ViewModel (view data) -> View (render), with
 interactions dispatching state edits. */
type WsiDom = {
	div: any
	controls: any
	error: any
	table: any
	viewer: any
	header?: any
}

class Wsi extends PlotBase implements RxComponent {
	static type = 'wsi'

	type: string
	dom: WsiDom
	interactions?: WsiInteractions
	/** showCellTypes of the previous render, to tell which exclusive fill
	 checkbox was just toggled when both end up checked */
	private prevShowCellTypes = false

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = Wsi.type
		const holder = opts.holder.classed('sjpp-wsi-main', true)
		const div = holder.append('div').style('padding', '5px')
		this.dom = {
			div,
			// burger menu for spatial viewer settings; hidden until a spatial image is shown
			controls: div.append('div').attr('id', 'sjpp-wsi-controls').style('display', 'none'),
			error: div.append('div').attr('id', 'sjpp-wsi-error').style('opacity', 0.75),
			table: div.append('div').attr('id', 'sjpp-wsi-table'),
			viewer: div.append('div').attr('id', 'sjpp-wsi-viewer')
		}
		if (opts.header)
			this.dom.header = opts.header.text('WHOLE SLIDE IMAGES').style('font-size', '0.7em').style('opacity', 0.6)
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			vocab: appState.vocab,
			config
		}
	}

	async init() {
		this.interactions = new WsiInteractions(this.app, this.id)
	}

	async main() {
		const config = structuredClone(this.state.config) // this plot's slice of app state
		if (config.childType != this.type && config.chartType != this.type) return // not for this plot
		if (!this.interactions) throw 'Interactions not initialized [wsi main()]'

		const settings: Settings = config.settings.wsi // selection + overlay settings

		// the cell-type and gene-expression FILLS are mutually exclusive
		// (unreadable on top of each other): when both boxes end up checked, the
		// one just toggled wins and the other is unchecked. Unchecked 'Gene
		// expression' only hides the fills — hover counts stay (View.ts).
		if (settings.showCellTypes && settings.showGeneExpression) {
			// whichever was already on before this edit is the one to turn off
			const off = this.prevShowCellTypes ? 'showCellTypes' : 'showGeneExpression'
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { wsi: { [off]: false } } } })
			return
		}
		this.prevShowCellTypes = settings.showCellTypes

		this.dom.error.text('') // clear any previous error banner

		// which samples have whole-slide images on disk?
		const model = new Model(this.state.vocab.genome, this.state.vocab.dslabel)
		const data = await model.getData() // termdb/wsiBySample sample listing
		if (!data || data.error || !data.samples?.length) {
			this.dom.table.selectAll('*').remove() // nothing to show; clear the ui
			this.dom.viewer.selectAll('*').remove()
			this.dom.error.style('padding', '20px').text(data?.error || 'No samples with whole-slide images.')
			return
		}

		// shape for rendering
		const viewModel = new ViewModel(data.samples, settings)

		// the selected sample's images from termdb/wsiBySample; on launch the
		// first sample is selected by default so its first image displays
		const selectedSample = viewModel.viewData.selectedSample
		const images = selectedSample ? (await model.getImages(selectedSample.sampleId)).images ?? [] : []

		// spatial image: rename the sandbox header and show the burger menu
		const image = images[settings.selectedImageIndex] ?? images[0] // the image being viewed
		const isSpatial = image?.type == 'spatial' // drives header text + burger visibility
		this.dom.header?.text(isSpatial ? 'SPATIAL VIEWER' : 'WHOLE SLIDE IMAGES')
		if (isSpatial) {
			const spImage = image as SpatialImage
			// gene names discovered from the expression h5 itself, so the burger
			// menu offers/validates genes that actually exist in the data
			const genes = await this.fetchGeneNames(spImage, selectedSample!.sampleId)
			// cell types discovered by the meta request, for the type-filter dropdowns
			await this.fetchCellTypes(spImage, selectedSample!.sampleId)
			// seed the burger menu's gene/level fields once (null = never edited)
			// so the shown values match the overlay and can be edited or cleared;
			// re-renders once with the seeded state
			if (settings.geneExpression == null) {
				// the dataset's configured default is only an override: keep the
				// genes of it that exist in the file, else fall back to the file's
				// first gene, so the default is never a gene the data lacks
				const configured = (spImage.geneExpression || '')
					.split(',')
					.map(s => s.trim())
					.filter(g => genes.includes(g))
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: {
						settings: {
							wsi: {
								geneExpression: configured.join(',') || genes[0] || '',
								annotationLevel: settings.annotationLevel ?? spImage.annotationLevel,
								// dataset default (w2.cellTypes); the burger checkbox overrides
								// after. Fills are mutually exclusive, so cell types on means
								// expression fills off (hover counts stay either way)
								showCellTypes: spImage.cellTypes ?? settings.showCellTypes,
								showGeneExpression: spImage.cellTypes ? false : settings.showGeneExpression
							}
						}
					}
				})
				return
			}
			if (!this.components.controls) await this.setControls()
			this.addGeneDatalist() // autocomplete on the Genes field from the discovered names
		}
		this.dom.controls.style('display', isSpatial ? 'inline-block' : 'none')

		await new View(this.dom, viewModel.viewData, images, settings, this.interactions, this.state.vocab).render()
	}

	/** gene names available in the current image's expression h5, cached per file */
	private geneNames: string[] = []
	private geneNamesFile?: string

	/** Discover the genes present in the image's cell_feature_matrix h5 via
	 wsitiles/genenames (same slide-scoped access checks as genecounts).
	 Returns [] when the image has no expression file or the request fails. */
	private async fetchGeneNames(image: SpatialImage, sampleId: string): Promise<string[]> {
		if (!image.geneExpressionFile) return []
		if (this.geneNamesFile == image.geneExpressionFile) return this.geneNames // cached
		const v = this.state.vocab
		const params =
			`wsimage=${encodeURIComponent(image.fileName)}&dslabel=${v.dslabel}&genome=${v.genome}` +
			`&sample_id=${encodeURIComponent(sampleId)}&imageType=spatial&file=${encodeURIComponent(
				image.geneExpressionFile
			)}`
		const r = await dofetch3(`wsitiles/genenames?${params}`).catch(() => null)
		this.geneNames = Array.isArray(r?.genes) ? r.genes : [] // failure = no discovery, config still works
		this.geneNamesFile = image.geneExpressionFile
		return this.geneNames
	}

	/** cell types available in the current image's boundaries CSV, cached per file */
	private cellTypeNames: string[] = []
	private cellTypesFile?: string

	/** Discover the distinct cell_type values of the image's boundaries CSV via
	 the meta request (?cellBoundaries= makes wsitiles/meta parse the column).
	 Returns [] when the image has no boundaries file, the CSV has no cell_type
	 column, or the request fails. */
	private async fetchCellTypes(image: SpatialImage, sampleId: string): Promise<string[]> {
		if (!image.cellBoundaries) return []
		if (this.cellTypesFile == image.cellBoundaries) return this.cellTypeNames // cached
		const v = this.state.vocab
		const params =
			`wsimage=${encodeURIComponent(image.fileName)}&dslabel=${v.dslabel}&genome=${v.genome}` +
			`&sample_id=${encodeURIComponent(sampleId)}&imageType=spatial&cellBoundaries=${encodeURIComponent(
				image.cellBoundaries
			)}`
		const r = await dofetch3(`wsitiles/meta?${params}`).catch(() => null)
		this.cellTypeNames = Array.isArray(r?.cellTypes) ? r.cellTypes : [] // failure = no dropdowns, overlay still works
		this.cellTypesFile = image.cellBoundaries
		return this.cellTypeNames
	}

	/** Attach the discovered gene names to the Genes text input as a native
	 datalist, so typing autocompletes to genes that exist in the data.
	 (Autocomplete applies to the whole field, i.e. the first gene of a
	 comma-separated list — later genes are typed without suggestions.) */
	private addGeneDatalist() {
		if (!this.geneNames.length) return
		const input = this.dom.controls.select('input[type=text]').node() as HTMLInputElement | null
		if (!input) return // controls not rendered (shouldn't happen)
		const id = `sjpp-wsi-genes-${this.id}`
		document.getElementById(id)?.remove() // rebuild when the image (and its genes) changed
		const dl = document.createElement('datalist')
		dl.id = id
		for (const g of this.geneNames) {
			const opt = document.createElement('option')
			opt.value = g
			dl.appendChild(opt)
		}
		input.after(dl)
		input.setAttribute('list', id) // link the input to its suggestions
	}

	/** Burger menu with the spatial overlay settings; fields are pre-seeded
	 with defaults discovered from the data by main() before this runs. */
	private async setControls() {
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls,
			inputs: [
				{
					label: 'Nucleus boundaries',
					title: 'Show or hide the nucleus segmentation overlay',
					type: 'checkbox',
					chartType: 'wsi',
					settingsKey: 'showNucleusBoundaries',
					boxLabel: 'show'
				},
				{
					label: 'Cell boundaries',
					title: 'Show or hide the cell segmentation overlay',
					type: 'checkbox',
					chartType: 'wsi',
					settingsKey: 'showCellBoundaries',
					boxLabel: 'show'
				},
				{
					label: 'Cell types',
					title: 'Fill cells by the cell_type annotation of the boundaries CSV (when present)',
					type: 'checkbox',
					chartType: 'wsi',
					settingsKey: 'showCellTypes',
					boxLabel: 'show'
				},
				{
					// chained dropdowns: one per selected type, plus an add-dropdown of
					// the remaining types that appears once the previous is picked.
					// No selection = all types. Hidden when the overlay is off or the
					// image's CSV has no cell_type column.
					label: 'Types shown',
					title: 'Fill only the selected cell types; no selection = all types',
					type: 'custom',
					settingsKey: 'cellTypeFilter',
					init: (self: any) => ({
						main: (plot: any) => {
							const td = self.dom.inputTd
							td.selectAll('*').remove()
							const types = this.cellTypeNames // discovered by fetchCellTypes for the shown image
							const s: Settings = plot.settings.wsi
							if (!s.showCellTypes || !types.length) {
								self.dom.row.style('display', 'none')
								return
							}
							self.dom.row.style('display', 'table-row')
							// drop stale selections when the image (and its types) changed
							const selected = (s.cellTypeFilter || '')
								.split(',')
								.map(t => t.trim())
								.filter(t => types.includes(t))
							const dispatch = (list: string[]) =>
								this.app.dispatch({
									type: 'plot_edit',
									id: this.id,
									config: { settings: { wsi: { cellTypeFilter: list.join(',') } } }
								})
							const addSelect = () =>
								td.append('select').style('display', 'block').style('margin', '2px 0').style('max-width', '180px')
							// one dropdown per chosen type: change replaces it, blank removes it
							for (const [i, t] of selected.entries()) {
								const sel = addSelect().on('change', function (this: HTMLSelectElement) {
									const next = selected.slice()
									if (this.value) next[i] = this.value
									else next.splice(i, 1)
									dispatch(next)
								})
								sel.append('option').attr('value', '').text('× remove')
								for (const ty of types)
									if (ty == t || !selected.includes(ty))
										sel
											.append('option')
											.attr('value', ty)
											.property('selected', ty == t)
											.text(ty)
							}
							// the next dropdown, offering the not-yet-selected types
							const remaining = types.filter(ty => !selected.includes(ty))
							if (remaining.length) {
								const add = addSelect().on('change', function (this: HTMLSelectElement) {
									if (this.value) dispatch([...selected, this.value])
								})
								add
									.append('option')
									.attr('value', '')
									.text(selected.length ? 'Add type…' : 'All types')
								for (const ty of remaining) add.append('option').attr('value', ty).text(ty)
							}
						}
					})
				},
				{
					label: 'Gene expression',
					title: 'Show or hide the gene expression overlay',
					type: 'checkbox',
					chartType: 'wsi',
					settingsKey: 'showGeneExpression',
					boxLabel: 'show'
				},
				{
					label: 'Genes',
					title: 'Comma-separated gene names to overlay',
					type: 'text',
					chartType: 'wsi',
					settingsKey: 'geneExpression',
					placeholder: 'gene1,gene2,…'
				},
				{
					label: 'Overlay mode',
					title: 'Color each gene separately (gene_expression), or sum all genes into one overlay (gene_groups)',
					type: 'radio',
					chartType: 'wsi',
					settingsKey: 'spatialMode',
					options: [
						{ label: 'Per gene', value: 'gene_expression' },
						{ label: 'Gene group', value: 'gene_groups' }
					]
				},
				{
					label: 'Annotation level',
					title: 'Show boundaries only within the n most zoomed-in levels; 0 = always show',
					type: 'number',
					chartType: 'wsi',
					settingsKey: 'annotationLevel',
					min: 0,
					step: 1
				}
			]
		})
	}
}

export const wsiInit = getCompInit(Wsi)
export const componentInit = wsiInit

export function getDefaultWsiSettings(overrides = {}): Settings {
	const defaults: Settings = {
		selectedSampleIndex: 0, // first sample selected on launch
		selectedImageIndex: 0, // the sample's first image displayed by default
		viewerHeight: '70vh',
		// spatial overlay settings; null = fall back to the dataset's values
		showCellBoundaries: true,
		showNucleusBoundaries: true,
		showGeneExpression: true,
		showCellTypes: false, // opt-in: fills all annotated cells, visually heavy
		cellTypeFilter: null, // null/'' = fill every annotated type

		geneExpression: null,
		annotationLevel: null,
		spatialMode: 'gene_expression'
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts: any, _app: any) {
	const config = {
		chartType: 'wsi',
		settings: {
			wsi: getDefaultWsiSettings(opts.overrides)
		},
		hidePlotFilter: true
	}
	return copyMerge(config, opts)
}
