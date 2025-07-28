import { fillTermWrapper } from '#termsetting'
import { Menu } from '#dom'
import type { Scatter } from '../scatter.js'
import { select } from 'd3-selection'
import { isNumericTerm } from '#shared/terms.js'
export const minShapeSize = 0.2
export const maxShapeSize = 6
export class ScatterView {
	opts: any
	dom: any
	scatter: Scatter
	loading: any
	loadingDiv: any
	tooltip: any
	tooltipDiv: any
	chart: any
	chartDiv: any

	constructor(scatter: Scatter) {
		this.opts = scatter.opts
		this.scatter = scatter

		const leftDiv = this.opts.holder.insert('div').style('display', 'inline-block')
		const controlsHolder = leftDiv
			.insert('div')
			.style('display', 'inline-block')
			.attr('class', 'pp-termdb-plot-controls')

		const rightDiv = this.opts.holder.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		const headerDiv = rightDiv.append('div')
		const mainDiv = rightDiv.append('div')

		this.dom = {
			headerDiv,
			mainDiv,
			header: this.opts.header,
			//holder,
			loadingDiv: this.opts.holder.append('div').style('position', 'absolute').style('left', '45%').style('top', '60%'),
			tip: new Menu({ padding: '0px' }),
			tooltip: new Menu({ padding: '2px', offsetX: 10, offsetY: 0 }),
			controlsHolder,
			toolsDiv: leftDiv.insert('div')
		}

		if (this.dom.header) {
			const chartName = splitCamelCase(this.scatter.type).toUpperCase()
			this.dom.header.html(
				`${
					this.scatter.config.name || ''
				} <span style="opacity:.6;font-size:.7em;margin-left:10px;">${chartName}</span>`
			)
		}
		document.addEventListener('scroll', () => this?.dom?.tooltip?.hide())
		select('.sjpp-output-sandbox-content').on('scroll', () => this.dom.tooltip.hide())
	}

	getControlInputs() {
		const hasRef = this.scatter.model.charts[0]?.data.samples.find(s => !('sampleId' in s)) || false
		const scaleDotOption = {
			type: 'term',
			configKey: 'scaleDotTW',
			chartType: 'sampleScatter',
			usecase: { target: 'sampleScatter', detail: 'numeric' },
			title: 'Scale sample by term value',
			label: 'Scale by',
			vocabApi: this.scatter.app.vocabApi,
			numericEditMenuVersion: ['continuous']
		}
		const shapeOption = {
			type: 'term',
			configKey: 'shapeTW',
			chartType: 'sampleScatter',
			usecase: { target: 'sampleScatter', detail: 'shapeTW' },
			title: 'Categories to assign a shape',
			label: 'Shape',
			vocabApi: this.scatter.app.vocabApi,
			numericEditMenuVersion: ['discrete'],
			processInput: async tw => {
				//only discrete mode allowed so set discrete mode and fill term wrapper to add the bins
				if (isNumericTerm(tw?.term)) {
					tw.q = { mode: 'discrete' } //use discrete mode by default
					await fillTermWrapper(tw, this.scatter.app.vocabApi)
				}
			}
		}
		const shapeSizeOption = {
			label: 'Sample size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'size',
			title: 'Sample size, represents the factor used to scale the sample',
			min: 0,
			step: 0.1
		}
		const step = (maxShapeSize - minShapeSize) / 10
		const minShapeSizeOption = {
			label: 'Min size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'minShapeSize',
			title: 'Minimum sample size',
			min: minShapeSize,
			max: maxShapeSize,
			step
		}
		const maxShapeSizeOption = {
			label: 'Max size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'maxShapeSize',
			title: 'Maximum sample size',
			min: minShapeSize,
			max: maxShapeSize,
			step
		}
		const orientation = {
			label: 'Scale order',
			type: 'radio',
			chartType: 'sampleScatter',
			settingsKey: 'scaleDotOrder',
			options: [
				{ label: 'Ascending', value: 'Ascending' },
				{ label: 'Descending', value: 'Descending' }
			]
		}
		const refSizeOption = {
			label: 'Reference size',
			type: 'number',
			chartType: 'sampleScatter',
			settingsKey: 'refSize',
			title: 'It represents the area of the reference symbol in square pixels',
			min: 0,
			step: 0.1
		}
		const showAxes = {
			boxLabel: '',
			label: 'Show axes',
			type: 'checkbox',
			chartType: 'sampleScatter',
			settingsKey: 'showAxes',
			title: `Option to show/hide plot axes`,
			testid: 'showAxes'
		}

		const inputs: any = [
			{
				type: 'term',
				configKey: 'colorTW',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'colorTW' },
				title: 'Categories to color the samples',
				label: 'Color',
				vocabApi: this.scatter.app.vocabApi,
				numericEditMenuVersion: ['continuous', 'discrete']
			},

			{
				label: 'Opacity',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'opacity',
				title: 'It represents the opacity of the elements',
				min: 0,
				max: 1,
				step: 0.1
			},
			{
				label: 'Chart width',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'svgw'
			},
			{
				label: 'Chart height',
				type: 'number',
				chartType: 'sampleScatter',
				settingsKey: 'svgh'
			},
			{
				label: 'Show contour map',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'sampleScatter',
				settingsKey: 'showContour',
				title:
					"Shows the density of point clouds. If 'Color' is used in continous mode, it uses it to weight the points when calculating the density contours. If 'Z/Divide by' is added in continous mode, it used it instead."
			},
			{
				label: 'Save zoom transform',
				boxLabel: '',
				type: 'checkbox',
				chartType: 'sampleScatter',
				settingsKey: 'saveZoomTransform',
				title: `Option to save the zoom transformation in the state. Needed if you want to save a session with the actual zoom and pan applied`,
				processInput: value => this.saveZoomTransform(value)
			}
		]
		if (this.scatter.settings.showContour)
			inputs.push(
				{
					label: 'Color contours',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'sampleScatter',
					settingsKey: 'colorContours'
				},
				{
					label: 'Contour bandwidth',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'contourBandwidth',
					title: 'Reduce to increase resolution. ',
					min: 5,
					max: 50,
					step: 5
				},
				{
					label: 'Contour thresholds',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'contourThresholds',
					title: 'Dot size',
					min: 5,
					max: 30,
					step: 5
				}
			)
		if (this.scatter.config.sampleCategory) {
			const options: any = Object.values(this.scatter.config.sampleCategory.tw.term.values).map((v: any) => ({
				label: v.label || v.key,
				value: v.key
			}))
			if (this.scatter.config.sampleCategory.order)
				options.sort((elem1, elem2) => {
					const i1 = this.scatter.config.sampleCategory.order.indexOf(elem1.value)
					const i2 = this.scatter.config.sampleCategory.order.indexOf(elem2.value)
					if (i1 < i2) return -1
					return 1
				})
			if (!this.scatter.settings.sampleCategory)
				this.scatter.settings.sampleCategory = this.scatter.config.sampleCategory.defaultValue || ''
			options.push({ label: 'All', value: '' })
			const sampleCategory = {
				label: 'Sample type',
				type: 'dropdown',
				chartType: 'sampleScatter',
				settingsKey: 'sampleCategory',
				options
			}
			inputs.push(sampleCategory)
		}

		if (!this.scatter.model.is2DLarge) {
			const isPremade = this.scatter.config.name !== undefined && !this.scatter.config.term
			inputs.unshift({
				type: 'term',
				configKey: 'term0',
				chartType: 'sampleScatter',
				usecase: { target: 'sampleScatter', detail: 'term0' },
				title: 'Term to to divide by categories or to use as Z coordinate',
				label: 'Z / Divide by',
				vocabApi: this.scatter.app.vocabApi,
				numericEditMenuVersion: ['discrete', 'continuous'],
				processInput: tw => {
					if (!isPremade && isNumericTerm(tw?.term)) tw.q = { mode: 'continuous' } //use continuous mode by default if not premade plot
				}
			})
		} else {
			inputs.push(
				{
					label: 'Sample size',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'threeSize',
					title: 'Sample size',
					min: 0,
					max: 1,
					step: 0.001
				},
				{
					label: 'Field of Vision',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'threeFOV',
					title: 'Field of Vision',
					min: 50,
					max: 90,
					step: 1
				}
			)
		}
		if (this.scatter.config.term) {
			inputs.unshift(
				...[
					{
						type: 'term',
						configKey: 'term',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'numeric' },
						title: 'X coordinate to plot the samples',
						label: 'X',
						vocabApi: this.scatter.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous']
					},
					{
						type: 'term',
						configKey: 'term2',
						chartType: 'sampleScatter',
						usecase: { target: 'sampleScatter', detail: 'numeric' },
						title: 'Y coordinate to plot the samples',
						label: 'Y',
						vocabApi: this.scatter.app.vocabApi,
						menuOptions: '!remove',
						numericEditMenuVersion: ['continuous']
					}
				]
			)
			if (!this.scatter.model.is3D) {
				inputs.splice(4, 0, shapeOption)
				inputs.splice(5, 0, scaleDotOption)
				if (this.scatter.config.scaleDotTW) {
					inputs.splice(6, 0, minShapeSizeOption)
					inputs.splice(7, 0, maxShapeSizeOption)
					inputs.splice(8, 0, orientation)
					if (hasRef) inputs.splice(9, 0, refSizeOption)
				} else {
					inputs.splice(6, 0, shapeSizeOption)
					if (hasRef) inputs.splice(7, 0, refSizeOption)
				}

				inputs.push({
					label: 'Show regression',
					type: 'dropdown',
					chartType: 'sampleScatter',
					settingsKey: 'regression',
					options: [
						{ label: 'None', value: 'None' },
						//{ label: 'Loess', value: 'Loess' },
						{ label: 'Lowess', value: 'Lowess' },
						{ label: 'Polynomial', value: 'Polynomial' }
					]
				})
			} else {
				inputs.push({
					label: 'Chart depth',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'svgd'
				})
				inputs.push({
					label: 'Field of vision',
					title: 'Camera field of view, in degrees',
					type: 'number',
					chartType: 'sampleScatter',
					settingsKey: 'fov'
				})
			}
			inputs.push(showAxes)

			inputs.push({
				label: 'Default color',
				type: 'color',
				chartType: 'sampleScatter',
				settingsKey: 'defaultColor'
			})
		} else if (!this.scatter.model.is2DLarge) {
			inputs.splice(2, 0, shapeOption)
			inputs.splice(3, 0, scaleDotOption)
			if (this.scatter.config.scaleDotTW) {
				inputs.splice(4, 0, minShapeSizeOption)
				inputs.splice(5, 0, maxShapeSizeOption)
				inputs.splice(6, 0, orientation)
				if (hasRef) inputs.splice(7, 0, refSizeOption)
			} else {
				inputs.splice(4, 0, shapeSizeOption)
				if (hasRef) inputs.splice(5, 0, refSizeOption)
			}
			inputs.push(showAxes)
		}
		return inputs
	}

	saveZoomTransform(value: any) {
		if (value) this.scatter.vm.scatterZoom.saveZoomTransform()
		return value
	}
}

/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
function splitCamelCase(text) {
	return text.split(/(?=[A-Z])/).join(' ')
}
