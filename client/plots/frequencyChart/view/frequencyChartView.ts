import { fillTermWrapper } from '#termsetting'
import type { FrequencyChart } from '../frequencyChart.ts'
import { RunchartView } from '../../runchart/view/runchartView.ts'
import { isNumericTerm } from '#shared/terms.js'

export const minShapeSize = 0.2
export const maxShapeSize = 6
export class FrequencyChartView extends RunchartView {
	frequencyChart: FrequencyChart

	constructor(frequencyChart: FrequencyChart) {
		super(frequencyChart)
		this.frequencyChart = frequencyChart
	}

	async getControlInputs() {
		const filterInputs = await this.getFilterControlInputs()
		const shapeOption = {
			type: 'term',
			configKey: 'shapeTW',
			chartType: 'frequencyChart',
			usecase: { target: 'frequencyChart', detail: 'shapeTW' },
			title: 'Categories to assign a shape',
			label: 'Shape',
			vocabApi: this.frequencyChart.app.vocabApi,
			numericEditMenuVersion: ['discrete'],
			processInput: async tw => {
				//only discrete mode allowed so set discrete mode and fill term wrapper to add the bins
				if (isNumericTerm(tw?.term)) {
					tw.q = { mode: 'discrete' } //use discrete mode by default
					await fillTermWrapper(tw, this.frequencyChart.app.vocabApi)
				}
			}
		}
		const shapeSizeOption = {
			label: 'Sample size',
			type: 'number',
			chartType: 'frequencyChart',
			settingsKey: 'size',
			title: 'Sample size, represents the factor used to scale the sample',
			min: 0,
			step: 0.1
		}
		const step = (maxShapeSize - minShapeSize) / 10
		const minShapeSizeOption = {
			label: 'Min size',
			type: 'number',
			chartType: 'frequencyChart',
			settingsKey: 'minShapeSize',
			title: 'Minimum sample size',
			min: minShapeSize,
			max: maxShapeSize,
			step
		}
		const maxShapeSizeOption = {
			label: 'Max size',
			type: 'number',
			chartType: 'frequencyChart',
			settingsKey: 'maxShapeSize',
			title: 'Maximum sample size',
			min: minShapeSize,
			max: maxShapeSize * 2,
			step
		}

		const inputs: any = [
			...filterInputs,
			{
				type: 'term',
				configKey: 'term',
				chartType: 'frequencyChart',
				usecase: { target: 'frequencyChart', detail: 'numeric' },
				title: 'X coordinate to plot the samples',
				label: 'X',
				vocabApi: this.frequencyChart.app.vocabApi,
				menuOptions: '!remove',
				numericEditMenuVersion: ['continuous']
			},

			{
				type: 'term',
				configKey: 'term0',
				chartType: 'frequencyChart',
				usecase: { target: 'frequencyChart', detail: 'term0' },
				title: 'Term to to divide by categories',
				label: 'Divide by',
				vocabApi: this.frequencyChart.app.vocabApi,
				numericEditMenuVersion: ['discrete']
			},
			{
				label: 'Show cumulative frecuency',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'frequencyChart',
				settingsKey: 'showCumulativeFrequency',
				title: `Option to show the cumulative number of events over time`
			},
			{
				type: 'term',
				configKey: 'colorTW',
				chartType: 'frequencyChart',
				usecase: { target: 'frequencyChart', detail: 'colorTW' },
				title: 'Categories to color the samples',
				label: 'Color',
				vocabApi: this.frequencyChart.app.vocabApi,
				numericEditMenuVersion: ['continuous', 'discrete']
			},
			shapeOption,
			shapeSizeOption,

			{
				type: 'term',
				configKey: 'scaleDotTW',
				chartType: 'frequencyChart',
				usecase: { target: 'frequencyChart', detail: 'numeric' },
				title: 'Scale sample by term value',
				label: 'Scale by',
				vocabApi: this.frequencyChart.app.vocabApi,
				numericEditMenuVersion: ['continuous']
			},

			{
				label: 'Opacity',
				type: 'number',
				chartType: 'frequencyChart',
				settingsKey: 'opacity',
				title: 'It represents the opacity of the elements',
				min: 0,
				max: 1,
				step: 0.1
			},
			{
				label: 'Chart width',
				type: 'number',
				chartType: 'frequencyChart',
				settingsKey: 'svgw'
			},
			{
				label: 'Chart height',
				type: 'number',
				chartType: 'frequencyChart',
				settingsKey: 'svgh'
			},
			{
				label: 'Default color',
				type: 'color',
				chartType: 'frequencyChart',
				settingsKey: 'defaultColor'
			},
			{
				label: 'Save zoom transform',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'frequencyChart',
				settingsKey: 'saveZoomTransform',
				title: `Option to save the zoom transformation in the state. Needed if you want to save a session with the actual zoom and pan applied`,
				processInput: value => this.saveZoomTransform(value)
			}
		]
		if (this.frequencyChart.config.scaleDotTW)
			inputs.splice(inputs.length - 5, 0, minShapeSizeOption, maxShapeSizeOption, {
				label: 'Scale order',
				type: 'radio',
				chartType: 'frequencyChart',
				settingsKey: 'scaleDotOrder',
				options: [
					{ label: 'Ascending', value: 'Ascending' },
					{ label: 'Descending', value: 'Descending' }
				]
			})

		if (!this.frequencyChart.config.term0)
			inputs.push({
				label: 'Show regression',
				type: 'dropdown',
				chartType: 'frequencyChart',
				settingsKey: 'regression',
				options: [
					{ label: 'None', value: 'None' },
					//{ label: 'Loess', value: 'Loess' },
					{ label: 'Lowess', value: 'Lowess' },
					{ label: 'Polynomial', value: 'Polynomial' }
				]
			})

		return inputs
	}
}

/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
