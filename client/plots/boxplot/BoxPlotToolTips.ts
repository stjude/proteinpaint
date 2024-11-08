import { Menu } from '#dom'
import type { SvgG } from 'types/d3'

export class BoxPlotToolTips {
	boxplot: any
	g: SvgG
	plot: any
	tip = new Menu()
	readonly tablePadding = '3px'
	constructor(plot: any, g: SvgG) {
		this.plot = plot
		this.g = g
		this.boxplot = plot.boxplot

		this.addLabelTooltip()
		this.addLineToolTips()
	}

	addLabelTooltip() {
		this.boxplot.labelG.on('mouseover', () => {
			this.tip.clear().showunder(this.boxplot.labelG.node())
			const table = this.tip.d.append('table').attr('class', 'sja_simpletable')
			table
				.append('tr')
				.style('text-align', 'center')
				.append('td')
				.attr('colspan', 2)
				.style('padding', this.tablePadding)
				.text(this.boxplot.label)
			for (const stat of this.plot.descrStats) {
				const row = table.append('tr')
				row.append('td').style('padding', this.tablePadding).style('opacity', 0.5).text(stat.label)
				row.append('td').style('padding', this.tablePadding).style('text-align', 'center').text(stat.value)
			}
		})
		this.boxplot.labelG.on('mouseout', () => {
			this.tip.hide()
		})
	}

	addLineToolTips() {
		//Add rendering preferences here to maintain styles
		const addText = (text: string) => {
			this.tip.d.append('div').text(text)
		}
		const addToolTips = (elem, text: string) => {
			const elemBBox = elem.node().getBBox()
			//Add an expanded area for the tooltip
			//Easier for user to hover over
			this.g
				.append('rect')
				.attr('x', elemBBox.x - 10)
				.attr('y', elemBBox.y - 10)
				.attr('width', elemBBox.width + 20)
				.attr('height', elemBBox.height + 20)
				.attr('fill', 'transparent')
				.style('pointer-events', 'all')
				.on('mouseover', () => {
					this.tip.clear().showunder(elem.node())
					addText(text)
				})
				.on('mouseout', () => {
					this.tip.hide()
				})
		}

		if (this.boxplot.linep50) {
			const median = this.plot.descrStats.find((d: any) => d.id == 'median')
			addToolTips(this.boxplot.linep50, `Median: ${median.value}`)
		}
		if (this.boxplot.linew1) {
			const min = this.plot.descrStats.find((d: any) => d.id == 'min')
			addToolTips(this.boxplot.linew1, `Min: ${min.value}`)
		}
		if (this.boxplot.linew2) {
			const max = this.plot.descrStats.find((d: any) => d.id == 'max')
			addToolTips(this.boxplot.linew2, `Max: ${max.value}`)
		}
	}
}
