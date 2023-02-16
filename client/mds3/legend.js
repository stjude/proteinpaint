import { legend_newrow } from '#src/block.legend'
import { Menu } from '#dom/menu'
import { mclass, dt2label, dtcnv, dtloh, dtitd, dtsv, dtfusionrna, mclassitd } from '#shared/common'

/*
********************** EXPORTED
initLegend
updateLegend
********************** INTERNAL
create_mclass
update_mclass
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

const unknown_infoCategory_bgcolor = 'white',
	unknown_infoCategory_textcolor = 'black'

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
	may_create_formatFilters(tk)
	may_create_skewerRim(tk)
}

/*
list all mutation classes
attribute may have already been created with customization
legend.mclass{}
	.hiddenvalues
	.row
	.holder
*/
function create_mclass(tk, block) {
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
	if (!tk.mds.bcf?.info) return // not using bcf with info fields
	// collect info field keys eligible for displaying in legend
	const infoFields4legend = []
	// find eligible info field keys to show in legend and create global object with infofield categories as field_category
	for (const key in tk.mds.bcf.info) {
		const field = tk.mds.bcf.info[key]
		if (field.categories) {
			infoFields4legend.push(key)
		}
	}
	if (!infoFields4legend.length) return // no filterable fields

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

function may_create_formatFilters(tk) {
	if (!tk.mds.bcf?.format) return // not using bcf with format fields
	// collect format fields used for filtering
	const formatFields4legend = []
	for (const k in tk.mds.bcf.format) {
		if (tk.mds.bcf.format[k].isFilter) formatFields4legend.push(k)
	}
	if (!formatFields4legend.length) return // nothing filterable

	if (!tk.legend.formatFilter) tk.legend.formatFilter = {} // key: format key
	for (const key of formatFields4legend) {
		const row = tk.legend.table.append('tr') // html <tr> created for this info field in the legend table
		// this row will have two columns, just like mclass

		// column 1 <td>: format field name
		row
			.append('td')
			.style('text-align', 'right')
			.style('opacity', 0.3)
			.text(tk.mds.bcf.format[key].Description)

		tk.legend.formatFilter[key] = {
			hiddenvalues: new Set(),
			row,
			// column 2 <td>: content holder
			holder: row.append('td')
		}
	}
}

function may_update_formatFilter(data, tk) {
	if (!tk.legend.formatFilter) return
	if (!data.skewer) {
		console.log('data.skewer[] is not present and cannot show INFO legend')
		return
	}

	for (const formatKey in tk.legend.formatFilter) {
		// key of a FORMAT field and will create a legend section

		// clear holder
		tk.legend.formatFilter[formatKey].holder.selectAll('*').remove()

		// data for the INFO field is categorical, in the legend show unique list of categories and variant count
		// TODO later use "termType=categorical/integer/float"

		const category2variantCount = new Map() // key: category of this INFO field, v: number of variants
		for (const m of data.skewer) {
			if (m.formatK2count?.[formatKey]) {
				for (const category in m.formatK2count[formatKey]) {
					category2variantCount.set(category, 1 + (category2variantCount.get(category) || 0))
				}
			}
		}

		// sort tally in descending order, each element is a two-ele array [category, variantCount]
		const all_lst = [...category2variantCount].sort((i, j) => j[1] - i[1])

		const show_lst = [],
			hidden_lst = []

		for (const [category, count] of all_lst) {
			const dict = { category, count }
			if (tk.legend.formatFilter[formatKey].hiddenvalues.has(category)) {
				hidden_lst.push(dict)
			} else {
				show_lst.push(dict)
			}
		}

		show_lst.sort((i, j) => j.count - i.count)
		hidden_lst.sort((i, j) => j.count - i.count)

		for (const k of tk.legend.formatFilter[formatKey].hiddenvalues) {
			if (!hidden_lst.find(i => i.k == k)) {
				hidden_lst.push({ k })
			}
		}

		for (const c of show_lst) {
			// c={category:str, count:int}

			const cell = tk.legend.formatFilter[formatKey].holder
				.append('div')
				.attr('class', 'sja_clb')
				.style('display', 'inline-block')
				.on('click', event => {
					tk.legend.tip
						.clear()
						.showunder(event.target)
						.d.append('div')
						.attr('class', 'sja_menuoption')
						.text('Hide')
						.on('click', () => {
							tk.legend.formatFilter[formatKey].hiddenvalues.add(c.category)
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
								tk.legend.formatFilter[formatKey].hiddenvalues.add(c2.category)
							}
							tk.legend.formatFilter[formatKey].hiddenvalues.delete(c.category)
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
								tk.legend.formatFilter[formatKey].hiddenvalues.clear()
								tk.legend.tip.hide()
								tk.uninitialized = true
								tk.load()
							})
					}
				})

			cell
				.append('div')
				.style('display', 'inline-block')
				.text(c.category + ', n=' + c.count)
		}

		// hidden ones
		for (const c of hidden_lst) {
			let loading = false
			tk.legend.formatFilter[formatKey].holder
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_clb')
				.style('text-decoration', 'line-through')
				.style('opacity', 0.3)
				.text(c.k)
				.on('click', async () => {
					if (loading) return
					loading = true
					tk.legend.formatFilter[formatKey].hiddenvalues.delete(c.k)
					tk.uninitialized = true
					await tk.load()
				})
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
		// if using invalid dslabel, upon initiating initLegend() will not be called
		//and tk.legend may not be created
		return
	}

	/* data.mclass2variantcount is optional; if present, will render in mclass section of track legend
	also keep data so it can be accessible by block.svg.js
	for rendering mclass legend in exported svg
	*/

	tk.legend.mclass.currentData = data.mclass2variantcount
	update_mclass(tk)

	may_update_variantShapeName(data, tk)
	may_update_infoFields(data, tk)
	may_update_formatFilter(data, tk)
	may_update_skewerRim(data, tk)
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

/*
update legend for all info fields of this track
*/
function may_update_infoFields(data, tk) {
	if (!tk.legend.bcfInfo) return
	if (!data.skewer) {
		console.log('data.skewer[] is not present and cannot show INFO legend')
		return
	}

	for (const infoKey in tk.legend.bcfInfo) {
		// key of an INFO field and will create a legend section

		// clear holder
		tk.legend.bcfInfo[infoKey].holder.selectAll('*').remove()

		if (tk.mds.bcf.info[infoKey].Type == 'String') {
			// data for the INFO field is categorical, in the legend show unique list of categories and variant count
			// TODO later use "termType=categorical/integer/float"

			const category2variantCount = new Map() // key: category of this INFO field, v: number of variants
			for (const m of data.skewer) {
				const category = m?.info?.[infoKey]
				if (category == undefined) continue // this variant is not annotated by this field

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
				// c={category:str, count:int}

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

						// optional description of this category
						const desc = tk.mds.bcf.info[infoKey].categories?.[c.category]?.desc
						if (desc) {
							tk.legend.tip.d
								.append('div')
								.style('padding', '10px')
								.style('font-size', '.8em')
								.style('width', '150px')
								.html(desc)
						}

						tk.legend.tip.showunder(cell.node())
					})

				cell
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_mcdot')
					.style('background', tk.mds.bcf.info[infoKey].categories?.[c.category]?.color || unknown_infoCategory_bgcolor)
					.html(c.count > 1 ? c.count : '&nbsp;')
				cell
					.append('div')
					.style('display', 'inline-block')
					.style('color', tk.mds.bcf.info[infoKey].categories?.[c.category]?.color || unknown_infoCategory_textcolor)
					.html('&nbsp;' + tk.mds.bcf.info[infoKey].categories?.[c.category]?.label || c.category)
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
			.on('click', event => {
				tk.legend.tip
					.clear()
					.showunder(event.target)
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
			.on('click', async event => {
				if (loading) return
				loading = true
				tk.legend.mclass.hiddenvalues.delete(c.k)
				event.target.innerHTML = 'Updating...'
				tk.uninitialized = true
				await tk.load()
			})
	}
}

function may_create_skewerRim(tk, block) {
	if (!tk.mds.queries?.snvindel?.skewerRim) return // not enabled
	const R = (tk.legend.skewerRim = {})
	if (!tk.mds.queries.snvindel.skewerRim.hiddenvaluelst) tk.mds.queries.snvindel.skewerRim.hiddenvaluelst = []

	R.row = tk.legend.table.append('tr')

	R.headerTd = R.row // name of rim legend row is set on the fly, allows to change data type for rim
		.append('td')
		.style('text-align', 'right')
		.style('opacity', 0.3)

	R.holder = R.row.append('td')
}

function getSkewerRimLegendHeaderName(tk) {
	const sk = tk.mds.queries.snvindel.skewerRim
	if (sk.type == 'format') {
		if (!sk.formatKey) throw 'skewerRim.formatKey missing'
		return tk.mds.bcf?.format?.[sk.formatKey]?.Description || sk.formatKey
	}
	return 'unknown skewerRim.type'
}

function may_update_skewerRim(data, tk) {
	const sk = tk.mds.queries?.snvindel?.skewerRim
	if (!sk) return // not enabled
	let rim1total = 0, // count number of cases, not unique
		noRimTotal = 0
	for (const m of data.skewer) {
		const r1 = m.rim1count || 0
		rim1total += r1
		noRimTotal += m.occurrence - r1
	}
	const R = tk.legend.skewerRim
	R.headerTd.text(getSkewerRimLegendHeaderName(tk))
	R.holder.selectAll('*').remove()

	// rim1
	if (rim1total > 0) {
		R.holder
			.append('div')
			.attr('class', 'sja_clb')
			.style('display', 'inline-block')
			.html(`${getRimSvg(1)} ${sk.rim1value}, n=${rim1total}`)
			.on('click', event => {
				tk.legend.tip
					.clear()
					.showunder(event.target)
					.d.append('div')
					.attr('class', 'sja_menuoption')
					.text('Hide')
					.on('click', () => {
						sk.hiddenvaluelst.push(sk.rim1value)
						tk.legend.tip.hide()
						tk.uninitialized = true
						tk.load()
					})
			})
	}
	// no rim
	if (noRimTotal > 0) {
		R.holder
			.append('div')
			.attr('class', 'sja_clb')
			.style('display', 'inline-block')
			.html(`${getRimSvg()} ${sk.noRimValue}, n=${noRimTotal}`)
			.on('click', event => {
				tk.legend.tip
					.clear()
					.showunder(event.target)
					.d.append('div')
					.attr('class', 'sja_menuoption')
					.text('Hide')
					.on('click', () => {
						sk.hiddenvaluelst.push(sk.noRimValue)
						tk.legend.tip.hide()
						tk.uninitialized = true
						tk.load()
					})
			})
	}

	// hidden ones
	for (const c of sk.hiddenvaluelst) {
		let loading = false
		R.holder
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_clb')
			.style('text-decoration', 'line-through')
			.style('opacity', 0.3)
			.text(c)
			.on('click', async event => {
				if (loading) return
				loading = true
				sk.hiddenvaluelst.splice(sk.hiddenvaluelst.indexOf(c), 1)
				event.target.innerHTML = 'Updating...'
				tk.uninitialized = true
				await tk.load()
			})
	}
}

function getRimSvg(rim) {
	return (
		'<svg width="19" height="19" style="margin-right: 5px;">' +
		'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle>' +
		(rim == 1
			? '<path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="#858585" stroke="none"></path>'
			: rim == 2
			? '' // hollow rim2, not done yet
			: '') + // blank for no rim
		'</svg>'
	)
}
