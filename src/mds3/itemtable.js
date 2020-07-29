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
			const data = await tk.mds.variant2samples.get(mlst, 'samples')
			if (data.error) throw data.error
			if (!data.data || !data.data[0]) throw 'result error'
			trtemp.remove()
			for (const term of tk.mds.variant2samples.terms) {
				const [td1, td2] = row_headervalue(table)
				td1.text(term.name)
				td2.text(data.data[0][term.id])
			}
			return
		}
		// multiple samples
		const data = await tk.mds.variant2samples.get(mlst, 'summary')
		if (data.error) throw data.error
		if (!data.data) throw 'result error'
		trtemp.remove()
		for (const entry of data.data) {
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
		td1.text('Mutation')
		print_snvindel(m, td2)
	}
	{
		const [td1, td2] = row_headervalue(table)
		td1.text('Occurrence')
		td2.text(m.occurrence)
	}
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
	for (const m of mlst) {
		const tr = table.append('tr')
		print_snvindel(m, tr.append('td').style('padding-right', '10px'))
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

function print_snvindel(m, d) {
	d.append('span')
		.style('font-size', '1.1em')
		.text(m.mname) // do not .html() to prevent injection
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
