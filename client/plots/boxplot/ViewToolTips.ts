import { Menu } from '#dom'

export class ViewToolTips {
	boxplot: any
	plot: any
	tip = new Menu()
	constructor(plot: any) {
		this.plot = plot
		this.boxplot = plot.boxplot
		this.setSimpleToolTips()
	}
	setSimpleToolTips() {
		//Add rendering preferences here to maintain styles
		const addSimpleText = text => {
			this.tip.d.append('div').text(text)
		}
		const addSimpleToolTips = (target, text) => {
			//TODO: Figure out how to expand the mouse/point event region
			//to make it easier to hover over the boxplot
			target.on('mouseover', () => {
				this.tip.clear().showunder(target.node())
				addSimpleText(text)
			})
			target.on('mouseout', () => {
				this.tip.hide()
			})
		}
		addSimpleToolTips(this.boxplot.linep50, `Median: ${this.boxplot.p50.toFixed(2)}`)
		addSimpleToolTips(this.boxplot.linew1, `Min: ${this.plot.min.toFixed(2)}`)
		addSimpleToolTips(this.boxplot.linew2, `Max: ${this.plot.max.toFixed(2)}`)
	}
}
