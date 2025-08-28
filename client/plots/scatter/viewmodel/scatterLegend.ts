import { ColorScale, getMaxLabelWidth, Menu } from '#dom'
import { select } from 'd3-selection'
import { rgb } from 'd3-color'
import { morigin, dt2label } from '#shared/common.js'
import { shapes } from '../model/scatterModel.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { ScatterLegendInteractivity } from './scatterLegendInteractivity.js'
import { minShapeSize, maxShapeSize } from '../view/scatterView.js'
import type { Scatter } from '../scatter.js'
import type { ScatterLegendItem } from '../scatterTypes.js'
export class ScatterLegend {
	scatter: Scatter
	vm: any
	model: any
	interactivity: any
	legendInteractivity: ScatterLegendInteractivity
	changeGradientColor: any

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.vm = scatter.vm
		this.model = scatter.model
		this.interactivity = scatter.interactivity
		this.legendInteractivity = new ScatterLegendInteractivity(scatter)
	}
	//Dynamically calculate the length of the legend labels
	getLegendLabelWidth(chart, key, svg, size) {
		const legend: Map<string, ScatterLegendItem> = chart[`${key}Legend`]
		if (!legend) return 0
		const labels: any = []
		for (const [k, v] of legend.entries()) {
			if (k != 'Ref') labels.push(`${k}, n=(${v.sampleCount})`)
		}
		labels.push(this.scatter.config[`${key}TW`]?.term?.name ?? '')

		// Add 70 for icons, paddings, etc.
		const width = getMaxLabelWidth(svg, labels, size) + 70
		return width
	}

	getFontSize(chart, legend) {
		let fontSize = 0.9
		if (chart.colorLegend.size < 10 && chart.shapeLegend.size < 10) return fontSize
		const top = 20
		//legend is a Map<string, ScatterLegendItem>
		if (legend.size > top) {
			fontSize = Math.min(0.9, top / legend.size)
			if (fontSize < 0.7) fontSize = 0.7
		}
		return fontSize
	}

	renderLegend(chart, step) {
		const legendG = chart.legendG
		legendG.selectAll('*').remove()
		let offsetX = 0
		let offsetY = 15
		let legendHeight = 0
		if (!this.scatter.config.colorTW && !this.scatter.config.shapeTW && !this.scatter.config.colorColumn) {
			if (this.scatter.config.scaleDotTW) {
				chart.scaleG = legendG
					.append('g')
					.attr('transform', `translate(${offsetX + 45},${this.scatter.vm.legendHeight - 150})`)
				this.drawScaleDotLegend(chart)
			}
			return
		}

		let title
		let title0 = this.scatter.config.term0
			? `${this.scatter.config.term0.term.name + ' ' + chart.id}, n=${chart.cohortSamples.length}`
			: `${chart.cohortSamples.length} ${
					this.scatter.config.sampleType ? this.scatter.config.sampleType + 's' : 'samples'
			  }`
		if (this.model.filterSampleStr) title0 += `, search = ${this.model.filterSampleStr}`
		legendG.append('text').attr('x', 0).attr('y', offsetY).text(title0).style('font-weight', 'bold')
		const fontSize = this.getFontSize(chart, chart.colorLegend)
		const scale = chart.colorLegend.size > 20 || chart.shapeLegend.size > 20 ? 0.5 : 0.7 //if many categories, reduce size

		const colorG = legendG.append('g').style('font-size', `${fontSize}em`)
		offsetY += step + 10
		if (this.scatter.config.colorTW || this.scatter.config.colorColumn) {
			title = `${getTitle(
				this.scatter.config.colorTW?.term?.name || this.scatter.config.colorColumn.name,
				30,
				this.scatter.config.shapeTW == undefined
			)}`
			const colorRefCategory = chart.colorLegend.get('Ref')

			if (this.scatter.config.colorTW?.term?.type == 'geneVariant' && this.scatter.config.colorTW?.q.type == 'values')
				offsetY = this.renderGeneVariantLegend(
					chart,
					offsetX,
					offsetY,
					legendG,
					this.scatter.config.colorTW,
					'category',
					chart.colorLegend,
					scale
				)
			else {
				legendG
					.append('text')
					.attr('id', 'legendTitle')
					.attr('x', offsetX)
					.attr('y', offsetY)
					.text(title)
					.style('font-weight', 'bold')
				offsetY += step

				if (this.scatter.config.colorTW?.q?.mode === 'continuous') {
					// Get the current domain values from our color generator
					// These values represent the minimum and maximum values in our dataset
					let [min, max] = chart.colorGenerator.domain()

					// Extract and sort all sample values for our calculations
					// We filter out any values that are explicitly defined in the term values
					// This gives us the raw numerical data we need for scaling
					const colorValues = chart.colorValues
					const scaleG = colorG.append('g')
					// Create a ColorScale component with enhanced mode functionality
					const colorScale = new ColorScale({
						// Basic visual configuration
						holder: scaleG, // SVG group to contain our color scale
						barheight: 20, // Height of the color gradient bar
						barwidth: 150, // Width of the color gradient bar
						colors: [
							// Start and end colors for our gradient
							this.scatter.config.startColor[chart.id],
							this.scatter.config.stopColor[chart.id]
						],
						domain: [min, max], // Current numerical range of our data
						position: `0, 100`, // Position within the legend
						ticks: 4, // Number of tick marks to show
						tickSize: 5, // Size of tick marks
						topTicks: true, // Display ticks above the gradient bar

						// Callback for when gradient colors are changed via color picker
						setColorsCallback: (val, idx) => {
							this.legendInteractivity.changeGradientColor(chart, val, idx)
						},

						// Configuration for our enhanced scaling modes
						numericInputs: {
							// Start with either the chart's current mode or default to 'auto'
							cutoffMode: this.scatter.settings.colorScaleMode,
							// Default percentile value for percentile mode
							defaultPercentile: this.scatter.settings.colorScalePercentile,

							// This callback handles all mode changes and updates
							callback: (obj: any) => {
								// Handle different modes for color scaling
								if (obj.cutoffMode === 'auto') {
									min = colorValues[0]
									max = colorValues[colorValues.length - 1]
								} else if (obj.cutoffMode === 'fixed') {
									min = obj.min
									max = obj.max
								} else if (obj.cutoffMode === 'percentile') {
									min = colorValues[0]
									const index = Math.floor((colorValues.length * obj.percentile) / 100)
									max = colorValues[index]
								}

								// Dispatch the updated config
								this.scatter.app.dispatch({
									type: 'plot_edit',
									id: this.scatter.id,
									config: {
										settings: {
											sampleScatter: {
												colorScaleMode: obj.cutoffMode,
												colorScaleMinFixed: obj.cutoffMode === 'fixed' ? min : null,
												colorScaleMaxFixed: obj.cutoffMode === 'fixed' ? max : null,
												colorScalePercentile:
													obj.cutoffMode === 'percentile' ? obj.percentile : this.scatter.settings.colorScalePercentile
											}
										}
									}
								})
							}
						}
					})

					// Initialize the color scale with current settings
					colorScale.updateScale()
					offsetY += step * 2
				} else {
					for (const [key, category] of chart.colorLegend) {
						if (key == 'Ref') continue
						const name = key
						const hidden = this.scatter.config.colorTW?.q.hiddenValues
							? key in this.scatter.config.colorTW.q.hiddenValues
							: false
						const [circleG, itemG] = this.addLegendItem(
							chart,
							colorG,
							category,
							name,
							key,
							offsetX,
							offsetY,
							scale,
							hidden
						)
						if (!this.scatter.config.colorColumn) {
							circleG.on('click', e => this.legendInteractivity.onLegendClick(chart, 'colorTW', key, e, category))
							itemG.on('click', event => this.legendInteractivity.onLegendClick(chart, 'colorTW', key, event, category))
						}
						offsetY += step
					}
				}
			}
			if (colorRefCategory?.sampleCount > 0) {
				offsetY = offsetY + step
				const titleG = legendG.append('g')
				titleG.append('text').attr('x', offsetX).attr('y', offsetY).text('Reference').style('font-weight', 'bold')

				offsetY = offsetY + step

				const refColorG = legendG.append('g')
				refColorG
					.append('path')
					.attr('transform', () => `translate(${offsetX - 2}, ${offsetY - 5}) scale(${scale})`)
					.style('fill', colorRefCategory.color)
					.attr('d', shapes[0])
					.style('stroke', rgb(colorRefCategory.color).darker())

				refColorG.on('click', e => this.legendInteractivity.onLegendClick(chart, 'colorTW', 'Ref', e, colorRefCategory))
				const refText = legendG
					.append('g')
					.append('text')
					.attr('x', offsetX + 20)
					.attr('y', offsetY + 4)
					.text(`n=${colorRefCategory.sampleCount}`)
					.style('text-decoration', !this.scatter.settings.showRef ? 'line-through' : 'none')
					.attr('alignment-baseline', 'middle')

				refText.on('click', e => this.legendInteractivity.onLegendClick(chart, 'colorTW', 'Ref', e, colorRefCategory))
			}
			legendHeight = offsetY
		}

		if (this.scatter.config.shapeTW) {
			offsetX = chart.colorLegendWidth
			offsetY = 60
			title = `${getTitle(this.scatter.config.shapeTW.term.name)}`
			if (this.scatter.config.shapeTW.term.type == 'geneVariant' && this.scatter.config.shapeTW.q.type == 'values')
				this.renderGeneVariantLegend(
					chart,
					offsetX,
					offsetY,
					legendG,
					this.scatter.config.shapeTW,
					'shape',
					chart.shapeLegend,
					scale
				)
			else {
				const shapeG = legendG.append('g').style('font-size', `${this.getFontSize(chart, chart.shapeLegend)}em`)

				legendG.append('text').attr('x', offsetX).attr('y', offsetY).text(title).style('font-weight', 'bold')
				offsetY += step
				const color = 'gray'
				for (const [key, shape] of chart.shapeLegend) {
					if (key == 'Ref') continue
					const index = shape.shape % shapes.length
					const symbol = shapes[index]
					const name = key
					const count = shape.sampleCount
					const hidden = this.scatter.config.shapeTW.q.hiddenValues
						? key in this.scatter.config.shapeTW.q.hiddenValues
						: false
					const itemG = shapeG.append('g')

					itemG
						.append('path')
						.attr('transform', () => `translate(${offsetX}, ${offsetY - 5}) scale(${scale + 0.1})`) //shapes are a bit smaller than the circle shape
						.style('pointer-events', 'bounding-box')
						.style('fill', color)
						.attr('d', symbol)
						.style('stroke', rgb(color).darker())

					itemG
						.append('text')
						.attr('x', offsetX + 25)
						.attr('y', offsetY + 4)
						.text(`${name}, n=${count}`)
						.style('text-decoration', hidden ? 'line-through' : 'none')
						.attr('alignment-baseline', 'middle')
					offsetY += step
					itemG.on('click', event => this.legendInteractivity.onLegendClick(chart, 'shapeTW', key, event, shape))
				}
			}
			if (offsetY > legendHeight) legendHeight = offsetY
		}

		if (this.scatter.config.scaleDotTW) {
			chart.scaleG = legendG.append('g').attr('transform', `translate(${0},${legendHeight + 50})`)
			this.drawScaleDotLegend(chart)
		}
	}

	addLegendItem(chart, g, category, name, key, x, y, scale, hidden = false) {
		const circleG = g.append('g')
		circleG
			.append('path')
			.attr('d', shapes[0])
			.attr('transform', `translate(${x - 2}, ${y - 5}) scale(${scale})`)
			.style('fill', category.color)
			.style('stroke', rgb(category.color).darker())
		if (!this.scatter.config.colorColumn)
			circleG.on('click', e => this.legendInteractivity.onLegendClick(chart, 'colorTW', key, e, category))
		const itemG = g.append('g')
		itemG
			.append('text')
			.attr('name', 'sjpp-scatter-legend-label')
			.attr('x', x + 20)
			.attr('y', y + 4)
			.text(`${name}, n=${category.sampleCount}`)
			.style('text-decoration', hidden ? 'line-through' : 'none')
			.attr('alignment-baseline', 'middle')

		return [circleG, itemG]
	}

	renderGeneVariantLegend(chart, offsetX, offsetY, legendG, tw, cname, map, scale) {
		const step = 125
		const name = tw.term.name.length > 25 ? tw.term.name.slice(0, 25) + '...' : tw.term.name
		const title = name
		const G = legendG.append('g').style('font-size', '0.9em')

		G.append('text')
			.attr('id', 'legendTitle')
			.attr('x', offsetX)
			.attr('y', offsetY)
			.text(title)
			.style('font-weight', 'bold')

		offsetX += step
		const mutations: any = []
		for (const value of map.values())
			if (value.mutation)
				//if no mutation is Ref
				mutations.push(value.mutation)

		const mutationsLabels = new Set()
		offsetY += 10
		for (const mutation of mutations) {
			const dt = mutation.dt
			const origin = morigin[mutation.origin]?.label
			const dtlabel = origin ? `${origin[0]} ${dt2label[dt]}` : dt2label[dt]
			if (!mutationsLabels.has(dtlabel)) mutationsLabels.add(dtlabel)
			else continue
			offsetY += 15

			G.append('text')
				.attr('x', offsetX - step)
				.attr('y', offsetY)
				.text(origin ? `${origin} ${dt2label[dt]}` : dt2label[dt])
				.style('font-weight', 'bold')
			offsetY += 25
			for (const [key, category] of map) {
				if (key == 'Ref') continue
				if (!key.includes(dtlabel)) continue
				const [mkey, cat_dtlabel] = key.split(', ')

				if (!cat_dtlabel.includes(dtlabel)) continue
				const itemG = G.append('g')
				if (cname == 'shape') {
					const index = category.shape % shapes.length
					itemG
						.append('path')
						.attr('transform', () => `translate(${offsetX - step - 2}, ${offsetY - 8}) scale(${scale})`)
						.style('fill', 'gray')
						.style('pointer-events', 'bounding-box')
						.attr('d', shapes[index])
						.style('stroke', rgb('gray').darker())
					itemG.on('click', e => this.legendInteractivity.onLegendClick(chart, 'shapeTW', key, e, category))
				} else {
					itemG
						.append('path')
						.attr('d', shapes[0])
						.attr('transform', `translate(${-2}, ${offsetY - 8}) scale(${scale})`)
						.style('fill', category.color)
						.style('stroke', rgb(category.color).darker())
					itemG.on('click', e => this.legendInteractivity.onLegendClick(chart, 'colorTW', key, e, category))
				}
				const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false

				G.append('g')
					.append('text')
					.attr('x', offsetX - step + 24)
					.attr('y', offsetY + 4)
					.attr('name', 'sjpp-scatter-legend-label')
					.style('text-decoration', hidden ? 'line-through' : 'none')
					.text(mkey.toUpperCase() + (key.includes(dtlabel) ? `, n=${category.sampleCount}` : ''))
					.on('click', event =>
						this.legendInteractivity.onLegendClick(
							chart,
							cname == 'shape' ? 'shapeTW' : 'colorTW',
							key,
							event,
							category
						)
					)

				offsetY += 25
			}
		}

		return offsetY
	}

	drawScaleDotLegend(chart) {
		const scaleG = chart.scaleG
		scaleG.selectAll('*').remove()
		const width = 70

		const minScale = this.scatter.settings.minShapeSize / 3
		const maxScale = this.scatter.settings.maxShapeSize / 3
		const order = this.scatter.settings.scaleDotOrder
		const isAscending = order == 'Ascending'

		const titleG = scaleG.append('g')

		titleG.append('text').text(this.scatter.config.scaleDotTW.term.name).style('font-weight', 'bold')
		const start = roundValueAuto(chart.ranges.scaleMin).toString()
		const end = roundValueAuto(chart.ranges.scaleMax).toString()
		const x = 30
		const y = 40
		const defaultSize = 16 //icons default size

		const minSize = defaultSize * minScale
		const maxSize = defaultSize * maxScale
		const minRadius = minSize / 2
		const maxRadius = maxSize / 2
		const minG = scaleG.append('g').attr('transform', `translate(${x},${y})`)
		const shift = 30
		minG
			.append('path')
			.attr('d', shapes[0])
			.style('fill', '#aaa')
			.style('stroke', '#aaa')
			.attr(
				'transform',
				`translate(${isAscending ? -minRadius : -maxRadius}, ${isAscending ? -minRadius : -maxRadius}) scale(${
					isAscending ? minScale : maxScale
				})`
			)

		const maxG = scaleG.append('g').attr('transform', `translate(${width + x},${y})`)

		maxG
			.append('path')
			.attr('d', shapes[0])
			.style('fill', '#aaa')
			.style('stroke', '#aaa')
			.attr(
				'transform',
				`translate(${isAscending ? -maxRadius : -minRadius}, ${isAscending ? -maxRadius : -minRadius}) scale(${
					isAscending ? maxScale : minScale
				})`
			)

		minG
			.append('text')
			.attr('x', isAscending ? -minRadius - shift : -maxRadius - shift)
			.attr('y', 5)
			.style('font-size', '.8em')
			.attr('text-anchor', 'start')
			.text(start)

		maxG
			.append('text')
			.attr('x', isAscending ? maxSize + 5 : minSize + 5)
			.attr('y', 5)
			.style('font-size', '.8em')
			.text(end)

		minG
			.append('line')
			.attr('x1', 0)
			.attr('y1', isAscending ? minRadius : maxRadius)
			.attr('x2', width)
			.attr('y2', isAscending ? maxRadius : minRadius)
			.style('stroke', '#aaa')
		minG
			.append('line')
			.attr('x1', 0)
			.attr('y1', isAscending ? -minRadius : -maxRadius)
			.attr('x2', width)
			.attr('y2', isAscending ? -maxRadius : -minRadius)
			.style('stroke', '#aaa')

		scaleG
			.append('rect')
			.attr('width', 110 * this.scatter.vm.scatterZoom.zoom)
			.attr('height', 50)
			.attr('fill', 'transparent')
			.on('click', e => {
				const menu = new Menu({ padding: '3px' })
				const div = menu.d
				div.append('label').text('Min:')
				const minInput: any = div
					.append('input')
					.attr('type', 'number')
					.attr('min', minShapeSize)
					.attr('step', '0.5')
					.attr('max', maxShapeSize)
					.style('width', '50px')
					.attr('value', this.scatter.settings.minShapeSize)
					.on('change', () => {
						const value = parseFloat(minInput.node().value)
						this.scatter.config.settings.sampleScatter.minShapeSize = value
						this.scatter.app.dispatch({
							type: 'plot_edit',
							id: this.scatter.id,
							config: this.scatter.config
						})
					})
				div.append('label').text('Max:')
				const maxInput: any = div
					.append('input')
					.attr('type', 'number')
					.attr('step', '0.5')
					.attr('min', minShapeSize)
					.attr('max', maxShapeSize)
					.style('width', '50px')
					.attr('value', this.scatter.settings.maxShapeSize)
					.on('change', () => {
						const value: any = parseFloat(maxInput.node().value)
						this.scatter.config.settings.sampleScatter.maxShapeSize = value
						this.scatter.app.dispatch({
							type: 'plot_edit',
							id: this.scatter.id,
							config: this.scatter.config
						})
					})
				const divRadios = menu.d.append('div')
				divRadios.append('label').text('Order: ')
				const data = ['Ascending', 'Descending']
				divRadios
					.selectAll('input')
					.data(data)
					.enter()
					.append('div')
					.style('display', 'inline-block')
					.each((text, i, divs) => {
						const div = select(divs[i])
						const input = div
							.append('input')
							.attr('type', 'radio')
							.attr('name', 'order')
							.attr('id', text)
							.attr('value', text)
							.property('checked', text => text == order)

						div.append('label').text(text).attr('for', text)
						input.on('change', e => {
							this.changeScaleDotOrder(e.target.value)
						})
					})
				menu.showunder(e.target)
			})
	}

	changeScaleDotOrder(order) {
		this.scatter.config.settings.sampleScatter.scaleDotOrder = order
		this.scatter.app.dispatch({
			type: 'plot_edit',
			id: this.scatter.id,
			config: this.scatter.config
		})
	}
}

export function getTitle(name, size = 30, complete = false) {
	if (name.length > size && !complete) name = name.slice(0, size) + '...'
	return name
}
