import { event as d3event } from 'd3-selection'
import { fold_glyph, settle_glyph } from './skewer.render'
import { may_render_skewer } from './skewer'
import { itemtable } from './itemtable'
import { makelabel, positionLeftlabelg } from './leftlabel'
import { tab2box } from '../src/client'
import { dt2label } from '#shared/common'

/*
the "#variants" label should always be made as it is about any content displayed in mds3 track

for now data{} is no longer used! as mlst used for display is cached on client
if type=skewer, cached at tk.skewer.data
if type=numeric, cached at currentMode.data

may allow to show a different name instead of "variant"
*/
export function makeVariantLabel(data, tk, block, laby) {
	// TODO while skewer data is optional for a mds3 track,
	// later should check other non-skewer data types too
	if (!tk.skewer) return

	// skewer subtrack is visible, create leftlabel based on #variants that is displayed/total
	if (!tk.leftlabels.doms.variants) {
		tk.leftlabels.doms.variants = makelabel(tk, block, laby)
	}

	const currentMode = tk.skewer.viewModes.find(i => i.inuse)

	let totalcount, showcount

	if (tk.custom_variants) {
		// if custom list is available, total is defined by its array length
		totalcount = tk.custom_variants.length
	} else {
		// no custom data but server returned data, get total from it
		totalcount = tk.skewer.rawmlst.length
	}

	if (totalcount == 0) {
		tk.leftlabels.doms.variants
			.text('No variants')
			.attr('class', '')
			.style('opacity', 0.5)
			.on('click', null)
		return
	}

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
		.on('click', () => {
			tk.menutip.clear().showunder(d3event.target)
			menu_variants(tk, block)
		})
	return
}

function menu_variants(tk, block) {
	tk.menutip.d
		.append('div')
		.text('List')
		.attr('class', 'sja_menuoption')
		.on('click', () => {
			listSkewerData(tk, block)
		})

	if (tk.skewer.hlssmid) {
		tk.menutip.d
			.append('div')
			.text('Cancel highlight')
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

	if (tk.skewer.viewModes.find(n => n.inuse).type == 'skewer') {
		// showmode=1/0 means expanded/folded skewer, defined in skewer.render.js
		const expandCount = tk.skewer.data.reduce((i, j) => i + j.showmode, 0)
		if (expandCount > 0) {
			// has expanded skewer
			tk.menutip.d
				.append('div')
				.text('Fold')
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					fold_glyph(tk.skewer.data, tk)
					tk.menutip.hide()
				})
		} else if (expandCount == 0) {
			tk.menutip.d
				.append('div')
				.text('Expand')
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					settle_glyph(tk, block)
					tk.menutip.hide()
				})
		}
	}

	mayAddSkewerModeOption(tk, block)
}

async function listSkewerData(tk, block) {
	/* data: []
	each element {}:
	.x
	.mlst[]
		each m{}:
			.mname
			.class
	*/
	const currentMode = tk.skewer.viewModes.find(i => i.inuse)
	let data
	if (currentMode.type == 'skewer') {
		data = tk.skewer.data.filter(i => i.x >= 0 && i.x <= block.width)
	} else if (currentMode.type == 'numeric') {
		data = currentMode.data
	} else {
		throw 'unknown mode type'
	}

	tk.menutip.clear()

	// group variants by dt; for each group, render with itemtable()

	const dt2mlst = new Map()
	for (const g of data) {
		for (const m of g.mlst) {
			if (!dt2mlst.has(m.dt)) dt2mlst.set(m.dt, [])
			dt2mlst.get(m.dt).push(m)
		}
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
		tabs.push({
			label: mlst.length + ' ' + dt2label[dt],
			callback: div => {
				itemtable({
					div,
					mlst,
					tk,
					block,
					doNotListSample4multim: true
				})
			}
		})
	}
	tab2box(tk.menutip.d.append('div').style('margin', '10px'), tabs)
}

function mayAddSkewerModeOption(tk, block) {
	if (!tk.skewer) return
	if (tk.skewer.viewModes.length <= 1) {
		// only one possible mode, cannot toggle mode, do not add option
		return
	}
	// there are more than 1 mode, print name of current mode
	tk.menutip.d
		.append('div')
		.style('margin', '10px 10px 3px 10px')
		.style('font-size', '.7em')
		.style('opacity', 0.5)
		.text(getViewmodeName(tk.skewer.viewModes.find(n => n.inuse)))
	// show available modes
	for (const n of tk.skewer.viewModes) {
		if (n.inuse) continue
		// a mode not in use; make option to switch to it
		tk.menutip.d
			.append('div')
			.text(getViewmodeName(n))
			.attr('class', 'sja_menuoption')
			.on('click', () => {
				for (const i of tk.skewer.viewModes) i.inuse = false
				n.inuse = true
				tk.menutip.hide()
				may_render_skewer({ skewer: tk.skewer.rawmlst }, tk, block)
				positionLeftlabelg(tk, block)
				tk._finish()
			})
	}
}

function getViewmodeName(n) {
	if (!n) return 'MISSING!!'
	if (n.type == 'skewer') return 'As lollipops'
	if (n.type == 'numeric') return n.label + ' as Y axis'
	return 'unknown mode'
}
