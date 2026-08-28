import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx' // rx plumbing
import { PlotBase } from '../PlotBase' // shared mass-plot base class
import type { BasePlotConfig, MassState } from '#mass/types/mass' // app state shapes
import type { SpatialImage } from '#types' // spatial image entry from wsiBySample
import { dofetch3 } from '#common/dofetch' // gene-name/cell-type discovery requests
import { controlsInit } from '../controls' // burger-menu builder
import type Settings from './Settings.ts' // this plot's settings shape
import { Model } from './model/Model' // server data access
import { ViewModel } from './viewModel/ViewModel' // shapes data for rendering
import { View } from './view/View' // renders table + viewer
import { WsiInteractions } from './interactions/WsiInteractions' // state-edit dispatchers

/** Mass plot listing every sample in the dataset that has whole-slide images
 (the wsisamples route performs the per-sample check), with a pan/zoom viewer
 for the selected sample's slide. Architecture mirrors plots/corrVolcano:
 Model (server data) -> ViewModel (view data) -> View (render), with
 interactions dispatching state edits. */
type WsiDom = {
	div: any // the plot's outer container
	controls: any // burger menu holder (spatial only)
	error: any // inline error banner
	table: any // pick-a-sample table
	viewer: any // tabs + map
	header?: any // sandbox header, renamed per image kind
}

class Wsi extends PlotBase implements RxComponent {
	static type = 'wsi' // rx chart type name

	type: string // instance copy of the chart type
	dom: WsiDom // the divs built in the constructor
	interactions?: WsiInteractions // created in init()
	/** showCellTypes of the previous render, to tell which exclusive fill
	 checkbox was just toggled when both end up checked */
	private prevShowCellTypes = false

	constructor(opts: any, api: ComponentApi) {
		super(opts, api) // PlotBase wires app/id/opts
		this.type = Wsi.type // rx uses this to route state updates
		const holder = opts.holder.classed('sjpp-wsi-main', true) // sandbox mount point
		const div = holder.append('div').style('padding', '5px') // the plot's own container
		this.dom = {
			div,
			// burger menu for spatial viewer settings; hidden until a spatial image is shown
			controls: div.append('div').attr('id', 'sjpp-wsi-controls').style('display', 'none'),
			error: div.append('div').attr('id', 'sjpp-wsi-error').style('opacity', 0.75), // inline errors
			table: div.append('div').attr('id', 'sjpp-wsi-table'), // sample table mount
			viewer: div.append('div').attr('id', 'sjpp-wsi-viewer') // tabs + map mount
		}
		if (opts.header)
			// sandbox title; main() renames it to SPATIAL VIEWER for spatial images
			this.dom.header = opts.header.text('WHOLE SLIDE IMAGES').style('font-size', '0.7em').style('opacity', 0.6)
	}

	/** the app-state slice this plot reacts to */
	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id) // this plot's config
		if (!config) {
			// the plot was registered wrong; fail loudly
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			vocab: appState.vocab, // genome + dslabel for server requests
			config // the plot's own settings
		}
	}

	/** rx lifecycle: one-time setup before the first main() */
	async init() {
		this.interactions = new WsiInteractions(this.app, this.id) // dispatchers used by the view
	}

	/** rx lifecycle: re-renders the whole plot on every relevant state change */
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
			this.dom.viewer.selectAll('*').remove() // and any stale viewer
			this.dom.error.style('padding', '20px').text(data?.error || 'No samples with whole-slide images.') // say why
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
			const spImage = image as SpatialImage // narrowed: spatial images carry companion paths
			// gene names discovered from the expression h5 itself, so the burger
			// menu offers/validates genes that actually exist in the data
			const genes = await this.fetchGeneNames(spImage, selectedSample!.sampleId)
			// cell types discovered by the meta request, for the type-filter dropdowns
			const cellTypes = await this.fetchCellTypes(spImage, selectedSample!.sampleId)
			// switching images can leave cellTypeFilter naming types the new
			// image lacks: the dropdowns would show 'All types' while the viewer
			// filters every cell out. Persist the cleaned selection instead
			// (only when discovery succeeded — [] may just mean the request failed)
			if (settings.cellTypeFilter && cellTypes.length) {
				const cleaned = settings.cellTypeFilter
					.split(',')
					.map(t => t.trim())
					.filter(t => cellTypes.includes(t)) // keep only types this image has
					.join(',')
				if (cleaned != settings.cellTypeFilter) {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { wsi: { cellTypeFilter: cleaned } } }
					})
					return // re-renders with the reconciled filter
				}
			}
			// seed the burger menu's gene/level fields once (null = never edited)
			// so the shown values match the overlay and can be edited or cleared;
			// re-renders once with the seeded state
			if (settings.geneExpression == null) {
				// the dataset's configured default is only an override: keep the
				// genes of it that exist in the file, else fall back to the file's
				// first gene, so the default is never a gene the data lacks
				const configured = (spImage.geneExpression || '') // dataset's comma-separated default genes
					.split(',')
					.map(s => s.trim())
					.filter(g => genes.includes(g)) // keep only genes the h5 actually has
				this.app.dispatch({
					// one-time seeding edit; triggers a re-render with the seeded values
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
			if (!this.components.controls) await this.setControls() // build the burger menu once
			this.addGeneDatalist() // autocomplete on the Genes field from the discovered names
		}
		this.dom.controls.style('display', isSpatial ? 'inline-block' : 'none') // burger only for spatial

		await new View(this.dom, viewModel.viewData, images, settings, this.interactions, this.state.vocab).render() // draw
	}

	/** gene names available in the current image's expression h5, cached per file */
	private geneNames: string[] = []
	private geneNamesFile?: string // the h5 the cache was built from

	/** Discover the genes present in the image's cell_feature_matrix h5 via
	 wsitiles/genenames (same slide-scoped access checks as genecounts).
	 Returns [] when the image has no expression file or the request fails. */
	private async fetchGeneNames(image: SpatialImage, sampleId: string): Promise<string[]> {
		const src = image.spatialData // the consolidated h5ad holds the expression matrix
		if (!src) return [] // no expression source, nothing to discover
		if (this.geneNamesFile == src) return this.geneNames // cached
		const v = this.state.vocab // genome + dslabel for the request
		const params = // standard wsitiles slide addressing + the expression file
			`wsimage=${encodeURIComponent(image.fileName)}&dslabel=${v.dslabel}&genome=${v.genome}` +
			`&sample_id=${encodeURIComponent(sampleId)}&imageType=spatial&file=${encodeURIComponent(src)}`
		const r = await dofetch3(`wsitiles/genenames?${params}`).catch(() => null)
		this.geneNames = Array.isArray(r?.genes) ? r.genes : [] // failure = no discovery, config still works
		this.geneNamesFile = src // remember which file the cache is for
		return this.geneNames
	}

	/** cell types available in the current image's annotations CSV, cached per file */
	private cellTypeNames: string[] = []
	private cellTypesFile?: string // the CSV the cache was built from

	/** Discover the distinct cell_type values of the image's per-cell
	 annotations CSV via the meta request (?cellAnnotations= makes
	 wsitiles/meta scan it). Returns [] when the image has no annotations
	 file or the request fails. */
	private async fetchCellTypes(image: SpatialImage, sampleId: string): Promise<string[]> {
		const src = image.spatialData // the consolidated h5ad holds the annotations
		if (!src) {
			// this image has no annotations: clear the cache so stale types
			// from a previously shown image don't populate the dropdowns
			this.cellTypeNames = []
			this.cellTypesFile = undefined
			return this.cellTypeNames
		}
		if (this.cellTypesFile == src) return this.cellTypeNames // cached
		const v = this.state.vocab // genome + dslabel for the request
		const params = // standard wsitiles slide addressing + the annotations source to scan
			`wsimage=${encodeURIComponent(image.fileName)}&dslabel=${v.dslabel}&genome=${v.genome}` +
			`&sample_id=${encodeURIComponent(sampleId)}&imageType=spatial&cellAnnotations=${encodeURIComponent(src)}`
		const r = await dofetch3(`wsitiles/meta?${params}`).catch(() => null)
		this.cellTypeNames = Array.isArray(r?.cellTypes) ? r.cellTypes : [] // failure = no dropdowns, overlay still works
		this.cellTypesFile = src // remember which file the cache is for
		return this.cellTypeNames
	}

	/** Attach the discovered gene names to the Genes text input as a native
	 datalist, so typing autocompletes to genes that exist in the data.
	 (Autocomplete applies to the whole field, i.e. the first gene of a
	 comma-separated list — later genes are typed without suggestions.) */
	private addGeneDatalist() {
		if (!this.geneNames.length) return // nothing discovered, no suggestions
		const input = this.dom.controls.select('input[type=text]').node() as HTMLInputElement | null // the Genes field
		if (!input) return // controls not rendered (shouldn't happen)
		const id = `sjpp-wsi-genes-${this.id}` // per-plot-instance datalist id
		document.getElementById(id)?.remove() // rebuild when the image (and its genes) changed
		const dl = document.createElement('datalist') // native autocomplete source
		dl.id = id // the id the input's list attribute points to
		for (const g of this.geneNames) {
			const opt = document.createElement('option') // one suggestion per gene
			opt.value = g // the text autocomplete inserts
			dl.appendChild(opt)
		}
		input.after(dl) // datalist must be in the DOM to work
		input.setAttribute('list', id) // link the input to its suggestions
	}

	/** Burger menu with the spatial overlay settings; fields are pre-seeded
	 with defaults discovered from the data by main() before this runs. */
	private async setControls() {
		this.components.controls = await controlsInit({
			app: this.app, // rx app the inputs dispatch through
			id: this.id, // this plot's id in app state
			holder: this.dom.controls, // the burger-menu div
			inputs: [
				{
					// checkbox: toggle the blue nucleus outlines
					label: 'Nucleus boundaries',
					title: 'Show or hide the nucleus segmentation overlay',
					type: 'checkbox',
					chartType: 'wsi',
					settingsKey: 'showNucleusBoundaries',
					boxLabel: 'show'
				},
				{
					// checkbox: toggle the green cell outlines
					label: 'Cell boundaries',
					title: 'Show or hide the cell segmentation overlay',
					type: 'checkbox',
					chartType: 'wsi',
					settingsKey: 'showCellBoundaries',
					boxLabel: 'show'
				},
				{
					// checkbox: toggle the categorical cell-type fills (mutually
					// exclusive with the gene expression fills, enforced in main())
					label: 'Cell types',
					title: 'Fill cells by their cell_type from the annotations CSV (when present)',
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
							const td = self.dom.inputTd // the row's input cell
							td.selectAll('*').remove() // rebuild the dropdowns on every state change
							const types = this.cellTypeNames // discovered by fetchCellTypes for the shown image
							const s: Settings = plot.settings.wsi // current settings from state
							if (!s.showCellTypes || !types.length) {
								self.dom.row.style('display', 'none') // overlay off / no annotation column
								return
							}
							self.dom.row.style('display', 'table-row') // show the row
							// defensive only: main() reconciles cellTypeFilter to this
							// image's types before rendering, so this filter is a no-op
							// unless a render sneaks in mid-reconciliation
							const selected = (s.cellTypeFilter || '')
								.split(',')
								.map(t => t.trim())
								.filter(t => types.includes(t))
							const dispatch = (list: string[]) =>
								// write the new selection back to state; re-render redraws the dropdowns
								this.app.dispatch({
									type: 'plot_edit',
									id: this.id,
									config: { settings: { wsi: { cellTypeFilter: list.join(',') } } }
								})
							const addSelect = () =>
								td
									.append('select')
									.attr('aria-label', 'Cell type filter')
									.style('display', 'block')
									.style('margin', '2px 0')
									.style('max-width', '180px')
							// one dropdown per chosen type: change replaces it, blank removes it
							for (const [i, t] of selected.entries()) {
								const sel = addSelect().on('change', function (this: HTMLSelectElement) {
									const next = selected.slice() // edit a copy of the selection
									if (this.value) next[i] = this.value // picked a type = replace this slot
									else next.splice(i, 1) // picked the blank option = remove this slot
									dispatch(next)
								})
								sel.append('option').attr('value', '').text('× remove') // the blank remove option
								// offer this slot's own type plus every type no other slot holds
								for (const ty of types)
									if (ty == t || !selected.includes(ty))
										sel
											.append('option')
											.attr('value', ty)
											.property('selected', ty == t) // current choice pre-selected
											.text(ty)
							}
							// the next dropdown, offering the not-yet-selected types
							const remaining = types.filter(ty => !selected.includes(ty))
							if (remaining.length) {
								const add = addSelect().on('change', function (this: HTMLSelectElement) {
									if (this.value) dispatch([...selected, this.value]) // append the picked type
								})
								add
									.append('option')
									.attr('value', '') // placeholder, selecting it changes nothing
									.text(selected.length ? 'Add type…' : 'All types')
								for (const ty of remaining) add.append('option').attr('value', ty).text(ty) // the candidates
							}
						}
					})
				},
				{
					// checkbox: toggle the expression FILLS only — hover counts stay
					// either way (View.ts always loads the genes)
					label: 'Gene expression',
					title: 'Show or hide the gene expression overlay',
					type: 'checkbox',
					chartType: 'wsi',
					settingsKey: 'showGeneExpression',
					boxLabel: 'show'
				},
				{
					// text field: which genes to load, with datalist autocomplete
					label: 'Genes',
					title: 'Comma-separated gene names to overlay',
					type: 'text',
					chartType: 'wsi',
					settingsKey: 'geneExpression',
					placeholder: 'gene1,gene2,…'
				},
				{
					// radio: per-gene overlays vs one summed gene-group overlay
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
					// number: how many zoomed-in levels show the boundary strokes
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

export const wsiInit = getCompInit(Wsi) // the rx component factory
export const componentInit = wsiInit // alias the plot loader expects

/** the plot's default settings, with optional per-dataset overrides */
export function getDefaultWsiSettings(overrides = {}): Settings {
	const defaults: Settings = {
		selectedSampleIndex: 0, // first sample selected on launch
		selectedImageIndex: 0, // the sample's first image displayed by default
		viewerHeight: '70vh', // map height in the sandbox
		// spatial overlay settings; null = fall back to the dataset's values
		showCellBoundaries: true, // green cell outlines on
		showNucleusBoundaries: true, // blue nucleus outlines on
		showGeneExpression: true, // expression fills on (seeding may flip this off)
		showCellTypes: false, // opt-in: fills all annotated cells, visually heavy
		cellTypeFilter: null, // null/'' = fill every annotated type

		geneExpression: null, // null = seed from the data on first spatial render
		annotationLevel: null, // null = dataset default
		spatialMode: 'gene_expression' // per-gene overlays by default
	}
	return Object.assign(defaults, overrides) // dataset overrides win
}

/** initial plot config when the chart is launched */
export async function getPlotConfig(opts: any, _app: any) {
	const config = {
		chartType: 'wsi', // routes state updates to this component
		settings: {
			wsi: getDefaultWsiSettings(opts.overrides) // defaults + dataset overrides
		},
		hidePlotFilter: true // the mass filter UI doesn't apply to slides
	}
	return copyMerge(config, opts) // launch-time opts win over defaults
}
