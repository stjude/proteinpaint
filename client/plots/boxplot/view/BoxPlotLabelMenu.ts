import type { MassAppApi, MassState } from '#mass/types/mass'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import type { RenderedPlot } from './RenderedPlot'
import { renderTable, type Menu } from '#dom'
import { rgb } from 'd3-color'

/** Menu is available when more than one boxplot is rendered. */
export class BoxPlotLabelMenu {
	constructor(
		plot: RenderedPlot,
		app: MassAppApi,
		interactions: BoxPlotInteractions,
		tip: Menu,
		isVertical: boolean
		/*chart: any*/
	) {
		const options = [
			{
				text: `Add filter: ${plot.key}`,
				isVisible: () => true,
				callback: () => interactions.addFilter(plot)
			},
			{
				text: `Hide ${plot.key}`,
				isVisible: () => true,
				callback: () => interactions.hidePlot(plot)
			},
			{
				text: `List samples`,
				isVisible: (state: MassState) => state.termdbConfig.displaySampleIds && app.vocabApi.hasVerifiedToken(),
				callback: async (event: MouseEvent) => {
					if (isVertical) tip.clear().show(event.clientX, event.clientY)
					else tip.clear().showunder(plot.boxplot.labelG.node())
					const [rows, columns] = await interactions.listSamples(plot)

					const tableDiv = tip.d.append('div')
					renderTable({
						rows: rows as any,
						columns: columns as any,
						div: tableDiv,
						maxHeight: '35vh',
						resize: true,
						showLines: true,
						dataTestId: 'sjpp-listsampletable'
					})
				}
			}
		]
		plot.boxplot.labelG.on('click', (event: MouseEvent) => {
			tip.clear()
			if (isVertical) tip.show(event.clientX, event.clientY)
			else tip.showunder(plot.boxplot.labelG.node())
			const state = app.getState()
			for (const opt of options) {
				//Adds all the menu options before the color picker
				if (!opt.isVisible(state)) continue
				tip.d
					.append('div')
					.classed('sja_menuoption', true)
					.text(opt.text)
					.on('click', (event: MouseEvent) => {
						tip.hide()
						opt.callback(event)
					})
			}
			if (plot.color) {
				tip.d
					.append('div')
					.style('padding', '5px 10px')
					.style('display', 'inline-block')
					.text('Color:')
					.append('input')
					.attr('type', 'color')
					.property('value', rgb(plot.color).formatHex())
					.on('change', event => {
						interactions.updatePlotColor(plot, event.target.value)
						tip.hide()
					})
			}
		})
	}
}
