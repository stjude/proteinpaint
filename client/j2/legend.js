import { legend_newrow } from '#src/block.legend'
import { Menu, ColorScale, icons, shapes, renderCnvConfig } from '#dom'
import { rgb } from 'd3-color'

/*
 */

export function initLegend(tk, block) {
	// run only once, called by makeTk
	if (!block.legend) return // block has no legend. could be due to hidegenelegend flag
	if (!tk.legend) tk.legend = {}
	tk.legend.tip = new Menu({ padding: '0px' })

	const [tr, td, td0] = legend_newrow(block, tk.name)
	tk.legend.headTd = td0 // for updating tk name in legend when filterObj updates

	tk.tr_legend = tr // to be compatible with block.tk_remove()

	const table = td.append('table').style('border-spacing', '5px').style('border-collapse', 'separate')

	tk.legend.table = table
}
export function updateLegend(data, tk, block) {}
