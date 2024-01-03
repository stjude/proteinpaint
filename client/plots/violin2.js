import { getCompInit, copyMerge } from '../rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from './controls'

class ViolinPlot2 {
	constructor(opts) {
		this.type = 'violin2'
	}

	async init(appState) {
		const controls = this.opts.holder.append('div').attr('class', 'sjpp-plot-controls').style('display', 'inline-block')
		const holder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', this.opts.mode != 'minimal' ? '5px' : '0px')
			.style('padding-left', this.opts.mode != 'minimal' ? '45px' : '0px')
			.attr('id', 'sjpp-vp-holder')
		const loadingDiv = this.opts.holder
			.append('div')
			.style('position', 'absolute')
			.style('display', this.opts.mode != 'minimal' ? 'inline-block' : 'none')
			.style('padding-left', '10px')
			.style('padding-top', '20px')
			.text('Loading ...')
		this.dom = {
			loadingDiv,
			controls,
			violinDiv: holder
		}
		await this.setControls(this.getState(appState))
	}

	async setControls(state) {
		this.components = {}
		if (this.opts.mode == 'minimal') return
		const inputs = [
			{
				type: 'term1',
				// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here
				usecase: { target: 'violin2', detail: 'term' }
			},
			{
				type: 'overlay',
				title: 'Overlay data',
				//TODO: when term is numeric use 'overlay' otherwise for categories use 'Divide by'
				// TODO: when used under the summary chart, this.opts.usecase may replace the usecase here

				usecase: { target: 'violin2', detail: 'term2' }
			},
			{
				label: 'Orientation',
				title: 'Orientation of the chart',
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'orientation',
				options: [
					{ label: 'Vertical', value: 'vertical' },
					{ label: 'Horizontal', value: 'horizontal' }
				]
			},
			{
				label: 'Data symbol',
				title: 'Symbol type',
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'datasymbol',
				options: [
					{ label: 'Ticks', value: 'rug' },
					{ label: 'Circles', value: 'bean' },
					{ label: 'Off', value: 'none' }
				]
			},
			{
				label: 'Scale',
				title: 'Axis scale',
				type: 'radio',
				chartType: 'violin',
				settingsKey: 'unit',
				options: [
					{ label: 'Linear', value: 'abs' },
					{ label: 'Log', value: 'log' }
				]
			},
			{
				label: 'Symbol size',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'radius',
				step: 1,
				max: 15,
				min: 3
			},
			{
				label: 'Stroke width',
				title: 'Size of Symbol stroke',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'strokeWidth',
				step: 0.1,
				max: 2,
				min: 0.1
			},

			{
				label: 'Plot length',
				title: 'Length of the plot',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'svgw',
				step: 10,
				max: 1000,
				min: 500,
				debounceInterval: 1000
			},
			{
				label: 'Plot thickness',
				title: 'Thickness of plots, min:60 and max:150',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'plotThickness',
				step: 10,
				max: 500,
				min: 60,
				debounceInterval: 1000
			},
			{
				label: 'Median length',
				title: 'Length of median',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'medianLength',
				step: 1,
				max: 15,
				min: 3,
				debounceInterval: 1000
			},
			{
				label: 'Median thickness',
				title: 'Width of median',
				type: 'number',
				chartType: 'violin',
				settingsKey: 'medianThickness',
				step: 1,
				max: 10,
				min: 3,
				debounceInterval: 100
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls,
			inputs
		})

		this.components.controls.on('downloadClick.violin', this.download)
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		return {}
	}

	async main() {}
}

export function getDefaultViolinSettings(app, overrides = {}) {
	const defaults = {
		orientation: 'horizontal',
		rowlabelw: 250,
		brushRange: null, //object with start and end if there is a brush selection
		svgw: 500, // span length of a plot/svg, not including margin
		datasymbol: 'bean',
		radius: 5,
		strokeWidth: 0.2,
		axisHeight: 60,
		rightMargin: 50,
		displaySampleIds: app?.getState()?.termdbConfig?.displaySampleIds ? true : false,
		lines: [],
		unit: 'abs', // abs: absolute scale, log: log scale
		plotThickness: 150,
		medianLength: 7,
		medianThickness: 3
	}
	return Object.assign(defaults, overrides)
}

export const violinInit = getCompInit(ViolinPlot2)
export const componentInit = violinInit

export async function getPlotConfig(opts, app) {
	try {
		await fillTermWrapper(opts.term, app.vocabApi)
		if (opts.term2) await fillTermWrapper(opts.term2, app.vocabApi)
		if (opts.term0) await fillTermWrapper(opts.term0, app.vocabApi)
	} catch (e) {
		throw `${e} [violin getPlotConfig()]`
	}

	const config = {
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},

			violin: getDefaultViolinSettings(app)
		}
	}

	// may apply term-specific changes to the default object
	return copyMerge(config, opts)
}
