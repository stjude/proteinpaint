import type { BoxPlotDom } from './BoxPlot'
import { to_svg } from '#src/client'

export class BoxPlotInteractions {
	dom: BoxPlotDom
	constructor(dom: BoxPlotDom) {
		this.dom = dom
	}
	download() {
		const svg = this.dom.div.select('svg').node() as Node
		to_svg(svg, `boxplot`, { apply_dom_styles: true })
	}
}
