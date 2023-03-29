import { fillbar } from '#dom/fillbar'
import { get_list_cells } from '#dom/gridutils'
import { mclass, dtsnvindel, dtsv, dtfusionrna } from '#shared/common'
import { renderTable } from '#dom/table'
import { rgb } from 'd3-color'
import { print_snv, printSvPair } from './itemtable'
import { getsjcharts } from '../src/getsjcharts'
import { Menu } from '#dom/menu'

/*
********************** EXPORTED
init_sampletable()
	using mds.variant2samples.get() to map mlst[] to samples
	always return list of samples, does not return summaries
	mlst can be mixture of data types, doesn't matter

displaySampleTable()
	call this function to render one or multiple samples
	calls make_singleSampleTable() or renderTable()

samples2columnsRows()

********************** INTERNAL
make_singleSampleTable
feedSample2selectCallback


********************** arg{}
.mlst[]
	used for v2s.get() query
.tk
	.mds.variant2samples.twLst[]
.block
.div
.tid2value={}
 	sample filters by e.g. clicking on a sunburst ring, for tk.mds.variant2samples.get
.singleSampleDiv
	optional, if just one single sample, can show into this table rather than creating a new one
*/

const cutoff_tableview = 10

export async function init_sampletable(arg) {
	//run variant2samples.get() to map variants to samples
	const wait = arg.div
		.append('div')
		.text('Loading...')
		.style('padding', '10px')
		.style('color', '#8AB1D4')
		.style('font-size', '1.25em')
		.style('font-weight', 'bold')

	// may not be used!
	//terms from sunburst ring
	// Note: in ordered to keep term-values related to sunburst immuatable, these term names are
	// stored as 'tid2value_orig' and not removed from tid2Value when filter changed or removed
	arg.tid2value_orig = new Set()
	if (arg.tid2value) Object.keys(arg.tid2value).forEach(arg.tid2value_orig.add, arg.tid2value_orig)

	try {
		arg.querytype = arg.tk.mds.variant2samples.type_samples
		const samples = await arg.tk.mds.variant2samples.get(arg) // returns list of samples
		await displaySampleTable(samples, arg)
		wait.remove()
	} catch (e) {
		wait.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

export async function displaySampleTable(samples, args) {
	if (samples.length == 1) {
		return await make_singleSampleTable(samples[0], args)
	}
	const [columns, rows] = await samples2columnsRows(samples, args.tk)
	const params = { rows, columns, div: args.div, resize: rows.length > 10 }
	//if (args.maxWidth) params.maxWidth = args.maxWidth
	//if (args.maxHeight) params.maxHeight = args.maxHeight

	params.columnButtons = []

	if (args.tk.mds.queries?.singleSampleMutation) {
		const width = window.innerWidth
		const height = screen.height
		const colButton = {
			text: 'Disco',
			//disabled: (i) => false,
			callback: async (event, i) => {
				const sample = samples[i]
				showDtDisco(event, sample, args, true)
			}
		}
		params.columnButtons.push(colButton)
	}
	if (args.tk.allow2selectSamples) {
		// this tk allows to select samples; create new opt to display button

		params.buttons = [
			{
				text: args.tk.allow2selectSamples.buttonText,
				callback: sampleIdxLst => {
					// argument is list of array index of selected samples
					feedSample2selectCallback(args.tk, args.block, samples, sampleIdxLst)
					args.tk.itemtip.hide()
					args.tk.menutip.hide()
				}
			}
		]
	}

	return renderTable(params)
}

function feedSample2selectCallback(tk, block, samples, sampleIdxLst) {
	// map sampleIdxLst to sample attributes that caller wants to pick
	const pickLst = []
	for (const i of sampleIdxLst) {
		const s0 = samples[i]
		const s1 = {}
		for (const attr of tk.allow2selectSamples.attributes) {
			s1[attr] = s0[attr]
		}
		pickLst.push(s1)
	}
	tk.allow2selectSamples.callback({ samples: pickLst, source: 'Samples with ' + block2source(block) })
}

async function make_singleSampleTable(s, arg) {
	const grid_div =
		arg.singleSampleDiv ||
		arg.div
			.append('div')
			.style('display', 'inline-grid')
			.style('grid-template-columns', 'auto auto')
			.style('gap-row-gap', '1px')
			.style('align-items', 'center')
			.style('justify-items', 'left')
			.style('padding', '10px')
			.style('width', '100%')

	if (s.sample_id) {
		// sample_id is hardcoded
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text('Sample')
		printSampleName(s, arg.tk, cell2, arg.block)
	}

	/////////////
	// hardcoded logic to represent if this case is open or controlled-access
	if ('caseIsOpenAccess' in s) {
		const [cell1, cell2] = get_list_cells(grid_div)
		cell1.text('Access')
		cell2.text(s.caseIsOpenAccess ? 'Open' : 'Controlled')
	}

	if (arg.tk.mds.variant2samples.twLst) {
		for (const tw of arg.tk.mds.variant2samples.twLst) {
			const [cell1, cell2] = get_list_cells(grid_div)
			cell1.text(tw.term.name).style('text-overflow', 'ellipsis')
			cell2.style('text-overflow', 'ellipsis')
			if (tw.id in s) {
				if (Array.isArray(s[tw.id])) {
					if (tw.baseURL) {
						cell2.html(s[tw.id].map(i => `<a href=${tw.baseURL + i} target=_blank>${i}</a>`).join('<br>'))
					} else {
						cell2.html(s[tw.id].join('<br>'))
					}
				} else {
					// single value
					if (tw.baseURL) {
						cell2.html(`<a href=${tw.baseURL + s[tw.id]} target=_blank>${s[tw.id]}</a>`)
					} else {
						cell2.text(s[tw.id])
					}
				}
			}
		}
	}

	if (s.ssmid2format) {
		// format data is displayed per ssmid (if there are multiple variants)
		for (const ssmid of s.ssm_id_lst) {
			if (s.ssm_id_lst.length > 1) {
				// there are multiple, need to mark it out
				const div = grid_div
					.append('div')
					.style('grid-column', 'span 2')
					.style('margin-top', '20px')
				const m = arg.mlst.find(i => i.ssm_id == ssmid)
				if (m) {
					// found m object by id, can make a better display
					if (m.dt == 1) {
						print_snv(div, m, arg.tk)
					} else if (m.dt == 2 || m.dt == 5) {
						printSvPair(m.pairlst[0], div)
					} else {
						div.text(ssmid)
					}
				} else {
					div.text(ssmid)
				}
			} else {
				// only 1 ssm from this sample obj, no need to mark it out
			}

			for (const formatkey in s.ssmid2format[ssmid]) {
				const value = s.ssmid2format[ssmid][formatkey]
				const [cell1, cell2] = get_list_cells(grid_div)
				const fobj = arg.tk.mds?.bcf?.format?.[formatkey]
				cell1.text((fobj && fobj.Description) || formatkey)
				cell2.html(printFormat(fobj, value))
			}
		}
	}

	/* quick fix for accessing details of a single case
	if (arg.tk.mds.termdb && arg.tk.mds.termdb.allowCaseDetails) {
		// has one single case
		arg.div.append('div').text('Case details')
	}
	*/
}

function printSampleName(sample, tk, div, block) {
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
		a.style('word-break', 'break-word')
	} else {
		div.append('span').text(sample.sample_id)
	}

	const extraRow = div.append('div') // row under sample name to show optional info about the sample

	if (tk.allow2selectSamples) {
		// display button for selecting this sample alone
		const t = tk.allow2selectSamples.buttonText
		extraRow
			.append('button')
			.style('margin-right', '10px')
			.text(t.endsWith('s') ? t.substring(0, t.length - 1) : t)
			.on('click', () => {
				feedSample2selectCallback(tk, block, [sample], [0])
				tk.itemtip.hide()
				tk.menutip.hide()
			})
	}

	if (tk.mds.queries?.singleSampleMutation) {
		extraRow
			.append('button')
			.style('margin-right', '10px')
			.text('Disco plot')
			.on('click', async event => {
				event.target.innerHTML = 'Loading...'
				event.target.disabled = true
				try {
					showDtDisco(event, sample, { tk, block })
				} catch (e) {
					event.target.innerHTML = 'Error: ' + (e.message || e)
					if (e.stack) console.log(e.stack)
				}
			})
	}
}

async function showDtDisco(event, sample, arg, fromTable = false) {
	const mlst = await arg.tk.mds.queries.singleSampleMutation.get(
		sample[arg.tk.mds.queries.singleSampleMutation.sample_id_key || 'sample_id']
	)

	for (const i of mlst) i.position = i.pos

	const sjcharts = await getsjcharts()
	const disco_arg = {
		sampleName: sample.sample_id,
		data: mlst
	}
	arg.tk.menutip.clear().show(event.clientX, event.clientY)
	if (!fromTable) event.target.innerHTML = mlst.length + ' variants loaded'
	else
		arg.tk.menutip.d
			.append('div')
			.text(`Sample ${sample.sample_id}`)
			.style('text-align', 'center')
			.style('font-weight', 'bold')
			.style('margin', '5px')

	const renderer = await sjcharts.dtDisco({
		chromosomeType: arg.block.genome.name,
		majorchr: arg.block.genome.majorchr,
		holderSelector: arg.tk.menutip.d.append('div'),
		settings: {
			showControls: false,
			selectedSamples: []
		}
	})
	renderer.main(disco_arg)
}

/***********************************************
converts list of samples into inputs for renderTable()

samples with multiple variants must have been grouped to the same sample obj

*/
export async function samples2columnsRows(samples, tk) {
	// detect if these columns appear in the samples
	const has_caseAccess = samples.some(i => 'caseIsOpenAccess' in i),
		has_ssm = samples.some(i => i.ssm_id) || samples.some(i => i.ssm_id_lst),
		has_format = samples.some(i => i.ssmid2format) && tk.mds?.bcf?.format
	const displayedFormatKeySet = new Set() // set of format keys for display, to skip keys not in display

	// to be returned by this function, as inputs for renderTable
	const columns = [{ label: 'Sample' }],
		rows = [] // each row is an array of same length as columns

	///////////////// fill in columns[]
	if (has_caseAccess) {
		columns.push({ label: 'Access', editCallback: (i, cell) => console.log(i, cell) })
	}

	if (tk.mds.variant2samples.twLst) {
		for (const tw of tk.mds.variant2samples.twLst) {
			const cell = { label: tw.term.name }
			columns.push(cell)
		}
	}

	if (has_ssm) {
		columns.push({
			label: 'Mutations',
			isSsm: true // flag for text file downloader to do detect and do special treatment on this field
		})
	}

	if (has_format) {
		for (const s of samples) {
			if (!s.ssmid2format) continue
			for (const sm in s.ssmid2format) {
				for (const k in s.ssmid2format[sm]) displayedFormatKeySet.add(k)
			}
		}

		for (const f in tk.mds.bcf.format) {
			if (!displayedFormatKeySet.has(f)) continue
			const fobj = tk.mds.bcf.format[f]
			columns.push({
				label: fobj.Description || f
			})
		}
	}

	// done making columns[]

	///////////////// fill in rows[]

	for (const sample of samples) {
		// create one row[] for each sample
		// elements are by the same order as columns[]
		const row = [{ value: sample.sample_id }]

		// generate list of ssm
		// so as to show per-ssm data in consistent order
		let ssm_id_lst = sample.ssm_id_lst
		if (!ssm_id_lst && sample.ssm_id) ssm_id_lst = [sample.ssm_id]

		if (tk.mds.variant2samples.url) {
			row[0].url = tk.mds.variant2samples.url.base + sample[tk.mds.variant2samples.url.namekey]
		}

		if (has_caseAccess) {
			row.push({ value: sample.caseIsOpenAccess ? 'Open' : 'Controlled' })
		}

		if (tk.mds.variant2samples.twLst) {
			for (const tw of tk.mds.variant2samples.twLst) {
				if (tw.baseURL) {
					row.push({ html: `<a href=${tw.baseURL + sample[tw.id]} target=_blank>${sample[tw.id]}</a>` })
				} else {
					row.push({ value: sample[tw.id] })
				}
			}
		}

		if (has_ssm) {
			if (ssm_id_lst) {
				const htmls = []
				for (const ssm_id of ssm_id_lst) {
					const oneHtml = []
					const m = (tk.skewer.rawmlst || tk.custom_variants).find(i => i.ssm_id == ssm_id)
					if (m) {
						// found m data point
						if (m.dt == dtsnvindel) {
							if (tk.mds.queries && tk.mds.queries.snvindel && tk.mds.queries.snvindel.url) {
								oneHtml.push(`<a href=${tk.mds.queries.snvindel.url.base + m.ssm_id} target=_blank>${m.mname}</a>`)
							} else {
								oneHtml.push(m.mname)
							}
						} else if (m.dt == dtsv || m.dt == dtfusionrna) {
							const p = m.pairlst[0]
							oneHtml.push(
								`${p.a.name || ''} ${p.a.chr}:${p.a.pos} ${p.a.strand == '+' ? 'forward' : 'reverse'} > ${p.b.name ||
									''} ${p.b.chr}:${p.b.pos} ${p.b.strand == '+' ? 'forward' : 'reverse'}`
							)
						} else {
							throw 'unknown dt'
						}
						oneHtml.push(
							`<span style="color:${rgb(mclass[m.class].color).darker()};font-size:0.8em;">${
								mclass[m.class].label
							}</span>`
						)

						htmls.push(oneHtml.join(' '))
					} else {
						// m datapoint not found on client
						htmls.push(ssm_id)
					}
				}
				row.push({ html: htmls.join('<br>') })
			} else {
				// sample has no ssm, shouldn't happen
				row.push({ value: '' })
			}
		}

		if (has_format) {
			if (!ssm_id_lst) throw 'ssm_id_lst missing, cannot show format'
			for (const fkey in tk.mds.bcf.format) {
				if (!displayedFormatKeySet.has(fkey)) continue
				if (!sample.ssmid2format) {
					// sample does not have format values, return blank cell for each format field
					row.push({ value: '' })
					continue
				}
				const fobj = tk.mds.bcf.format[fkey]
				const htmls = []
				for (const ssmid of ssm_id_lst) {
					const value = sample.ssmid2format?.[ssmid]?.[fkey]
					htmls.push(printFormat(fobj, value))
				}
				row.push({ html: htmls.join('<br>') })
			}
		}

		rows.push(row)
	}
	return [columns, rows]
}

function printFormat(fobj, value) {
	if (fobj && value && fobj.Number == 'R' && fobj.Type == 'Integer') {
		const lst = value.split(',').map(Number)
		if (lst.length == 2) {
			const [ref, alt] = lst // [0] is ref read count, [1] is alt
			if (ref >= 0 && alt >= 0 && ref + alt > 0) {
				// the two numbers are valid allelic read count
				return `${fillbar(null, { f: alt / (alt + ref) })} <span style="font-size:.8em">${alt}/${alt + ref}</span>`
			}
		}
	}
	// any other case, simply return raw value without parsing
	return value
}

export function block2source(b) {
	if (b.gmmode == 'genomic') {
		const r = b.rglst[0]
		return 'mutations from ' + r.chr + ':' + r.start + '-' + r.stop
	}
	if (b.usegm) return 'mutations in ' + b.usegm.name
	return 'mutations'
}
