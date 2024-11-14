import { Menu } from '#dom'
import type { MassAppApi } from '#mass/types/mass'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import { renderTable } from '#dom'

export class BoxPlotLabelMenu {
	tip = new Menu({ padding: '' })
	constructor(plot, app: MassAppApi, id: string, interactions: BoxPlotInteractions) {
		const options = [
			//TODO: Filter option? Group?
			{
				text: `Hide ${plot.key}`,
				isVisible: true,
				callback: () => {
					const plotConfig = app.getState().plots.find(p => p.id === id)
					const config = structuredClone(plotConfig)
					const contTerm = config.term.q.mode == 'continuous' ? 'term2' : 'term'
					if (!config[contTerm].q.hiddenValues) config[contTerm].q.hiddenValues = {}
					config[contTerm].q.hiddenValues[plot.key] = 1
					app.dispatch({
						type: 'plot_edit',
						id,
						config
					})
				}
			},
			{
				text: `List samples`,
				isVisible: true,
				callback: async () => {
					this.tip.clear().showunder(plot.boxplot.labelG.node())
					const min = plot.descrStats.find(s => s.id === 'min').value
					const max = plot.descrStats.find(s => s.id === 'max').value
					const rows = await interactions.listSamples(plot, min, max)

					const tableDiv = this.tip.d.append('div')
					const columns = [{ label: 'Sample' }, { label: 'Value' }]

					renderTable({
						rows,
						columns,
						div: tableDiv,
						maxWidth: '30vw',
						maxHeight: '25vh',
						resize: true,
						showLines: true
					})
				}
			}
		]
		plot.boxplot.labelG.on('click', () => {
			this.tip.clear().showunder(plot.boxplot.labelG.node())
			for (const opt of options) {
				if (!opt.isVisible) continue
				this.tip.d
					.append('div')
					.classed('sja_menuoption', true)
					.text(opt.text)
					.on('click', () => {
						this.tip.hide()
						opt.callback()
					})
			}
		})
	}
}
