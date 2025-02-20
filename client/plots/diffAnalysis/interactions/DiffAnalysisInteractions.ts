import { downloadTable } from '#dom'
import { to_svg } from '#src/client'
import type { DiffAnalysisDom } from '../DiffAnalysisTypes'

export class DiffAnalysisInteractions {
	dom: DiffAnalysisDom
	pValueTableData: any
	constructor(dom: DiffAnalysisDom) {
		this.dom = dom
		this.pValueTableData = []
	}

	download() {
		this.dom.tip.clear().showunder(this.dom.controls.select('div').node())
		const opts = [
			{
				text: 'Download plot',
				callback: () => {
					const svg = this.dom.svg.node() as Node
					to_svg(svg, `boxplot`, { apply_dom_styles: true })
				}
			},
			{
				text: 'Download p value table',
				callback: () => {
					downloadTable(this.pValueTableData.rows, this.pValueTableData.columns)
				}
			}
		]
		for (const opt of opts) {
			this.dom.tip.d.append('div').attr('class', 'sja_menuoption').text(opt.text).on('click', opt.callback)
		}
	}

	clearDom() {
		this.dom.div.selectAll('table').remove()
		this.dom.plot.selectAll('*').remove()
		this.dom.xAxis.selectAll('*').remove()
		this.dom.yAxisLabel.text('')
		this.dom.yAxis.selectAll('*').remove()
	}
}
