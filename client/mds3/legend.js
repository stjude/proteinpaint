import { event as d3event } from 'd3-selection'
import { legend_newrow } from '../src/block.legend'
import { Menu } from '#dom/menu'
import { mclass, dt2label, dtcnv, dtloh, dtitd, dtsv, dtfusionrna, mclassitd } from '#shared/common'

/*
********************** EXPORTED
initLegend
updateLegend
********************** INTERNAL
create_mclass
update_mclass
update_info_fields
may_create_variantShapeName
may_update_variantShapeName
may_create_infoFields
may_update_infoFields

********************** tk.legend{} structure
.tip
.table
	<table>, in which creates <tr> of two <td> to show legend sections
.mclass{}
	.hiddenvalues Set()
	.holder DOM
	.row DOM
.variantShapeName{}
	.row
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
	may_create_variantShapeName(tk)
	may_create_infoFields(tk)
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

function may_create_variantShapeName(tk) {
	if (!tk.variantShapeName) return
	const holder = tk.legend.table
		.append('tr')
		.append('td')
		.attr('colspan', 2)
	const vl = (tk.legend.variantShapeName = {})
	{
		const d = holder.append('div')
		d.append('span').html(
			`<svg style="display:inline-block" width=12 height=12>
			<circle cx=6 cy=6 r=6 fill=gray></circle></svg> n=`
		)
		vl.dotCount = d.append('span')
		if (tk.variantShapeName.dot) d.append('span').text(', ' + tk.variantShapeName.dot)
		vl.dotDiv = d
	}
	{
		const d = holder.append('div')
		d.append('span').html(
			`<svg style="display:inline-block" width=12 height=12>
			<path d="M 6 0 L 0 12 h 12 Z" fill=gray></path></svg> n=`
		)
		vl.triangleCount = d.append('span')
		if (tk.variantShapeName.triangle) d.append('span').text(', ' + tk.variantShapeName.triangle)
		vl.triangleDiv = d
	}
	{
		const d = holder.append('div')
		d.append('span').html(
			`<svg style="display:inline-block" width=13 height=13>
			<circle cx=6.5 cy=6.5 r=6 stroke=gray fill=none></circle></svg> n=`
		)
		vl.circleCount = d.append('span')
		if (tk.variantShapeName.circle) d.append('span').text(', ' + tk.variantShapeName.circle)
		vl.circleDiv = d
	}
}

function may_create_infoFields(tk) {
	
	// console.log(field_category)
	// console.log(tk)
	
	if (!tk.mds.bcf || !tk.mds.bcf.info) {
		// not using bcf with info fields
		return
	}
	// collect info field keys eligible for displaying in legend
	const infoFields4legend = [] 
	// find eligible info field keys to show in legend and create global object with infofield categories as field_category
	for(let key in tk.mds.bcf.info){
		let field = tk.mds.bcf.info[key]
		if(field.categories){
			infoFields4legend.push(key)
		}
	}
	if (!infoFields4legend.length) {
		return
	}

	// has info fields to show in legend

	if (!tk.legend.bcfInfo) tk.legend.bcfInfo = {} // key: info key
	for (const key of infoFields4legend) {
		const row = tk.legend.table.append('tr') // html <tr> created for this info field in the legend table
		// this row will have two columns, just like mclass

		// column 1 <td>: info field name
		row
			.append('td')
			.style('text-align', 'right')
			.style('opacity', 0.3)
			.text(tk.mds.bcf.info[key].name || key)

		tk.legend.bcfInfo[key] = {
			hiddenvalues: new Set(),
			row,
			// column 2 <td>: content holder
			holder: row.append('td')
		}
	}
}

/*
data is returned by xhr
update legend dom
makes no return
*/
export function updateLegend(data, tk, block) {
	if (!tk.legend) {
		/* if using invalid dslabel, upon initiating initLegend() will not be called
		and tk.legend may not be created
		*/
		return
	}

	// should clear here
	//tk.legend.mclass.holder.selectAll('*').remove()

	/* data.mclass2variantcount is optional; if present, will render in mclass section of track legend
	also keep data so it can be accessible by block.svg.js
	for rendering mclass legend in exported svg
	*/

	tk.legend.mclass.currentData = data.mclass2variantcount
	update_mclass(tk)

	/*
	if (data.info_fields) {
		update_info_fields(data.info_fields, tk)
	}
	*/

	may_update_variantShapeName(data, tk)
	may_update_infoFields(data, tk)
}

function may_update_variantShapeName(data, tk) {
	if (!tk.variantShapeName) return
	let dot = 0,
		triangle = 0,
		circle = 0
	for (const m of data.skewer) {
		if (m.shapeTriangle) triangle++
		else if (m.shapeCircle) circle++
		else dot++
	}
	const vl = tk.legend.variantShapeName
	vl.dotDiv.style('display', dot ? 'block' : 'none')
	vl.triangleDiv.style('display', triangle ? 'block' : 'none')
	vl.circleDiv.style('display', circle ? 'block' : 'none')
	vl.dotCount.text(dot)
	vl.triangleCount.text(triangle)
	vl.circleCount.text(circle)
}

function may_update_infoFields(data, tk) {
	// TODO allow filtering
	
	if (!tk.legend.bcfInfo) return
	if (!data.skewer) {
		console.log('data.skewer[] is not present and cannot show INFO legend')
		return
	}
	let field_category = {}
	for(let key in tk.mds.bcf.info){
		let field = tk.mds.bcf.info[key]
		if(field.categories){
			field_category = field.categories
		}
	}
	// console.log(field_category)

	for (const infoKey in tk.legend.bcfInfo) {
		// clear holder
		tk.legend.bcfInfo[infoKey].holder.selectAll('*').remove()
		if (tk.mds.bcf.info[infoKey].Type == 'String') {
			// categorical field, show unique list of categories and variant count
			// TODO later use "termType=categorical/integer/float"

			const category2variantCount = new Map() // key: category of this INFO field, v: number of variants
			for (const m of data.skewer) {
				if (!m.info) continue
				if (!(infoKey in m.info)) continue
				const category = m.info[infoKey]
				if (Array.isArray(category)) {
					for (const c of category) {
						category2variantCount.set(c, 1 + (category2variantCount.get(c) || 0))
					}
				} else {
					category2variantCount.set(category, 1 + (category2variantCount.get(category) || 0))
				}
			}

			// sort tally in descending order, each element is a two-ele array [category, variantCount]
			const all_lst = [...category2variantCount].sort((i, j) => j[1] - i[1])

			const show_lst = [],
				hidden_lst = []

			for (const [category, count] of all_lst) {
				const clnsig_dict = { category, count }
				if (tk.legend.bcfInfo[infoKey].hiddenvalues.has(category)) {
					hidden_lst.push(clnsig_dict)
				} else {
					show_lst.push(clnsig_dict)
				}
			}

			show_lst.sort((i, j) => j.count - i.count)
			hidden_lst.sort((i, j) => j.count - i.count)

			for (const k of tk.legend.bcfInfo[infoKey].hiddenvalues) {
				if (!hidden_lst.find(i => i.k == k)) {
					hidden_lst.push({ k })
				}
			}
			
			for (const c of show_lst) {
			let desc
				for(let [key,value] of Object.entries(field_category)){
					if(c.category == key){	
						desc = value.desc
					}
				}

				const cell = tk.legend.bcfInfo[infoKey].holder
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
								tk.legend.bcfInfo[infoKey].hiddenvalues.add(c.category)
								tk.legend.tip.hide()
								tk.uninitialized = true
								tk.load()
							})

						tk.legend.tip.d
							.append('div')
							.attr('class', 'sja_menuoption')
							.text('Show only')
							.on('click', () => {
								for (const c2 of show_lst) {
									tk.legend.bcfInfo[infoKey].hiddenvalues.add(c2.category)
								}
								tk.legend.bcfInfo[infoKey].hiddenvalues.delete(c.category)
								tk.legend.tip.hide()
								tk.uninitialized = true
								tk.load()
							})

						if (hidden_lst.length) {
							tk.legend.tip.d
								.append('div')
								.attr('class', 'sja_menuoption')
								.text('Show all')
								.on('click', () => {
									tk.legend.bcfInfo[infoKey].hiddenvalues.clear()
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
							.html(desc)

						tk.legend.tip.showunder(cell.node())
					})

				cell
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_mcdot')
					.style('background', tk.mds.bcf.info[infoKey].categories[c.category].color)
					.html(c.count > 1 ? c.count : '&nbsp;')
				cell
					.append('div')
					.style('display', 'inline-block')
					.style('color', tk.mds.bcf.info[infoKey].categories[c.category].color)
					.html('&nbsp;' + tk.mds.bcf.info[infoKey].categories[c.category].label)
			}

			// hidden ones
			for (const c of hidden_lst) {
				let loading = false
				tk.legend.bcfInfo[infoKey].holder
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_clb')
					.style('text-decoration', 'line-through')
					.style('opacity', 0.3)
					.text(c.k)
					.on('click', async () => {
						if (loading) return
						loading = true
						tk.legend.bcfInfo[infoKey].hiddenvalues.delete(c.k)
						tk.uninitialized = true
						await tk.load()
					})
			}
		}
	}
}

function update_mclass(tk) {
	if (!tk.legend.mclass.currentData || tk.legend.mclass.currentData.length == 0) return
	// console.log(tk.legend.mclass.currentData)

	/* only clear here
	todo: upon zooming into protein, should generate updated mclass2variantcount using client cached data, visible in view range
	*/
	tk.legend.mclass.holder.selectAll('*').remove()

	const showlst = [],
		hiddenlst = []
	for (const [k, count] of tk.legend.mclass.currentData) {
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
	// e.g. if class filter is done at backend, and currentData is calculated just from visible data items
	for (const k of tk.legend.mclass.hiddenvalues) {
		if (!hiddenlst.find(i => i.k == k)) {
			hiddenlst.push({ k })
		}
	}

	for (const c of showlst) {
		// { k, count }
		// k is either dt (integer), or mclass (string)
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
					.html(desc)

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

/*
function update_info_fields(data, tk) {
// data is data.info_fields{}

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
*/