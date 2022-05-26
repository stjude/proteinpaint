import { fillbar } from '../../dom/fillbar'
import { get_list_cells } from '../../dom/gridutils'

/*
********************** EXPORTED
init_sampletable
********************** INTERNAL
make_singleSampleTable
make_multiSampleTable

using mds.variant2samples.get() to map mlst[] to samples
always return list of samples, does not return summaries
mlst can be mixture of data types, doesn't matter

********************** arg{}
.mlst[]
	.occurrence
.tk
	.mds.variant2samples.termidlst
.block
.div
.tid2value
 	sample filters by e.g. clicking on a sunburst ring, for tk.mds.variant2samples.get
.singleSampleDiv
	optional, if just one single sample, can show into this table rather than creating a new one
.multiSampleTable{}
	optional, may show a list of samples in here
	{ header:div, ssmid2div: map }
*/

const cutoff_tableview = 10

export async function init_sampletable(arg) {
	const wait = arg.div.append('div').text('Loading...')
	const numofcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0) // sum of occurrence of mlst[]

	// may not be used!
	//terms from sunburst ring
	// Note: in ordered to keep term-values related to sunburst immuatable, these term names are
	// stored as 'tid2value_orig' and not removed from tid2Value when filter changed or removed
	arg.tid2value_orig = new Set()
	if (arg.tid2value) Object.keys(arg.tid2value).forEach(arg.tid2value_orig.add, arg.tid2value_orig)

	try {
		if (numofcases == 1) {
			// one sample
			await make_singleSampleTable(arg)
		} else {
			// multiple samples
			await make_multiSampleTable(arg)
		}
		wait.remove()
	} catch (e) {
		wait.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

async function make_singleSampleTable(arg) {
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const data = await arg.tk.mds.variant2samples.get(arg) // data is [samples, total]
	const sampledata = data[0][0] // must have just one sample

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
			cell2.text(sampledata[termid] || 'N/A').style('text-overflow', 'ellipsis')
		}
	}

	/////////////
	// hardcoded logic to represent read depth using gdc data
	// allelic read depth only applies to ssm, not to other types of mutations
	if (sampledata.ssm_read_depth) {
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
	} else {
		div.text(sample.sample_id)
	}
}

async function make_multiSampleTable(arg) {
	// create horizontal table to show multiple samples, one sample per row
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const [data, numofcases] = await arg.tk.mds.variant2samples.get(arg)
	// each element of data[] is a sample{}

	// flags for optional columns
	const has_sample_id = data.find(i => i.sample_id),
		has_ssm_read_depth = data.find(i => i.ssm_read_depth),
		has_totalNormal = data.find(i => i.totalNormal)

	// count total number of columns
	let numColumns = 0
	if (has_sample_id) numColumns++
	if (arg.tk.mds.variant2samples.termidlst) numColumns += arg.tk.mds.variant2samples.termidlst.length
	if (has_ssm_read_depth) numColumns++
	if (has_totalNormal) numColumns++

	// flag to enable alternating background color for sample rows
	let rowBg = false

	if (arg.multiSampleTable) {
		// for each sample, find placeholder by sample.ssm_id, create new row for this sample into placeholder

		let startDataCol = arg.multiSampleTable.startCol + 1
		await printHeader(arg.grid, true, startDataCol)

		let sampleStartRow = 1
		for (const sample of data) {
			sampleStartRow = ++sampleStartRow
			const row = arg.multiSampleTable.ssmid2div.get(sample.ssm_id)
			if (!row) {
				// no corresponding row was found by this ssm id
				continue
			}
			console.log(row)
			// for a variant with multiple samples, css is set repeatedly on the row (placeholder)
			printSampleRow(sample, arg.grid, startDataCol, sampleStartRow)
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

	function printSampleRow(sample, row, startDataCol, sampleStartRow) {
		rowBg = !rowBg
		let startCol = startDataCol
		if (has_sample_id) {
			const cell = row.append('div')
			if (sampleStartRow) cell.style('grid-row-start', sampleStartRow)
			if (startDataCol) {
				cell.style('grid-column-start', startCol)
			}
			if (rowBg) cell.style('background', '#eee')
			printSampleName(sample, arg.tk, cell)
		}
		if (arg.tk.mds.variant2samples.termidlst) {
			for (const termid of arg.tk.mds.variant2samples.termidlst) {
				const cell = row.append('div').text(termid in sample ? sample[termid] : '')
				if (startDataCol) {
					startCol = ++startCol
					cell.style('grid-column-start', startCol)
				}
				if (sampleStartRow) cell.style('grid-row-start', sampleStartRow)
				if (rowBg) cell.style('background', '#eee')
			}
		}
		if (has_ssm_read_depth) {
			const cell = row.append('div')
			const sm = sample.ssm_read_depth
			if (sm) {
				fillbar(cell, { f: sm.altTumor / sm.totalTumor })
				cell
					.append('span')
					.text(sm.altTumor + ' / ' + sm.totalTumor)
					.style('margin', '0px 10px')
				if (startDataCol) {
					startCol = ++startCol
					cell.style('grid-column-start', startCol)
				}
				if (sampleStartRow) cell.style('grid-row-start', sampleStartRow)
			}
			if (rowBg) cell.style('background', '#eee')
		}
		if (has_totalNormal) {
			const cell = row.append('div').text('totalNormal' in sample ? sample.totalNormal : '')
			if (startDataCol) {
				startCol = ++startCol
				cell.style('grid-column-start', startCol)
			}
			if (sampleStartRow) cell.style('grid-row-start', sampleStartRow)
			if (rowBg) cell.style('background', '#eee')
		}
	}
}
