import * as common from '../../shared/common'
import { to_textfile, fillbar } from '../client'


/*
********************** EXPORTED
init_sampletable
********************** INTERNAL
make_singleSampleTable
make_multiSampleTable
get_list_cells

using variant2samples
mlst can be mixture of data types, doesn't matter
if the total occurrence is 1, will print details for that sample
otherwise, will print summaries for each sample attribute from all samples
arg{}
.mlst[]
	.occurrence // important parameter to determine the display mode
.tk
	.mds.variant2samples.termidlst
.block
.div
.tid2value
 	sample filters by e.g. clicking on a sunburst ring, for tk.mds.variant2samples.get
*/

const cutoff_tableview = 10

export async function init_sampletable(arg) {
    
    const holder = arg.div.append('div')
    const err_check_div = arg.div.append('div')
        .style('color', '#bbb')
        .text('Loading...')

    const numofcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0) // sum of occurrence of mlst[]
    try {
		if (numofcases == 1) {
			// one sample
			await make_singleSampleTable(arg, holder)
		} else if (numofcases < cutoff_tableview) {
			// few cases
			await make_multiSampleTable(arg, holder)
		} else {
			// more cases, show summary
			// await make_sampleSummary(arg, table, downloadlinkdiv)
		}
		err_check_div.remove()
	} catch (e) {
		err_check_div.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

async function make_singleSampleTable(arg, holder) {
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const data = await arg.tk.mds.variant2samples.get(arg)
	const sampledata = data[0] // must have just one sample

    const table = holder
        .append('div')
        .style('margin', '20px')
        .style('font-size', '.9em')
        .style('display', 'grid')
        .style('grid-template-columns', 'auto auto')
        .style('gap-row-gap', '1px')
        .style('align-items', 'center')
        .style('justify-items', 'left')

	if (sampledata.sample_id) {
		// sample_id is hardcoded
		const [cell1, cell2] = get_list_cells(table)
		cell1.text('Sample')
		if (arg.tk.mds.variant2samples.url) {
			const a = cell2.append('a')
			a.attr(
				'href',
				arg.tk.mds.variant2samples.url.base +
					(arg.tk.mds.variant2samples.url.namekey
						? sampledata[arg.tk.mds.variant2samples.url.namekey]
						: sampledata.sample_id)
			)
			a.attr('target', '_blank')
			a.text(sampledata.sample_id)
		} else {
			cell2.text(sampledata.sample_id)
		}
	}

	for (const termid of arg.tk.mds.variant2samples.termidlst) {
		const term = arg.tk.mds.termdb.getTermById(termid)
		if (!term) throw 'unknown term id: ' + termid
		const [cell1, cell2] = get_list_cells(table)
		cell1.text(term.name)
		cell2.text(sampledata[termid])
	}

	/////////////
	// hardcoded logic to represent read depth using gdc data
	// allelic read depth only applies to ssm, not to other types of mutations
	if (sampledata.ssm_read_depth) {
		// to support other configurations of ssm read depth
		const sm = sampledata.ssm_read_depth
		const [cell1, cell2] = get_list_cells(table)
		cell1.style('height','35px').text('DNA read depth')
        cell2.style('height','35px')
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
			.text(sm.totalNormal)
			.style('margin-right', '10px')
		d.append('span')
			.text('TOTAL DEPTH IN NORMAL')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
	}
}

async function make_multiSampleTable(arg, holder) {
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const data = await arg.tk.mds.variant2samples.get(arg)

	// use booleen flags to determine table columns based on these samples
	const has_sampleid = data.some(i => i.sample_id) // sample_id is hardcoded
	const has_ssm_depth = data.some(i => i.ssm_read_depth)
    const col_count = arg.tk.mds.variant2samples.termidlst.length + has_sampleid + (has_ssm_depth ? 2 : 0)
	const table = holder
        .append('div')
        .style('margin', '10px')
        .style('font-size', '.9em')
        .style('display', 'grid')
        .style('grid-template-columns', 'repeat('+ col_count +', auto)')
        .style('grid-template-rows', 'repeat('+ data.length +', auto)')
        .style('grid-row-gap', '5px')
        .style('align-items', 'center')
        .style('justify-items', 'left')

	if (has_sampleid) {
		table.append('div')
        .style('font-size', '.8em')
        .style('opacity', 0.5)
        .text('SAMPLE')
	}
	for (const termid of arg.tk.mds.variant2samples.termidlst) {
		const term = arg.tk.mds.termdb.getTermById(termid)
		table.append('div')
            .style('opacity', 0.5)
            .style('font-size', '.8em')
            .text(term.name)
	}
	if (has_ssm_depth) {
		// to support other configs
		table.append('div').style('opacity', 0.5).style('font-size', '.8em').text('TUMOR DNA MAF')
		table.append('div').style('opacity', 0.5).style('font-size', '.8em').text('NORMAL DEPTH')
	}

	// one row per sample
	for (const [i, sample] of data.entries()) {
		if (has_sampleid) {
			const cell = get_table_cell(table, i)
			if (sample.sample_id) {
				if (arg.tk.mds.variant2samples.url) {
					const a = cell.append('a')
					a.attr(
						'href',
						arg.tk.mds.variant2samples.url.base +
							(arg.tk.mds.variant2samples.url.namekey
								? sample[arg.tk.mds.variant2samples.url.namekey]
								: sample.sample_id)
					)
					a.attr('target', '_blank')
					a.text(sample.sample_id)
				} else {
					cell.text(sample.sample_id)
				}
			}
		}
		for (const termid of arg.tk.mds.variant2samples.termidlst) {
            const cell = get_table_cell(table, i)
			cell.text(sample[termid])
		}
		if (has_ssm_depth) {
            const cell1 = get_table_cell(table, i) // tumor
            const cell2 = get_table_cell(table, i) // normal 
 
			const sm = sample.ssm_read_depth
			if (sm) {
				fillbar(cell1, { f: sm.altTumor / sm.totalTumor })
				cell1
                    .style('width','140px')
					.append('span')
					.text(sm.altTumor + ' / ' + sm.totalTumor)
					.style('margin', '0px 10px')
				cell2.text(sm.totalNormal)
			}
		}
	}
}

function get_list_cells(table) {
	return [
		table
			.append('div')
            .style('width','100%')
            .style('padding', '5px 20px 5px 0px')
			.style('color', '#bbb')
			.style('border-bottom', 'solid 1px #ededed'),
		table.append('div')
            .style('width','100%')
            .style('border-bottom', 'solid 1px #ededed')
            .style('padding', '5px 20px 5px 0px')
	]
}

function get_table_cell(table, i){
    return table.append('div')
        .style('width','95%')
        .style('height','100%')
        .style('padding','2px 5px')
        .style('background-color', i % 2 == 0 ? '#eee':'#fff')
}