import { mclass, dtsnvindel, dtfusionrna, dtsv } from '../../shared/common'
import { init_sampletable } from './sampletable'
import { get_list_cells } from '../../dom/gridutils'
import { event as d3event } from 'd3-selection'
import { appear } from '../../dom/animation'

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
.disable_variant2samples:true
	set to true to not to issue variant2samples query for variants
*/
export async function itemtable(arg) {
	if (arg.mlst[0].dt == dtsnvindel) {
		await table_snvindel(arg)
		if (!isElementInViewport(arg.div)) {
			// If div renders outside of viewport, shift left
			const leftpos = determineLeftCoordinate(arg.div)
			appear(arg.div)
			arg.div.style('left', leftpos + 'vw').style('max-width', '90vw')
		}
		return
	}
	if (arg.mlst[0].dt == dtfusionrna || arg.mlst[0].dt == dtsv) {
		await table_fusionsv(arg)
		if (!isElementInViewport(arg.div)) {
			// If div renders outside of viewport, shift left
			const leftpos = determineLeftCoordinate(arg.div)
			appear(arg.div)
			arg.div.style('left', leftpos + 'vw').style('max-width', '90vw')
		}
		return
	}
	throw 'itemtable unknown dt'
}

function determineLeftCoordinate(div) {
	const coords = div.node().getBoundingClientRect()
	// Reset left position to 100% - (arg.div.width % + 3%)
	let leftpos
	if (coords.width / (document.documentElement.clientWidth || window.innerWidth) > 0.4) {
		leftpos = 3
	} else {
		leftpos = 100 - ((coords.width / (document.documentElement.clientWidth || window.innerWidth)) * 100 + 3)
	}
	return leftpos
}

/*
rendering may be altered by tk.mds config
may use separate scripts to code different table styles
*/
async function table_snvindel(arg) {
	const grid = arg.div
		.append('div')
		.style('display', 'inline-grid')
		.style('overflow-y', 'scroll')

	if (arg.mlst.length == 1) {
		// single variant, use two-column table to show key:value pairs
		grid
			.style('grid-template-columns', 'auto auto')
			.style('max-height', '40vw')
			// in case creating a new table for multiple samples of this variant,
			// add space between grid and the new table
			.style('margin-bottom', '10px')
		table_snvindel_onevariant(arg, grid)

		// if the variant has only one sample,
		// allow to append new rows to grid to show sample key:value
		arg.singleSampleDiv = grid
		// if there are multiple samples, this <div> won't be used
		// a new table will be created under arg.div to show sample table
	} else {
		// make a multi-column table for all variants, one row for each variant
		// set of columns are based on available attributes in mlst
		grid.style('max-height', '30vw').style('gap', '5px')
		// create placeholder for inserting samples for each variant
		arg.multiSampleTable = table_snvindel_multivariant(arg, grid)
		arg.grid = grid
	}

	if (!arg.disable_variant2samples && arg.tk.mds.variant2samples) {
		await init_sampletable(arg)
	}
}

function table_snvindel_onevariant({ mlst, tk, block }, grid) {
	const m = mlst[0]
	{
		const [td1, td2] = get_list_cells(grid)
		td1.text(block.mclassOverride ? block.mclassOverride.className : 'Consequence')
		print_mname(td2, m)
		//add_csqButton(m, tk, td2, table)
	}
	{
		const [td1, td2] = get_list_cells(grid)
		// do not pretend m is mutation if ref/alt is missing
		td1.text(m.ref && m.alt ? 'Mutation' : 'Position')
		print_snv(td2, m, tk)
	}
	if ('occurrence' in m) {
		const [td1, td2] = get_list_cells(grid)
		td1.text('Occurrence')
		td2.text(m.occurrence)
	}
	const currentMode = tk.skewer.viewModes.find(i => i.inuse)
	if (currentMode.type == 'numeric' && currentMode.byAttribute != 'occurrence') {
		// show a numeric value that is not occurrence
		const [td1, td2] = get_list_cells(grid)
		td1.text(currentMode.label)
		td2.text(m.__value_missing ? 'NA' : m.__value_use)
	}
}

function print_mname(div, m) {
	div.append('span').text(m.mname)
	div
		.append('span')
		.style('margin-left', '5px')
		.style('color', mclass[m.class].color)
		.style('font-size', '.8em')
		.text(mclass[m.class].label.toUpperCase())
}

function print_snv(holder, m, tk) {
	let printto = holder
	if (tk.mds.queries && tk.mds.queries.snvindel.url && tk.mds.queries.snvindel.url.key in m) {
		const a = holder.append('a')
		a.attr('href', tk.mds.queries.snvindel.url.base + m[tk.mds.queries.snvindel.url.key])
		a.attr('target', '_blank')
		printto = a
	}
	printto.html(`${m.chr}:${m.pos + 1} ${m.ref && m.alt ? m.ref + '>' + m.alt : ''}`)
}

/* multiple variants, each with occurrence
one row for each variant
click a button from a row to show the sample summary/detail table for that variant
show a summary table across samples of all variants
*/
function table_snvindel_multivariant({ mlst, tk, block, div, disable_variant2samples }, grid) {
	/* flags to indicate if to show these columns in the grid
	column 1: mutation
	column 2: position
	... optional columns
	*/

	const fixedColumnCount =
		1 + // consequence
		1 + // mutation
		1 // sampleDivHeader
	const showOccurrence = mlst.find(i => i.occurrence != undefined)
	let showNumericmodeValue
	const currentMode = tk.skewer.viewModes.find(i => i.inuse)
	if (currentMode.type == 'numeric' && currentMode.byAttribute != 'occurrence') {
		showNumericmodeValue = true
	}
	// Calculate number of columns specific to each sample group
	const numOfMetaDataCols =
		tk.mds.variant2samples.termidlst.length +
		(tk.mds.variant2samples.sampleHasSsmReadDepth == true ? 1 : 0) +
		(tk.mds.variant2samples.sampleHasSsmTotalNormal == true ? 1 : 0)

	grid
		.style(
			'grid-template-columns',
			`'repeat(${fixedColumnCount +
				(showOccurrence ? 1 : 0) +
				(showNumericmodeValue ? 1 : 0) +
				numOfMetaDataCols}, auto)'`
		)
		.style('text-overflow', 'ellipsis')
		.style('overflow', 'scroll')
		.style('max-width', '100%') // Fix for grid overflowing tooltip

	// header
	grid
		.append('div')
		.text(block.mclassOverride ? block.mclassOverride.className : 'Consequence')
		.style('opacity', 0.3)
	grid
		.append('div')
		.text(mlst.find(i => i.ref && i.alt) ? 'Mutation' : 'Position')
		.style('opacity', 0.3)
		.style('grid-column-start', '2')
	let startCol = 2 // Determines the start col for positioning later
	if (showOccurrence) {
		startCol = ++startCol
		grid
			.append('div')
			.style('opacity', 0.3)
			.text('Occurrence')
			.style('grid-column-start', startCol)
	}
	if (showNumericmodeValue) {
		startCol = ++startCol
		grid
			.append('div')
			.style('opacity', 0.3)
			.text(currentMode.label)
			.style('grid-column-start', startCol)
	}

	// placeholder for showing column headers of sample table, keep blank if there's no content
	// const sampleDivHeader = grid.append('div')

	// one row for each variant
	const ssmid2div = new Map() // k: m.ssm_id, v: <div>
	// for each variant, make a placeholder <div> and append to list

	for (const m of mlst) {
		// column 1
		print_mname(grid.append('div').style('grid-column-start', '1'), m)
		// column 2
		print_snv(grid.append('div').style('grid-column-start', '2'), m, tk)
		let dataStartCol = 2
		if (showOccurrence) {
			dataStartCol = ++dataStartCol
			grid
				.append('div')
				.text(m.occurrence)
				.style('grid-column-start', dataStartCol)
				.style('text-align', 'center')
		}

		if (showNumericmodeValue) {
			dataStartCol = ++dataStartCol
			grid
				.append('div')
				.text(m.__value_missing ? 'NA' : m.__value_use)
				.style('grid-column-start', dataStartCol)
				.style('text-align', 'center')
		}
		// create placeholder for showing available samples of this variant
		ssmid2div.set(m.ssm_id, grid.append('div').style('display', 'grid'))
	}
	// return { header: sampleDivHeader, ssmid2div, startCol, grid }
	return { ssmid2div, startCol }
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

// function is not used
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
		print_mname(td, m)
	}
}

function isElementInViewport(el) {
	const rect = el.node().getBoundingClientRect()
	return (
		// Fix for div appearing still appearing within viewport but without a border,
		// causing content to render bunched.
		rect.top >= 5 &&
		rect.left >= 5 &&
		rect.bottom < (document.documentElement.clientHeight || window.innerHeight) - 5 &&
		rect.right < (document.documentElement.clientWidth || window.innerWidth) - 5
	)
}
