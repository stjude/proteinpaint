import { Menu } from '#dom'

export class BoxPlotLabelMenu {
	tip = new Menu()
	constructor(plot) {
		const options = [
			{
				text: `Hide ${plot.key}`,
				callback: () => {
					//A comment so ts doesn't complain
				}
			},
			{
				text: `List samples`,
				callback: () => {
					//A comment so ts doesn't complain
				}
			}
		]
		plot.boxplot.labelG.on('click', () => {
			this.tip.clear().showunder(plot.boxplot.labelG.node())
			for (const opt of options) {
				this.tip.d
					.append('div')
					.attr('classed', 'sja_menuoption')
					.text(opt.text)
					.on('click', () => {
						this.tip.hide()
						opt.callback()
					})
			}
		})
	}
}
