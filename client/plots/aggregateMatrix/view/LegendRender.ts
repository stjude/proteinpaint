import type { AggregateMatrix } from '../AggregateMatrix.ts'
import type { AggMatrixViewData } from '../viewModel/ViewModelDataTypes.ts'
import { ColorScale, DotSizeScale, LegendItemMenu, capitalizeFirstLetter } from '#dom'
import { rgb } from 'd3-color'
import { validateMinMax } from '../settings/defaults.ts'

export class LegendRender {
	ag: AggregateMatrix
	readonly xStart = 15
	pieLegendMenu: LegendItemMenu

	constructor(ag: AggregateMatrix) {
		this.ag = ag
		this.pieLegendMenu = new LegendItemMenu({
			callback: hiddenSliceKeys => {
				this.ag.app.dispatch({
					type: 'plot_edit',
					id: this.ag.id,
					config: { settings: { aggregateMatrix: { hiddenSliceKeys } } }
				})
			}
		})
	}

	render(viewData: AggMatrixViewData, div: any) {
		const settings = this.ag.state.config.settings.aggregateMatrix
		const colorScaleSvg = div.append('svg').style('display', 'block').attr('height', 100)
		//The size is set in renderDotScaleRef, from the bounding box of the rendered scale
		const dotScaleSvg = div.append('svg').style('display', 'block')
		this.renderColorScale(viewData.colorScale, settings, colorScaleSvg)
		this.renderDotScaleRef(dotScaleSvg, settings)
		if (viewData.pieLegend.entries.length) this.renderPieLegend(viewData.pieLegend, div)
	}

	/** One shared legend of the slice colors, as every pie uses the same colors and order. It has every slice,
	 * hidden or not. Hidden slices are crossed out, and clicking an entry opens a menu to show or hide slices. */
	renderPieLegend(legend: AggMatrixViewData['pieLegend'], div: any) {
		const rowHeight = 18
		const svg = div
			.append('svg')
			.attr('class', 'sjpp-ag-matrix-pie-legend')
			.attr('data-testid', 'sjpp-ag-matrix-pie-legend')
			.style('display', 'block')
			.attr('width', 260)
			.attr('height', 30 + legend.entries.length * rowHeight)
		svg
			.append('text')
			.attr('x', this.xStart)
			.attr('y', 20)
			.style('font-weight', 'bold')
			.style('font-size', '0.8em')
			.text(legend.title)
		const keys = legend.entries.map(entry => entry.key)
		const hiddenKeys = legend.entries.filter(entry => entry.hidden).map(entry => entry.key)
		legend.entries.forEach((entry, i) => {
			const y = 30 + i * rowHeight
			const g = svg
				.append('g')
				.attr('class', 'sjpp-ag-matrix-pie-legend-item')
				.attr('data-testid', 'sjpp-ag-matrix-pie-legend-item')
				.style('cursor', 'pointer')
				.on('click', event => {
					this.pieLegendMenu.show({ target: event.currentTarget, key: entry.key, keys, hiddenKeys })
				})
			g.append('rect')
				.attr('x', this.xStart)
				.attr('y', y)
				.attr('width', 12)
				.attr('height', 12)
				.attr('fill', entry.color)
				.attr('fill-opacity', entry.hidden ? 0.3 : 1)
				.attr('stroke', '#999')
				.attr('stroke-width', 0.5)
			g.append('text')
				.attr('x', this.xStart + 18)
				.attr('y', y + 10)
				.style('font-size', '0.8em')
				.style('text-decoration', entry.hidden ? 'line-through' : 'none')
				.style('opacity', entry.hidden ? 0.6 : 1)
				.text(entry.label)
		})
	}

	renderColorScale(colorScale, settings, svg) {
		svg
			.append('text')
			.attr('x', this.xStart)
			.attr('y', 20)
			.style('font-weight', 'bold')
			.style('font-size', '0.8em')
			.text(capitalizeFirstLetter(settings.gradientMethod))

		new ColorScale({
			holder: svg,
			domain: colorScale.scale.domain(),
			colors: [settings.startColor, settings.stopColor],
			barheight: 20,
			barwidth: 200,
			position: `${this.xStart + 10}, 35`,
			setColorsCallback: (val, idx) => {
				const hexColor = rgb(val).formatHex()
				const colorKey = idx == 0 ? 'startColor' : 'stopColor'
				this.ag.app.dispatch({
					type: 'plot_edit',
					id: this.ag.id,
					config: {
						settings: {
							aggregateMatrix: {
								[colorKey]: hexColor
							}
						}
					}
				})
			}
		})
	}

	renderDotScaleRef(svg, settings) {
		new DotSizeScale({
			g: svg.append('g').attr('transform', `translate(${this.xStart}, 15)`),
			inputMax: settings.dotInputMax,
			inputMin: settings.dotInputMin,
			maxRadius: settings.maxDotSize,
			minRadius: settings.minDotSize,
			isAscending: true,
			title: capitalizeFirstLetter(settings.sizeMethod),
			menu: {
				minMaxLabel: 'pixels',
				callback: async (obj: { min: number; max: number }) => {
					const { min, max } = obj
					const isValid = validateMinMax(settings, min, max)
					if (isValid !== null) {
						alert(isValid)
						return
					}
					this.ag.app.dispatch({
						type: 'plot_edit',
						id: this.ag.id,
						config: {
							settings: {
								aggregateMatrix: {
									minDotSize: min,
									maxDotSize: max
								}
							}
						}
					})
				}
			}
		})

		//Fit the svg to what was rendered, including the group's translation, title and labels
		const box = svg.node().getBBox()
		svg.attr('width', Math.ceil(box.x + box.width + this.xStart)).attr('height', Math.ceil(box.y + box.height + 15))
	}
}
