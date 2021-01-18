import * as common from '../common'

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

export async function itemtable(mlst, tk, block, div) {
	if (mlst[0].dt == common.dtsnvindel) {
		await table_snvindel(mlst, tk, block, div)
		return
	}
	if (mlst[0].dt == common.dtfusionrna || mlst[0].dt == common.dtsv) {
		await table_fusionsv(mlst, tk, block, div)
		return
	}
	throw 'itemtable unknown dt'
}

/*
using variant2samples
mlst can be mixture of data types, doesn't matter
if the total occurrence is 1, will print details for that sample
otherwise, will print summaries for each sample attribute from all samples
*/
export async function mlst2samplesummary(mlst, tk, block, table) {
	const [tdtemp1, tdtemp2, trtemp] = row_headervalue(table)
	tdtemp1.text('Loading...')
	try {
		if (mlst.length == 1 && mlst[0].occurrence == 1) {
			// one single sample, print details
			const data = await tk.mds.variant2samples.get(tk, mlst, tk.mds.variant2samples.type_samples)
			trtemp.remove()
			for (const termid of tk.mds.variant2samples.termidlst) {
				const term = tk.mds.termdb.getTermById(termid)
				if (!term) throw 'unknown term id: ' + termid
				const [td1, td2] = row_headervalue(table)
				td1.text(term.name)
				td2.text(data[0][termid])
			}
			return
		}
		// multiple samples
		const data = await tk.mds.variant2samples.get(tk, mlst, tk.mds.variant2samples.type_summary)
		trtemp.remove()
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
	} catch (e) {
		tdtemp1.text(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

/*
rendering may be altered by tk.mds config
may use separate scripts to code different table styles
*/
async function table_snvindel(mlst, tk, block, div) {
	const varianttable = div.append('table')
	if (mlst.length == 1) {
		// single variant, use two-column table to show key:value pairs
		table_snvindel_onevariant(mlst[0], tk, block, varianttable)
	} else {
		// make a multi-column table for all variants, one row for each variant
		table_snvindel_multivariant(mlst, tk, block, varianttable)
	}
	if (tk.mds.variant2samples) {
		// to show sample info (occurrence=1) or summary (occurrence>1)
		const heading = div
			.append('div')
			.style('margin-top', '20px')
			.style('opacity', 0.4)
			.style('font-size', '1.2em')
		if (mlst.length == 1) {
			if (mlst[0].occurrence == 1) {
				heading.text('Information about this case')
			} else {
				heading.text('Summary of ' + mlst[0].occurrence + ' cases')
			}
		} else {
			heading.text(`Summary of ${mlst.reduce((i, j) => i + j.occurrence, 0)} cases harboring ${mlst.length} variants`)
		}
		await mlst2samplesummary(mlst, tk, block, div.append('table'))
	}
}

function table_snvindel_onevariant(m, tk, block, table) {
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
function table_snvindel_multivariant(mlst, tk, block, div) {
	const columnnum = 2 // get number of columns, dependent on tk.mds setting
	const table = div.append('table')
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
					await mlst2samplesummary(
						[m],
						tk,
						block,
						tr2
							.append('td')
							.attr('colspan', columnnum)
							.append('table')
							.style('border', 'solid 1px #ccc')
							.style('margin-left', '20px')
					)
				})
			// hidden row to show sample details of this variant
			const tr2 = table.append('tr').style('display', 'none')
		} else {
			td2.text(m.occurrence)
		}
	}
}

function print_snvindel(m, d, tk) {
	{
		const s = d.append('span').style('font-size', '1.1em')
		if (tk.mds.queries.snvindel.url && tk.mds.queries.snvindel.url.key in m) {
			const a = s.append('a')
			a.attr('href', tk.mds.queries.snvindel.url.base + m[tk.mds.queries.snvindel.url.key])
			a.attr('target', '_blank')
			a.append('span').html(
				'<svg fill="currentColor" preserveAspectRatio="xMidYMid meet" height="1em" width="1em" viewBox="0 0 40 40" style="vertical-align: middle; margin-right: 0.5rem;"><g><path d="m31.4 20.7v7.2q0 2.6-1.9 4.5t-4.5 1.9h-18.6q-2.6 0-4.5-1.9t-1.9-4.5v-18.6q0-2.7 1.9-4.6t4.5-1.8h15.7q0.4 0 0.6 0.2t0.2 0.5v1.4q0 0.3-0.2 0.5t-0.6 0.2h-15.7q-1.4 0-2.5 1.1t-1 2.5v18.6q0 1.4 1 2.5t2.5 1h18.6q1.5 0 2.5-1t1.1-2.5v-7.2q0-0.3 0.2-0.5t0.5-0.2h1.4q0.3 0 0.5 0.2t0.2 0.5z m8.6-19.3v11.5q0 0.5-0.4 1t-1 0.4-1-0.4l-4-4-14.5 14.6q-0.2 0.2-0.5 0.2t-0.5-0.2l-2.6-2.6q-0.2-0.2-0.2-0.5t0.2-0.5l14.6-14.5-4-4q-0.4-0.4-0.4-1t0.4-1 1-0.4h11.5q0.6 0 1 0.4t0.4 1z"></path></g></svg>'
			)
			a.append('span').text(m.mname)
		} else {
			s.text(m.mname) // do not .html() to prevent injection
		}
	}
	d.append('span')
		.style('margin-left', '10px')
		.style('color', common.mclass[m.class].color)
		.style('font-weight', 'bold')
		.style('font-size', '.8em')
		.text(common.mclass[m.class].label.toUpperCase())
	d.append('span')
		.style('margin-left', '10px')
		.text(m.chr + ':' + (m.pos + 1))
	d.append('span')
		.style('margin-left', '10px')
		.style('opacity', 0.5)
		.style('font-size', '.7em')
		.text('REF')
	d.append('span')
		.style('margin-left', '5px')
		.text(m.ref)
	d.append('span')
		.style('margin-left', '10px')
		.style('opacity', 0.5)
		.style('font-size', '.7em')
		.text('ALT')
	d.append('span')
		.style('margin-left', '5px')
		.text(m.alt)
}

async function table_fusionsv(mlst, tk, block, div) {
	/*
	table view, with svgraph for first ml
	svgraph(mlst[0])

	if(mlst.length==1) {
		// 2-column table view
	} else {
		// one row per sv, click each row to show its svgraph
	}
	*/
	if (tk.mds.variant2samples) {
		// show sample summary
		await mlst2samplesummary(mlst, tk, block, div.append('div').style('margin', '10px'))
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
