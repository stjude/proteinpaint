import { mclass, dtsnvindel, dtfusionrna, dtsv, dtcnv, bplen, dt2label } from '#shared/common.js'
import { init_sampletable } from './sampletable'
import { appear, renderTable, table2col, makeSsmLink, Menu } from '#dom'
import { dofetch3 } from '#common/dofetch'

/*
when there's just one item, print a vertical 2-col table to show details
when there are multiple items (all same type!!), print a table to list all items
this table is different from "sampletable" in that it focuses on a brief overview of multiple items, and only print occurrence of each item and no other sample-level detail
	TODO always nice to add in more columns for better description of the items, e.g. vcf info fields

arg{}
.div
	contents are rendered here
.tipDiv
	optional. the menu.d DOM element of the menu;
	if provided, may try to move it left if table may be too wide and tipDiv is too much to right
.mlst[]
	!!! all of the same dt !!!
	.occurrence=int must be set for each variant
.tk
.block
.tippos{left,top}
	if provided, is the x/y position of the tk.itemtip in which the table is displayed, and will allow moving tk.itemtip to left when it decides the table has too many columns
	if not provided, the function does not know which menu tip it is printing into and will not try to move it
.doNotListSample4multim
	only set to true by leftlabel.variant to not to generate a sample handle


itemtable
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
*/

const cutoff_tableview = 10
//let ontologyTerms

export async function itemtable(arg) {
	if (arg.mlst.find(m => m.dt != dtsnvindel && m.dt != dtfusionrna && m.dt != dtsv && m.dt != dtcnv)) {
		throw 'mlst[] contains unknown dt'
	}

	if (arg.mlst.length == 1) {
		await itemtable_oneItem(arg)
	} else {
		await itemtable_multiItems(arg)
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
export async function itemtable_oneItem(arg) {
	const table = table2col({ holder: arg.div })

	const m = arg.mlst[0]

	if (m.dt == dtsnvindel) {
		table_snvindel(arg, table)
	} else if (m.dt == dtsv || m.dt == dtfusionrna) {
		await table_svfusion(arg, table)
	} else if (m.dt == dtcnv) {
		table_cnv(arg, table)
	} else {
		throw 'itemtable_oneItem: unknown dt'
	}

	// if the variant has only one sample,
	// allow to append new rows to table to show sample key:value
	arg.singleSampleDiv = table
	// if there are multiple samples, this <div> won't be used
	// a new table will be created under arg.div to show sample table

	if (arg.tk.mds.variant2samples) {
		if (m.occurrence) {
			// has valid occurrence; display samples carrying this variant
			await init_sampletable(arg)
		}
	}
}

/*
multiple variants
show an option for each, click one to run above single-variant code
mlst table has optional columns, only the first column is clickable menu option, rest of columns are info only
1. basic info about the variant, as menu option
2. occurrence if present, as text
3. numeric value if used, as text
*/
async function itemtable_multiItems(arg) {
	// upon clicking an option for a variant, hide tableDiv and display go-back button allowing to go back to tableDiv
	const goBackButton = arg.div.append('div').style('margin', '10px').append('button').style('display', 'none')
	goBackButton.html('&#8810; Back to list').on('click', () => {
		tableDiv.style('display', '')
		goBackButton.style('display', 'none')
		singleVariantDiv.style('display', 'none')
	})
	const singleVariantDiv = arg.div.append('div').style('display', 'none')

	///////////////// determine table columns

	const columns = [
		{
			label: `Click a ${dt2label[arg.mlst[0].dt]} to see details`,
			fillCell: (td, i) => {
				// to render an item into a cell, not convenient to use "value" or "html", use fillCell() to create elements with click handler
				const m = arg.mlst[i]
				if (m.dt == dtsnvindel) {
					td.append('span').text(arg.tk.mnamegetter(m))
					td.append('span')
						.text(mclass[m.class].label)
						.style('font-size', '.8em')
						.style('margin-left', '10px')
						.style('color', mclass[m.class].color)
					td.append('span')
						.text(`${m.chr}:${m.pos + 1}${m.ref ? ', ' + m.ref + '>' + m.alt : ''}`)
						.style('font-size', '.8em')
						.style('margin-left', '10px')
				} else if (m.dt == dtsv || m.dt == dtfusionrna) {
					td.append('span').text(mclass[m.class].label).style('font-size', '.7em').style('margin-right', '8px')

					printSvPair(m.pairlst[0], td)
				} else if (m.dt == dtcnv) {
					const cs = cnv2str(m, arg.tk)
					td.html(cs.value + '&nbsp;&nbsp;' + cs.pos)
				} else {
					td.text('error: unknown m.dt')
				}
			}
		}
	]
	const hasOccurrence = arg.mlst.some(i => i.occurrence)
	if (hasOccurrence) {
		columns.push({ label: 'Occurrence' })
		// do not sort m by occurrence to show by order of position
	}
	// info fields?
	let infoFields = null
	if (arg.tk.mds.bcf?.info) {
		infoFields = []
		for (const k in arg.tk.mds.bcf.info) {
			if (arg.tk.mds.bcf.info[k].categories) {
				infoFields.push(k)
				columns.push({ label: arg.tk.mds.bcf.info[k].name || k })
			}
		}
		if (infoFields.length == 0) infoFields = null
	}
	// numeric value view mode object (that is not occurrence)
	let numViewMode
	if (arg.tk.skewer) {
		numViewMode = arg.tk.skewer.viewModes.find(i => i.inuse && i.type == 'numeric' && i.byAttribute != 'occurrence')
		if (numViewMode) {
			columns.push({ label: numViewMode.label })
		}
	}

	////////////////// generate table rows

	// sort mlst by on screen position "__x", common to all dt and irrespective of block strand
	arg.mlst.sort((i, j) => i.__x - j.__x)

	const rows = [] // one row per m
	for (const m of arg.mlst) {
		const row = [{}] // 1st blank cell to print variant button
		if (hasOccurrence) {
			row.push({ value: 'occurrence' in m ? m.occurrence : '' })
		}
		if (infoFields) {
			for (const k of infoFields) {
				const v = m.info?.[k]
				if (v == undefined) {
					row.push({}) // unannotated
				} else {
					const o = arg.tk.mds.bcf.info[k].categories[v]
					if (o?.color) {
						row.push({ html: `<span style="background:${o.color}">&nbsp;&nbsp;</span> ${o.label || v}` })
					} else {
						row.push({ value: v })
					}
				}
			}
		}
		if (numViewMode) {
			row.push({ value: m.__value_use })
		}
		rows.push(row)
	}

	const tableDiv = arg.div.append('div')

	renderTable({
		div: tableDiv,
		columns,
		rows,
		resize: true,
		noButtonCallback: i => {
			tableDiv.style('display', 'none')
			goBackButton.style('display', '')
			singleVariantDiv.style('display', '').selectAll('*').remove()
			const a2 = Object.assign({}, arg)
			a2.mlst = [arg.mlst[i]]
			a2.div = singleVariantDiv
			itemtable(a2)
		},
		singleMode: true,
		noRadioBtn: true
	})

	if (!arg.doNotListSample4multim && arg.tk.mds.variant2samples) {
		const totalOccurrence = arg.mlst.reduce((i, j) => i + (j.occurrence || 0), 0)
		if (totalOccurrence) {
			arg.div
				.append('div')
				.style('margin-top', '10px')
				.append('span')
				.attr('class', 'sja_clbtext')
				.text('List all samples')
				.on('click', async event => {
					event.target.remove()
					tableDiv.remove()
					await init_sampletable(arg)
					mayMoveTipDiv2left(arg)
				})
		}
	}
}

/*
table display of variant attributes, for mlst[0] single variant
do not show sample level details
*/
async function table_snvindel({ mlst, tk, block }, table) {
	const m = mlst[0]
	{
		const [td1, td2] = table.addRow()
		td1.text(block.mclassOverride ? block.mclassOverride.className : 'Consequence')
		print_mname(td2, m)
		//add_csqButton(m, tk, td2, table)
	}
	{
		const [td1, td2] = table.addRow()
		// do not pretend m is mutation if ref/alt is missing
		td1.text(m.ref && m.alt ? 'Mutation' : 'Position')
		print_snv(td2, m, tk, block)
		// if (tk.mds.termdbConfig?.queries?.alphaGenome && m.ref && m.alt && m.ref != '-' && m.alt != '-') {
		// 	if (!ontologyTerms) await dofetch3('alphaGenomeTypes', {}).then(data => (ontologyTerms = data.ontologyTerms))

		// 	const [td3, td4] = table.addRow()
		// 	// do not pretend m is mutation if ref/alt is missing
		// 	td3.text('Alpha Genome')
		// 	const select = td4.append('select')
		// 	for (const term of ontologyTerms) select.append('option').attr('value', term.value).text(term.label)
		// 	const ontologyTerm = tk.mds.termdbConfig.queries.alphaGenome?.ontologyTerm
		// 	if (ontologyTerm) select.node().value = ontologyTerm

		// 	td4
		// 		.append('button')
		// 		.text('View')
		// 		.on('click', async () => {
		// 			openAlphaGenome(m, select.node().value)
		// 		})
		// }
	}
	if (m.occurrence > 1) {
		const [td1, td2] = table.addRow()
		td1.text('Occurrence')
		td2.text(m.occurrence)
	}
	table_snvindel_mayInsertNumericValueRow(m, tk, table)
	table_snvindel_mayInsertHtmlSections(m, tk, table)
	table_snvindel_mayInsertLD(m, tk, table)

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

			const [td1, td2] = table.addRow()

			// column 1: info field key
			td1.text(key).attr('data-testid', 'sjpp-mds3tk-singlemtablerow4infokey')

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

/*
const menu = new Menu({ padding: '2px' })
async function openAlphaGenome(m, ontologyTerm) {
	const params = {
		chromosome: m.chr,
		position: m.pos + 1,
		reference: m.ref,
		alternate: m.alt,
		ontologyTerms: [ontologyTerm]
	}

	const data = await dofetch3('alphaGenome', { body: params })
	if (data.error) {
		console.error(data.error)
		alert('Error fetching alpha genome: ' + (data.error.message || data.error))
		return
	}
	menu.clear()
	menu.d.append('img').attr('width', '1250px').attr('src', data.plotImage)
	menu.show(0, 0)
}
*/

function table_snvindel_mayInsertNumericValueRow(m, tk, table) {
	const currentMode = tk.skewer.viewModes.find(i => i.inuse)
	if (currentMode.type != 'numeric' || currentMode.byAttribute == 'occurrence') return
	// current mode is numeric and is not occurrence, as occurrence has already been shown in the table
	if (currentMode.tooltipPrintValue) {
		const tmp = currentMode.tooltipPrintValue(m)

		if (Array.isArray(tmp)) {
			for (const s of tmp) {
				// s should be {k,v}
				const [td1, td2] = table.addRow()
				td1.text(s.k)
				td2.text(s.v)
			}
		} else {
			console.log('unknown return value')
		}
		return
	}

	const [td1, td2] = table.addRow()
	td1.text(currentMode.label)
	td2.text(m.__value_missing ? 'NA' : m.__value_use)
}
function table_snvindel_mayInsertHtmlSections(m, tk, table) {
	if (!m.htmlSections) return
	if (!Array.isArray(m.htmlSections)) throw 'htmlSections[] is not array'
	for (const section of m.htmlSections) {
		const [td1, td2] = table.addRow()
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
	const color = infoField.categories?.[infoValue]?.color
	if (color) {
		// key has a color, show circle
		td.append('span').html('&nbsp;&nbsp;').style('background', color).style('margin-right', '5px')
	}
	td.append('span').text(infoField.categories?.[infoValue]?.label || infoValue)
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

export function print_snv(holder, m, tk, block) {
	// first print snv name. ref/alt may be missing if data is non-mutation
	// later its html may be rewritten with a link
	const ssmNameDom = holder.append('span').text(`${m.chr}:${m.pos + 1} ${m.ref && m.alt ? m.ref + '>' + m.alt : ''}`)

	// ssm url definition can come from two places! see type def
	const urlConfig = tk.mds.termdbConfig?.urlTemplates?.ssm || tk.mds.queries?.snvindel?.ssmUrl
	if (urlConfig) {
		const separateUrls = makeSsmLink(urlConfig, m, ssmNameDom, block.genome.name)
		if (separateUrls?.length) {
			holder.append('span').style('margin-left', '10px').html(separateUrls.join(' '))
		}
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
				const tr = table.append('tr').style('font-size', '.7em').style('opacity', 0.5)
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

async function table_svfusion(arg, table) {
	// display one svfusion event

	// svgraph in 1st row
	await makeSvgraph(
		arg.mlst[0],
		table.scrollDiv.insert('div', ':first-child'), // insert to top
		arg.block
	)

	// rows
	{
		const [c1, c2] = table.addRow()
		c1.text('Data type')
		c2.text(mclass[arg.mlst[0].class].label)
	}
	{
		// todo: support chimeric read fraction on each break end
		const [c1, c2] = table.addRow()
		c1.text('Break points')
		for (const pair of arg.mlst[0].pairlst) {
			printSvPair(pair, c2.append('div'))
		}
	}
}

export function table_cnv(arg, table) {
	const cs = cnv2str(arg.mlst[0], arg.tk)
	{
		const [c1, c2] = table.addRow()
		c1.text('Copy number change')
		c2.html(cs.value)
	}
	{
		const [c1, c2] = table.addRow()
		c1.text('Position')
		c2.html(cs.pos)
	}
}

export function cnv2str(m, tk) {
	const cs = {}
	// TODO need queries.cnv.type=cat/lr/cn
	// with type, will be able to make better indication
	if (Number.isFinite(m.value)) {
		cs.value = `<span style="background:${tk.cnv.colorScale(m.value)}">&nbsp;&nbsp;</span> ${m.value}`
	} else {
		cs.value = `<span style="background:${mclass[m.class].color}">&nbsp;&nbsp;</span> ${mclass[m.class].label}`
	}
	cs.pos = `${m.chr}:${m.start}-${m.stop} <span style="font-size:.8em">${bplen(m.stop - m.start)}</span>`
	return cs
}

export function printSvPair(pair, div) {
	if (pair.a.name) div.append('span').text(pair.a.name).style('font-weight', 'bold').style('margin-right', '5px')
	div
		.append('span')
		.text(
			`${pair.a.chr}:${pair.a.pos + 1} ${pair.a.strand == '+' ? 'forward' : 'reverse'} > ${pair.b.chr}:${
				pair.b.pos + 1
			} ${pair.b.strand == '+' ? 'forward' : 'reverse'}`
		)
	if (pair.b.name) div.append('span').text(pair.b.name).style('font-weight', 'bold').style('margin-left', '5px')
}

async function makeSvgraph(m, div, block) {
	div.attr('data-testid', 'sjpp-mds3tk-singlesvfusiongraph')
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

		await getGm(svpair.a, block, m.pairlst[0].a.name)
		await getGm(svpair.b, block, m.pairlst[0].b.name)

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
async function getGm(p, block, name) {
	// p={chr, position}
	const d = await dofetch3('isoformbycoord', { body: { genome: block.genome.name, chr: p.chr, pos: p.position } })
	if (d.error) throw d.error
	//Find name if more than one gene returned
	const u = d.lst.find(i => i.isdefault && name == i.name) || d.lst[0]
	if (u) {
		p.name = u.name
		p.gm = { isoform: u.isoform }
	}
}

function table_snvindel_mayInsertLD(m, tk, table) {
	if (!tk.mds.queries?.ld) return // not available
	const [td1, td2] = table.addRow()
	td1.text('LD overlay')

	const m0 = tk.mds.queries.ld.mOverlay?.m

	if (m0) {
		// doing overlay now. indicate some informational info; m0 is the selected variant
		const row = td2.append('div').style('margin-bottom', '5px')
		if (m.ssm_id == m0.ssm_id) {
			// the clicked variant is same as m0
			row.html(
				tk.mds.queries.ld.mOverlay.ldtkname +
					' r<sup>2</sup> values against this variant are displayed on all the other variants.'
			)
		} else {
			// not the same as m0
			let r2 = null
			for (const v of tk.mds.queries.ld.mOverlay.data || []) {
				if (v.pos == m.pos && v.alleles == m.ref + '.' + m.alt) {
					r2 = v.r2
					break
				}
			}
			if (r2 == null) {
				row.html('No r<sup>2</sup> value is found.')
			} else {
				row.html(tk.mds.queries.ld.mOverlay.ldtkname + ' r<sup>2</sup> = ' + r2)
			}
		}
	}

	td2
		.append('div')
		.html('Click a button to overlay LD r<sup>2</sup> values against this variant:')
		.style('font-size', '.8em')
		.style('opacity', 0.5)

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
