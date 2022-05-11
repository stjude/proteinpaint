import { select as d3select, event as d3event } from 'd3-selection'
import { mclass } from '../../shared/common'
import { fillbar } from '../client'
import { fold_glyph, settle_glyph } from './skewer.render'
import { itemtable } from './itemtable'

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
stratifymenu_genecnv
*/

/*
make left labels on main track render
labels are based on server data
TODO may not update every label when only updating certain sub track
*/

export function make_leftlabels(data, tk, block) {
	// must call after rendering skewer track
	// prior labels are erased
	tk.leftlabelg.selectAll('*').remove()
	// must reset leftLabelMaxwidth
	tk.leftLabelMaxwidth = tk.tklabel.node().getBBox().width

	let laby = labyspace + block.labelfontsize

	const labels = [] // for max width

	{
		const lab = mayMakeVariantLabel(data, tk, block, laby)
		if (lab) {
			labels.push(lab)
			laby += labyspace + block.labelfontsize
		}
	}

	if (data.genecnvNosample) {
		// quick fix; only for genecnv with no sample level info
		// should be replaced with just one multi-row label showing #variants, #cnv and click for a menu for collective summary
		const lab = makelabel(tk, block, laby)
			.text(
				data.genecnvNosample.reduce((i, j) => i + j.loss, 0) +
					' loss, ' +
					data.genecnvNosample.reduce((i, j) => i + j.gain, 0) +
					' gain'
			)
			.on('click', () => {
				tk.tktip.clear().showunder(d3event.target)
				stratifymenu_genecnv(data.genecnvNosample, tk, block)
			})
		laby += labyspace + block.labelfontsize
		labels.push(lab)
	}
	if (data.sampleSummaries) {
		for (const strat of data.sampleSummaries) {
			const showcount = strat.items.reduce((i, j) => i + (j.mclasses ? 1 : 0), 0)
			const lab = makelabel(tk, block, laby)
				.text(showcount + ' ' + strat.label + (showcount > 1 ? 's' : ''))
				.on('click', () => {
					tk.tktip.clear().showunder(d3event.target)
					stratifymenu_samplesummary(strat, tk, block)
				})
			laby += labyspace + block.labelfontsize
			labels.push(lab)
		}
	}
	if (data.sampleSummaries2) {
		for (const l of data.sampleSummaries2) {
			const lab = makelabel(tk, block, laby)
				.text(l.count + ' ' + l.label1 + (l.count > 1 ? 's' : ''))
				.on('click', async () => {
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
			labels.push(lab)
		}
	}
	for (const l of labels) {
		tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, l.node().getBBox().width)
	}
	return laby
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

function mayMakeVariantLabel(data, tk, block, laby) {
	// may allow to show a different name instead of "variant"

	if (!tk.skewer) return

	// skewer subtrack is visible, create leftlabel based on #variants that is displayed/total
	const lab = makelabel(tk, block, laby)

	let totalcount, showcount

	if (tk.custom_variants) {
		// if custom list is available, total is defined by its array length
		totalcount = tk.custom_variants.length
	} else if (data.skewer) {
		// no custom data but server returned data, get total from it
		totalcount = data.skewer.length
	} else {
		/* messy way to get total number of data points
		when it's updating in protein mode, client may not re-request data from server
		and data.skewer will be missing
		still the total data is kept on client
		*/
		if (tk.skewer.mode == 'skewer') {
			totalcount = tk.skewer.data.reduce((i, j) => i + j.mlst.length, 0)
		} else {
			throw 'do not know how to handle'
		}
	}

	if (totalcount == 0) {
		lab
			.text('No variants')
			.attr('class', '')
			.style('opacity', 0.5)
		return lab
	}

	/*
	out of total, only a subset may be plotted
	to count how many are plotted, check with skewer.mode
	if mode=skewer, plotted data are at tk.skewer.data[]
	else if mode=numeric, plotted data are at tk.numericmode.data
	*/
	if (tk.skewer.mode == 'skewer') {
		showcount = tk.skewer.data.filter(i => i.x >= 0 && i.x <= block.width).reduce((i, j) => i + j.mlst.length, 0)
	} else if (tk.skewer.mode == 'numeric') {
		showcount = tk.numericmode.data.reduce((i, j) => i + j.mlst.length, 0)
	} else {
		throw 'unknown skewer.mode'
	}

	if (showcount == 0) {
		// has data but none displayed
		lab
			.text('0 out of ' + totalcount + ' variant' + (totalcount > 1 ? 's' : ''))
			.attr('class', '')
			.style('opacity', 0.5)
		return lab
	}

	lab.text(
		showcount < totalcount
			? showcount + ' of ' + totalcount + ' variants'
			: showcount + ' variant' + (showcount > 1 ? 's' : '')
	)
	lab.on('click', () => {
		tk.menutip.clear().showunder(d3event.target)
		menu_variants(tk, block)
	})
	return lab
}

function menu_variants(tk, block) {
	tk.menutip.d
		.append('div')
		.text('List')
		.attr('class', 'sja_menuoption')
		.on('click', () => {
			listSkewerData(tk, block)
		})

	if (tk.skewer.mode == 'skewer') {
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
	const data =
		tk.skewer.mode == 'skewer' ? tk.skewer.data.filter(i => i.x >= 0 && i.x <= block.width) : tk.numericmode.data

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

function stratifymenu_genecnv(dat, tk, block) {
	// quick fix, will abandon when getting sample-level cnv data
	// dat[] is .genecnvNosample from server
	const m = dat[0]
	const maxf = (m.gain + m.loss) / m.total
	const frac2width = f => (100 * f) / maxf
	// scrollable table with fixed header
	const staydiv = tk.tktip.d
		.append('div')
		.style('position', 'relative')
		.style('padding-top', '20px')
	const scrolldiv = staydiv.append('div').style('overflow-y', 'scroll')
	if (dat.length > 20) {
		scrolldiv.style('height', '400px').style('resize', 'vertical')
	}
	const table = scrolldiv.append('table')
	const tr = table
		.append('tr')
		.style('font-size', '.9em')
		.style('color', '#858585')
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('Project') // XXX hardcoded!
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('Max: ' + Math.ceil(100 * maxf) + '%')
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('Loss/Gain/Total')
	for (const item of dat) {
		const tr = table.append('tr').attr('class', 'sja_clb')
		tr.append('td').text(item.label)
		const td = tr.append('td')
		if (item.loss) {
			td.append('div')
				.style('background', tk.mds.queries.genecnv.losscolor)
				.style('display', 'inline-block')
				.style('width', frac2width(item.loss / item.total) + 'px')
				.style('height', '15px')
		}
		if (item.gain) {
			td.append('div')
				.style('background', tk.mds.queries.genecnv.gaincolor)
				.style('display', 'inline-block')
				.style('width', frac2width(item.gain / item.total) + 'px')
				.style('height', '15px')
		}
		tr.append('td').html(
			'<span style="color:' +
				tk.mds.queries.genecnv.losscolor +
				'">' +
				item.loss +
				'</span>\t\t' +
				'<span style="color:' +
				tk.mds.queries.genecnv.gaincolor +
				'">' +
				item.gain +
				'</span>\t\t' +
				'<span style="opacity:.5;font-size:.8em">' +
				item.total +
				'</span>'
		)
	}
}
