import { legend_newrow } from '#src/block.legend'
import { Menu, axisstyle } from '#dom'
import { mclass, dt2label, dtcnv, dtloh, dtitd, dtsv, dtfusionrna, mclassitd } from '#shared/common.js'
import { interpolateRgb } from 'd3-interpolate'
import { showLDlegend } from '../plots/regression.results'
import { axisTop } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'
import { displayVectorGraphics } from './leftlabel.variant'

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
may_create_formatFilter
may_update_formatFilter
may_create_skewerRim
may_update_skewerRim
may_create_ld
may_update_ld
may_create_cnv
may_update_cnv

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

const unannotatedKey = 'Unannotated'

export function initLegend(tk, block) {
	/*
run only once, called by makeTk
*/
	if (!tk.legend) tk.legend = {}
	tk.legend.tip = new Menu({ padding: '0px' })

	const [tr, td, td0] = legend_newrow(block, tk.name)
	tk.legend.headTd = td0 // for updating tk name in legend when filterObj updates

	tk.tr_legend = tr // to be compatible with block.tk_remove()

	const table = td.append('table').style('border-spacing', '5px').style('border-collapse', 'separate')

	tk.legend.table = table

	create_mclass(tk, block)
	// may_create_variantShapeName(tk)
	may_create_infoFields(tk)
	may_create_formatFilter(tk)
	may_create_skewerRim(tk)
	may_create_ld(tk)
	may_create_cnv(tk)
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
		.style('opacity', 0.7)
		.text(block.mclassOverride ? block.mclassOverride.className || 'Mutation' : 'Mutation')

	tk.legend.mclass.holder = tk.legend.mclass.row.append('td')
}

// function may_create_variantShapeName(tk) {
// 	if (!tk.variantShapeName) return
// 	const holder = tk.legend.table.append('tr').append('td').attr('colspan', 2)
// 	const vl = (tk.legend.variantShapeName = {})
// 	{
// 		const d = holder.append('div')
// 		d.append('span').html(
// 			`<svg style="display:inline-block" width=12 height=12>
// 			<circle cx=6 cy=6 r=6 fill=gray></circle></svg> n=`
// 		)
// 		vl.dotCount = d.append('span')
// 		if (tk.variantShapeName.dot) d.append('span').text(', ' + tk.variantShapeName.dot)
// 		vl.dotDiv = d
// 	}
// 	{
// 		const d = holder.append('div')
// 		d.append('span').html(
// 			`<svg style="display:inline-block" width=12 height=12>
// 			<path d="M 6 0 L 0 12 h 12 Z" fill=gray></path></svg> n=`
// 		)
// 		vl.triangleCount = d.append('span')
// 		if (tk.variantShapeName.triangle) d.append('span').text(', ' + tk.variantShapeName.triangle)
// 		vl.triangleDiv = d
// 	}
// 	{
// 		const d = holder.append('div')
// 		d.append('span').html(
// 			`<svg style="display:inline-block" width=13 height=13>
// 			<circle cx=6.5 cy=6.5 r=6 stroke=gray fill=none></circle></svg> n=`
// 		)
// 		vl.circleCount = d.append('span')
// 		if (tk.variantShapeName.circle) d.append('span').text(', ' + tk.variantShapeName.circle)
// 		vl.circleDiv = d
// 	}
// }

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
			.style('opacity', 0.7)
			.text(tk.mds.bcf.info[key].name || key)

		tk.legend.bcfInfo[key] = {
			hiddenvalues: new Set(),
			row,
			// column 2 <td>: content holder
			holder: row.append('td')
		}
	}
}

function may_create_formatFilter(tk) {
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
		row.append('td').style('text-align', 'right').style('opacity', 0.7).text(tk.mds.bcf.format[key].Description)

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
		let unannotatedCount = 0
		for (const m of data.skewer) {
			if (!m.formatK2count?.[formatKey]) continue // no data
			for (const category in m.formatK2count[formatKey].v2c) {
				category2variantCount.set(
					category,
					m.formatK2count[formatKey].v2c[category] + (category2variantCount.get(category) || 0)
				)
			}
			unannotatedCount += m.formatK2count[formatKey].unannotatedCount || 0
		}

		// sort tally in descending order, each element is a two-ele array [category, variantCount]
		const show_lst = [...category2variantCount]
		show_lst.sort((i, j) => j[1] - i[1])
		if (unannotatedCount) {
			// show unannotated at the end
			show_lst.push([unannotatedKey, unannotatedCount])
		}

		for (const [category, count] of show_lst) {
			const cell = tk.legend.formatFilter[formatKey].holder
				.append('div')
				.attr('class', 'sja_clb')
				.style('display', 'inline-block')
				.on('click', () => {
					const opts = [
						{
							label: 'Hide',
							isVisible: () => true,
							callback: () => {
								tk.legend.formatFilter[formatKey].hiddenvalues.add(category)
							}
						},
						{
							label: 'Show only',
							isVisible: () => true,
							callback: () => {
								for (const c2 of show_lst) {
									tk.legend.formatFilter[formatKey].hiddenvalues.add(c2[0])
								}
								tk.legend.formatFilter[formatKey].hiddenvalues.delete(category)
							}
						},
						{
							label: 'Show all',
							isVisible: () => tk.legend.formatFilter[formatKey].hiddenvalues.size,
							callback: () => {
								tk.legend.formatFilter[formatKey].hiddenvalues.clear()
							}
						}
					]
					createLegendTipMenu(opts, tk, cell.node())
				})
			cell
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_mcdot')
				.style('background', '#aaa')
				.style('margin-right', '5px')
				.html(count > 1 ? count : '&nbsp;')
			cell.append('div').style('display', 'inline-block').text(category)
		}

		// hidden ones
		for (const c of tk.legend.formatFilter[formatKey].hiddenvalues) {
			let loading = false
			tk.legend.formatFilter[formatKey].holder
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_clb')
				.style('text-decoration', 'line-through')
				.style('opacity', 0.7)
				.text(c)
				.on('click', async () => {
					if (loading) return
					loading = true
					tk.legend.formatFilter[formatKey].hiddenvalues.delete(c)
					reload(tk)
				})
		}
	}
}

function reload(tk) {
	tk.legend.tip.hide()
	tk.load()
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

	// may_update_variantShapeName(data, tk)
	may_update_infoFields(data, tk)
	may_update_formatFilter(data, tk)
	may_update_skewerRim(data, tk)
	may_update_ld(tk)
	may_update_cnv(tk)
}

// function may_update_variantShapeName(data, tk) {
// 	if (!tk.variantShapeName) return
// 	let dot = 0,
// 		triangle = 0,
// 		circle = 0
// 	for (const m of data.skewer) {
// 		if (m.shapeTriangle) triangle++
// 		else if (m.shapeCircle) circle++
// 		else dot++
// 	}
// 	const vl = tk.legend.variantShapeName
// 	vl.dotDiv.style('display', dot ? 'block' : 'none')
// 	vl.triangleDiv.style('display', triangle ? 'block' : 'none')
// 	vl.circleDiv.style('display', circle ? 'block' : 'none')
// 	vl.dotCount.text(dot)
// 	vl.triangleCount.text(triangle)
// 	vl.circleCount.text(circle)
// }

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
				const category = infoKey in m.info ? m.info[infoKey] : unannotatedKey
				if (Array.isArray(category)) {
					for (const c of category) {
						category2variantCount.set(c, 1 + (category2variantCount.get(c) || 0))
					}
				} else {
					category2variantCount.set(category, 1 + (category2variantCount.get(category) || 0))
				}
			}

			// sort tally in descending order, each element is a two-ele array [category, variantCount]
			const show_lst = [...category2variantCount].sort((i, j) => j[1] - i[1])

			for (const [category, count] of show_lst) {
				const cell = tk.legend.bcfInfo[infoKey].holder
					.append('div')
					.attr('class', 'sja_clb')
					.style('display', 'inline-block')
					.on('click', () => {
						const opts = [
							{
								label: 'Hide',
								isVisible: () => true,
								callback: () => {
									tk.legend.bcfInfo[infoKey].hiddenvalues.add(category)
								}
							},
							{
								label: 'Show only',
								isVisible: () => true,
								callback: () => {
									for (const c2 of show_lst) {
										tk.legend.bcfInfo[infoKey].hiddenvalues.add(c2[0])
									}
									tk.legend.bcfInfo[infoKey].hiddenvalues.delete(category)
								}
							},
							{
								label: 'Show all',
								isVisible: () => tk.legend.bcfInfo[infoKey].hiddenvalues.size,
								callback: () => {
									tk.legend.bcfInfo[infoKey].hiddenvalues.clear()
								}
							}
						]

						createLegendTipMenu(opts, tk, cell.node())

						// optional description of this category
						const desc = tk.mds.bcf.info[infoKey].categories?.[category]?.desc
						if (desc) {
							tk.legend.tip.d
								.append('div')
								.style('padding', '10px')
								.style('font-size', '.8em')
								.style('width', '150px')
								.html(desc)
						}
					})

				cell
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_mcdot')
					.style('background', tk.mds.bcf.info[infoKey].categories?.[category]?.color || unknown_infoCategory_bgcolor)
					.html(count > 1 ? count : '&nbsp;')
				cell
					.append('div')
					.style('display', 'inline-block')
					.style('color', tk.mds.bcf.info[infoKey].categories?.[category]?.color || unknown_infoCategory_textcolor)
					.style('padding-left', '5px')
					.text(tk.mds.bcf.info[infoKey].categories?.[category]?.label || category)
			}

			// hidden ones
			for (const c of tk.legend.bcfInfo[infoKey].hiddenvalues) {
				let loading = false
				tk.legend.bcfInfo[infoKey].holder
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_clb')
					.style('text-decoration', 'line-through')
					.text(c)
					.on('click', async () => {
						if (loading) return
						loading = true
						tk.legend.bcfInfo[infoKey].hiddenvalues.delete(c)
						reload(tk)
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
				const opts = [
					{
						label: 'Hide',
						isVisible: () => true,
						callback: () => {
							tk.legend.mclass.hiddenvalues.add(c.k)
						}
					},
					{
						label: 'Show only',
						isVisible: () => true,
						callback: () => {
							for (const c2 of showlst) {
								tk.legend.mclass.hiddenvalues.add(c2.k)
							}
							tk.legend.mclass.hiddenvalues.delete(c.k)
						}
					},
					{
						label: 'Show all',
						isVisible: () => hiddenlst.length,
						callback: () => {
							tk.legend.mclass.hiddenvalues.clear()
						}
					},
					{
						isChangeShape: true,
						isVisible: () => {
							return !tk.skewer.viewModes.find(v => v.type === 'numeric').inuse
								? tk.mds?.termdbConfig?.tracks?.allowSkewerChanges ?? true
								: false
						},
						callback: (val, tk) => {
							tk.shapes[c.k] = val[0]
							tk.load()
							tk.legend.tip.hide()
						}
					},
					{
						isChangeColor: true,
						value: color,
						isVisible: () => true,
						callback: colorValue => {
							mclass[c.k].color = colorValue
						}
					}
				]
				createLegendTipMenu(opts, tk, event.target)

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
			.style('opacity', 0.7)
			.text((c.count ? '(' + c.count + ') ' : '') + (Number.isInteger(c.k) ? dt2label[c.k] : mclass[c.k].label))
			.on('click', async event => {
				if (loading) return
				loading = true
				tk.legend.mclass.hiddenvalues.delete(c.k)
				event.target.innerHTML = 'Updating...'
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
		.style('opacity', 0.7)

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
			.html(`${getRimSvg(1)}${sk.rim1value}, n=${rim1total}`)
			.on('click', event => {
				tk.legend.tip
					.clear()
					.showunder(event.target)
					.d.append('div')
					.attr('class', 'sja_menuoption')
					.text('Hide')
					.on('click', () => {
						sk.hiddenvaluelst.push(sk.rim1value)
						reload(tk)
					})
			})
	}
	// no rim
	if (noRimTotal > 0) {
		R.holder
			.append('div')
			.attr('class', 'sja_clb')
			.style('display', 'inline-block')
			.html(`${getRimSvg()}${sk.noRimValue}, n=${noRimTotal}`)
			.on('click', event => {
				tk.legend.tip
					.clear()
					.showunder(event.target)
					.d.append('div')
					.attr('class', 'sja_menuoption')
					.text('Hide')
					.on('click', () => {
						sk.hiddenvaluelst.push(sk.noRimValue)
						reload(tk)
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
			.style('opacity', 0.7)
			.text(c)
			.on('click', async event => {
				if (loading) return
				loading = true
				sk.hiddenvaluelst.splice(sk.hiddenvaluelst.indexOf(c), 1)
				event.target.innerHTML = 'Updating...'
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

function may_create_ld(tk, block) {
	if (!tk.mds.queries?.ld) return
	tk.mds.queries.ld.colorScale = interpolateRgb(tk.mds.queries.ld.overlay.color_0, tk.mds.queries.ld.overlay.color_1)
	const R = (tk.legend.ld = {})
	R.row = tk.legend.table.append('tr')
	// contents are filled in dynamically
	R.headerTd = R.row.append('td').style('text-align', 'right').style('opacity', 0.7)
	R.holder = R.row.append('td')
	R.showHolder = R.holder.append('div').style('display', 'none')
	showLDlegend(R.showHolder, tk.mds.queries.ld.colorScale)
	R.showHolder
		.append('span')
		.text('Cancel overlay')
		.style('font-size', '.7em')
		.attr('class', 'sja_clbtext')
		.on('click', () => {
			delete tk.mds.queries.ld.mOverlay
			if (tk.skewer?.hlssmid) delete tk.skewer.hlssmid
			tk.load()
		})
}

function may_update_ld(tk) {
	if (!tk.mds.queries?.ld?.mOverlay) {
		// not in use
		if (tk.legend.ld) {
			tk.legend.ld.headerTd.html('')
			tk.legend.ld.showHolder.style('display', 'none')
		}
		return
	}
	// doing overlay
	tk.legend.ld.headerTd.html(tk.mds.queries.ld.mOverlay.ldtkname + ' LD r<sup>2</sup>')
	tk.legend.ld.showHolder.style('display', 'block')
}

function may_create_cnv(tk, block) {
	if (!tk.cnv) return
	const R = (tk.legend.cnv = {})
	R.row = tk.legend.table.append('tr')
	// contents are filled in dynamically
	R.headerTd = R.row.append('td').style('text-align', 'right').style('opacity', 0.7).text('CNV')
	R.holder = R.row.append('td')
	R.showHolder = R.holder.append('div').style('display', 'none')
}

function may_update_cnv(tk) {
	if (!tk.cnv) return
	tk.legend.cnv.holder.selectAll('*').remove()
	const svg = tk.legend.cnv.holder.append('svg')
	const axisheight = 20
	const barheight = 15
	const xpad = 10
	const axiswidth = 150
	axisstyle({
		axis: svg
			.append('g')
			.attr('transform', 'translate(' + xpad + ',' + axisheight + ')')
			.call(
				axisTop()
					.scale(scaleLinear().domain([-tk.cnv.absoluteMax, tk.cnv.absoluteMax]).range([0, axiswidth]))
					.ticks(4)
			),
		fontsize: 12
	})

	const id = 'grad' + Math.random()
	const grad = svg.append('defs').append('linearGradient').attr('id', id)
	grad.append('stop').attr('offset', '0%').attr('stop-color', tk.cnv.lossColor)
	grad.append('stop').attr('offset', '50%').attr('stop-color', 'white')
	grad.append('stop').attr('offset', '100%').attr('stop-color', tk.cnv.gainColor)
	svg
		.append('rect')
		.attr('x', xpad)
		.attr('y', axisheight)
		.attr('width', axiswidth)
		.attr('height', barheight)
		.attr('fill', `url(#${id})`)

	svg.attr('width', xpad * 2 + axiswidth).attr('height', axisheight + barheight)
}

function createLegendTipMenu(opts, tk, elem) {
	tk.legend.tip.clear().showunder(elem)

	for (const opt of opts) {
		if (opt.isVisible()) {
			if (opt.isChangeColor) {
				tk.legend.tip.d
					.append('div')
					.style('padding', '5px 10px')
					.text('Color:')
					.append('input')
					.attr('type', 'color')
					.property('value', rgb(opt.value).formatHex())
					.on('change', event => {
						const color = event.target.value
						opt.callback(color)
						reload(tk)
					})
			} else if (opt.isChangeShape) {
				let called = false
				const div = tk.legend.tip.d
					.append('div')
					.text('Change Shape')
					.style('vertical-align', 'middle')
					.attr('class', 'sja_menuoption')
					.on('click', () => {
						if (called == false) {
							called = true
							displayVectorGraphics({
								holder: div.append('div').style('margin-top', '10px'),
								callback: val => opt.callback(val, tk),
								tk: tk
							})
						}
					})
			} else {
				tk.legend.tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(opt.label)
					.on('click', () => {
						opt.callback()
						reload(tk)
					})
			}
		}
	}
}
