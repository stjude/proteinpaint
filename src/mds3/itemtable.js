import * as common from '../common'
import { to_textfile, fillbar } from '../client'

/*
********************** EXPORTED
itemtable
mlst2samplesummary
********************** INTERNAL
table_snvindel
table_fusionsv

.occurrence must be set for each variant
all mlst of one data type
should work for all types of data

TODO
similar to vcf, variant annotation should be kept in .info{}, e.g. consequence
describe these attributes in tk.mds.variantInfo
print each info as table row/column

*/

/*
for a list of variants of *same type*, print details of both variant and samples
arg{}
.div
.mlst
.tk
.block
.tid2value{}
*/

const cutoff_tableview = 10

export async function itemtable(arg) {
	if (arg.mlst[0].dt == common.dtsnvindel) {
		await table_snvindel(arg)
		return
	}
	if (arg.mlst[0].dt == common.dtfusionrna || arg.mlst[0].dt == common.dtsv) {
		await table_fusionsv(arg)
		return
	}
	throw 'itemtable unknown dt'
}

/*
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
export async function mlst2samplesummary(arg) {
	// quick fix!! when showing multi-sample summary, Lou wanted a *download* link, show at this top div
	const downloadlinkdiv = arg.div.append('div')

	const table = arg.div.append('table') // 2 columns: 1. field name, 2. field content
	const [tdtemp1, tdtemp2, trtemp] = row_headervalue(table)
	tdtemp1.text('Loading...')
	const numofcases = arg.mlst.reduce((i, j) => i + j.occurrence, 0) // sum of occurrence of mlst[]
	try {
		if (numofcases == 1) {
			// one sample
			await make_singleSampleTable(arg, table)
		} else if (numofcases < cutoff_tableview) {
			// few cases
			await make_multiSampleTable(arg)
		} else {
			// more cases, show summary
			await make_sampleSummary(arg, table, downloadlinkdiv)
		}
		trtemp.remove()
	} catch (e) {
		tdtemp1.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

async function make_multiSampleTable(arg) {
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const data = await arg.tk.mds.variant2samples.get(arg)

	// use booleen flags to determine table columns based on these samples
	const has_sampleid = data.find(i => i.sample_id) // sample_id is hardcoded
	const has_ssm_depth = data.find(i => i.ssm_read_depth)
	const table = arg.div.append('table')

	// header row
	const tr = table
		.append('tr')
		.style('font-size', '.8em')
		.style('opacity', 0.5)
	if (has_sampleid) {
		tr.append('td').text('SAMPLE')
	}
	for (const termid of arg.tk.mds.variant2samples.termidlst) {
		const term = arg.tk.mds.termdb.getTermById(termid)
		tr.append('td').text(term.name)
	}
	if (has_ssm_depth) {
		// to support other configs
		tr.append('td').text('TUMOR DNA MAF')
		tr.append('td').text('NORMAL DEPTH')
	}

	// one row per sample
	for (const sample of data) {
		const tr = table.append('tr')
		if (has_sampleid) {
			const td = tr.append('td')
			if (sample.sample_id) {
				if (arg.tk.mds.variant2samples.url) {
					const a = td.append('a')
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
					td.text(sample.sample_id)
				}
			}
		}
		for (const termid of arg.tk.mds.variant2samples.termidlst) {
			const term = arg.tk.mds.termdb.getTermById(termid)
			tr.append('td').text(sample[termid])
		}
		if (has_ssm_depth) {
			const td1 = tr.append('td') // tumor
			const td2 = tr.append('td') // normal
			const sm = sample.ssm_read_depth
			if (sm) {
				fillbar(td1, { f: sm.altTumor / sm.totalTumor })
				td1
					.append('span')
					.text(sm.altTumor + ' / ' + sm.totalTumor)
					.style('margin', '0px 10px')
				td2.text(sm.totalNormal)
			}
		}
	}
}

async function make_singleSampleTable(arg, table) {
	arg.querytype = arg.tk.mds.variant2samples.type_samples
	const data = await arg.tk.mds.variant2samples.get(arg)
	const sampledata = data[0] // must have just one sample
	if (sampledata.sample_id) {
		// sample_id is hardcoded
		const [td1, td2] = row_headervalue(table)
		td1.text('Sample')
		if (arg.tk.mds.variant2samples.url) {
			const a = td2.append('a')
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
			td2.text(sampledata.sample_id)
		}
	}

	for (const termid of arg.tk.mds.variant2samples.termidlst) {
		const term = arg.tk.mds.termdb.getTermById(termid)
		if (!term) throw 'unknown term id: ' + termid
		const [td1, td2] = row_headervalue(table)
		td1.text(term.name)
		td2.text(sampledata[termid])
	}

	/////////////
	// hardcoded logic to represent read depth using gdc data
	// allelic read depth only applies to ssm, not to other types of mutations
	if (sampledata.ssm_read_depth) {
		// to support other configurations of ssm read depth
		const sm = sampledata.ssm_read_depth
		const [td1, td2] = row_headervalue(table)
		td1.text('DNA read depth')
		fillbar(td2, { f: sm.altTumor / sm.totalTumor })
		td2
			.append('span')
			.text(sm.altTumor + ' / ' + sm.totalTumor)
			.style('margin', '0px 10px')
		td2
			.append('span')
			.text('ALT / TOTAL IN TUMOR')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
		const d = td2.append('div') // next row to show normal total
		d.append('span')
			.text(sm.totalNormal)
			.style('margin-right', '10px')
		d.append('span')
			.text('TOTAL DEPTH IN NORMAL')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
		/*
		td1.text('Read depth')
		const table2 = td2.append('table')
		const tr = table2.append('tr')
		tr.style('font-size', '.7em').style('opacity', 0.5)
		tr.append('td').text('Tumor')
		tr.append('td').text('Germline')
		tr.append('td').text('Caller')
		for (const d of sampledata.read_depth) {
			const tr = table2.append('tr')
			const td1 = tr.append('td')
			fillbar(td1, { f: d.altT / d.totalT })
			td1
				.append('span')
				.text(d.altT + ' / ' + d.totalT)
				.style('margin', '0px 10px')
			td1
				.append('span')
				.text('ALT / TOTAL')
				.style('font-size', '.7em')
				.style('opacity', 0.5)
			tr.append('td').text(d.totalG)
			tr.append('td')
				.text(d.caller)
				.style('opacity', 0.5)
		}
		*/
	}
}

async function make_sampleSummary(arg, table, linkdiv) {
	arg.querytype = arg.tk.mds.variant2samples.type_summary
	const data = await arg.tk.mds.variant2samples.get(arg)
	for (const entry of data) {
		const [td1, td2] = row_headervalue(table)
		td1.text(entry.name)
		if (entry.numbycategory) {
			const t2 = td2.append('table')
			for (const [category, count] of entry.numbycategory) {
				const tr = t2.append('tr')
				tr.append('td')
					.text(count)
					.style('text-align', 'right')
					.style('padding-right', '10px')
				tr.append('td').text(category)
			}
		}
	}

	/////// temporary fix! add link at table top to download summaries
	{
		const lines = []
		for (const entry of data) {
			if (entry.numbycategory) {
				for (const [category, count] of entry.numbycategory) {
					lines.push(entry.name + '\t' + category + '\t' + count)
				}
			}
		}
		linkdiv
			.style('margin', '10px 0px')
			.append('a')
			.text('DOWNLOAD SUMMARY')
			.style('font-size', '.9em')
			.on('click', () => to_textfile('Summary', lines.join('\n')))
	}
}

/*
rendering may be altered by tk.mds config
may use separate scripts to code different table styles
*/
async function table_snvindel(arg) {
	arg.table = arg.div.append('table')
	if (arg.mlst.length == 1) {
		// single variant, use two-column table to show key:value pairs
		arg.m = arg.mlst[0]
		table_snvindel_onevariant(arg)
	} else {
		// make a multi-column table for all variants, one row for each variant
		table_snvindel_multivariant(arg)
	}
	if (arg.tk.mds.variant2samples) {
		// to show sample info (occurrence=1) or summary (occurrence>1)
		const heading = arg.div
			.append('div')
			.style('margin-top', '20px')
			.style('opacity', 0.4)
			.style('font-size', '1.1em')
		{
			const c = arg.mlst.reduce((i, j) => i + j.occurrence, 0)
			heading.text(c < cutoff_tableview ? 'Sample details' : 'Summary of ' + c + ' samples')
		}
		await mlst2samplesummary(arg)
	}
}

function table_snvindel_onevariant({ m, tk, block, table }) {
	{
		const [td1, td2] = row_headervalue(table)
		td1.text('Consequence')
		add_csqButton(m, tk, td2, table)
	}
	{
		const [td1, td2] = row_headervalue(table)
		td1.text('Mutation')
		print_snv(td2, m, tk)
	}
	{
		const [td1, td2] = row_headervalue(table)
		td1.text('Occurrence')
		td2.text(m.occurrence)
	}
}

function add_csqButton(m, tk, td, table) {
	// m:
	// tk:
	// td: the <td> to show current csq label
	// table: 2-col
	if (tk.mds.queries.snvindel.m2csq && m.csqcount > 1) {
		const a = td.append('a')
		a.html(m.mname + ' <span style="font-size:.8em">' + common.mclass[m.class].label.toUpperCase() + '</span> &#9660;')
		// click link to query for csq list
		const tr = table.append('tr').style('display', 'none')
		const td2 = tr.append('td').attr('colspan', 2) // to show result of additional csq
		let first = true
		a.on('click', async () => {
			if (tr.style('display') == 'none') {
				tr.style('display', 'table-row')
				a.html(
					m.mname + ' <span style="font-size:.8em">' + common.mclass[m.class].label.toUpperCase() + '</span> &#9650;'
				)
			} else {
				tr.style('display', 'none')
				a.html(
					m.mname + ' <span style="font-size:.8em">' + common.mclass[m.class].label.toUpperCase() + '</span> &#9660;'
				)
			}
			if (!first) return
			first = false
			const wait = td2.append('div').text('Loading...')
			try {
				const data = await tk.mds.queries.snvindel.m2csq.get(m)
				if (data.error) throw data.error
				wait.remove()
				const table = td2.append('table').style('margin-bottom', '10px')
				const tr = table
					.append('tr')
					.style('font-size', '.7em')
					.style('opacity', 0.5)
				tr.append('td').text('AA change')
				tr.append('td').text('Isoform')
				tr.append('td').text('Consequence')
				for (const d of data.csq) {
					const tr = table.append('tr')
					tr.append('td').text(d.aa_change)
					tr.append('td').text(d.transcript_id)
					tr.append('td').text(d.consequence_type)
				}
			} catch (e) {
				wait.text(e.message || e)
			}
		})
	} else {
		// no showing additional csq
		td.append('span').text(m.mname)
		td.append('span')
			.style('margin-left', '10px')
			.style('color', common.mclass[m.class].color)
			.style('font-size', '.8em')
			.text(common.mclass[m.class].label.toUpperCase())
	}
}

function print_snv(holder, m, tk) {
	let printto = holder
	if (tk.mds.queries.snvindel.url && tk.mds.queries.snvindel.url.key in m) {
		const a = holder.append('a')
		a.attr('href', tk.mds.queries.snvindel.url.base + m[tk.mds.queries.snvindel.url.key])
		a.attr('target', '_blank')
		printto = a
	}
	printto.html(
		m.chr +
			':' +
			(m.pos + 1) +
			' <span style="font-size:.7em;opacity:.5">REF</span> ' +
			m.ref +
			' <span style="font-size:.7em;opacity:.5">ALT</span> ' +
			m.alt
	)
}

/* multiple variants, each with occurrence
one row for each variant
click a button from a row to show the sample summary/detail table for that variant
show a summary table across samples of all variants
*/
function table_snvindel_multivariant({ mlst, tk, block, table }) {
	const columnnum = 2 // get number of columns, dependent on tk.mds setting
	// header row
	const tr = table.append('tr')
	tr.append('td')
		.text('Mutation')
		.style('opacity', 0.5)
		.style('padding-right', '10px')
	tr.append('td')
		.text('Occurrence')
		.style('opacity', 0.5)
	// one row for each variant
	for (const m of mlst) {
		const tr = table.append('tr')
		const td1 = tr.append('td').style('padding-right', '10px')
		add_csqButton(m, tk, td1.append('span').style('margin-right', '10px'), table)
		print_snv(td1, m, tk)
		const td2 = tr.append('td')
		if (tk.mds.variant2samples) {
			let first = true
			td2
				.html(m.occurrence + '\t&#9660;')
				.style('text-align', 'right')
				.attr('class', 'sja_clbtext')
				.on('click', async () => {
					if (tr2.style('display') == 'none') {
						tr2.style('display', 'table-row')
						td2.html(m.occurrence + '\t&#9650;')
					} else {
						tr2.style('display', 'none')
						td2.html(m.occurrence + '\t&#9660;')
					}
					if (!first) return
					// load sample info
					first = false
					await mlst2samplesummary({
						mlst: [m],
						tk,
						block,
						div: tr2
							.append('td')
							.attr('colspan', columnnum)
							.append('table')
							.style('border', 'solid 1px #ccc')
							.style('margin-left', '20px')
					})
				})
			// hidden row to show sample details of this variant
			const tr2 = table.append('tr').style('display', 'none')
		} else {
			td2.text(m.occurrence)
		}
	}
}

async function table_fusionsv(arg) {
	/*
	table view, with svgraph for first ml
	svgraph(mlst[0])

	if(mlst.length==1) {
		// 2-column table view
	} else {
		// one row per sv, click each row to show its svgraph
	}
	*/
	if (arg.tk.mds.variant2samples) {
		// show sample summary
		await mlst2samplesummary(arg)
	}
}

// may move to client.js
function row_headervalue(table) {
	const tr = table.append('tr')
	return [
		tr
			.append('td')
			.style('color', '#bbb')
			.style('border-bottom', 'solid 1px #ededed')
			.style('padding', '5px 20px 5px 0px'),
		tr.append('td').style('border-bottom', 'solid 1px #ededed'),
		tr
	]
}
