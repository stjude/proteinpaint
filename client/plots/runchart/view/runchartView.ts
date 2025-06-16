import { fillTermWrapper } from '#termsetting'
import type { Runchart } from '../runchart.js'
import { ScatterView } from '../../scatter/view/scatterView.js'
import { isNumericTerm } from '#shared/terms.js'

export const minShapeSize = 0.2
export const maxShapeSize = 6
export class RunchartView extends ScatterView {
	runchart: Runchart

	constructor(runchart: Runchart) {
		super(runchart)
		this.runchart = runchart
	}

	async getFilterControlInputs() {
		const filters = {}
		for (const tw of this.runchart.filterTWs) {
			const filter = this.runchart.getFilter(tw)
			if (filter) filters[tw.term.id] = filter
		}

		//Dictionary with samples applying all the filters but not the one from the current term id
		const samplesPerFilter = await this.runchart.app.vocabApi.getSamplesPerFilter({
			filters
		})
		const inputs: any[] = []
		if (this.runchart.config.countryTW) {
			const countries = this.runchart.getList(this.runchart.config.countryTW, samplesPerFilter)

			inputs.push({
				label: 'Country',
				type: 'dropdown',
				chartType: this.runchart.type,
				settingsKey: this.runchart.config.countryTW.term.id,
				options: countries,
				callback: value => this.runchart.setCountry(value)
			})
		}
		if (this.runchart.config.siteTW) {
			const sites = this.runchart.getList(this.runchart.config.siteTW, samplesPerFilter)
			inputs.push({
				label: 'Site',
				type: 'dropdown',
				chartType: this.runchart.type,
				settingsKey: this.runchart.config.siteTW.term.id,
				options: sites,
				callback: value => this.runchart.setFilterValue(this.runchart.config.siteTW.term.id, value)
			})
		}
		return inputs
	}

	async getControlInputs() {
		const inputs: any[] = await this.getFilterControlInputs()
		const shapeOption = {
			type: 'term',
			configKey: 'shapeTW',
			chartType: 'runChart',
			usecase: { target: 'runChart', detail: 'shapeTW' },
			title: 'Categories to assign a shape',
			label: 'Shape',
			vocabApi: this.runchart.app.vocabApi,
			numericEditMenuVersion: ['discrete'],
			processInput: async tw => {
				//only discrete mode allowed so set discrete mode and fill term wrapper to add the bins
				if (isNumericTerm(tw?.term)) {
					tw.q = { mode: 'discrete' } //use discrete mode by default
					await fillTermWrapper(tw, this.runchart.app.vocabApi)
				}
			}
		}
		const shapeSizeOption = {
			label: 'Sample size',
			type: 'number',
			chartType: 'runChart',
			settingsKey: 'size',
			title: 'Sample size, represents the factor used to scale the sample',
			min: 0,
			step: 0.1
		}
		const step = (maxShapeSize - minShapeSize) / 10
		const minShapeSizeOption = {
			label: 'Min size',
			type: 'number',
			chartType: 'runChart',
			settingsKey: 'minShapeSize',
			title: 'Minimum sample size',
			min: minShapeSize,
			max: maxShapeSize,
			step
		}
		const maxShapeSizeOption = {
			label: 'Max size',
			type: 'number',
			chartType: 'runChart',
			settingsKey: 'maxShapeSize',
			title: 'Maximum sample size',
			min: minShapeSize,
			max: maxShapeSize * 2,
			step
		}

		inputs.push(
			...[
				{
					type: 'term',
					configKey: 'term',
					chartType: 'runChart',
					usecase: { target: 'runChart', detail: 'numeric' },
					title: 'X coordinate to plot the samples',
					label: 'X',
					vocabApi: this.runchart.app.vocabApi,
					menuOptions: '!remove',
					numericEditMenuVersion: ['continuous']
				},
				{
					type: 'term',
					configKey: 'term2',
					chartType: 'runChart',
					usecase: { target: 'runChart', detail: 'numeric' },
					title: 'Y coordinate to plot the samples',
					label: 'Y',
					vocabApi: this.runchart.app.vocabApi,
					menuOptions: '!remove',
					numericEditMenuVersion: ['continuous']
				},
				{
					boxLabel: '',
					label: 'Aggregate data',
					chartType: 'runChart',
					settingsKey: 'aggregateData',
					title: `Group samples from the same month and year`,
					type: 'dropdown',
					options: [
						{ label: 'None', value: 'None' },
						//{ label: 'Loess', value: 'Loess' },
						{ label: 'Median', value: 'Median' },
						{ label: 'Mean', value: 'Mean' }
					]
				},

				{
					type: 'term',
					configKey: 'term0',
					chartType: 'runChart',
					usecase: { target: 'runChart', detail: 'term0' },
					title: 'Term to to divide by categories',
					label: 'Divide by',
					vocabApi: this.runchart.app.vocabApi,
					numericEditMenuVersion: ['discrete']
				},
				{
					type: 'term',
					configKey: 'colorTW',
					chartType: 'runChart',
					usecase: { target: 'runChart', detail: 'colorTW' },
					title: 'Categories to color the samples',
					label: 'Color',
					vocabApi: this.runchart.app.vocabApi,
					numericEditMenuVersion: ['continuous', 'discrete']
				},
				shapeOption,
				shapeSizeOption,

				{
					type: 'term',
					configKey: 'scaleDotTW',
					chartType: 'runChart',
					usecase: { target: 'runChart', detail: 'numeric' },
					title: 'Scale sample by term value',
					label: 'Scale by',
					vocabApi: this.runchart.app.vocabApi,
					numericEditMenuVersion: ['continuous']
				},

				{
					label: 'Opacity',
					type: 'number',
					chartType: 'runChart',
					settingsKey: 'opacity',
					title: 'It represents the opacity of the elements',
					min: 0,
					max: 1,
					step: 0.1
				},
				{
					label: 'Chart width',
					type: 'number',
					chartType: 'runChart',
					settingsKey: 'svgw'
				},
				{
					label: 'Chart height',
					type: 'number',
					chartType: 'runChart',
					settingsKey: 'svgh'
				},
				{
					label: 'Default color',
					type: 'color',
					chartType: 'runChart',
					settingsKey: 'defaultColor'
				},
				{
					label: 'Save zoom transform',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'runChart',
					settingsKey: 'saveZoomTransform',
					title: `Option to save the zoom transformation in the state. Needed if you want to save a session with zoom and pan applied`,
					processInput: value => this.saveZoomTransform(value)
				}
			]
		)
		if (this.runchart.config.scaleDotTW)
			inputs.splice(inputs.length - 5, 0, minShapeSizeOption, maxShapeSizeOption, {
				label: 'Scale order',
				type: 'radio',
				chartType: 'runChart',
				settingsKey: 'scaleDotOrder',
				options: [
					{ label: 'Ascending', value: 'Ascending' },
					{ label: 'Descending', value: 'Descending' }
				]
			})

		if (!this.runchart.config.term0)
			inputs.push({
				label: 'Show regression',
				type: 'dropdown',
				chartType: 'runChart',
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
