import sun1 from './block.ds.sun1'
import { itemtable } from './block.ds.itemtable'

/*
may show sunburst chart using several possible data sources
either server-side computed summary, or client-side computed

todo: as the central place for making sunburst
sunburst.js to replace sun1
*/

export default async function(occurrence, mlst, cx, cy, tk, block) {
	if (tk.ds) {
		// legacy ds
		// give priority to the relatively new method of ds.variant2tumors
		if (tk.ds.variant2tumors) {
			tk.glider.style('cursor', 'wait')
			const data = await tk.ds.variant2tumors.get(mlst)
			tk.glider.style('cursor', 'auto')
			if (data.error) {
				block.error(data.error)
				return true
			}
			const _ = await import('./sunburst')
			_.default({
				occurrence,
				boxyoff: tk.yoff,
				boxheight: tk.height,
				boxwidth: block.width,
				svgheight: Number.parseFloat(block.svg.attr('height')),
				g: tk.glider.append('g'),
				pica: tk.pica,
				cx,
				cy,
				nodes: data.nodes,
				chartlabel: mlst[0].mname,
				click_listbutton: (x, y) => {
					itemtable({ x, y, mlst, tk, block, pane: true })
				}
			})
			return true
		}
		if (tk.ds.cohort) {
			// legacy cohort config on legacy ds
			let showsunburst = false
			if (tk.ds.cohort.annotation) {
				if (tk.ds.cohort.variantsunburst) {
					showsunburst = true
				}
			} else {
				// no annotation, should be old-style official ds
				// FIXME update to new ds
				// or all update to mds altogether
				showsunburst = true
			}
			if (showsunburst) {
				sun1(tk, block, {
					cx,
					cy,
					mlst: mlst,
					label: mlst[0].mname,
					cohort: tk.ds.cohort
				})
				return true
			}
		}
	}
	return false
}
