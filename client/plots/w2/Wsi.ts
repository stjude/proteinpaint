import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import type { BasePlotConfig, MassState } from '#mass/types/mass'
import type { SpatialImage } from '#types'
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
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return
		if (!this.interactions) throw 'Interactions not initialized [wsi main()]'

		const settings: Settings = config.settings.wsi
		this.dom.error.text('')

		// which samples have whole-slide images on disk?
		const model = new Model(this.state.vocab.genome, this.state.vocab.dslabel)
		const data = await model.getData()
		if (!data || data.error || !data.samples?.length) {
			this.dom.table.selectAll('*').remove()
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
		const isSpatial = images[0]?.type == 'spatial'
		this.dom.header?.text(isSpatial ? 'SPATIAL VIEWER' : 'WHOLE SLIDE IMAGES')
		if (isSpatial) {
			// seed the burger menu's gene/level fields with the dataset's defaults
			// (null = never edited) so the shown values match the overlay and can
			// be edited or cleared; re-renders once with the seeded state
			const image = images[0] as SpatialImage
			if (settings.geneExpression == null && image.geneExpression != null) {
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: {
						settings: {
							wsi: {
								geneExpression: image.geneExpression,
								annotationLevel: settings.annotationLevel ?? image.annotationLevel
							}
						}
					}
				})
				return
			}
			if (!this.components.controls) await this.setControls()
		}
		this.dom.controls.style('display', isSpatial ? 'inline-block' : 'none')

		await new View(this.dom, viewModel.viewData, images, settings, this.interactions, this.state.vocab).render()
	}

	/** Burger menu with the spatial overlay settings; fields are pre-seeded
	 with the dataset's defaults by main() before this runs. */
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
		viewerHeight: '70vh',
		// spatial overlay settings; null = fall back to the dataset's values
		showCellBoundaries: true,
		showNucleusBoundaries: true,
		showGeneExpression: true,
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
