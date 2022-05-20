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
			const term = arg.tk.mds.termdb.getTermById(termid)
			if (!term) throw 'unknown term id: ' + termid
			const [cell1, cell2] = get_list_cells(grid_div)
			cell1.text(term.name)
			cell2.text(sampledata[termid] || 'N/A')
		}
	}

	/////////////
	// hardcoded logic to represent read depth using gdc data
	// allelic read depth only applies to ssm, not to other types of mutations
	if (sampledata.ssm_read_depth) {
		// to support other configurations of ssm read depth
		const sm = sampledata.ssm_read_depth
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.style('height', '35px').text('Tumor DNA MAF')
		cell2.style('height', '35px')
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
		d.append('span')
			.text('TOTAL DEPTH IN NORMAL')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
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
		/* insert into existing table, do not create new table
		print sample column headers into multiSampleTable.header
		for each sample, find placeholder by sample.ssm_id, create new row for this sample into placeholder
		*/

		// FIXME sample columns must not overlap when clicking a variant to the right, e.g. F156L of KRAS
		arg.multiSampleTable.header
			.style('display', 'grid')
			.style('grid-template-columns', 'repeat(' + numColumns + ', minmax(2vw, 10vw))')
			.style('opacity', 0.3)

		printHeader(arg.multiSampleTable.header)

		for (const sample of data) {
			const row = arg.multiSampleTable.ssmid2div.get(sample.ssm_id)
			if (!row) {
				// no corresponding row was found by this ssm id
				continue
			}

			// for a variant with multiple samples, css is set repeatedly on the row (placeholder)
			row.style('display', 'grid').style('grid-template-columns', 'repeat(' + numColumns + ', minmax(2vw, 10vw))')
			printSampleRow(sample, row)
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
		printHeader(grid, true)
		for (const sample of data) {
			printSampleRow(sample, grid)
		}
	}

	//////////// helpers

	function printHeader(row, gray) {
		if (has_sample_id) {
			const c = row.append('div').text('Sample')
			if (gray) c.style('opacity', 0.3)
		}
		if (arg.tk.mds.variant2samples.termidlst) {
			for (const termid of arg.tk.mds.variant2samples.termidlst) {
				const t = arg.tk.mds.termdb.getTermById(termid)
				const c = row.append('div').text(t ? t.name : termid)
				if (gray) c.style('opacity', 0.3)
			}
		}
		if (has_ssm_read_depth) {
			const c = row.append('div').text('Tumor DNA MAF')
			if (gray) c.style('opacity', 0.3)
		}
		if (has_totalNormal) {
			const c = row.header.append('div').text('Normal depth')
			if (gray) c.style('opacity', 0.3)
		}
	}

	function printSampleRow(sample, row) {
		rowBg = !rowBg
		if (has_sample_id) {
			const cell = row.append('div')
			if (rowBg) cell.style('background', '#eee')
			printSampleName(sample, arg.tk, cell)
		}
		if (arg.tk.mds.variant2samples.termidlst) {
			for (const termid of arg.tk.mds.variant2samples.termidlst) {
				const cell = row.append('div').text(termid in sample ? sample[termid] : '')
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
			}
			if (rowBg) cell.style('background', '#eee')
		}
		if (has_totalNormal) {
			const cell = row.append('div').text('totalNormal' in sample ? sample.totalNormal : '')
			if (rowBg) cell.style('background', '#eee')
		}
	}
}
