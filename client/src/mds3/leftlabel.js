import { select as d3select, event as d3event } from 'd3-selection'
import { mclass } from '../../shared/common'
import { fillbar } from '../../dom/fillbar'
import { fold_glyph, settle_glyph } from './skewer.render'
import { itemtable } from './itemtable'
import { mayAddSkewerModeOption } from './skewer'

const labyspace = 5
const font = 'Arial'

/*
********************** EXPORTED
make_leftlabels
positionLeftlabelg
********************** INTERNAL
makelabel
mayMakeVariantLabel
	menu_variants
		listSkewerData
mayMakeSampleLabel
	menu_samples


make left labels on main track render
labels are based on server data
labels are kept persistent by keys in tk.leftlabels.doms{}
must call after rendering skewer track
must reset leftLabelMaxwidth

TODO may not update every label when only updating certain sub track
*/

export function make_leftlabels(data, tk, block) {
	tk.leftLabelMaxwidth = tk.tklabel.node().getBBox().width

	let laby = 0

	mayMakeVariantLabel(data, tk, block, laby)
	if (tk.leftlabels.doms.variants) laby += labyspace + block.labelfontsize

	mayMakeSampleLabel(data, tk, block, laby)
	if (tk.leftlabels.doms.samples) laby += labyspace + block.labelfontsize

	// done creating all possible left labels
	tk.leftlabels.laby = laby
	positionLeftlabelg(tk, block)

	for (const k in tk.leftlabels.doms) {
		tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, tk.leftlabels.doms[k].node().getBBox().width)
	}
	tk.subtk2height.leftlabels = laby + 20 // account for tk.tklabel
}

export function positionLeftlabelg(tk, block) {
	if (tk.leftlabels.laby == 0) {
		// no labels
		return
	}
	let x = 0
	if (tk.skewer) {
		const nm = tk.skewer.viewModes.find(i => i.inuse)
		if (nm.type == 'numeric') {
			// in numeric mode now, axis opens to left,
			// need to prevent left label from overlapping with axis
			// use y position of last label
			const lly = tk.leftlabels.laby + labyspace + block.labelfontsize
			if (lly > nm.toplabelheight - 10) {
				x = nm.axisWidth
			}
		}
	}
	tk.leftlabels.g.attr('transform', `translate(${-x},${labyspace + block.labelfontsize})`)
}

function makelabel(tk, block, y) {
	return tk.leftlabels.g
		.append('text')
		.attr('font-size', block.labelfontsize)
		.attr('font-family', font)
		.attr('y', block.labelfontsize / 2 + y)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('class', 'sja_clbtext2')
		.attr('fill', 'black')
		.attr('x', block.tkleftlabel_xshift)
}

/* for now data{} is no longer used! as mlst used for display is cached on client
if type=skewer, cached at tk.skewer.data
if type=numeric, cached at currentMode.data

may allow to show a different name instead of "variant"
*/
function mayMakeVariantLabel(data, tk, block, laby) {
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
			// quick fix to prevent gdc track to run variant2sample on too many ssm
			disable_variant2samples: true
		})
	}
}

function mayMakeSampleLabel(data, tk, block, laby) {
	if (!data.sampleTotalNumber) return
	// skewer subtrack is visible, create leftlabel based on #variants that is displayed/total
	if (!tk.leftlabels.doms.samples) {
		tk.leftlabels.doms.samples = makelabel(tk, block, laby)
	}
	tk.leftlabels.doms.samples
		.text(`${data.sampleTotalNumber} case${data.sampleTotalNumber > 1 ? 's' : ''}`)
		.on('click', () => {
			tk.menutip.clear().showunder(d3event.target)
			menu_samples(data, tk, block)
		})
}

function menu_samples(data, tk, block) {
	if (data.sampleTotalNumber < 10) {
		// list samples
	}
	tk.menutip.d
		.append('div')
		.text('Todo')
		.attr('class', 'sja_menuoption')
		.on('click', () => {})
}
