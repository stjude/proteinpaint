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
********************** INTERNAL
makelabel
mayMakeVariantLabel
	menu_variants
		listSkewerData
stratifymenu_samplesummary
*/

/*
make left labels on main track render
labels are based on server data
labels are kept persistent by keys in tk.leftlabels{}
must call after rendering skewer track
must reset leftLabelMaxwidth

TODO may not update every label when only updating certain sub track
*/

export function make_leftlabels(data, tk, block) {
	tk.leftLabelMaxwidth = tk.tklabel.node().getBBox().width

	let laby = labyspace + block.labelfontsize

	mayMakeVariantLabel(data, tk, block, laby)
	if (tk.leftlabels.variants) laby += labyspace + block.labelfontsize

	if (data.sampleSummaries) {
		for (const strat of data.sampleSummaries) {
			if (!tk.leftlabels[strat.label]) {
				tk.leftlabels[strat.label] = makelabel(tk, block, laby)
			}
			const showcount = strat.items.reduce((i, j) => i + (j.mclasses ? 1 : 0), 0)
			tk.leftlabels[strat.label].text(showcount + ' ' + strat.label + (showcount > 1 ? 's' : '')).on('click', () => {
				tk.tktip.clear().showunder(d3event.target)
				stratifymenu_samplesummary(strat, tk, block)
			})
			laby += labyspace + block.labelfontsize
		}
	}

	if (data.sampleSummaries2) {
		for (const l of data.sampleSummaries2) {
			if (!tk.leftlabels[l.label1]) tk.leftlabels[l.label1] = makelabel(tk, block, laby)
			tk.leftlabels[l.label1].text(l.count + ' ' + l.label1 + (l.count > 1 ? 's' : '')).on('click', async () => {
				const wait = tk.tktip
					.clear()
					.showunder(d3event.target)
					.d.append('div')
					.text('Loading...')
				try {
					const config = tk.mds.sampleSummaries2.lst.find(i => i.label1 == l.label1)
					if (!config) throw 'not found: ' + l.label1
					const data = await tk.mds.sampleSummaries2.get(config)
					if (data.error) throw data.error
					wait.remove()
					stratifymenu_samplesummary(data.strat, tk, block)
				} catch (e) {
					wait.text('Error: ' + (e.message || e))
				}
			})
			laby += labyspace + block.labelfontsize
		}
	}
	// done creating all possible left labels
	for (const k in tk.leftlabels) {
		tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, tk.leftlabels[k].node().getBBox().width)
	}
	tk.subtk2height.leftlabels = laby
}

function makelabel(tk, block, y) {
	return tk.leftlabelg
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
	if (!tk.leftlabels.variants) {
		tk.leftlabels.variants = makelabel(tk, block, laby)
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
		tk.leftlabels.variants
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
		tk.leftlabels.variants
			.text('0 out of ' + totalcount + ' variant' + (totalcount > 1 ? 's' : ''))
			.attr('class', '')
			.style('opacity', 0.5)
			.on('click', null)
		return
	}

	tk.leftlabels.variants
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

function stratifymenu_samplesummary(strat, tk, block) {
	// strat is one of .sampleSummaries[] from server
	// scrollable table with fixed header
	const staydiv = tk.tktip.d
		.append('div')
		.style('position', 'relative')
		.style('padding-top', '20px')
	const scrolldiv = staydiv.append('div')
	{
		const catcount =
			(tk.samplefiltertemp[strat.label] ? tk.samplefiltertemp[strat.label].length : 0) +
			strat.items.reduce((i, j) => i + 1 + (j.label2 ? j.label2.length : 0), 0)
		if (catcount > 20) {
			scrolldiv
				.style('overflow-y', 'scroll')
				.style('height', '400px')
				.style('resize', 'vertical')
		}
	}
	const table = scrolldiv.append('table')
	const tr = table
		.append('tr')
		.style('font-size', '.9em')
		.style('color', '#858585')
	// 1 - checkbox
	tr.append('td')
	// 2 - category label
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text(strat.label.toUpperCase())
	const hascohortsize = strat.items[0].cohortsize != undefined
	if (hascohortsize) {
		// 3 - percent bar, for those variants shown
		tr.append('td')
			.append('div')
			.style('position', 'absolute')
			.style('top', '0px')
			.text('%SHOWN')
	}
	{
		// 4 - samples, for those variants shown
		const td = tr.append('td')
		if (!hascohortsize) {
			// no percent column, print label for this column
			td.append('div')
				.style('position', 'absolute')
				.style('top', '0px')
				.text('SHOWN')
		}
	}
	// 5 - shown mclass
	tr.append('td')
	/*
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('MUTATIONS')
		*/
	/*
	let hashidden = false
	for (const i of strat.items) {
		if (i.hiddenmclasses) {
			hashidden = true
		}
		if (i.label2) {
			for (const j of i.label2) {
				if (j.hiddenmclasses) {
					hashidden = true
				}
			}
		}
	}
	if (hashidden) {
		// 6 - hidden samples
		// 7 - hidden mclass
		tr.append('td')
			.append('div')
			.style('position', 'absolute')
			.style('top', '0px')
			.text('HIDDEN')
	}
	*/
	for (const item of strat.items) {
		fillrow(item)
		if (item.label2) {
			for (const i of item.label2) {
				fillrow(i, true)
			}
		}
	}

	// hidden categories
	if (tk.samplefiltertemp && tk.samplefiltertemp[strat.label]) {
		for (const label of tk.samplefiltertemp[strat.label]) {
			fillrow({ label })
		}
	}

	const row = tk.tktip.d.append('div').style('margin-top', '15px')
	row
		.append('button')
		.text('Submit')
		.style('margin-right', '5px')
		.on('click', () => {
			const lst = table.node().getElementsByTagName('input')
			const unchecked = []
			for (const i of lst) {
				if (!i.checked) unchecked.push(i.getAttribute('category'))
			}
			if (unchecked.length == lst.length) return window.alert('Please check at least one option.')
			tk.samplefiltertemp[strat.label] = unchecked.length ? unchecked : undefined
			tk.tktip.hide()
			tk.uninitialized = true
			tk.load()
		})
	row
		.append('span')
		.text('Check_all')
		.attr('class', 'sja_clbtext2')
		.style('margin-right', '10px')
		.on('click', () => {
			for (const i of table.node().getElementsByTagName('input')) {
				i.checked = true
			}
		})
	row
		.append('span')
		.text('Clear')
		.attr('class', 'sja_clbtext2')
		.style('margin-right', '5px')
		.on('click', () => {
			for (const i of table.node().getElementsByTagName('input')) {
				i.checked = false
			}
		})

	function fillrow(item, issub) {
		const tr = table.append('tr').attr('class', 'sja_clb')

		let cbid
		{
			const td = tr.append('td')
			if (!issub) {
				// only make checkbox for first level, not sub level
				cbid = Math.random().toString()
				// checkbox
				td.append('input')
					.attr('type', 'checkbox')
					.attr('id', cbid)
					.property(
						'checked',
						!tk.samplefiltertemp[strat.label] || !tk.samplefiltertemp[strat.label].includes(item.label)
					)
					.attr('category', item.label)
			}
		}
		tr.append('td')
			.append('label')
			.text(item.label)
			.attr('for', cbid)
			.style('padding-left', issub ? '10px' : '0px')
			.style('font-size', issub ? '.8em' : '1em')
		if (hascohortsize) {
			const td = tr.append('td')
			if (item.cohortsize != undefined) {
				fillbar(
					td,
					{ f: item.samplecount / item.cohortsize, v1: item.samplecount, v2: item.cohortsize },
					{ fillbg: '#ECE5FF', fill: '#9F80FF' }
				)
			}
		}
		{
			const td = tr.append('td')
			if (item.samplecount != undefined) {
				td.text(item.samplecount + (item.cohortsize ? ' / ' + item.cohortsize : '')).style('font-size', '.7em')
			}
		}
		const td = tr.append('td')
		if (item.mclasses) {
			for (const [thisclass, count] of item.mclasses) {
				td.append('span')
					.html(count == 1 ? '&nbsp;' : count)
					.style('background-color', mclass[thisclass].color)
					.attr('class', 'sja_mcdot')
			}
		}
		/*
		if (hashidden) {
			const td = tr.append('td')
			if (item.hiddenmclasses) {
				for (const [mclass, count] of item.hiddenmclasses) {
					td.append('span')
						.html(count == 1 ? '&nbsp;' : count)
						.style('background-color', mclass[mclass].color)
						.attr('class', 'sja_mcdot')
				}
			}
		}
		*/
	}
}
