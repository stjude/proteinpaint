import { mclass, dtsnvindel, dtfusionrna, dtsv, dtcnv, dtitd, bplen, dt2label } from '#shared/common.js'
import { init_sampletable, getSamples, displaySampleTable } from './sampletable'
import { appear, renderTable, table2col, makeSsmLink, isoformPairRangeSelect } from '#dom'
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
			makeBreakpointChart
				getGeneModels
	itemtable_multiItems
mayMoveTipDiv2left
add_csqButton
print_snv
printSvPair
*/

const cutoff_tableview = 10

export async function itemtable(arg) {
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
	} else if (m.dt == dtcnv || m.dt == dtitd) {
		table_cnv(arg, table)
	} else {
		throw new Error('unknown dt')
	}

	// if the variant has only one sample,
	// allow to append new rows to table to show sample key:value
	arg.singleSampleDiv = table
	// if there are multiple samples, this <div> won't be used
	// a new table will be created under arg.div to show sample table

	if (arg.tk.mds.variant2samples) {
		if (m.occurrence) {
			// has valid occurrence; display samples carrying this variant
			if (arg.svfusionSampleTable) {
				/* this sv/fusion event breaks at multiple positions of the partner gene, and the breakpoint
				chart of table_svfusion() has taken over rendering of the sample table, as the table is
				limited to the selected breakpoint and re-rendered on selecting another */
				await arg.svfusionSampleTable()
			} else {
				await init_sampletable(arg)
			}
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
				} else if (m.dt == dtitd) {
					const cs = cnv2str(m, arg.tk)
					td.html(cs.value + '&nbsp;&nbsp;' + cs.pos)
				} else {
					td.text('error: unknown m.dt')
					throw new Error('unknown dt')
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
		if (section.callback) {
			if (section.key) td1.text(section.key)
			td2
				.append('button')
				.text(section.label || 'Run')
				.on('click', section.callback)
		} else if (section.key && section.html) {
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
	if (m.__cim) {
		div
			.append('span')
			.html('&#9888;')
			.style('margin-left', '5px')
			.attr('title', 'Consequence annotation is not based on current gene isoform')
	}
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
	const m = arg.mlst[0]
	if (!m.pairlst?.[0]) throw '.pairlst[] missing'

	// svgraph in 1st row
	const graphDiv = table.scrollDiv.insert('div', ':first-child') // insert to top

	// rows
	{
		const [c1, c2] = table.addRow()
		c1.text('Data type')
		c2.text(mclass[m.class].label)
	}
	// todo: support chimeric read fraction on each break end
	const [c1, c2] = table.addRow()
	c1.text('Break points')

	// m.pairlstIdx is the side of the pair on the gene in view, thus the partner is the other side
	const partnerSide = m.pairlstIdx == 0 ? 'b' : 'a'
	if (m.pairlst[0][partnerSide]?.breakpoints) {
		/* the samples of this event break at multiple positions of the partner gene (see
		mayUpdatePairlst() in mds3.load.js); chart them and let user pick which to show */
		await makeBreakpointChart(arg, m, partnerSide, graphDiv, c2)
	} else {
		await makeSvgraph(m, graphDiv, arg.block)
		for (const pair of m.pairlst) {
			printSvPair(pair, c2.append('div'))
		}
	}
}

/*
chart the breakpoints of the partner gene, linked to the breakpoint of the gene in view, over the isoform
structures of both genes, via isoformPairRangeSelect(). the user selects a range on the partner gene there
(by dragging, typing coordinates, or clicking a link) and applies it; then:
- the fusion structure of the selected breakpoint is drawn (of the most frequent one, when several are selected)
- the break points in range are listed in breakpointCell
- the sample table is limited to the samples breaking within the range
clearing the range shows all breakpoints and samples. the most frequent breakpoint is selected to begin with

m.pairlst[0][partnerSide].breakpoints[] is required; see mayUpdatePairlst() in mds3.load.js
*/
async function makeBreakpointChart(arg, m, partnerSide, div, breakpointCell) {
	const selfSide = partnerSide == 'a' ? 'b' : 'a'
	const self = m.pairlst[0][selfSide] // point on the gene in view
	const partner = m.pairlst[0][partnerSide]
	const breakpoints = partner.breakpoints

	const chartDiv = div.append('div').attr('data-testid', 'sjpp-mds3tk-svfusionBreakpointChart').style('margin', '10px')
	const svgraphDiv = div.append('div')

	// the breakpoint of the gene in view can be intergenic and carry no name; the gene in view is then used
	const selfGene = self.name || arg.block.usegm?.name
	/* one isoform per gene, over which the breakpoints are charted: the isoform in view for the gene in
	view, and the default isoform of the partner. If using all isoforms of a gene the tooltip would be too 
	tall to be usable, e.g. 50 rows for TP53 */
	const [selfGm, partnerGm] = await Promise.all([
		getGeneModels(arg.block.genome, selfGene, arg.block.usegm?.isoform),
		getGeneModels(arg.block.genome, partner.name)
	])

	const api = isoformPairRangeSelect({
		holder: chartDiv,
		self: { gene: selfGene || self.chr, chr: self.chr, allgm: selfGm },
		partner: { gene: partner.name || partner.chr, chr: partner.chr, allgm: partnerGm },
		links: breakpoints.map(b => ({ selfPos: self.pos, partnerPos: b.pos, samplecount: b.samplecount })),
		// a fusion transcript is read on the exons; an sv on the genome. same as the breakpoint filter ui
		mode: m.dt == dtfusionrna ? 'rna' : 'genomic',
		// room for an ensembl isoform name and the locus of a zoomed track, which the default width clips
		labelWidth: 140,
		// a sample with events at two partner breakpoints is counted at both
		samplesAreUpperBound: true,
		callback: range => select(range)
	})

	let selected // {chr,start,stop} range on the partner gene in display; null for all breakpoints
	let latest = 0 // increments on each selection, so that a slow render does not overwrite a newer one
	// samples of this event, and the holder of their table; both are set by arg.svfusionSampleTable() below
	let allSamples, sampleTableDiv

	// pair of breakpoints for one partner breakpoint, in the same shape as m.pairlst[0]
	function makePair(b) {
		const pair = {}
		pair[selfSide] = self
		pair[partnerSide] = { chr: b.chr, pos: b.pos, strand: b.strand, name: partner.name }
		return pair
	}

	async function select(range) {
		const token = ++latest
		selected = range
		try {
			// breakpoints[] are all on the partner chr, the chr of the range
			const inRange = range ? breakpoints.filter(b => b.pos >= range.start && b.pos <= range.stop) : breakpoints

			breakpointCell.selectAll('*').remove()
			if (!inRange.length)
				breakpointCell.append('div').style('opacity', 0.6).text('No breakpoint in the selected range')
			for (const b of inRange) {
				const d = breakpointCell.append('div')
				printSvPair(makePair(b), d)
				d.append('span')
					.style('margin-left', '5px')
					.style('opacity', 0.6)
					.text('n=' + b.samplecount)
			}

			svgraphDiv.selectAll('*').remove()
			if (inRange.length) {
				if (inRange.length > 1) {
					// the fusion structure is of one pair of breakpoints; breakpoints[] is sorted by count
					svgraphDiv
						.append('div')
						.style('margin', '0px 10px')
						.style('opacity', 0.6)
						.text(
							`Fusion structure of the most frequent of ${
								range ? 'the ' + inRange.length + ' selected' : 'all'
							} breakpoints`
						)
				}
				// render into a new <div> so that the graph is wiped out on selecting another breakpoint
				await makeSvgraph(
					Object.assign({}, m, { pairlst: [makePair(inRange[0])] }),
					svgraphDiv.append('div'),
					arg.block
				)
			}

			await renderSampleTable(token)
		} catch (e) {
			// nothing awaits a selection made in the chart; report in place rather than leaving an unhandled rejection
			if (token == latest) breakpointCell.text('Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
	}

	async function renderSampleTable(token) {
		if (!sampleTableDiv || !allSamples) return // samples are not yet loaded; rendered when they are
		if (token != latest) return // another breakpoint is selected in the meantime; its render wins
		sampleTableDiv.selectAll('*').remove()
		/* limit to samples with an event breaking in the selected range, and each such sample to its events in
		range, so its row prints only the matching breakpoints. a sample carries its events in _pairArray[],
		aligned with ssm_id_lst[] (see combineSamplesById() in mds3.variant2samples.js) */
		let samples = allSamples
		if (selected) {
			samples = []
			for (const s of allSamples) {
				const keep = [] // indices of the events in range
				s._pairArray?.forEach((pairlst, i) => {
					const p = pairlst?.[0]?.[partnerSide]
					if (p?.chr == selected.chr && p.pos >= selected.start && p.pos <= selected.stop) keep.push(i)
				})
				if (keep.length)
					samples.push(
						Object.assign({}, s, {
							_pairArray: keep.map(i => s._pairArray[i]),
							ssm_id_lst: s.ssm_id_lst?.filter((_, i) => keep.includes(i))
						})
					)
			}
		}
		if (!samples.length) {
			sampleTableDiv.append('div').style('margin', '10px').style('opacity', 0.6).text('No sample')
			return
		}
		try {
			await displaySampleTable(
				samples,
				// singleSampleDiv is dropped so that a single sample of the selection is printed in sampleTableDiv
				Object.assign({}, arg, { div: sampleTableDiv, singleSampleDiv: null })
			)
		} catch (e) {
			// same as init_sampletable(), show the error in place of the table
			if (token == latest) sampleTableDiv.text('Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
	}

	/* called by itemtable_oneItem() in place of init_sampletable(), as the sample table is limited to the
	selected breakpoint and re-rendered on selecting another */
	arg.svfusionSampleTable = async () => {
		sampleTableDiv = arg.div.append('div')
		const wait = sampleTableDiv.append('div').text('Loading...').style('padding', '10px').style('color', '#8AB1D4')
		try {
			allSamples = await getSamples(arg)
			wait.remove()
			await renderSampleTable(latest)
		} catch (e) {
			wait.text('Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
	}

	// begin with the most frequent breakpoint; breakpoints[] is sorted by count
	const mostFreqBP = { chr: partner.chr, start: breakpoints[0].pos, stop: breakpoints[0].pos }
	api?.setRange(mostFreqBP)
	await select(mostFreqBP)
}

/*
gene models of a gene by name, for charting breakpoints over its isoform. returns the preferred isoform when
given and found, else the default isoform(s), else all models of the gene. none when the name is missing or
unknown, so that the chart still draws the breakpoints on their own
*/
async function getGeneModels(genome, gene, preferredIsoform) {
	if (!gene) return []
	try {
		const data = await dofetch3('genelookup', { body: { genome: genome.name, input: gene, deep: 1 } })
		if (data.error) throw data.error
		const gmlst = data.gmlst || []
		const preferred = gmlst.filter(gm => gm.isoform == preferredIsoform)
		if (preferred.length) return preferred
		const defaults = gmlst.filter(gm => gm.isdefault)
		return defaults.length ? defaults : gmlst
	} catch (e) {
		console.warn(`no gene model for ${gene}: ${e.message || e}`)
		return []
	}
}

export function table_cnv(arg, table) {
	const m = arg.mlst[0]
	const cs = cnv2str(m, arg.tk)
	{
		const [c1, c2] = table.addRow()
		c1.text(mclass[m.class]?.desc)
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
	// TODO need queries.cnv.type=categorical/logratio/integer copy number
	// with type, will be able to make better indication
	if (Number.isFinite(m.value)) {
		if (tk.cnv.colorScale) {
			cs.value = `<span style="background:${tk.cnv.colorScale(m.value)}">&nbsp;&nbsp;</span> ${m.value}`
		} else {
			// color scale will be missing when cnv in density mode, and a cnv event can still be displayed in sample table!
			cs.value = m.value
		}
	} else {
		cs.value = `<span style="background:${mclass[m.class].color}">&nbsp;&nbsp;</span> 
			${tk.mds.termdbConfig?.mclass?.[m.class]?.label || mclass[m.class].label}`
	}
	cs.pos = `${m.chr}:${m.start}-${m.stop} <span style="font-size:.8em">${bplen(m.stop - m.start)}</span>`
	return cs
}

export function printSvPair(pair, div) {
	if (pair.a.name) div.append('span').text(pair.a.name).style('font-weight', 'bold').style('margin-right', '5px')
	div.append('span').text(`${svPoint2str(pair.a)} > ${svPoint2str(pair.b)}`)
	if (pair.b.name) div.append('span').text(pair.b.name).style('font-weight', 'bold').style('margin-left', '5px')
}

/* a point of a sv/fusion pair, at 1-based position. the partner point of an aggregated event may hold multiple
breakpoints (see mayUpdatePairlst() in mds3.load.js), which are charted by table_svfusion() instead */
function svPoint2str(p) {
	if (p.breakpoints) return `${p.chr} ${p.breakpoints.length} breakpoints`
	return `${p.chr}:${p.pos + 1} ${p.strand == '+' ? 'forward' : 'reverse'}`
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

		await getGm(svpair.a, block, m.pairlst[0].a.name, m.pairlst[0].a.isoform)
		await getGm(svpair.b, block, m.pairlst[0].b.name, m.pairlst[0].b.isoform)

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

// isoform is optional
async function getGm(p, block, geneName, isoform) {
	// p={chr, position}
	if (isoform) {
		// isoform already specified on the breakend. use as-is and without validation
		p.name = geneName
		p.gm = { isoform }
		return
	}
	// no isoform specified. find matching isoform by position
	const d = await dofetch3('isoformbycoord', { body: { genome: block.genome.name, chr: p.chr, pos: p.position } })
	if (d.error) throw d.error
	//Find name if more than one gene returned
	const u = d.lst.find(i => i.isdefault && geneName == i.name) || d.lst[0]
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
