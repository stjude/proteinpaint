import { getCompInit, copyMerge } from '../rx'
import { controlsInit } from './controls'

class imagePlot {
	constructor() {
		this.type = 'imagePlot'
	}

	init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const state = this.getState(appState)
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder,
			controlsHolder: holder.append('div'),
			imageHolder: holder.append('div')
		}
		this.setControls()
		const url = `http://localhost:3000/static/st_jude_logo.png`
		this.dom.imageHolder
			.append('img')
			.attr('src', url)
			.attr('width', config.settings.imagePlot.width)
			.attr('height', config.settings.imagePlot.height)
	}

	async setControls() {
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsHolder,
				inputs: [
					{
						label: 'Chart width',
						type: 'number',
						chartType: this.type,
						settingsKey: 'width'
					},
					{
						label: 'Chart height',
						type: 'number',
						chartType: this.type,
						settingsKey: 'height'
					}
				]
			})
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
}

export async function getPlotConfig(opts, app) {
	let settings = getDefaultImagePlotSettings()
	if (opts.settings) copyMerge(settings, opts.settings)
	const config = {
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			imagePlot: settings
		}
	}
	// may apply term-specific changes to the default object
	const result = copyMerge(config, opts)
	return result
}

export function getDefaultImagePlotSettings() {
	return {
		width: 500,
		height: 500
	}
}

export const imagePlotInit = getCompInit(imagePlot)
// this alias will allow abstracted dynamic imports
export const componentInit = imagePlotInit

export async function renderImagePlot(state, holder, sampleName) {
	const opts = {
		holder,

		state: {
			vocab: state.vocab,

			plots: [
				{
					chartType: 'imagePlot',
					sampleName
				}
			]
		}
	}
	const plot = await import('#plots/plot.app.js')
	const plotAppApi = await plot.appInit(opts)
}
