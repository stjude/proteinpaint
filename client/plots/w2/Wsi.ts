import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import type { BasePlotConfig, MassState } from '#mass/types/mass'
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

		await new View(this.dom, viewModel.viewData, images, settings, this.interactions, this.state.vocab).render()
	}
}

export const wsiInit = getCompInit(Wsi)
export const componentInit = wsiInit

export function getDefaultWsiSettings(overrides = {}): Settings {
	const defaults: Settings = {
		selectedSampleIndex: 0, // first sample selected on launch
		viewerHeight: '70vh'
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
