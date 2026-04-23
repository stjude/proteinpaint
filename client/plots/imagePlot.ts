import { dofetch3 } from '#src/client'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '../rx'
import { controlsInit } from './controls'
import { PlotBase } from './PlotBase'

class ImagePlot extends PlotBase implements RxComponent {
	static type = 'imagePlot'

	type: string

	constructor(opts, api: ComponentApi) {
		super(opts, api)
		this.opts = opts
		this.api = api
		this.type = ImagePlot.type

		if (this.opts?.header) {
			if (this.opts?.headerText)
				this.opts.header.append('span').style('padding-right', '5px').text(this.opts.headerText)
			this.opts.header.append('span').text('IMAGE PLOT').style('font-size', '0.7em').style('opacity', 0.6)
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			termfilter: appState.termfilter,
			vocab: appState.vocab
		}
	}

	async init(appState) {
		const config = this.getState(appState).config

		//Init DOM
		const holder = this.opts.holder.append('div').attr('data-testid', 'sjpp-imagePlot-holder')
		this.dom = {
			holder,
			controlsHolder: holder
				.append('div')
				.attr('data-testid', 'sjpp-imagePlot-controlsDiv')
				.style('display', 'inline-block'),
			imageHolder: holder.append('div').attr('data-testid', 'sjpp-imagePlot-imagesDiv').style('display', 'inline-block')
		}
		//No main() originally implemented. Change in controls has no effect, for now.
		// this.setControls()

		const sampleId = config.sample?.sampleId || config.sample?.sID
		let images
		if (config?.imgDir) {
			const img = await dofetch3(
				`img?file=${config.imgDir.folder}${config.imgDir.folder.endsWith('/') ? '' : '/'}${sampleId}/${
					config.imgDir.fileName
				}`
			)
			if (!img || img?.error) throw new Error(img?.error || 'Error fetching image')
			images = [img]
		} else {
			const result = await this.app.vocabApi.getSampleImages(sampleId)
			if (result.error) throw new Error(result.error)
			images = result.images
		}

		for (const img of images) {
			this.dom.imageHolder
				.append('img')
				.style('padding', '10px')
				.attr('src', img.src)
				.attr('width', config.settings.imagePlot.width)
				.attr('height', config.settings.imagePlot.height)
		}
	}

	async setControls() {
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsHolder,
				inputs: [
					{
						label: 'Image width',
						type: 'number',
						chartType: this.type,
						settingsKey: 'width'
					},
					{
						label: 'Image height',
						type: 'number',
						chartType: this.type,
						settingsKey: 'height'
					}
				]
			})
		}
	}

	async main() {
		// console.log('image plot main called with state ', this.state)
	}
}

export async function getPlotConfig(opts) {
	const settings = getDefaultImagePlotSettings()
	if (opts.settings) copyMerge(settings, opts.settings)

	const config = {
		settings: {
			controls: {
				isOpen: false
			},
			imagePlot: settings
		}
	}
	return copyMerge(config, opts)
}

type Settings = {
	width: number
	height: number
}

export function getDefaultImagePlotSettings(): Settings {
	return {
		width: 500,
		height: 500
	}
}

export const imagePlotInit = getCompInit(ImagePlot)
// this alias will allow abstracted dynamic imports
export const componentInit = imagePlotInit

/** Old implementation maintained for the sampleView.
 * ***Not*** recommended for new use cases. */
export async function renderImagePlot(state, holder, sample) {
	const opts = {
		holder,

		state: {
			vocab: state.vocab,

			plots: [
				{
					chartType: 'imagePlot',
					sample
				}
			]
		}
	}
	const plot = await import('#plots/plot.app.js')
	await plot.appInit(opts)
}
