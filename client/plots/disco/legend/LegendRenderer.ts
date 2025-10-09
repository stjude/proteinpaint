import type Legend from './Legend.ts'
import svgLegend from '#dom/svg.legend'
import LegendJSONMapper from './LegendJSONMapper.ts'
import { dtcnv } from '#shared/common.js'
import { renderCnvSourceLegend } from '../cnv/renderCnvSourceLegend.ts'
import type ViewModel from '../viewmodel/ViewModel.ts'
import type { AlternativeCnvSet } from '../cnv/renderCnvSourceLegend.ts'

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
		const altCnv = viewModel.appState.args.alternativeDataByDt?.[dtcnv] as AlternativeCnvSet[]
		const svgDiv = viewModel.svgDiv // Assuming ViewModel now holds reference to the SVG container div

		if (altCnv && altCnv.length > 0) {
			const legendG = holder.select('g[data-testid="sjpp_disco_plot_legend"]')

			if (!legendG.empty()) {
				renderCnvSourceLegend(svgDiv, legendG, altCnv, this.fontSize, onCnvSourceSelect)
			}
		}
	}
}
