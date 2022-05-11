import { mclass, dtsnvindel, dtfusionrna, dtsv } from '../../shared/common'
import { init_sampletable } from './sampletable'
import { event as d3event } from 'd3-selection'

/*
********************** EXPORTED
itemtable
********************** INTERNAL
table_snvindel
table_snvindel_onevariant
table_snvindel_multivariant
add_csqButton
print_snv

table_fusionsv

.occurrence must be set for each variant
all mlst of one data type
should work for all types of data

TODO
similar to vcf, variant annotation should be kept in .info{}, e.g. consequence
describe these attributes in tk.mds.variantInfo
print each info as table row/column

*/

const cutoff_tableview = 10

/*
for a list of variants of *same type*, print details of both variant and samples
arg{}
.div
.mlst
.tk
.block
.disableSamplesummary:true
*/
export async function itemtable(arg) {
	if (arg.mlst[0].dt == dtsnvindel) {
		await table_snvindel(arg)
		return
	}
	if (arg.mlst[0].dt == dtfusionrna || arg.mlst[0].dt == dtsv) {
		await table_fusionsv(arg)
		return
	}
	throw 'itemtable unknown dt'
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

	if (!arg.disableSamplesummary && arg.tk.mds.variant2samples) {
		await init_sampletable(arg)
	}
}

function table_snvindel_onevariant({ m, tk, table, block }) {
	{
		const [td1, td2] = row_headervalue(table)
		td1.text(block.mclassOverride ? block.mclassOverride.className : 'Consequence')
		add_csqButton(m, tk, td2, table)
	}
	{
		const [td1, td2] = row_headervalue(table)
		// do not pretend m is mutation if ref/alt is missing
		td1.text(m.ref && m.alt ? 'Mutation' : 'Position')
		print_snv(td2, m, tk)
	}
	if ('occurrence' in m) {
		const [td1, td2] = row_headervalue(table)
		td1.text('Occurrence')
		td2.text(m.occurrence)
	}
	if (tk.skewer.mode == 'numeric') {
		const nm = tk.numericmode
		const [td1, td2] = row_headervalue(table)
		if (nm.tooltipPrintValue) {
			const [a, b] = nm.tooltipPrintValue(m)
			td1.text(a)
			td2.text(b)
		} else {
			td1.text(nm.valueName || 'Value')
			td2.text(m.__value_use)
		}
	}
}

function add_csqButton(m, tk, td, table) {
	// m:
	// tk:
	// td: the <td> to show current csq label
	// table: 2-col
	if (tk.mds.queries && tk.mds.queries.snvindel.m2csq && m.csqcount > 1) {
		const a = td.append('a')
		a.html(m.mname + ' <span style="font-size:.8em">' + mclass[m.class].label.toUpperCase() + '</span> &#9660;')
		// click link to query for csq list
		const tr = table.append('tr').style('display', 'none')
		const td2 = tr.append('td').attr('colspan', 2) // to show result of additional csq
		let first = true
		a.on('click', async () => {
			if (tr.style('display') == 'none') {
				tr.style('display', 'table-row')
				a.html(m.mname + ' <span style="font-size:.8em">' + mclass[m.class].label.toUpperCase() + '</span> &#9650;')
			} else {
				tr.style('display', 'none')
				a.html(m.mname + ' <span style="font-size:.8em">' + mclass[m.class].label.toUpperCase() + '</span> &#9660;')
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
			.style('color', mclass[m.class].color)
			.style('font-size', '.8em')
			.text(mclass[m.class].label.toUpperCase())
	}
}

function print_snv(holder, m, tk) {
	let printto = holder
	if (tk.mds.queries && tk.mds.queries.snvindel.url && tk.mds.queries.snvindel.url.key in m) {
		const a = holder.append('a')
		a.attr('href', tk.mds.queries.snvindel.url.base + m[tk.mds.queries.snvindel.url.key])
		a.attr('target', '_blank')
		printto = a
	}
	printto.html(
		`${m.chr}:${m.pos + 1}
		${m.ref ? ' <span style="font-size:.7em;opacity:.5">REF</span> ' + m.ref : ''}
		${m.alt ? ' <span style="font-size:.7em;opacity:.5">ALT</span> ' + m.alt : ''}`
	)
}

/* multiple variants, each with occurrence
one row for each variant
click a button from a row to show the sample summary/detail table for that variant
show a summary table across samples of all variants
*/
function table_snvindel_multivariant({ mlst, tk, block, table, div }) {
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
	let mlst_render = []
	// one row for each variant
	for (const m of mlst) {
		const tr = table.append('tr')
		const td1 = tr.append('td').style('padding-right', '10px')
		add_csqButton(m, tk, td1.append('span').style('margin-right', '10px'), table)
		print_snv(td1, m, tk)
		const td2 = tr.append('td')
		if (tk.mds.variant2samples) {
			let first = true

			const occurnace_div = td2.append('div')

			occurnace_div
				.append('input')
				.property('type', 'checkbox')
				.on('change', async () => {
					if (d3event.target.checked) mlst_render.push(m)
					else {
						mlst_render = mlst_render.filter(mt => mt.ssm_id != m.ssm_id)
					}
					const multisample_div = div.select('.sj_sampletable_holder')
					multisample_div.selectAll('*').remove()
					await init_sampletable({
						mlst: mlst_render.length ? mlst_render : mlst,
						tk,
						block,
						div: multisample_div
					})
				})

			occurnace_div
				.append('div')
				.style('display', 'inline-block')
				.style('text-align', 'right')
				.style('margin-left', '5px')
				.attr('class', 'sja_clbtext')
				.text(m.occurrence)
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
		await init_sampletable(arg)
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
