import { event as d3event } from 'd3-selection'
import { fold_glyph, settle_glyph } from './skewer.render'
import { itemtable } from './itemtable'
import { mayAddSkewerModeOption } from './skewer'
import { makelabel } from './leftlabel'

/* for now data{} is no longer used! as mlst used for display is cached on client
if type=skewer, cached at tk.skewer.data
if type=numeric, cached at currentMode.data

may allow to show a different name instead of "variant"
*/
export function mayMakeVariantLabel(data, tk, block, laby) {
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

	// should simply list variants in a table
	// group variants by dt; for each group, render with itemtable()

	const dt2mlst = new Map()
	for (const g of data) {
		for (const m of g.mlst) {
			if (!dt2mlst.has(m.dt)) dt2mlst.set(m.dt, [])
			dt2mlst.get(m.dt).push(m)
		}
	}

	for (const mlst of dt2mlst.values()) {
		const div = tk.menutip.d.append('div').style('margin', '10px')
		await itemtable({
			div,
			mlst,
			tk,
			block,
			// quick fix to prevent gdc track to run variant2samples on too many ssm
			disable_variant2samples: true
		})
	}
}
