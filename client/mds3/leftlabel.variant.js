import { fold_glyph, settle_glyph } from './skewer.render'
import { may_render_skewer } from './skewer'
import { itemtable } from './itemtable'
import { makelabel, positionLeftlabelg } from './leftlabel'
import { to_textfile, Tabs, make_radios, shapes, shapeSelector } from '#dom'
import { rangequery_rglst } from './tk'
import { samples2columnsRows, block2source, findMbyId } from './sampletable'
import { dt2label, mclass, dtsnvindel, dtsv, dtcnv, dtfusionrna } from '#shared/common.js'

/*
variant label covers any data item rendered in a mds3 tk
if has tk.skewer{}
	if type=skewer, cached at tk.skewer.data
	if type=numeric, cached at currentMode.data
if has tk.cnv:
	get count from data.cnv[] as that's per segment
	but not tk.cnv.cnvLst as that's aggregated by sample
*/
export function makeVariantLabel(data, tk, block, laby) {
	// variant label covers skewer and cnv
	if (!tk.skewer && !tk.cnv) return
	// skewer and/or cnv subtrack available. will create this label

	if (!tk.leftlabels.doms.variants) {
		tk.leftlabels.doms.variants = makelabel(tk, block, laby)
		tk.leftlabels.doms.variants.attr('data-testid', 'sja_variants_label')
	}

	const [labeltext, totalcount, showcount] = getVariantLabelText(data, tk, block)

	if (totalcount == 0) {
		tk.leftlabels.doms.variants.text(labeltext).attr('class', '').style('opacity', 0.7).on('click', null)
		return
	}

	if (showcount == 0) {
		// has data but none displayed
		tk.leftlabels.doms.variants.text(labeltext).attr('class', '').style('opacity', 0.5).on('click', null)
		return
	}

	tk.leftlabels.doms.variants
		.style('opacity', 1) // restore style in case label was disabled
		.attr('class', 'sja_clbtext2')
		.text(labeltext)
		.on('click', event => {
			tk.menutip.clear().showunder(event.target)
			menu_variants(tk, block)
		})
}

export function getVariantLabelText(data, tk, block) {
	let totalcount = 0,
		showcount = 0
	const dtset = new Set() // count number of unique dt, to detect if visible data has only one dt, if so show new label

	if (tk.custom_variants) {
		// if custom list is available, total is defined by its array length
		totalcount = tk.custom_variants.length
		for (const m of tk.custom_variants) dtset.add(m.dt)
	} else {
		// no custom data but server returned data, get total from it
		if (tk.skewer?.rawmlst) {
			totalcount += tk.skewer.rawmlst.length
			for (const m of tk.skewer.rawmlst) dtset.add(m.dt)
		}
		if (data.cnv) {
			totalcount += data.cnv.cnvs.length
			for (const m of data.cnv.cnvs) dtset.add(m.dt)
		} else if (data.cnvDensity) {
			totalcount += data.cnvDensity.segmentCount
			dtset.add(dtcnv)
		}
	}

	if (totalcount == 0) return ['No data', 0, 0]

	// there is at least 1 variant shown. start to count those that are shown which could be less than totalcount

	if (tk.skewer) {
		const currentMode = tk.skewer.viewModes.find(i => i.inuse)
		/*
		out of total, only a subset may be plotted
		to count how many are plotted, check with mode type
		if type=skewer, plotted data are at tk.skewer.data[]
		else if type=numeric, plotted data are at tk.skewer.numericModes[?].data
		*/
		if (currentMode.type == 'skewer') {
			showcount = tk.skewer.data.filter(i => i.x >= 0 && i.x <= block.width).reduce((i, j) => i + j.mlst.length, 0)
		} else if (currentMode.type == 'numeric') {
			showcount = currentMode.data.filter(i => i.x >= 0 && i.x <= block.width).reduce((i, j) => i + j.mlst.length, 0)
		} else {
			throw 'unknown mode type'
		}
	}

	if (data.cnv) {
		// always count cnv when present, so as not to trigger "xx of yy" at variant label
		showcount += data.cnv.cnvs.length
	} else if (data.cnvDensity) {
		showcount += data.cnvDensity.segmentCount
	}

	// what to call the items: if only a single dt shown, call by its name; if items are of multiple dts, use generic name "variant"
	let vn = 'variant'
	if (dtset.size == 1) {
		const dt = [...dtset][0]
		if (dt == dtsnvindel) {
			// do not change. avoid using snv/indel, looks odd
		} else {
			vn = dt2label[dt]
		}
	}

	if (showcount == 0) {
		return [`0 out of ${totalcount} ${vn}${totalcount > 1 ? 's' : ''}`, totalcount, showcount]
	}

	return [
		showcount < totalcount
			? showcount + ' of ' + totalcount + ' ' + vn + 's'
			: showcount + ' ' + vn + (showcount > 1 ? 's' : ''),
		totalcount,
		showcount
	]
}

function menu_variants(tk, block) {
	// in case only showing cnv density but no skewer, disable all options from this menu as they do not apply to cnv density
	if ((!tk.skewer?.rawmlst || tk.skewer.rawmlst?.length == 0) && tk.cnv?.cnvInDensity) {
		tk.menutip.d
			.append('div')
			.style('margin', '10px')
			.text('Viewing CNV segment density, no information on individual segments.')
		if (tk.cnv.cnvMsg) {
			tk.menutip.d.append('div').style('margin', '10px').text(tk.cnv.cnvMsg)
		}
		return
	}
	const listDiv = tk.menutip.d
		.append('div')
		.text('List')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.attr('data-testid', 'sjpp_mds3tk_variantleftlabel_list')
		.attr('tabindex', 0)
		.on('click', () => {
			listVariantData(tk, block)
		})

	listDiv.node().focus()
	setTimeout(() => listDiv.node().blur(), 2000)

	if (tk.skewer && !tk.hardcodeCnvOnly) {
		// these are skewer-specific options, if hardcoded cnv-only, do not show;
		if (tk.skewer.hlssmid) {
			tk.menutip.d
				.append('div')
				.text('Cancel highlight')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('tabindex', 0)
				.on('click', () => {
					delete tk.skewer.hlssmid
					tk.skewer.hlBoxG.selectAll('*').remove()
					const currentMode = tk.skewer.viewModes.find(i => i.inuse)
					if (currentMode.type == 'skewer') {
						// have to rerender under skewer mode, to rearrange skewers
						settle_glyph(tk, block)
					} else if (currentMode.type == 'numeric') {
						// no need to rerender for numeric mode, the disks are fixed
					} else {
						throw 'unknown mode type'
					}
					tk.menutip.hide()
				})
		}

		const vm = tk.skewer.viewModes.find(n => n.inuse) // view mode that's in use. following menu options depends on it
		if (vm.type == 'skewer') {
			// show options related to skewer mode

			// showmode=1/0 means expanded/folded skewer, defined in skewer.render.js
			const expandCount = tk.skewer.data.reduce((i, j) => i + j.showmode, 0)
			if (expandCount > 0) {
				// has expanded skewer
				tk.menutip.d
					.append('div')
					.text('Collapse')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.attr('data-testid', 'sja_collapse_menuoption') // mds3tk_variantleftlabel_collapse
					.attr('tabindex', 0)
					.on('click', () => {
						fold_glyph(tk.skewer.data, tk)
						tk.menutip.hide()
					})
			} else if (expandCount == 0) {
				tk.menutip.d
					.append('div')
					.text('Expand')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.attr('data-testid', 'sja_expand_menuoption') // mds3tk_variantleftlabel_expand
					.attr('tabindex', 0)
					.on('click', () => {
						settle_glyph(tk, block)
						tk.menutip.hide()
					})
			}

			tk.menutip.d
				.append('div')
				.text(tk.skewer.pointup ? 'Point down' : 'Point up')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('tabindex', 0)
				.on('click', () => {
					tk.skewer.pointup = !tk.skewer.pointup
					tk.load()
					tk.menutip.hide()
				})

			// change variant shape option
			if (tk.filterObj) {
				let called = false
				const div = tk.menutip.d
					.append('div')
					.text('Change variant shape')
					.style('vertical-align', 'middle')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.attr('tabindex', 0)
					.on('click', () => {
						if (called == false) {
							called = true
							renderShapePicker({
								holder: div.append('div').style('margin-top', '10px'),
								callback: shape => {
									Object.keys(tk.shapes).forEach(key => {
										tk.shapes[key] = shape
									})
									tk.load()
									tk.menutip.hide()
								},
								tk
							})
						}
					})
			}
		} else if (vm.type == 'numeric') {
			// only show this opt in numeric mode; delete when label hiding works for skewer mode

			tk.menutip.d
				.append('div')
				.text(tk.skewer.hideDotLabels ? 'Show all variant labels' : 'Hide all variant labels')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('tabindex', 0)
				.on('click', () => {
					tk.skewer.hideDotLabels = !tk.skewer.hideDotLabels
					tk.load()
					tk.menutip.hide()
				})
		}
	}

	if (!tk.custom_variants) {
		// FIXME enable download for custom data
		tk.menutip.d
			.append('div')
			.text('Download')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.attr('tabindex', 0)
			.attr('data-testid', 'sjpp_mds3tk_variantdownload_menuoption')
			.on('click', () => {
				downloadVariants(tk, block)
				tk.menutip.hide()
			})
	}

	tk.menutip.d.on('keydown', function (event) {
		if (event.key != 'Enter' || !event.target.className.includes('sja_menuoption')) return
		event.target.dispatchEvent(new KeyboardEvent('click'))
	})

	mayAddSkewerModeOption(tk, block)
}

async function listVariantData(tk, block) {
	/* data: []
	each element {}:
	.x
	.mlst[]
		each m{}:
			.mname
			.class
	*/

	tk.menutip.clear()

	// TODO make reusable and supply contents to menu_variants() List
	// group variants by dt; for each group, render with itemtable()
	const dt2mlst = new Map()

	if (tk.skewer) {
		const currentMode = tk.skewer.viewModes.find(i => i.inuse)
		let data
		if (currentMode.type == 'skewer') {
			data = tk.skewer.data.filter(i => i.x >= 0 && i.x <= block.width)
		} else if (currentMode.type == 'numeric') {
			data = currentMode.data
		} else {
			throw 'unknown mode type'
		}
		for (const g of data) {
			for (const m of g.mlst) {
				if (!dt2mlst.has(m.dt)) dt2mlst.set(m.dt, [])
				dt2mlst.get(m.dt).push(m)
			}
		}
	}

	if (tk.cnv?.cnvLst?.length) {
		dt2mlst.set(dtcnv, tk.cnv.cnvLst)
	}

	if (dt2mlst.size == 1) {
		// only one dt
		const div = tk.menutip.d.append('div').style('margin', '10px')
		await itemtable({
			div,
			mlst: dt2mlst.get([...dt2mlst.keys()][0]),
			tk,
			block,
			doNotListSample4multim: true
		})
		return
	}

	// multiple dt
	const tabs = []
	for (const [dt, mlst] of dt2mlst) {
		tabs.push({ label: mlst.length + ' ' + dt2label[dt] })
	}
	new Tabs({
		holder: tk.menutip.d
			.append('div')
			.attr('class', 'sja_pp_vlb_dttabdiv') // for testing
			.style('margin', '10px'),
		tabs
	}).main()
	let i = 0
	for (const [dt, mlst] of dt2mlst) {
		itemtable({
			div: tabs[i++].contentHolder.append('div').style('margin-left', '10px'),
			mlst,
			tk,
			block,
			doNotListSample4multim: true
		})
	}
}

export function renderShapePicker(arg) {
	const lollipopShapes = {
		filledCircle: shapes.filledCircle,
		emptyCircle: shapes.emptyCircle,
		filledVerticalRectangle: shapes.filledVerticalRectangle,
		emptyVerticalRectangle: shapes.emptyVerticalRectangle,
		filledTriangle: shapes.filledTriangle,
		emptyTriangle: shapes.emptyTriangle,
		filledSquare: shapes.filledSquare,
		emptySquare: shapes.emptySquare
	}

	const { holder, callback, tk } = arg
	const shapePaths = Object.values(lollipopShapes).map(shape => shape.path)

	const selectorCallback = val => {
		const shape = Object.keys(lollipopShapes)[val]
		callback(shape, tk)
	}

	const opts = { backgroundColor: '' }

	shapeSelector(holder, selectorCallback, shapePaths, opts)
}

function mayAddSkewerModeOption(tk, block) {
	if (!tk.skewer) return
	if (tk.skewer.viewModes.length <= 1) {
		// only one possible mode, cannot toggle mode, do not add option
		return
	}
	// there are more than 1 mode, print name of current mode
	const options = []
	for (const [idx, v] of tk.skewer.viewModes.entries()) {
		const o = {
			label: getViewmodeName(v),
			value: idx
		}
		if (v.inuse) o.checked = true
		options.push(o)
	}
	make_radios({
		holder: tk.menutip.d
			.append('div')
			.attr('class', 'sja_pp_vlb_viewmoderadiodiv') // for testing
			.style('margin', '10px'),
		styles: {
			display: 'block'
		},
		options,
		callback: async idx => {
			for (const i of tk.skewer.viewModes) i.inuse = false
			tk.skewer.viewModes[idx].inuse = true
			may_render_skewer({ skewer: tk.skewer.rawmlst }, tk, block)
			positionLeftlabelg(tk, block)
			tk._finish()
		}
	})
}

function getViewmodeName(n) {
	if (!n) return 'MISSING!!'
	if (n.type == 'skewer') return 'As lollipops'
	if (n.type == 'numeric') return n.label + ' as Y axis'
	return 'unknown mode'
}

async function downloadVariants(tk, block) {
	if (!tk.mds.variant2samples) {
		console.log('TODO: variant-only')
		return
	}
	// call variant2samples.get() to get sample-level data
	const arg = {
		querytype: 'samples'
	}

	rangequery_rglst(tk, block, arg)

	// FIXME for custom_variants, somehow arg requries .mlst=[]

	const samples = (await tk.mds.variant2samples.get(arg)).samples
	/*
	array of sample objects
	each sample will have 1 or more variants
	*/

	const [columns, rows] = await samples2columnsRows(samples, tk)
	/*
	columns[] is array of text file columns
	rows[] is same length as samples[]

	to output text file:

	column with {isSsm=true} is skipped, and is replaced with adhoc columns 
	*/

	// header line of text file
	const headerline = []
	for (const c of columns) {
		if (c.isSsm) {
			// skip the field as the value is html; replace with sub fields
			headerline.push('AAchange')
			headerline.push('Consequence')
			headerline.push('Mutation')
			continue
		}
		if (c.isMaf) {
			// skip the field as the value is svg; replace with sub fields
			headerline.push('Alternative allele depth in tumor')
			headerline.push('Total depth in tumor')
			continue
		}
		headerline.push(c.label)
	}

	// one line for each mutation per sample, with the same set of columns as headerline
	const lines = []
	for (const [sidx, sample] of samples.entries()) {
		// sidx is used on rows[]

		let ssm_id_lst // a sample can have >= 1 mutations
		if (Array.isArray(sample.ssm_id_lst)) {
			ssm_id_lst = sample.ssm_id_lst
		} else if (sample.ssm_id) {
			ssm_id_lst = [sample.ssm_id]
		} else {
			console.log('sample obj lacks ssm_id and ssm_id_lst')
			continue
		}

		for (const ssmid of ssm_id_lst) {
			const m = findMbyId(ssmid, tk)
			if (!m) {
				console.log('ssm not found by id: ' + ssmid)
				continue
			}

			// create one line for this m{} from this sample{}

			const line = []

			for (const [cidx, c] of columns.entries()) {
				if (c.isSsm) {
					// skip the field as the value is html; replace with breakdown fields
					if (m.dt == dtsnvindel) {
						line.push(m.mname)
						line.push(mclass[m.class].label)
						line.push(m.chr + ':' + (m.pos + 1) + ' ' + m.ref + '>' + m.alt)
					} else if (m.dt == dtsv || m.dt == dtfusionrna) {
						line.push('')
						line.push(mclass[m.class].label)
						line.push(
							m.pairlst[0].a.chr + ':' + m.pairlst[0].a.pos + '>' + m.pairlst[0].b.chr + ':' + m.pairlst[0].b.pos
						)
					} else if (m.dt == dtcnv) {
						line.push(Number.isFinite(m.value) ? m.value : '')
						line.push(mclass[m.class].label)
						line.push(m.chr + ':' + (m.start + 1) + '-' + (m.stop + 1))
					} else {
						throw 'unknown m.dt'
					}
					continue
				}

				// the data cell returned by table builder
				const cell = rows[sidx][cidx]

				if (cell.bySsmid) {
					// value is per ssm
					if (ssmid in cell.bySsmid) {
						const v = cell.bySsmid[ssmid]
						if (c.isMaf) {
							line.push(v.altTumor)
							line.push(v.totalTumor)
						} else {
							line.push(v)
						}
					} else {
						// no value for this ssm
						line.push('')
					}
					continue
				}
				if (c.isMaf) {
					line.push(cell.altTumor)
					line.push(cell.totalTumor)
					continue
				}
				line.push(cell.value)
			}

			lines.push(line.join('\t'))
		}
	}
	to_textfile(
		block2source(block) + ' ' + new Date().toLocaleDateString() + '.txt',
		headerline.join('\t') + '\n' + lines.join('\n')
	)
}
