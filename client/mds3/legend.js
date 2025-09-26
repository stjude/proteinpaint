import { legend_newrow } from '#src/block.legend'
import { Menu, ColorScale, icons, shapes } from '#dom'
import {
	mds3tkMclass,
	mclass,
	dt2label,
	dtcnv,
	dtloh,
	dtitd,
	dtsv,
	dtfusionrna,
	mclassitd,
	bplen
} from '#shared/common.js'
import { interpolateRgb } from 'd3-interpolate'
import { showLDlegend } from '../plots/regression.results'
import { rgb } from 'd3-color'
import { renderShapePicker } from './leftlabel.variant'

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

const unknown_infoCategory_color = 'black'

export const unannotatedKey = 'Unannotated'

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
	may_create_variantShapeName(tk)
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
	if (tk.hardcodeCnvOnly) {
		// in cnv-only mode, keep mutation legend invisible and still create tk.legend.mclass{} to avoid breaking logic
		tk.legend.mclass.row.style('display', 'none')
	}

	tk.legend.mclass.row
		.append('td')
		.style('text-align', 'right')
		.style('opacity', 0.7)
		.text(block.mclassOverride ? block.mclassOverride.className || 'Mutation' : 'Mutation')

	tk.legend.mclass.holder = tk.legend.mclass.row.append('td')
}

function may_create_variantShapeName(tk) {
	if (!tk.legend.customShapeLabels || !tk.custom_variants) return
	if (!tk.legend.variantShapeName) tk.legend.variantShapeName = []

	for (const data of tk.custom_variants) {
		if (!data.shape) data.shape = 'filledCircle' //Quick fix since legend renders simultaneously with skewers
		const shapeObj = tk.legend.variantShapeName.find(v => v.key == data.shape)
		if (!shapeObj) {
			tk.legend.variantShapeName.push({
				key: data.shape,
				origShape: data.shape,
				num: 1
			})
		} else {
			shapeObj.num = ++shapeObj.num
		}
	}

	// custom_variants[] initial items may have limited set of shapes; later the items maybe dynamically reassigned with additional shape not found in variantShapeName[] that will break code; since all shapes should be declared in customShapeLabels{}, populate them into variantShapeName[] to avoid this issue
	if (tk.legend.customShapeLabels) {
		for (const shape in tk.legend.customShapeLabels) {
			if (!tk.legend.variantShapeName.find(i => i.key == shape)) {
				tk.legend.variantShapeName.push({
					key: shape,
					origShape: shape,
					num: 0
				})
			}
		}
	}

	tk.legend.variantShapeName.sort((a, b) => b.num - a.num)

	const width = 12
	const height = 12

	const shapesWrapper = tk.legend.table.append('tr').append('td').attr('colspan', 2)

	for (const shapeObj of Object.values(tk.legend.variantShapeName)) {
		const getArgs = () => {
			return shapeObj.key.includes('Circle')
				? { radius: width / 2 - 0.5 }
				: shapeObj.key.includes('Rectangle')
				? { width: width / 2 + 2.5, height: height - 0.5 }
				: { width: width - 0.5, height: height - 0.5 }
		}

		shapeObj.wrapper = shapesWrapper.append('div')

		// .on('click', event => {
		// 	tk.legend.tip.clear().showunder(event.target)
		// 	renderShapePicker({
		// 		holder: tk.legend.tip.d.append('div'),
		// 		callback: val => {
		// 			for (const d of tk.skewer.rawmlst) {
		// 				if (shapeObj.ids.some(i => i == d.id)) {
		// 					d.shape = val
		// 				}
		// 			}
		// 			shapeObj.key = val
		// 			shapeObj.shapeG
		// 				.attr('d', shapes[val].calculatePath(getArgs(shapeObj)))
		// 				.attr('fill', shapes[val].isFilled ? 'grey' : 'white')
		// 				.attr('stroke', shapes[val].isFilled ? 'none' : 'grey')
		// 			reload(tk)
		// 		},
		// 		tk: tk
		// 	})
		// })

		const svg = shapeObj.wrapper.append('span').append('svg').attr('width', width).attr('height', height)

		shapeObj.shapeG = svg
			.append('g')
			.attr('transform', `translate(${width / 2}, ${height / 2})`)
			.append('path')
			.attr('d', shapes[shapeObj.key].calculatePath(getArgs(shapeObj)))
			.attr('fill', shapes[shapeObj.key].isFilled ? 'grey' : 'white')
			.attr('stroke', shapes[shapeObj.key].isFilled ? 'none' : 'grey')

		shapeObj.wrapper.append('span').html(`&nbsp;n=`)
		shapeObj.numDiv = shapeObj.wrapper.append('span').text(shapeObj.num)
		shapeObj.wrapper.append('span').text(`, ${tk.legend.customShapeLabels[shapeObj.key]}`)
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
	may_update_variantShapeName(data, tk)
	may_update_infoFields(data, tk)
	may_update_formatFilter(data, tk)
	may_update_skewerRim(data, tk)
	may_update_ld(tk)
	may_update_cnv(tk)
}

function may_update_variantShapeName(data, tk) {
	if (!tk.legend.customShapeLabels) return
	Object.values(tk.legend.variantShapeName).forEach(s => {
		if (!s.ids) {
			/** Create function completes before ids are assigned to each data pt.
			 * Create list here once, to prevent incorrect counts for legend items
			 * when the same shape is selected more than once.
			 */
			s.ids = data.skewer.filter(d => d.shape == s.key).map(i => i.id)
		}
		s.num = 0
	})

	for (const d of data.skewer) {
		let shapeObj = tk.legend.variantShapeName.find(s => s.ids.some(i => i == d.id))
		if (!shapeObj) {
			shapeObj = tk.legend.variantShapeName.find(s => s.key == d.shape || s.origShape == d.shape)
			shapeObj.ids.push(d.id)
		}
		shapeObj.num = ++shapeObj.num
	}

	Object.values(tk.legend.variantShapeName).forEach(s => {
		s.wrapper.style('display', s.num ? 'block' : 'none')
		s.numDiv.text(s.num)
	})
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
				const category = m.info?.[infoKey] || unannotatedKey
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
				printCategory({
					holder: tk.legend.bcfInfo[infoKey].holder,
					key: category,
					color: tk.mds.bcf.info[infoKey].categories?.[category]?.color || unknown_infoCategory_color,
					label: tk.mds.bcf.info[infoKey].categories?.[category]?.label || category,
					count,
					click: event => {
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

						createLegendTipMenu(opts, tk, event.target)

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
					}
				})
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
	if (tk.hardcodeCnvOnly) return // legend is permanently hidden, no need to update
	if (!tk.legend.mclass.currentData || tk.legend.mclass.currentData.length == 0) return
	/* currentData[]: each element is shown as an entry in legend [ [class=str, count], [dt=integer, count] ]
	element is length=2 array. ele[0] can be either string or integer:
	- string: mclass key for snvindel
	- integer: a dt value e.g. dtcnv, those dt that doesn't have a corresponding mclass key
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
		const { label, desc, color } = mds3tkMclass(c.k)

		/*
		// k is either dt (integer), or mclass (string)
		let label,
			desc,
			color = '#858585'

console.log(c)
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
		*/
		printCategory({
			holder: tk.legend.mclass.holder,
			key: c.k,
			label,
			color,
			count: c.count,
			click: () => {
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
							if (c.k == dtcnv) return false // no changing shape for cnv
							return !tk.skewer.viewModes.find(v => v.type === 'numeric')?.inuse
								? tk.mds?.termdbConfig?.tracks?.allowSkewerChanges ?? true
								: false
						},
						callback: (val, tk) => {
							tk.shapes[c.k] = val
							tk.load()
							tk.legend.tip.hide()
						}
					},
					{
						isChangeColor: true,
						value: color,
						isVisible: () => {
							return c.k != dtcnv // no changing color for cnv
						},
						callback: colorValue => {
							if (!mclass[c.k].origColor) mclass[c.k].origColor = mclass[c.k].color
							mclass[c.k].color = colorValue
						},
						reset: {
							isVisible: () => mclass[c.k].origColor,
							callback: () => (mclass[c.k].color = mclass[c.k].origColor)
						}
					}
				]
				createLegendTipMenu(opts, tk, event.target)

				const descDiv = tk.legend.tip.d
					.append('div')
					.style('padding', '10px')
					.style('font-size', '.8em')
					.style('width', '150px')

				descDiv.append('span').style('color', color).text(label.toUpperCase())

				descDiv.append('div').style('color', 'black').html(desc)
			}
		})
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
	if (!data.skewer) return // when missing, do nothing. this is possible when server breaks at loading a subtk
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
	R.headerTd = R.row.append('td').style('text-align', 'right').style('opacity', 0.7).text('CNV')
	R.holder = R.row.append('td').style('padding-left', '10px')

	if (Number.isFinite(tk.cnv.cnvGainCutoff)) {
		// has the cutoff and cnv data uses numeric value; show colorscale

		// make all pieces that are arranged left to right inside <td>
		R.colorscaleHolder = R.holder.append('div') // visibility determined by if any segments are shown in view range
		R.colorscaleHolder.append('span').text('Loss').style('font-size', '.8em').style('opacity', 0.6) // "Loss" label on left of colorscale
		const csHolder = R.colorscaleHolder.append('span') // actual holder of colorscale
		R.colorscaleHolder.append('span').text('Gain').style('font-size', '.8em').style('opacity', 0.6) // "Gain" label on right of colorscale

		// initiate colorscale component
		const axisheight = 20
		const barheight = 15
		const xpad = 10
		const axiswidth = 150

		R.colorScale = new ColorScale({
			barwidth: axiswidth,
			barheight,
			colors: [tk.cnv.lossColor, 'white', tk.cnv.gainColor],
			domain: [-1, 0, 1], // actual domain added during update
			fontSize: 12,
			holder: csHolder,
			height: axisheight + barheight,
			width: xpad * 2 + axiswidth,
			position: `${xpad},${axisheight}`,
			ticks: 4,
			tickSize: 6,
			topTicks: true,
			numericInputs: {
				callback: obj => {
					if (obj.cutoffMode == 'auto') {
						delete tk.cnv.presetMax
					} else if (obj.cutoffMode == 'fixed') {
						tk.cnv.presetMax = Math.abs(obj.max)
					} else {
						throw 'unknown cutoffMode value'
					}
					tk.load()
				}
			}
		})
	} else {
		// cnv data uses category but not numeric value; fill category legend based on returned data
		R.cnvCategoryHolder = R.holder.append('span').attr('data-testid', 'sjpp-mds3cnvlegend-categoryholder')
	}

	R.noCnv = R.holder.append('div').text('No data').style('opacity', 0.6) // indicator there's no cnv in the region

	// following prompt will always be shown for cnv both using numeric value or not

	const menu = new Menu() // launched by prompt
	// prompt to show cnv filter stats. click prompt to show menu to adjust filter parameters
	R.cnvFilterPrompt = R.holder
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '10px')
		.style('font-size', '.9em')
		.attr('class', 'sja_clbtext')
		.on('click', () => {
			menu.clear().showunder(R.cnvFilterPrompt.node()) // TODO as this prompt is usually at bottom of page, best to show menu above prompt
			menu.d.append('div').text('Max segment length. Set 0 for not restricting by max length.')
			menu.d
				.append('input')
				.attr('type', 'number')
				.attr('value', Number.isFinite(tk.cnv.cnvMaxLength) ? tk.cnv.cnvMaxLength : 0)
				.on('change', event => {
					const v = Number(event.target.value)
					tk.cnv.cnvMaxLength = v <= 0 ? null : v
					menu.hide()
					tk.load()
				})
			if (Number.isFinite(tk.cnv.cnvGainCutoff)) {
				console.log('todo show prompt')
			}
		})
}

function may_update_cnv(tk) {
	if (!tk.cnv) return

	// tk is equipped with cnv. determine if cnv data is actually shown
	if (!tk.cnv.cnvLst || tk.cnv.cnvLst.length == 0) {
		// no cnv shown in this region. hide colorscale
		// possible for cnvLst to be missing! e.g. on server error
		tk.legend.cnv.colorscaleHolder?.style('display', 'none')
		tk.legend.cnv.cnvCategoryHolder?.style('display', 'none')

		// when cnvLst is missing, could be showing density instead of segments. in such case do not show noCnv message
		tk.legend.cnv.noCnv.style('display', tk.cnv.cnvInDensity ? 'none' : 'inline-block')
	} else {
		// has cnv showing; update legend with data contents
		tk.legend.cnv.noCnv.style('display', 'none')

		if (Number.isFinite(tk.cnv.cnvGainCutoff)) {
			// cnv uses numeric values
			tk.legend.cnv.colorscaleHolder.style('display', 'inline-block')
			// update colorscale
			tk.legend.cnv.colorScale.colors = [tk.cnv.lossColor, 'white', tk.cnv.gainColor]
			tk.legend.cnv.colorScale.domain = tk.cnv.presetMax
				? [-tk.cnv.presetMax, 0, tk.cnv.presetMax]
				: [-tk.cnv.absoluteMax, 0, tk.cnv.absoluteMax]
			tk.legend.cnv.colorScale.updateScale()
		} else {
			// uses categories
			if (!tk.hardcodeCnvOnly) {
				// !!! tricky !!!
				// not in cnv-only mode, the categories are already shown in Mutation legend section; do not duplicate legend here
			} else {
				// show legend in cnv-only mode
				tk.legend.cnv.cnvCategoryHolder.style('display', 'inline-block').selectAll('*').remove()

				const class2count = new Map()
				for (const c of tk.cnv.cnvLst) {
					if (!c.class) continue
					class2count.set(c.class, 1 + (class2count.get(c.class) || 0))
				}
				for (const [cls, count] of [...class2count].sort((i, j) => j[1] - i[1])) {
					printCategory({
						holder: tk.legend.cnv.cnvCategoryHolder,
						key: cls,
						label: mclass[cls].label,
						color: mclass[cls].color,
						count: count,
						click: event => {
							const opts = [
								{
									label: 'Hide',
									isVisible: () => true,
									callback: () => {
										// NOTE add hidden cnv class here and pass it to backend using existing method
										tk.legend.mclass.hiddenvalues.add(cls)
									}
								},
								{
									isChangeColor: true,
									value: mclass[cls].color,
									isVisible: () => true,
									callback: colorValue => {
										if (!mclass[cls].origColor) mclass[cls].origColor = mclass[cls].color
										mclass[cls].color = colorValue
									},
									reset: {
										isVisible: () => mclass[cls].origColor,
										callback: () => (mclass[cls].color = mclass[cls].origColor)
									}
								}
							]
							createLegendTipMenu(opts, tk, event.target)
						}
					})
				}

				for (const cls of tk.legend.mclass.hiddenvalues) {
					let loading = false
					tk.legend.cnv.cnvCategoryHolder
						.append('div')
						.style('display', 'inline-block')
						.attr('class', 'sja_clb')
						.style('text-decoration', 'line-through')
						.style('opacity', 0.7)
						.text(mclass[cls].label)
						.on('click', async event => {
							if (loading) return
							loading = true
							tk.legend.mclass.hiddenvalues.delete(cls)
							event.target.innerHTML = 'Updating...'
							await tk.load()
						})
				}
			}
		}
	}

	// update filter prompt. each applicable filter criteria generates a phrase. concatenated phrases are shown in prompt
	// must do this even if no cnv is shown, which could be caused by filter param and allow to change here
	const lst = [
		Number.isFinite(tk.cnv.cnvMaxLength) ? `segment length <= ${bplen(tk.cnv.cnvMaxLength)}` : 'no length limit'
	]
	tk.legend.cnv.cnvFilterPrompt.text(`Filter: ${lst.join(', ')}`)
}

function createLegendTipMenu(opts, tk, elem) {
	tk.legend.tip.clear().showunder(elem)

	for (const opt of opts) {
		if (opt.isVisible()) {
			if (opt.isChangeColor) {
				tk.legend.tip.d
					.append('div')
					.style('padding', '5px 10px')
					.style('display', 'inline-block')
					.text('Color:')
					.append('input')
					.attr('type', 'color')
					.property('value', rgb(opt.value).formatHex())
					.on('change', event => {
						const color = event.target.value
						opt.callback(color)
						reload(tk)
					})
				if (opt.reset && opt.reset?.isVisible()) {
					const resetDiv = tk.legend.tip.d.append('div').style('display', 'inline-block')
					const handler = () => {
						opt.reset.callback()
						reload(tk)
					}
					icons['restart'](resetDiv, { handler, title: 'Reset to original color' })
				}
			} else if (opt.isChangeShape) {
				let called = false
				const div = tk.legend.tip.d
					.append('div')
					.text('Change shape')
					.style('vertical-align', 'middle')
					/** Adding the class here for the hover effect
					 * Styles are repeated to maintain the appearance
					 * of the menu item after the class (aka hover
					 * effect) is removed.
					 */
					.classed('sja_menuoption', true)
					.style('padding', '5px 10px')
					.style('margin', '1px')
					.style('border-radius', '0px')
					.on('click', () => {
						div.classed('sja_menuoption', false)
						div.style('background-color', 'white')
						if (called == false) {
							called = true
							renderShapePicker({
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
					.style('border-radius', '0px')
					.text(opt.label)
					.on('click', () => {
						opt.callback()
						reload(tk)
					})
			}
		}
	}
}

// print an entry for a category as a legend item
function printCategory({ holder, key, color, count, label, click }) {
	const div = holder.append('div').attr('class', 'sja_clb').style('display', 'inline-block').on('click', click)
	div
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_mcdot')
		.style('background', color)
		.html(count > 1 ? count : '&nbsp;')
	div
		.append('div')
		.style('display', 'inline-block')
		.style('color', color)
		.style('padding-left', '5px')
		.attr('data-testid', 'sjpp-mds3tk-legenditemlabel')
		.attr('__key__', key) // for testing
		.text(label)
}
