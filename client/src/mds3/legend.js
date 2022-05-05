import { event as d3event } from 'd3-selection'
import { legend_newrow } from '../block.legend'
import { Menu } from '../dom/menu'
import { mclass, dt2label, dtcnv, dtloh, dtitd, dtsv, dtfusionrna, mclassitd } from '../../shared/common'

/*
********************** EXPORTED
initLegend
updateLegend
********************** INTERNAL
create_mclass
update_mclass
update_info_fields

********************** tk.legend{} structure
.tip
.table
	<table>, in which creates sections for the legend of this track
.mclass{}
	.hiddenvalues Set()
	.holder DOM
	.row DOM
*/

export function initLegend(tk, block) {
	/*
run only once, called by makeTk
*/
	if (!tk.legend) tk.legend = {}
	tk.legend.tip = new Menu({ padding: '0px' })

	const [tr, td] = legend_newrow(block, tk.name)

	tk.tr_legend = tr // to be compatible with block.tk_remove()

	const table = td
		.append('table')
		.style('border-spacing', '5px')
		.style('border-collapse', 'separate')

	tk.legend.table = table

	create_mclass(tk, block)
}

function create_mclass(tk, block) {
	/*
list all mutation classes
attribute may have already been created with customization
legend.mclass{}
	.hiddenvalues
	.row
	.holder
*/
	if (!tk.legend.mclass) tk.legend.mclass = {}
	if (!tk.legend.mclass.hiddenvalues) tk.legend.mclass.hiddenvalues = new Set()

	tk.legend.mclass.row = tk.legend.table.append('tr')

	tk.legend.mclass.row
		.append('td')
		.style('text-align', 'right')
		.style('opacity', 0.3)
		.text(block.mclassOverride ? block.mclassOverride.className || 'Mutation' : 'Mutation')

	tk.legend.mclass.holder = tk.legend.mclass.row.append('td')
}

export function updateLegend(data, tk, block) {
	/*
data is returned by xhr
*/
	if (data.mclass2variantcount) {
		update_mclass(data.mclass2variantcount, tk)
	}
	if (data.info_fields) {
		update_info_fields(data.info_fields, tk)
	}
}

function update_mclass(mclass2variantcount, tk) {
	tk.legend.mclass.holder.selectAll('*').remove()

	const showlst = [],
		hiddenlst = []
	for (const [k, count] of mclass2variantcount) {
		const v = { k, count }
		if (tk.legend.mclass.hiddenvalues.has(k)) {
			hiddenlst.push(v)
		} else {
			showlst.push(v)
		}
	}
	showlst.sort((i, j) => j.count - i.count)
	hiddenlst.sort((i, j) => j.count - i.count)

	// items in hiddenvalues{} can still be absent in hiddenlst,
	// e.g. if class filter is done at backend, and mclass2variantcount is calculated just from visible data items
	for (const k of tk.legend.mclass.hiddenvalues) {
		if (!hiddenlst.find(i => i.k == k)) {
			hiddenlst.push({ k })
		}
	}

	for (const c of showlst) {
		/*
	k
	count
	*/
		let label,
			desc,
			color = '#858585'

		if (Number.isInteger(c.k)) {
			// c.k is not mclass (string), but dt (integer)
			label = dt2label[c.k]
			if (c.k == dtcnv) {
				desc = 'Copy number variation.'
			} else if (c.k == dtloh) {
				desc = 'Loss of heterozygosity.'
			} else if (c.k == dtitd) {
				color = mclass[mclassitd].color
				desc = 'Internal tandem duplication.'
			} else if (c.k == dtsv) {
				desc = 'Structural variation of DNA.'
			} else if (c.k == dtfusionrna) {
				desc = 'Fusion gene from RNA-seq.'
			}
		} else {
			label = mclass[c.k].label
			color = mclass[c.k].color
			desc = mclass[c.k].desc
		}

		const cell = tk.legend.mclass.holder
			.append('div')
			.attr('class', 'sja_clb')
			.style('display', 'inline-block')
			.on('click', () => {
				tk.legend.tip
					.clear()
					.d.append('div')
					.attr('class', 'sja_menuoption')
					.text('Hide')
					.on('click', () => {
						tk.legend.mclass.hiddenvalues.add(c.k)
						tk.legend.tip.hide()
						tk.uninitialized = true
						tk.load()
					})

				tk.legend.tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text('Show only')
					.on('click', () => {
						for (const c2 of showlst) {
							tk.legend.mclass.hiddenvalues.add(c2.k)
						}
						tk.legend.mclass.hiddenvalues.delete(c.k)
						tk.legend.tip.hide()
						tk.uninitialized = true
						tk.load()
					})

				if (hiddenlst.length) {
					tk.legend.tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.text('Show all')
						.on('click', () => {
							tk.legend.mclass.hiddenvalues.clear()
							tk.legend.tip.hide()
							tk.uninitialized = true
							tk.load()
						})
				}

				tk.legend.tip.d
					.append('div')
					.style('padding', '10px')
					.style('font-size', '.8em')
					.style('width', '150px')
					.text(desc)

				tk.legend.tip.showunder(cell.node())
			})

		cell
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_mcdot')
			.style('background', color)
			.html(c.count > 1 ? c.count : '&nbsp;')
		cell
			.append('div')
			.style('display', 'inline-block')
			.style('color', color)
			.html('&nbsp;' + label)
	}

	// hidden ones
	for (const c of hiddenlst) {
		let loading = false

		tk.legend.mclass.holder
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_clb')
			.style('text-decoration', 'line-through')
			.style('opacity', 0.3)
			.text((c.count ? '(' + c.count + ') ' : '') + (Number.isInteger(c.k) ? dt2label[c.k] : mclass[c.k].label))
			.on('click', async () => {
				if (loading) return
				loading = true
				tk.legend.mclass.hiddenvalues.delete(c.k)
				d3event.target.innerHTML = 'Updating...'
				tk.uninitialized = true
				await tk.load()
			})
	}
}

function update_info_fields(data, tk) {
	/*
data is data.info_fields{}
*/
	for (const key in data) {
		const i = tk.info_fields.find(i => i.key == key)
		if (!i) {
			console.log('info field not found by key: ' + key)
			continue
		}
		i._data = data[key]
		if (i.isactivefilter) {
			// an active filter; update stats
			if (i.iscategorical) {
				// update counts from htmlspan
				if (i.unannotated_htmlspan)
					i.unannotated_htmlspan.text('(' + (i._data.unannotated_count || 0) + ') Unannotated')
				for (const v of i.values) {
					if (v.htmlspan) {
						v.htmlspan.text('(' + (i._data.value2count[v.key] || 0) + ') ' + v.label)
					}
				}
			} else if (i.isinteger || i.isfloat) {
				if (i.htmlspan) i.htmlspan.text('(' + i._data.filteredcount + ' filtered)')
			} else if (i.isflag) {
				if (i.htmlspan)
					i.htmlspan.text(
						'(' + (i.remove_yes ? i._data.count_yes : i._data.count_no) + ') ' + (i.remove_no ? 'No' : 'Yes')
					)
			} else {
				throw 'unknown info type'
			}
		}
	}
}
