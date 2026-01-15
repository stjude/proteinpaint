import type Legend from './Legend.ts'
import { svgLegend, getMaxLabelWidth } from '#dom'
import LegendJSONMapper from './LegendJSONMapper.ts'
import { dtcnv } from '#shared/common.js'
import { renderCnvSourceLegend, type AlternativeCnvSet } from '../cnv/renderCnvSourceLegend.ts'
import type ViewModel from '../viewmodel/ViewModel.ts'

export default class LegendRenderer {
	private legendJSONMapper: LegendJSONMapper
	private fontSize: number

	constructor(cappedCnvMaxAbsValue = 0, fontSize: number) {
		this.fontSize = fontSize
		this.legendJSONMapper = new LegendJSONMapper(cappedCnvMaxAbsValue)
	}

	render(
		holder: any,
		legend: Legend,
		xOffset: number,
		svgw: number,
		svgh: number,
		viewModel: ViewModel,
		onCnvSourceSelect: (index: number) => void
	) {
		const svgLegendRenderer = svgLegend({
			holder: holder.append('g').attr('data-testid', 'sjpp_disco_plot_legend'),
			rectFillFxn: d => d.color,
			iconStroke: '#aaa'
		})
		const data = this.legendJSONMapper.map(legend)

		const legendTitles = data.map(d => d.name.trim())
		const maxLabelWidth = getMaxLabelWidth(holder, legendTitles)

		const d = {
			xOffset: maxLabelWidth + xOffset
		}

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
		const altCnv: AlternativeCnvSet[] = viewModel.appState.args.alternativeDataByDt?.[dtcnv]

		if (altCnv && altCnv.length > 0) {
			const legendG = holder.select('g[data-testid="sjpp_disco_plot_legend"]')
			const cnvLegendG = legendG.select('#sjpp-disco-cnv-legend')

			if (!legendG.empty()) {
				/** This shouldn't be necessary. It's reasonable to assume
				 * a cnv legend group will exist if there is a cnvClassMap.*/
				const add2G = cnvLegendG.empty() ? legendG : cnvLegendG
				renderCnvSourceLegend(add2G, altCnv, this.fontSize, onCnvSourceSelect)
			}
		}
	}
}
