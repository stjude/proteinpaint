import type { BoxPlotDom } from './BoxPlot'
import { to_svg } from '#src/client'

export class BoxPlotInteractions {
	dom: BoxPlotDom
	constructor(dom: BoxPlotDom) {
		this.dom = dom
	}

	download() {
		//May add more options in the future
		const svg = this.dom.div.select('svg').node() as Node
		to_svg(svg, `boxplot`, { apply_dom_styles: true })
	}

	help() {
		//May add more options in the future
		window.open('https://github.com/stjude/proteinpaint/wiki/Box-plot')
	}
}
