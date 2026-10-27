import type { AggregateMatrix } from '../AggregateMatrix.ts'
import type { AggMatrixViewData } from '../viewModel/ViewModelDataTypes.ts'
import { ColorScale, LegendCircleReference, capitalizeFirstLetter } from '#dom'
import { rgb } from 'd3-color'
import { validateMinMax } from '../settings/defaults.ts'

export class LegendRender {
	ag: AggregateMatrix
	readonly xStart = 15

	constructor(ag: AggregateMatrix) {
		this.ag = ag
	}

	render(viewData: AggMatrixViewData, div: any) {
		const settings = this.ag.state.config.settings.aggregateMatrix
		const colorScaleSvg = div.append('svg').style('display', 'block').attr('height', 100)
		const dotScaleSvg = div
			.append('svg')
			.style('display', 'block')
			.attr('height', settings.maxDotSize + 20 + 50) //20px for the title position, 50px for the title and padding around the rendering.
		this.renderColorScale(viewData.colorScale, settings, colorScaleSvg)
		this.renderDotScaleRef(dotScaleSvg, settings)
		if (viewData.pieLegend.entries.length) this.renderPieLegend(viewData.pieLegend, div)
	}

	/** One shared legend of the slice colors, as every pie uses the same colors and order */
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
		legend.entries.forEach((entry, i) => {
			const y = 30 + i * rowHeight
			svg
				.append('rect')
				.attr('x', this.xStart)
				.attr('y', y)
				.attr('width', 12)
				.attr('height', 12)
				.attr('fill', entry.color)
				.attr('stroke', '#999')
				.attr('stroke-width', 0.5)
			svg
				.append('text')
				.attr('x', this.xStart + 18)
				.attr('y', y + 10)
				.style('font-size', '0.8em')
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
		new LegendCircleReference({
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
	}
}
