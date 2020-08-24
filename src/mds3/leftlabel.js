import { select as d3select, event as d3event } from 'd3-selection'
import * as common from '../common'
import * as client from '../client'

const labyspace = 5

/*
make left labels on main track render
labels are based on server data
TODO may not update every label when only updating certain sub track
*/

export function make_leftlabels(data, tk, block) {
	// must call after rendering skewer track
	tk.leftlabelg.selectAll('*').remove()
	let laby = labyspace + block.labelfontsize

	const labels = [] // for max width

	{
		// variant count may combine genecnv and skewer, and show sublabels under main
		const lab = makelabel(tk, block, laby)
		const variantcount = tk.skewer.data.reduce((i, j) => i + j.mlst.length, 0)
		if (variantcount == 0) {
			// hide label
			lab
				.text('No variants')
				.attr('class', '')
				.style('opacity', 0.5)
		} else {
			if (data.skewer) {
				lab.text(
					variantcount < data.skewer.length
						? variantcount + ' of ' + data.skewer.length + ' variants'
						: variantcount + ' variant' + (variantcount > 1 ? 's' : '')
				)
			} else {
				lab.text(variantcount + ' variant' + (variantcount > 1 ? 's' : ''))
			}
			lab.on('click', () => {
				tk.tktip.clear().showunder(d3event.target)
				menu_mclass(data, tk, block)
			})
		}
		labels.push(lab)
	}

	laby += labyspace + block.labelfontsize
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
			const lab = makelabel(tk, block, laby)
				.text(strat.items.length + ' ' + strat.label + (strat.items.length > 1 ? 's' : ''))
				.on('click', () => {
					tk.tktip.clear().showunder(d3event.target)
					stratifymenu_samplesummary(strat, tk, block)
				})
			laby += labyspace + block.labelfontsize
			labels.push(lab)
		}
	}
	for (const l of labels) {
		l.each(function() {
			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
		})
	}
	return laby
}

function makelabel(tk, block, y) {
	return tk.leftlabelg
		.append('text')
		.attr('font-size', block.labelfontsize)
		.attr('font-family', client.font)
		.attr('y', block.labelfontsize / 2 + y)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('class', 'sja_clbtext2')
		.attr('fill', 'black')
		.attr('x', block.tkleftlabel_xshift)
}

function menu_mclass(data, tk, block) {
	const checkboxdiv = tk.tktip.d.append('div').style('margin-bottom', '10px')
	for (const [mclass, count] of data.mclass2variantcount) {
		addrow(mclass, count)
	}
	// show hidden mclass without a server-returned count
	for (const s of tk.hiddenmclass) {
		if (data.mclass2variantcount.find(i => i[0] == s)) continue
		addrow(s, 0)
	}

	const row = tk.tktip.d.append('div')
	row
		.append('button')
		.text('Submit')
		.style('margin-right', '5px')
		.on('click', () => {
			const lst = checkboxdiv.node().getElementsByTagName('input')
			const unchecked = []
			for (const i of lst) {
				if (!i.checked) unchecked.push(i.getAttribute('mclass'))
			}
			if (unchecked.length == lst.length) return window.alert('Please check at least one option.')
			tk.hiddenmclass = new Set(unchecked)
			tk.tktip.hide()
			tk.unitiated = true
			tk.load()
		})
	row
		.append('span')
		.text('Check_all')
		.attr('class', 'sja_clbtext2')
		.style('margin-right', '10px')
		.on('click', () => {})
	row
		.append('span')
		.text('Clear')
		.attr('class', 'sja_clbtext2')
		.style('margin-right', '5px')
		.on('click', () => {})

	function addrow(mclass, count) {
		const row = checkboxdiv.append('div')
		const label = row.append('label')
		label
			.append('input')
			.attr('type', 'checkbox')
			.property('checked', !tk.hiddenmclass.has(mclass))
			.attr('mclass', mclass)
		label
			.append('span')
			.style('margin-left', '8px')
			.style('padding', '0px 6px')
			.style('border-radius', '6px')
			.style('background', common.mclass[mclass].color)
			.style('color', 'white')
			.style('font-size', '.8em')
			.text(count)
		label
			.append('span')
			.style('margin-left', '8px')
			.text(common.mclass[mclass].label)
			.style('color', common.mclass[mclass].color)
	}
}

function stratifymenu_samplesummary(strat, tk, block) {
	// strat is one of .sampleSummaries[] from server
	// scrollable table with fixed header
	const staydiv = tk.tktip.d
		.append('div')
		.style('position', 'relative')
		.style('padding-top', '20px')
	const scrolldiv = staydiv.append('div').style('overflow-y', 'scroll')
	if (strat.items.reduce((i, j) => i + 1 + (j.label2 ? j.label2.length : 0), 0) > 20) {
		scrolldiv.style('height', '400px').style('resize', 'vertical')
	}
	const table = scrolldiv.append('table')
	// 4 columns
	const tr = table
		.append('tr')
		.style('font-size', '.9em')
		.style('color', '#858585')
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text(strat.label.toUpperCase())
	const hascohortsize = strat.items[0].cohortsize != undefined
	if (hascohortsize) {
		tr.append('td')
			.append('div')
			.style('position', 'absolute')
			.style('top', '0px')
			.text('%')
	}
	tr.append('td')
	/*
		.append('div')
		.style('position','absolute')
		.style('top','0px')
		.text('SAMPLES')
		*/
	tr.append('td')
		.append('div')
		.style('position', 'absolute')
		.style('top', '0px')
		.text('MUTATIONS')
	for (const item of strat.items) {
		fillrow(item)
		if (item.label2) {
			for (const i of item.label2) {
				fillrow(i, true)
			}
		}
	}
	function fillrow(item, issub) {
		const tr = table.append('tr').attr('class', 'sja_clb')
		tr.append('td')
			.text(item.label)
			.style('padding-left', issub ? '10px' : '0px')
			.style('font-size', issub ? '.8em' : '1em')
		if (hascohortsize) {
			const td = tr.append('td')
			if (item.cohortsize != undefined) {
				client.fillbar(
					td,
					{ f: item.samplecount / item.cohortsize, v1: item.samplecount, v2: item.cohortsize },
					{ fillbg: '#ECE5FF', fill: '#9F80FF' }
				)
			}
		}
		tr.append('td')
			.text(item.samplecount + (item.cohortsize ? ' / ' + item.cohortsize : ''))
			.style('font-size', '.7em')
		const td = tr.append('td')
		for (const [mclass, count] of item.mclasses) {
			td.append('span')
				.html(count == 1 ? '&nbsp;' : count)
				.style('background-color', common.mclass[mclass].color)
				.attr('class', 'sja_mcdot')
		}
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
