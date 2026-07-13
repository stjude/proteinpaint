import { legend_newrow } from '#src/block.legend'
import { Menu } from '#dom'
import { JTypes } from '#shared'
import { printCategory } from '../mds3/legend'

/*
 */

export function initLegend(tk, block) {
	// run only once, called by makeTk
	if (!block.legend) return // block has no legend. could be due to hidegenelegend flag
	if (!tk.legend) tk.legend = {}
	tk.legend.tip = new Menu({ padding: '0px' })

	const [tr, td, td0] = legend_newrow(block, tk.dslabel)
	tk.legend.headTd = td0 // for updating tk name in legend when filterObj updates

	tk.tr_legend = tr // to be compatible with block.tk_remove()

	const table = td.append('table').style('border-spacing', '5px').style('border-collapse', 'separate')

	tk.legend.table = table
	create_type(tk, block)
}
export function updateLegend(data, tk, block) {
	if (!tk.legend) {
		// if using invalid dslabel, upon initiating initLegend() will not be called
		//and tk.legend may not be created
		return
	}
	update_type(tk)
}
function create_type(tk, block) {
	if (!tk.legend.type) tk.legend.type = {}
	if (!tk.legend.type.hiddenvalues) tk.legend.type.hiddenvalues = new Set()

	if (tk.hiddenTypes) {
		// some types to be hidden by default according to ds
		for (const c of tk.hiddenTypes) tk.legend.type.hiddenvalues.add(c)
	}

	tk.legend.type.row = tk.legend.table.append('tr')

	tk.legend.type.row
		.append('td')
		.attr('data-testid', 'sjpp-j2-legend-row-type')
		.style('text-align', 'right')
		.style('opacity', 0.7)
		.text('Type')

	tk.legend.type.holder = tk.legend.type.row.append('td')
}
function update_type(tk) {
	if (tk.hardcodeCnvOnly) return // legend is permanently hidden, no need to update
	const type2count = new Map() // k: type, v: count
	for (const j of tk.data) {
		for (const t of j.types) {
			type2count.set(t, 1 + (type2count.get(t) || 0))
		}
	}

	tk.legend.type.holder.selectAll('*').remove()

	for (const [t, c] of [...type2count].sort((i, j) => j[1] - i[1])) {
		// { k, count }
		printCategory({
			holder: tk.legend.type.holder,
			key: t,
			label: JTypes[t].name,
			color: JTypes[t].color,
			count: c,
			testid: 'sjpp-j2-legend-row-type-item',
			click: event => {
				const opts = [
					{
						label: 'Hide',
						callback: () => {
							tk.legend.type.hiddenvalues.add(t)
						}
					},
					{
						label: 'Show only',
						callback: () => {
							for (const t2 of type2count) {
								tk.legend.type.hiddenvalues.add(t2)
							}
							tk.legend.type.hiddenvalues.delete(t)
						}
					},
					{
						label: 'Show all',
						isVisible: () => tk.legend.type.hiddenvalues.size,
						callback: () => {
							tk.legend.type.hiddenvalues.clear()
						}
					}
				]
				tk.legend.tip.clear().showunder(event.target)
				for (const o of opts) {
					if (o.isVisible && o.isVisible() == false) continue
					tk.legend.tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.attr('data-testid', `sjpp-legend-option-${o.label.toLowerCase().replace(/\s/g, '-')}`)
						.style('border-radius', '0px')
						.text(o.label)
						.on('click', () => {
							o.callback()
							tk.legend.tip.hide()
							tk.load()
						})
				}
			}
		})
	}

	// hidden ones
	for (const c of tk.legend.type.hiddenvalues) {
		let loading = false

		tk.legend.type.holder
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_clb')
			.style('text-decoration', 'line-through')
			.style('opacity', 0.7)
			.text(JTypes[c].name)
			.on('click', async event => {
				if (loading) return
				loading = true
				tk.legend.type.hiddenvalues.delete(c)
				event.target.innerHTML = 'Updating...'
				await tk.load()
			})
	}
}
