import { Menu } from '#dom'
import type { MassAppApi, MassState } from '#mass/types/mass'
import type { BoxPlotInteractions } from '../interactions/BoxPlotInteractions'
import { renderTable } from '#dom'

export class BoxPlotLabelMenu {
	tip = new Menu({ padding: '' })
	constructor(plot, app: MassAppApi, id: string, interactions: BoxPlotInteractions) {
		const options = [
			//TODO: Filter option? Group?
			{
				text: `Hide ${plot.key}`,
				isVisible: () => true,
				callback: (state: MassState) => {
					const plotConfig = state.plots.find(p => p.id === id)
					if (!plotConfig) throw 'Box plot not found [BoxPlotLabelMenu]'
					const config = structuredClone(plotConfig)
					const contTerm = config.term.q.mode == 'continuous' ? 'term2' : 'term'
					if (!config[contTerm].q.hiddenValues) config[contTerm].q.hiddenValues = {}
					config[contTerm].q.hiddenValues[plot.key] = 1
					app.dispatch({
						type: 'plot_edit',
						id,
						config: config
					})
				}
			},
			{
				text: `List samples`,
				isVisible: (state: MassState) => state.termdbConfig.displaySampleIds && app.vocabApi.hasVerifiedToken(),
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
			const state = app.getState()
			for (const opt of options) {
				if (!opt.isVisible(state)) continue
				this.tip.d
					.append('div')
					.classed('sja_menuoption', true)
					.text(opt.text)
					.on('click', () => {
						this.tip.hide()
						opt.callback(state)
					})
			}
		})
	}
}
