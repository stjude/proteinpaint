import { Menu } from '#dom'

export class BoxPlotLabelMenu {
	tip = new Menu({ padding: '' })
	constructor(plot, app, id) {
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
				isVisible: false,
				callback: () => {
					//A comment so ts doesn't complain
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
