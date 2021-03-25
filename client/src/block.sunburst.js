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
