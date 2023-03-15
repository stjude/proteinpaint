import { mclass, dtsnvindel, dtfusionrna, dtsv } from '#shared/common'
import { init_sampletable } from './sampletable'
import { get_list_cells } from '#dom/gridutils'
import { appear } from '#dom/animation'
import { dofetch3 } from '#common/dofetch'

/*
********************** EXPORTED
itemtable


********************** INTERNAL
itemtable_oneItem
	table_snvindel
		table_snvindel_mayInsertNumericValueRow
		table_snvindel_mayInsertHtmlSections
		table_snvindel_mayInsertLD
	table_svfusion
itemtable_multiItems
mayMoveTipDiv2left
add_csqButton
print_snv
printSvPair


.occurrence must be set for each variant
all mlst of one data type
should work for all types of data

TODO
print vcf info about variant attributes

*/

const cutoff_tableview = 10

/*
for a list of variants, print details of both variant and samples

arg{}
.div
	contents are rendered here
.tipDiv
	optional. the menu.d DOM element of the menu; if provided, may try to move it left if table may be too wide and tipDiv is too much to right
.mlst[]
	can be of different dt
.tk
	.menutip
	.itemtip
.block
.tippos{left,top}
	if provided, is the x/y position of the tk.itemtip in which the table is displayed, and will allow moving tk.itemtip to left when it decides the table has too many columns
	if not provided, the function does not know which menu tip it is printing into and will not try to move it
*/
export async function itemtable(arg) {
	for (const m of arg.mlst) {
		if (m.dt != dtsnvindel && m.dt != dtfusionrna && m.dt != dtsv) throw 'mlst[] contains unknown dt'
	}

	const grid = arg.div
		.append('div')
		.style('display', 'inline-grid')
		.style('overflow-y', 'scroll')

	if (arg.mlst.length == 1) {
		await itemtable_oneItem(arg, grid)
	} else {
		await itemtable_multiItems(arg, grid)
	}

	mayMoveTipDiv2left(arg)
}

function mayMoveTipDiv2left(arg) {
	if (!arg.tipDiv) {
		// tipDiv not provided, this is called from leftlabel.variants, the tip is already on window left and no need to move
		return
	}
	// arg.div should have children: <div><table></div>
	// where table may show sample-by-attr info. if there are many columns, then try to move tipDiv to window left
	const tableDoms = []
	for (const d of arg.div.selectAll('div').selectAll('table')) {
		if (d) tableDoms.push(d)
	}
	if (!tableDoms.length) return // no table found
	let maxColumnCount = 0
	for (const table of tableDoms) {
		// table's first element should be <thead><tr>...</tr></thead>
		const thead = table.firstChild
		if (thead.tagName != 'THEAD') continue
		const tr = thead.firstChild
		if (tr.tagName != 'TR') continue
		maxColumnCount = Math.max(maxColumnCount, tr.childNodes?.length)
	}
	if (maxColumnCount > 5) {
		// dataset has lots of columns
		arg.tipDiv.style('left', '50px')
	}
}

/*
display full details (and samples) for one item
*/
async function itemtable_oneItem(arg, grid) {
	grid
		.style('grid-template-columns', 'auto auto')
		.style('max-height', '40vw')
		// in case creating a new table for multiple samples of this variant,
		// add space between grid and the new table
		.style('margin-bottom', '10px')

	if (arg.mlst[0].dt == dtsnvindel) {
		table_snvindel(arg, grid)
	} else {
		await table_svfusion(arg, grid)
	}

	// if the variant has only one sample,
	// allow to append new rows to grid to show sample key:value
	arg.singleSampleDiv = grid
	// if there are multiple samples, this <div> won't be used
	// a new table will be created under arg.div to show sample table

	if (arg.tk.mds.variant2samples && arg.mlst[0].occurrence) {
		// display samples carrying this variant when conditions are met
		await init_sampletable(arg)
	}
}

/*
multiple variants
show an option for each, click one to run above single-variant code
grid has optional columns, only the first column is clickable menu option, rest of columns are info only
1. basic info about the variant, as menu option
2. occurrence if present, as text 
3. numeric value if used, as text
*/
async function itemtable_multiItems(arg, grid) {
	// limit height
	grid.style('max-height', '40vw')
	// possible columns
	const hasOccurrence = arg.mlst.some(i => i.occurrence)
	// numeric value?

	if (hasOccurrence) {
		// has more than 1 column
		grid.style('grid-template-columns', 'auto auto')
	}

	///////// print all rows

	// header row
	// header - note
	grid
		.append('div')
		.text('Click a variant to see details')
		.style('font-size', '.8em')
		.style('color', '#ccc')
		.style('position', 'sticky')
		.style('top', '0px')
		.style('background', 'white')
	if (hasOccurrence) {
		grid
			.append('div')
			.text('Occurrence')
			.style('font-size', '.8em')
			.style('color', '#ccc')
			.style('position', 'sticky')
			.style('top', '0px')
			.style('background', 'white')
	}

	// upon clicking an option for a variant
	// hide grid and display go-back button allowing to go back to grid (all options)
	const goBackButton = arg.div
		.append('div')
		.style('margin-bottom', '10px')
		.style('display', 'none')
	goBackButton
		.append('span')
		.html('&#8810; Back to list')
		.attr('class', 'sja_clbtext')
		.on('click', () => {
			grid.style('display', 'inline-grid')
			goBackButton.style('display', 'none')
			singleVariantDiv.style('display', 'none')
		})

	const singleVariantDiv = arg.div.append('div').style('display', 'none')

	for (const m of arg.mlst) {
		// create a menu option, clicking to show this variant by itself
		const div = grid
			.append('div')
			.attr('class', 'sja_menuoption')
			.on('click', () => {
				grid.style('display', 'none')
				goBackButton.style('display', 'block')
				singleVariantDiv
					.style('display', 'block')
					.selectAll('*')
					.remove()
				const a2 = Object.assign({}, arg)
				a2.mlst = [m]
				a2.div = singleVariantDiv
				itemtable(a2)
			})

		// print variant name

		if (m.dt == dtsnvindel) {
			div.append('span').text(m.mname)
			div
				.append('span')
				.text(mclass[m.class].label)
				.style('font-size', '.8em')
				.style('margin-left', '10px')
				.style('color', mclass[m.class].color)
			div
				.append('span')
				.text(`${m.chr}:${m.pos + 1}${m.ref ? ', ' + m.ref + '>' + m.alt : ''}`)
				.style('font-size', '.8em')
				.style('margin-left', '10px')
		} else if (m.dt == dtsv || m.dt == dtfusionrna) {
			div
				.append('span')
				.text(mclass[m.class].label)
				.style('font-size', '.7em')
				.style('margin-right', '8px')

			printSvPair(m.pairlst[0], div)
		} else {
			div.text('error: unknown m.dt')
		}

		// additional columns of this row

		if (hasOccurrence) {
			grid
				.append('div')
				.text(m.occurrence || '')
				.style('padding', '5px 10px') // same as sja_menuoption
		}
	}

	if (!arg.doNotListSample4multim && arg.tk.mds.variant2samples) {
		const totalOccurrence = arg.mlst.reduce((i, j) => i + (j.occurrence || 0), 0)
		if (totalOccurrence) {
			grid
				.append('div')
				.style('margin-top', '10px')
				.append('span')
				.attr('class', 'sja_clbtext')
				.text('List all samples')
				.on('click', async () => {
					grid.remove()
					await init_sampletable(arg)
					mayMoveTipDiv2left(arg)
				})
		}
	}
}

function table_snvindel({ mlst, tk, block }, grid) {
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
	if (m.occurrence > 1) {
		const [td1, td2] = get_list_cells(grid)
		td1.text('Occurrence')
		td2.text(m.occurrence)
	}
	table_snvindel_mayInsertNumericValueRow(m, tk, grid)
	table_snvindel_mayInsertHtmlSections(m, tk, grid)
	table_snvindel_mayInsertLD(m, tk, grid)

	if (m.info) {
		/* info fields are available for this variant
		later to add more features for info field display
		by referencing tk.mds.bcf.info{} for instructions to display each info field
		*/
		for (const key in m.info) {
			if (key == 'CSQ') {
				// TODO for custom tk, backend will send csq to client for display
				// for native tk, dataset may be configured not to send?
				continue
			}

			const [td1, td2] = get_list_cells(grid)

			// column 1: info field key
			td1.text(key)

			// column 2: info field value of this variant m{}
			// value can be array or one string

			const infoValue = m.info[key]
			const infoField = tk.mds?.bcf?.info?.[key] // client-side obj about this info field, could be missing for custom track!!

			// TODO improve code
			if (Array.isArray(infoValue)) {
				for (const v of infoValue) {
					renderInfoTd(m, infoField, v, td2, tk)
				}
			} else {
				renderInfoTd(m, infoField, infoValue, td2, tk)
			}

			if (infoField?.Description) {
				td2
					.append('span')
					.style('margin-left', '10px')
					.style('font-size', '.8em')
					.style('opacity', 0.6)
					.text(infoField.Description)
			}
		}
	}
}

function table_snvindel_mayInsertNumericValueRow(m, tk, grid) {
	const currentMode = tk.skewer.viewModes.find(i => i.inuse)
	if (currentMode.type != 'numeric' || currentMode.byAttribute == 'occurrence') return
	// current mode is numeric and is not occurrence, as occurrence has already been shown in the table
	const [td1, td2] = get_list_cells(grid)
	if (currentMode.tooltipPrintValue) {
		const tmp = currentMode.tooltipPrintValue(m)
		if (tmp.indexOf(' = ')) {
			const [k, v] = tmp.split(' = ')
			td1.text(k)
			td2.text(v)
			return
		}
	}
	td1.text(currentMode.label)
	td2.text(m.__value_missing ? 'NA' : m.__value_use)
}
function table_snvindel_mayInsertHtmlSections(m, tk, grid) {
	if (!m.htmlSections) return
	if (!Array.isArray(m.htmlSections)) throw 'htmlSections[] is not array'
	for (const section of m.htmlSections) {
		const [td1, td2] = get_list_cells(grid)
		if (section.key && section.html) {
			td1.text(section.key)
			td2.html(section.html)
		}
		// support more configurations
	}
}

function renderInfoTd(m, infoField, infoValue, td, tk) {
	/* render the <td> cell for one INFO field for a variant
m{}
key:str
infoValue:str
td: <td>
tk{}
*/
	if (!infoField) {
		// no "control" object for the info field
		td.append('span').text(infoValue)
		return
	}

	if (infoField.urlBase) {
		// value of this info field will be rendered as url
		td.append('a')
			.text(infoValue)
			.attr('href', infoField.urlBase + infoValue)
			.attr('target', '_blank')
		return
	}
	// this key is not rendered as url, show it using following logic
	const valueSpan = td.append('span').text(infoValue)
	if (infoField && infoField.categories) {
		const category = infoField.categories[infoValue]
		if (category) {
			// {color,label,textcolor}
			valueSpan.style('padding', '1px 4px').style('background', category.color)
			if (category.textcolor) {
				valueSpan.style('color', category.textcolor)
			}
		}
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

export function print_snv(holder, m, tk) {
	let printto = holder

	const url = tk.mds.queries?.snvindel?.variantUrl
	if (url && url.key in m) {
		if (url.shownSeparately) {
			// create a separate <a> element for the url, not directly on the Mutation field
			printto = holder.append('span')
			holder
				.append('a')
				.style('padding-left', '10px')
				.attr('href', url.base + m[url.key])
				.attr('target', '_blank')
				.text(m[url.key])
		} else {
			// url is created directly on mutation value
			const a = holder.append('a')
			a.attr('href', tk.mds.queries.snvindel.variantUrl.base + m[tk.mds.queries.snvindel.variantUrl.key])
			a.attr('target', '_blank')
			printto = a
		}
	}
	printto.html(`${m.chr}:${m.pos + 1} ${m.ref && m.alt ? m.ref + '>' + m.alt : ''}`)
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

async function table_svfusion(arg, grid) {
	// display one svfusion event

	// svgraph in 1st row
	grid.append('div')
	await makeSvgraph(arg.mlst[0], grid.append('div').style('margin-bottom', '10px'), arg.block)

	// rows
	{
		const [c1, c2] = get_list_cells(grid)
		c1.text('Data type')
		c2.text(mclass[arg.mlst[0].class].label)
	}
	{
		// todo: support chimeric read fraction on each break end
		const [c1, c2] = get_list_cells(grid)
		c1.text('Break points')
		for (const pair of arg.mlst[0].pairlst) {
			printSvPair(pair, c2.append('div'))
		}
	}
}

export function printSvPair(pair, div) {
	if (pair.a.name)
		div
			.append('span')
			.text(pair.a.name)
			.style('font-weight', 'bold')
			.style('margin-right', '5px')
	div
		.append('span')
		.text(
			`${pair.a.chr}:${pair.a.pos} ${pair.a.strand == '+' ? 'forward' : 'reverse'} > ${pair.b.chr}:${pair.b.pos} ${
				pair.b.strand == '+' ? 'forward' : 'reverse'
			}`
		)
	if (pair.b.name)
		div
			.append('span')
			.text(pair.b.name)
			.style('font-weight', 'bold')
			.style('margin-left', '5px')
}

async function makeSvgraph(m, div, block) {
	const wait = div.append('div').text('Loading...')
	try {
		if (!m.pairlst) throw '.pairlst[] missing'
		const svpair = {
			a: {
				chr: m.pairlst[0].a.chr,
				position: m.pairlst[0].a.pos,
				strand: m.pairlst[0].a.strand
			},
			b: {
				chr: m.pairlst[0].b.chr,
				position: m.pairlst[0].b.pos,
				strand: m.pairlst[0].b.strand
			}
		}

		await getGm(svpair.a, block)
		await getGm(svpair.b, block)

		wait.remove()

		const _ = await import('#src/svgraph')
		_.default({
			pairlst: [svpair],
			genome: block.genome,
			holder: div
		})
	} catch (e) {
		wait.text(e.message || e)
	}
}
async function getGm(p, block) {
	// p={chr, position}
	const d = await dofetch3('isoformbycoord', { body: { genome: block.genome.name, chr: p.chr, pos: p.position } })
	if (d.error) throw d.error
	const u = d.lst.find(i => i.isdefault) || d.lst[0]
	if (u) {
		p.name = u.name
		p.gm = { isoform: u.isoform }
	}
}

function table_snvindel_mayInsertLD(m, tk, grid) {
	if (!tk.mds.queries?.ld) return
	const [td1, td2] = get_list_cells(grid)
	td1.text('LD overlay')

	const m0 = tk.mds.queries.ld.mOverlay?.m // if doing overlay now, returns the "index" m

	for (const o of tk.mds.queries.ld.tracks) {
		// o = {name}
		const btn = td2.append('button').text(o.name)

		if (m0 && m0.ssm_id == m.ssm_id) {
			// the same index variant everybody else's overlaying against
			if (o.name == tk.mds.queries.ld.mOverlay.ldtkname) {
				// the same ld tk
				btn.property('disabled', true)
				continue
			}
		}

		// enable clicking this button to overlay on this ld tk
		btn.on('click', () => {
			tk.itemtip.hide()
			// create the object to indicate overlaying is active
			tk.mds.queries.ld.mOverlay = {
				ldtkname: o.name,
				m: {
					chr: m.chr,
					pos: m.pos,
					ref: m.ref,
					alt: m.alt,
					ssm_id: m.ssm_id // required for highlighting
				}
			}
			tk.load()
		})
	}
}

// not in use
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
// not in use
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
