import type Legend from './Legend.ts'
import svgLegend from '#dom/svg.legend'
import LegendJSONMapper from './LegendJSONMapper.ts'

export default class LegendRenderer {
	private legendJSONMapper: LegendJSONMapper
	private fontSize: number

	constructor(cappedCnvMaxAbsValue = 0, fontSize: number) {
		this.fontSize = fontSize
		this.legendJSONMapper = new LegendJSONMapper(cappedCnvMaxAbsValue)
	}

	render(holder: any, legend: Legend, xOffset: number, svgw, svgh) {
		const svgLegendRenderer = svgLegend({
			holder: holder.append('g').attr('data-testid', 'sjpp_disco_plot_legend'),
			rectFillFxn: d => d.color,
			iconStroke: '#aaa'
		})

		// TODO calculate legend dimensions

		const d = {
			xOffset: xOffset
		}

		const data = this.legendJSONMapper.map(legend)

		svgLegendRenderer(data, {
			settings: Object.assign(
				{},
				{
					svgw: svgw,
					svgh: svgh,
					dimensions: d,
					fontsize: this.fontSize
				}
			)
		})
	}
}
