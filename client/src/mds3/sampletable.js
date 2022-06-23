import { fillbar } from '../../dom/fillbar'
import { get_list_cells } from '../../dom/gridutils'
import { select as d3select } from 'd3-selection'
import { mclass } from '../../shared/common'

/*
********************** EXPORTED
init_sampletable()
	using mds.variant2samples.get() to map mlst[] to samples
	always return list of samples, does not return summaries
	mlst can be mixture of data types, doesn't matter
displaySampleTable()
	call this function to render one or multiple samples

********************** INTERNAL
make_singleSampleTable
make_multiSampleTable
samples2rows
samples2columns
renderTable


********************** arg{}
.mlst[]
	used for v2s.get() query
.tk
	.mds.variant2samples.termidlst
.block
.div
.tid2value={}
 	sample filters by e.g. clicking on a sunburst ring, for tk.mds.variant2samples.get
.useRenderTable=true
	temp flag for using renderTable() for multi-sample display
	delete this flag when renderTable() replaces make_multiSampleTable()
.singleSampleDiv
	optional, if just one single sample, can show into this table rather than creating a new one
.multiSampleTable{}
	optional, may show a list of samples in here
	{ header:div, ssmid2div: map }
*/

const cutoff_tableview = 10

export async function init_sampletable(arg) {
	// run variant2samples.get() to map variants to samples
	const wait = arg.div
		.append('div')
		.text('Loading...')
		.style('padding', '10px')
		.style('color', '#8AB1D4')
		.style('font-size', '1.25em')
		.style('font-weight', 'bold')

	// may not be used!
	//terms from sunburst ring
	// Note: in ordered to keep term-values related to sunburst immuatable, these term names are
	// stored as 'tid2value_orig' and not removed from tid2Value when filter changed or removed
	arg.tid2value_orig = new Set()
	if (arg.tid2value) Object.keys(arg.tid2value).forEach(arg.tid2value_orig.add, arg.tid2value_orig)

	try {
		arg.querytype = arg.tk.mds.variant2samples.type_samples
		const samples = await arg.tk.mds.variant2samples.get(arg) // returns list of samples
		await displaySampleTable(samples, arg)
		wait.remove()
	} catch (e) {
		wait.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

export async function displaySampleTable(samples, arg) {
	if (samples.length == 1) {
		return await make_singleSampleTable(samples[0], arg)
	}
	if (arg.useRenderTable) {
		renderTable({
			rows: samples2rows(samples, arg.tk),
			columns: await samples2columns(samples, arg.tk),
			div: arg.div
		})
	} else {
		await make_multiSampleTable(samples, arg)
	}
}

async function make_singleSampleTable(sampledata, arg) {
	const grid_div =
		arg.singleSampleDiv ||
		arg.div
			.append('div')
			.style('display', 'inline-grid')
			.style('grid-template-columns', 'auto auto')
			.style('gap-row-gap', '1px')
			.style('align-items', 'center')
			.style('justify-items', 'left')

	if (sampledata.sample_id) {
		// sample_id is hardcoded
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text('Sample')
		printSampleName(sampledata, arg.tk, cell2)
	}

	if (arg.tk.mds.variant2samples.termidlst) {
		for (const termid of arg.tk.mds.variant2samples.termidlst) {
			const term = await arg.tk.mds.termdb.vocabApi.getterm(termid)
			if (!term) throw 'unknown term id: ' + termid
			const [cell1, cell2] = get_list_cells(grid_div)
			cell1.text(term.name).style('text-overflow', 'ellipsis')
			cell2.style('text-overflow', 'ellipsis')
			if (termid in sampledata) {
				if (Array.isArray(sampledata[termid])) {
					cell2.html(sampledata[termid].join('<br>'))
				} else {
					cell2.text(sampledata[termid])
				}
			}
		}
	}

	/////////////
	// hardcoded logic to represent read depth using gdc data
	// allelic read depth only applies to ssm, not to other types of mutations

	if (sampledata.ssm_id_lst) {
		/* ssm_id_lst is array of ssm ids
		it's attached to this sample when samples are queried from the #cases leftlabel
		create a new row in the table and list all ssm items
		in such case there can still be sampledata.ssm_read_depth,
		but since there can be multiple items from ssm_id_lst[] so do not display read depth
		*/
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text('Mutations')
		for (const ssm_id of sampledata.ssm_id_lst) {
			const d = cell2.append('div')
			const m = (arg.tk.skewer.rawmlst || arg.tk.custom_variants).find(i => i.ssm_id == ssm_id)
			if (m) {
				// found
				if (arg.tk.mds.queries && arg.tk.mds.queries.snvindel && arg.tk.mds.queries.snvindel.url) {
					d.append('a')
						.text(m.mname)
						.attr('target', '_blank')
						.attr('href', arg.tk.mds.queries.snvindel.url.base + ssm_id)
				} else {
					d.append('span').text(m.mname)
				}
				// class
				d.append('span')
					.style('margin-left', '10px')
					.style('color', mclass[m.class].color)
					.style('font-size', '.7em')
					.text(mclass[m.class].label)
			} else {
				// not found by ssm id
				d.text(ssm_id)
			}
		}
	} else if (sampledata.ssm_read_depth) {
		// to support other configurations of ssm read depth
		const sm = sampledata.ssm_read_depth
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1
			.style('height', '35px')
			.text('Tumor DNA MAF')
			.style('text-overflow', 'ellipsis')
		cell2.style('height', '35px').style('text-overflow', 'ellipsis')
		fillbar(cell2, { f: sm.altTumor / sm.totalTumor })
		cell2
			.append('span')
			.text(sm.altTumor + ' / ' + sm.totalTumor)
			.style('margin', '0px 10px')
		cell2
			.append('span')
			.text('ALT / TOTAL IN TUMOR')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
		const d = cell2.append('div') // next row to show normal total
		d.append('span')
			.text(sm.totalNormal || 'N/A')
			.style('margin-right', '10px')
			.style('text-overflow', 'ellipsis')
		d.append('span')
			.text('TOTAL DEPTH IN NORMAL')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
			.style('text-overflow', 'ellipsis')
	}

	/* quick fix for accessing details of a single case
	if (arg.tk.mds.termdb && arg.tk.mds.termdb.allowCaseDetails) {
		// has one single case
		arg.div.append('div').text('Case details')
	}
	*/
}

function printSampleName(sample, tk, div) {
	// print sample name in a div, if applicable, generate a hyper link using the sample name
	if (tk.mds.variant2samples.url) {
		const a = div.append('a')
		a.attr(
			'href',
			tk.mds.variant2samples.url.base +
				(tk.mds.variant2samples.url.namekey ? sample[tk.mds.variant2samples.url.namekey] : sample.sample_id)
		)
		a.attr('target', '_blank')
		a.text(sample.sample_id)
		a.style('word-break', 'break-word')
	} else {
		div.text(sample.sample_id)
	}
}

async function make_multiSampleTable(data, arg) {
	// create horizontal table to show multiple samples, one sample per row

	// flags for optional columns
	const has_sample_id = data.some(i => i.sample_id),
		has_ssm_read_depth = data.some(i => i.ssm_read_depth),
		has_totalNormal = data.some(i => i.totalNormal)

	// count total number of columns
	let numColumns = 0
	if (has_sample_id) numColumns++
	if (arg.tk.mds.variant2samples.termidlst) numColumns += arg.tk.mds.variant2samples.termidlst.length
	if (has_ssm_read_depth) numColumns++
	if (has_totalNormal) numColumns++

	if (arg.multiSampleTable) {
		// for each sample, find placeholder by sample.ssm_id, create new row for this sample into placeholder

		let startDataCol = arg.multiSampleTable.startCol + 1
		await printHeader(arg.grid, true, startDataCol)
		for (const sample of data) {
			const row = arg.multiSampleTable.ssmid2div.get(sample.ssm_id)
			if (!row) {
				// no corresponding row was found by this ssm id
				continue
			}
			// for a variant with multiple samples, css is set repeatedly on the row (placeholder)
			// display: contents renders data within the parent grid, ensuring the grid and subgrid
			// stay aligned as well as resize/flex synchronously
			row.style('display', 'contents').style('grid-column-start', startDataCol)
			printSampleRow(sample, row, startDataCol)
		}
	} else {
		// create new table, one row per sample
		const grid = arg.div
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'repeat(' + numColumns + ', auto)')
			.style('gap', '5px')
			.style('max-height', '30vw')
			.style('overflow-y', 'scroll')
		await printHeader(grid, true)
		for (const sample of data) {
			printSampleRow(sample, grid)
		}
	}
	// Alternating background color for sample rows
	colorRows()

	//////////// helpers

	async function printHeader(div, gray, startDataCol) {
		let startCol = startDataCol
		if (has_sample_id) {
			const c = div
				.append('div')
				.text('Sample')
				.style('grid-row-start', 1)
			if (startDataCol) {
				c.style('grid-column-start', startCol)
			}
			if (gray) c.style('opacity', 0.3)
		}
		if (arg.tk.mds.variant2samples.termidlst) {
			for (const termid of arg.tk.mds.variant2samples.termidlst) {
				const t = await arg.tk.mds.termdb.vocabApi.getterm(termid)
				const c = div
					.append('div')
					.text(t ? t.name : termid)
					.style('grid-row-start', 1)
				if (startDataCol) {
					startCol = ++startCol
					c.style('grid-column-start', startCol)
				}
				if (gray) c.style('opacity', 0.3)
			}
		}
		if (has_ssm_read_depth) {
			const c = div
				.append('div')
				.text('Tumor DNA MAF')
				.style('grid-row-start', 1)
			if (startDataCol) {
				startCol = ++startCol
				c.style('grid-column-start', startCol)
			}
			if (gray) c.style('opacity', 0.3)
		}
		if (has_totalNormal) {
			const c = div.header
				.append('div')
				.text('Normal depth')
				.style('grid-row-start', 1)
			if (startDataCol) {
				startCol = ++startCol
				c.style('grid-column-start', startCol)
			}
			if (gray) c.style('opacity', 0.3)
		}
	}

	function printSampleRow(sample, row, startDataCol) {
		let startCol = startDataCol
		if (has_sample_id) {
			const cell = row
				.append('div')
				.classed('sjpp-sample-table-div', true)
				.style('padding', '1px')
			if (startDataCol) {
				cell.style('grid-column-start', startCol)
			}
			printSampleName(sample, arg.tk, cell)
		}
		if (arg.tk.mds.variant2samples.termidlst) {
			for (const termid of arg.tk.mds.variant2samples.termidlst) {
				const cell = row
					.append('div')
					.text(termid in sample ? sample[termid] : '')
					.style('padding', '1px')
					.classed('sjpp-sample-table-div', true)
				if (startDataCol && !has_sample_id && arg.tk.mds.variant2samples.termidlst[0]) {
					cell.style('grid-column-start', startCol)
				}
			}
		}
		if (has_ssm_read_depth) {
			const cell = row
				.append('div')
				.classed('sjpp-sample-table-div', true)
				.style('padding', '1px')
			const sm = sample.ssm_read_depth
			if (sm) {
				fillbar(cell, { f: sm.altTumor / sm.totalTumor })
				cell
					.append('span')
					.text(sm.altTumor + ' / ' + sm.totalTumor)
					.style('margin', '0px 10px')
			}
		}
		if (has_totalNormal) {
			const cell = row
				.append('div')
				.text('totalNormal' in sample ? sample.totalNormal : '')
				.classed('sjpp-sample-table-div', true)
				.style('padding', '1px')
		}
	}

	function colorRows() {
		// Colors every other row light gray
		// Solves the problem of the multisample table rows' background color
		// rendering out of order (Cause: the sample rows are processed and rendered in order of
		// the data list and then shuffled into the respective sample subgrid)

		const rowDivs = document.querySelectorAll('.sjpp-sample-table-div')
		const rowArray = Array.from(rowDivs)
		for (const [i, elm] of rowArray.entries()) {
			const e = d3select(elm)
			const rowPosition = Math.floor(i / numColumns)
			let background = false
			if (rowPosition % 2 != 0) {
				background = true
				e.style('background-color', '#ededed')
			}
			e.on('mouseover', () => {
				e.style('background-color', '#fcfcca')
			})
			e.on('mouseout', () => {
				e.style('background-color', background == true ? '#ededed' : '')
			})
		}
	}
}

/***********************************************
renderTable() is the temporary implementation of table renderer
can replace with colleen's new function
samples2columns() and samples2rows() should continue to work with the future renderTable()
*/
async function samples2columns(samples, tk) {
	const columns = [{ label: 'Sample' }]
	if (tk.mds.variant2samples.termidlst) {
		for (const id of tk.mds.variant2samples.termidlst) {
			const t = await tk.mds.termdb.vocabApi.getterm(id)
			if (t) {
				columns.push({ label: t.name })
			} else {
				columns.push({ isinvalid: true })
			}
		}
	}
	columns.push({ label: 'Mutations', isSsm: true })
	return columns
}
function samples2rows(samples, tk) {
	const rows = []
	for (const sample of samples) {
		const row = [{ value: sample.sample_id }]

		if (tk.mds.variant2samples.url) {
			row[0].url = tk.mds.variant2samples.url.base + sample[tk.mds.variant2samples.url.namekey]
		}

		if (tk.mds.variant2samples.termidlst) {
			for (const id of tk.mds.variant2samples.termidlst) {
				row.push({ value: sample[id] })
			}
		}

		const ssmCell = { values: [] }
		for (const ssm_id of sample.ssm_id_lst) {
			const m = (tk.skewer.rawmlst || tk.custom_variants).find(i => i.ssm_id == ssm_id)
			const ssm = {}
			if (m) {
				// found m data point
				ssm.value = m.mname
				if (tk.mds.queries && tk.mds.queries.snvindel && tk.mds.queries.snvindel.url) {
					ssm.html = `<a href=${tk.mds.queries.snvindel.url.base + m.ssm_id} target=_blank>${m.mname}</a>`
				} else {
					ssm.html = m.mname
				}
				ssm.html += ` <span style="color:${mclass[m.class].color};font-size:.7em">${mclass[m.class].label}</span>`
			} else {
				// m datapoint not found on client
				ssm.value = ssm_id
			}
			ssmCell.values.push(ssm)
		}

		row.push(ssmCell)
		rows.push(row)
	}
	return rows
}
function renderTable({ columns, rows, div }) {
	const table = div
		.append('table')
		.style('border-spacing', '5px')
		.style('border-collapse', 'separate')
	const tr = table.append('tr')
	for (const c of columns) {
		tr.append('td')
			.text(c.label)
			.style('opacity', 0.5)
	}
	for (const row of rows) {
		const tr = table.append('tr').attr('class', 'sja_clb')
		for (const [colIdx, cell] of row.entries()) {
			const column = columns[colIdx]

			const td = tr.append('td')
			if (cell.values) {
				for (const v of cell.values) {
					const d = td.append('div')
					if (v.url) {
						d.append('a')
							.text(v.value)
							.attr('href', v.url)
							.attr('target', '_blank')
					} else if (v.html) {
						d.html(v.html)
					} else {
						d.text(v.value)
					}
				}
			} else if (cell.url) {
				td.append('a')
					.text(cell.value)
					.attr('href', cell.url)
					.attr('target', '_blank')
			} else {
				td.text(cell.value)
			}
		}
	}
}
