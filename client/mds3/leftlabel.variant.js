import { fold_glyph, settle_glyph } from './skewer.render'
import { may_render_skewer } from './skewer'
import { itemtable } from './itemtable'
import { makelabel, positionLeftlabelg } from './leftlabel'
import { to_textfile } from '#dom/downloadTextfile'
import { Tabs } from '../dom/toggleButtons'
import { make_radios } from '../dom/radiobutton'
import { rangequery_rglst } from './tk'
import { samples2columnsRows, block2source } from './sampletable'
import { dt2label, mclass, dtsnvindel, dtsv, dtcnv, dtfusionrna } from '#shared/common'
import { shapes } from '#dom/shapes'

/*
the "#variants" label should always be made as it is about any content displayed in mds3 track
(variant just refers to those dots!)

for now data{} is no longer used! as mlst used for display is cached on client
if type=skewer, cached at tk.skewer.data
if type=numeric, cached at currentMode.data

may allow to show a different name instead of "variant"
*/
export function makeVariantLabel(data, tk, block, laby) {
	// variant label covers skewer and cnv
	if (!tk.skewer && !tk.cnv) return

	// skewer subtrack is visible, create leftlabel based on #variants that is displayed/total
	if (!tk.leftlabels.doms.variants) {
		tk.leftlabels.doms.variants = makelabel(tk, block, laby)
		tk.leftlabels.doms.variants.attr('data-testid', 'sja_variants_label')
	}

	let totalcount, showcount

	if (tk.custom_variants) {
		// if custom list is available, total is defined by its array length
		totalcount = tk.custom_variants.length
	} else {
		// no custom data but server returned data, get total from it
		totalcount = tk.skewer.rawmlst.length + (data.cnv?.length || 0)
	}

	if (totalcount == 0) {
		tk.leftlabels.doms.variants.text('No variants').attr('class', '').style('opacity', 0.5).on('click', null)
		return
	}

	// there is at least 1 variant shown. start to count
	showcount = 0

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

	if (data.cnv) showcount += data.cnv.length // always count cnv when present, so as not to trigger "xx of yy" at variant label

	if (showcount == 0) {
		// has data but none displayed
		tk.leftlabels.doms.variants
			.text('0 out of ' + totalcount + ' variant' + (totalcount > 1 ? 's' : ''))
			.attr('class', '')
			.style('opacity', 0.5)
			.on('click', null)
		return
	}

	tk.leftlabels.doms.variants
		.style('opacity', 1) // restore style in case label was disabled
		.attr('class', 'sja_clbtext2')
		.text(
			showcount < totalcount
				? showcount + ' of ' + totalcount + ' variants'
				: showcount + ' variant' + (showcount > 1 ? 's' : '')
		)
		.on('click', event => {
			tk.menutip.clear().showunder(event.target)
			menu_variants(tk, block)
		})
	return
}

function menu_variants(tk, block) {
	tk.menutip.d
		.append('div')
		.text('List')
		.attr('class', 'sja_menuoption')
		.attr('data-testid', 'sja_list_menuoption') // FIXME mds3tk_variantleftlabel_list
		.style('border-radius', '0px')
		.on('click', () => {
			listVariantData(tk, block)
		})

	if (tk.skewer) {
		if (tk.skewer.hlssmid) {
			tk.menutip.d
				.append('div')
				.text('Cancel highlight')
				.style('border-radius', '0px')
				.attr('class', 'sja_menuoption')
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
					.attr('class', 'sja_menuoption')
					.attr('data-testid', 'sja_collapse_menuoption') // mds3tk_variantleftlabel_collapse
					.style('border-radius', '0px')
					.on('click', () => {
						fold_glyph(tk.skewer.data, tk)
						tk.menutip.hide()
					})
			} else if (expandCount == 0) {
				tk.menutip.d
					.append('div')
					.text('Expand')
					.attr('class', 'sja_menuoption')
					.attr('data-testid', 'sja_expand_menuoption') // mds3tk_variantleftlabel_expand
					.style('border-radius', '0px')
					.on('click', () => {
						settle_glyph(tk, block)
						tk.menutip.hide()
					})
			}

			tk.menutip.d
				.append('div')
				.text(tk.skewer.pointup ? 'Point down' : 'Point up')
				.attr('class', 'sja_menuoption')
				.style('border-radius', '0px')
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
					.attr('class', 'sja_menuoption')
					.on('click', () => {
						if (called == false) {
							called = true
							displayVectorGraphics({
								holder: div.append('div').style('margin-top', '10px'),
								callbacks: {
									onShapeClick: onShapeClick
								},
								tk: tk
							})
						}
					})
			} else return

			function displayVectorGraphics(arg) {
				const desiredShapes = { ...shapes }
				const { holder, callbacks, tk } = arg

				// Set default shape for load and create a toggle
				// to switch back to default lollipop when another
				// shape is selected
				if (!tk.skewer.shape) tk.skewer.shape = Object.entries(desiredShapes)[0]
				if (tk.skewer?.shape?.[1]?.isDefault === true) {
					delete desiredShapes['filledCircle']
				}

				const vectorGraphicsDiv = holder.append('div')
				vectorGraphicsDiv
					.append('div')
					.style('display', 'flex')
					.style('flex-direction', 'row')
					.style('align-items', 'center')
					.style('justify-content', 'center')
					.style('border', 'none')
					.style('width', '100%')
					.style('font-size', '20px')
					.style('margin-top', '5px')

				const shapesContainer = vectorGraphicsDiv
					.append('div')
					.style('display', 'flex')
					.style('flex-wrap', 'wrap')
					.style('width', 'max-content')

				Object.entries(desiredShapes).forEach((val, idx) => {
					const shapeWrapper = shapesContainer.append('div').style('padding', '0px 2px')
					const width = 18
					const height = 18
					const shapeSvg = shapeWrapper
						.append('svg')
						.attr('width', width)
						.attr('height', height)
						.attr('viewBox', `0 0 ${width} ${height}`)
						.style('cursor', 'pointer')
						.on('click', () => {
							if (callbacks && typeof callbacks.onShapeClick === 'function') {
								callbacks.onShapeClick(val, tk)
							}
						})
					shapeSvg
						.append('path')
						.attr('d', val[1].path)
						.attr('fill', val[1].isFilled ? 'black' : 'none')
						.attr('stroke', 'black')
				})
			}

			function onShapeClick(val, tk) {
				// Logic to change the pre-existing shape to the chosen shape
				tk.skewer.shape = val
				tk.load()
				tk.menutip.hide()
			}
		} else if (vm.type == 'numeric') {
			// only show this opt in numeric mode; delete when label hiding works for skewer mode

			tk.menutip.d
				.append('div')
				.text(tk.skewer.hideDotLabels ? 'Show all variant labels' : 'Hide all variant labels')
				.attr('class', 'sja_menuoption')
				.style('border-radius', '0px')
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
			.attr('class', 'sja_menuoption')
			.attr('data-testid', 'sjpp_mds3tk_variantdownload_menuoption')
			.style('border-radius', '0px')
			.on('click', () => {
				downloadVariants(tk, block)
				tk.menutip.hide()
			})
	}

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

	if (tk.cnv?.cnvLst) {
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
			const m = tk.skewer.rawmlst.find(i => i.ssm_id == ssmid)
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
