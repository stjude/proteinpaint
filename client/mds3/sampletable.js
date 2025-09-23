import { fillbar, renderTable, newSandboxDiv, table2col } from '#dom'
import { mclass, dtsnvindel, dtsv, dtfusionrna, dtcnv } from '#shared/common.js'
import { rgb } from 'd3-color'
import { print_snv, printSvPair, cnv2str } from './itemtable'
import { convertUnits } from '#shared/helpers.js'

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
		const out = await arg.tk.mds.variant2samples.get(arg) // returns list of samples
		await displaySampleTable(out.samples, arg)
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
	const params = { rows, columns, div: args.div, resize: rows.length > 10, dataTestId: 'sjpp_mds3tk_sampletable' }
	//if (args.maxWidth) params.maxWidth = args.maxWidth
	//if (args.maxHeight) params.maxHeight = args.maxHeight

	params.columnButtons = []

	if (args.tk.mds.queries?.singleSampleMutation) {
		const width = window.innerWidth
		const height = screen.height
		const colButton = {
			text: 'Disco',
			dataTestId: 'sja_sample_table_disco_button',
			callback: async (event, i) => {
				// hide tooltips where disco may have been launched
				args.tk.itemtip.hide() // when clicking dot with occurrence>1
				args.tk.menutip.hide() // when from sample leftlabel
				let thisMutation
				if (samples[i].ssm_id_lst?.[0]) {
					thisMutation = (args.tk.skewer.rawmlst || args.tk.custom_variants).find(
						m => m.ssm_id == samples[i].ssm_id_lst[0]
					)
				}
				await createDiscoInSandbox(args.tk, args.block, samples[i], thisMutation)
			}
		}
		params.columnButtons.push(colButton)
	}

	if (args.tk.mds.queries?.singleSampleGenomeQuantification) {
		for (const k in args.tk.mds.queries.singleSampleGenomeQuantification) {
			const btn = {
				text: k,
				dataTestId: `${k}_button`,
				callback: async (event, i) => {
					const sandbox = newSandboxDiv(args.tk.newChartHolder || args.block.holder0)
					sandbox.header.text(samples[i].sample_id)

					await (
						await import('#plots/plot.ssgq.js')
					).plotSingleSampleGenomeQuantification(
						args.tk.mds,
						args.tk.mds.label,
						k,
						samples[i],
						sandbox.body.append('div').style('margin', '20px'),
						args.block.genome,
						args.block.usegm?.name
					)
				}
			}
			params.columnButtons.push(btn)
		}
	}

	if (args.tk.allow2selectSamples) {
		// this tk allows to select samples; create new opt to display button

		params.buttons = [
			{
				text: args.tk.allow2selectSamples.buttonText,
				class: args.tk.allow2selectSamples.class,
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

/*
map sampleIdxLst to sample attributes that caller wants to pick
callback requests a set of attributes from the mds3 samples
an attribute may need to convert the value
*/
async function feedSample2selectCallback(tk, block, _samples, sampleIdxLst) {
	const s = [..._samples]
	const samples = sampleIdxLst.map(i => s[i])
	tk.allow2selectSamples.callback({
		samples: await tk.mds.termdb.vocabApi.convertSampleId(samples, tk.allow2selectSamples.attributes),
		source: 'Samples with ' + block2source(block)
	})
}

async function make_singleSampleTable(s, arg) {
	const table = arg.singleSampleDiv || table2col({ holder: arg.div })

	if (s.sample_id) {
		// sample_id is hardcoded
		const [cell1, cell2] = table.addRow()
		cell1.text(arg.tk.mds.termdbConfig?.lollipop?.sample || 'Sample')
		let m // mutation carried by this sample. if found, pass to createDiscoInSandbox for showing aachange on disco sandbox header for showing context
		if (s.ssm_id_lst?.[0]) {
			m = arg.tk.skewer.rawmlst.find(i => i.ssm_id == s.ssm_id_lst[0])
		}
		printSampleName(s, arg.tk, cell2, arg.block, m)
	}

	/////////////
	// hardcoded logic to represent if this case is open or controlled-access
	if ('caseIsOpenAccess' in s) {
		const [cell1, cell2] = table.addRow()
		cell1.text('Access')
		cell2.text(s.caseIsOpenAccess ? 'Open' : 'Controlled')
	}

	if (arg.tk.mds.variant2samples.twLst) {
		for (const tw of arg.tk.mds.variant2samples.twLst) {
			const [cell1, cell2] = table.addRow()
			cell1.text(tw.term.name).style('text-overflow', 'ellipsis')
			cell2.style('text-overflow', 'ellipsis')
			// TODO: use tw.$id to accomodate non-dictionary terms
			if (tw.term.id in s) {
				if (Array.isArray(s[tw.term.id])) {
					cell2.html(value2urlsOrText(s[tw.term.id], tw))
				} else {
					// single value
					const v = twDisplayValueFromSample(s, tw)
					cell2.html(value2urlsOrText(v, tw))
				}
			}
		}
	}

	if (s.ssmid2format) {
		// format data is displayed per ssmid (if there are multiple variants)
		for (const ssmid of s.ssm_id_lst) {
			if (s.ssm_id_lst.length > 1) {
				// there are multiple, need to mark it out
				//const td = table.addRow({spanTwoColumns:true})
				const [td1, td] = table.addRow()
				td.style('padding-top', '20px')
				const m = arg.tk.skewer.rawmlst.find(i => i.ssm_id == ssmid)
				if (m) {
					// found m object by id, can make a better display
					if (m.dt == dtsnvindel) {
						print_snv(td, m, arg.tk, arg.block)
					} else if (m.dt == dtsv || m.dt == dtfusionrna) {
						printSvPair(m.pairlst[0], td)
					} else {
						td.text(ssmid)
					}
				} else {
					td.text(ssmid)
				}
			} else {
				// only 1 ssm from this sample obj, no need to mark it out
			}

			for (const formatkey in s.ssmid2format[ssmid]) {
				const value = s.ssmid2format[ssmid][formatkey]
				const [t1, t2] = table.addRow()
				const fobj = arg.tk.mds?.bcf?.format?.[formatkey]
				t1.text(fobj?.Description || formatkey)
					.attr('data-testid', 'sjpp-mds3tk-singlemtablerow4formatkey')
					.attr('__key__', formatkey)
				t2.html(printFormat(fobj, value))
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

// get display value for a tw from a sample
function twDisplayValueFromSample(s, tw) {
	if (!(tw.term.id in s)) return ''
	const v = s[tw.term.id]
	if (tw.term.values?.[v]?.label) return tw.term.values[v].label

	const vc = tw.term.valueConversion
	if (vc) return convertUnits(v, vc.fromUnit, vc.toUnit, vc.scaleFactor)

	return v
}

/*
print name of a single sample
optional mutation from this sample may be provided, for showing along with disco launched from the button clicking to maintain context
*/
function printSampleName(sample, tk, div, block, thisMutation) {
	// print sample name in a div, if applicable, generate a hyper link using the sample name
	const temp = tk.mds.termdbConfig?.urlTemplates?.sample
	if (temp) {
		const a = div.append('a')
		a.attr('href', temp.base + (sample[temp.namekey] || sample.sample_id))
		a.attr('target', '_blank')
		a.text(sample.sample_id)
		a.style('word-break', 'break-word')
	} else {
		// class name for testing
		div.append('span').attr('class', 'pp_mds3_singleSampleNameSpan').text(sample.sample_id)
	}

	const extraRow = div.append('div') // row under sample name to show optional info about the sample

	if (tk.allow2selectSamples) {
		// display button for selecting this sample alone
		const t = tk.allow2selectSamples.buttonText
		const btn = extraRow
			.append('button')
			.attr('data-testid', 'sjpp-mds3tk-selectsamplebtn')
			.style('margin-right', '10px')
			.text(t.endsWith('s') ? t.substring(0, t.length - 1) : t)
			.on('click', () => {
				feedSample2selectCallback(tk, block, [sample], [0])
				tk.itemtip.hide()
				tk.menutip.hide()
			})
		if (tk.allow2selectSamples.class) btn.attr('class', tk.allow2selectSamples.class)
	}

	if (tk.mds.queries?.singleSampleMutation) {
		// make disco button
		extraRow
			.append('button')
			.style('margin-right', '10px')
			.text('Disco plot')
			.attr('data-testid', 'proteinpaint_disc_table_disco_button')
			.on('click', async () => {
				tk.itemtip.hide() // hide tooltip so it won't block
				await createDiscoInSandbox(tk, block, sample, thisMutation)
			})
	}

	if (tk.mds.queries?.singleSampleGenomeQuantification) {
		for (const k in tk.mds.queries.singleSampleGenomeQuantification) {
			extraRow
				.append('button')
				.text(k)
				.on('click', async () => {
					const sandbox = newSandboxDiv(tk.newChartHolder || block.holder0)
					sandbox.header.text(sample.sample_id)
					await (
						await import('#plots/plot.ssgq.js')
					).plotSingleSampleGenomeQuantification(
						tk.mds,
						tk.mds.label,
						k,
						sample,
						sandbox.body.append('div').style('margin', '20px'),
						block.genome,
						block.usegm?.name
						/* to pass current gene name to launch ssgb at that gene
						do not use thisMutation.gene, as "gene" is not guaranteed attribute on mutations
						*/
					)
				})
		}
	}
}

async function createDiscoInSandbox(tk, block, sample, thisMutation) {
	// create ad-hoc sandbox; if newChartHolder is present, plot into it
	const sandbox = newSandboxDiv(tk.newChartHolder || block.holder0)
	const headerTexts = [sample.sample_id] // for sandbox header
	if (thisMutation) {
		// mutation of this sample is provided (tooltip currently shows info about this mutation)
		// as tooltip is hidden, display this in disco header to inform context
		headerTexts.push(', with ')
		if (block.usegm) {
			headerTexts.push(block.usegm.name)
		} else {
			headerTexts.push(thisMutation.isoform) // todo convert to gene symbol
		}
		headerTexts.push(' ' + thisMutation.mname)
	}
	sandbox.header.text(headerTexts.join(''))
	try {
		;(await import('#plots/plot.disco.js')).default(
			tk.mds.termdbConfig,
			tk.mds.label,
			sample,
			sandbox.body,
			block.genome,
			{
				downloadImgName: headerTexts.join('') + ' Disco' // file name of svg downloaded from disco
			}
		)
	} catch (e) {
		sandbox.body.append('div').text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
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
	const columns = [{ label: tk.mds.termdbConfig?.lollipop?.sample || 'Sample' }],
		rows = [] // each row is an array of same length as columns

	///////////////// fill in columns[]
	if (has_caseAccess) {
		columns.push({ label: 'Access' })
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

		{
			const temp = tk.mds.termdbConfig?.urlTemplates?.sample
			if (temp) {
				row[0].url = temp.base + (sample[temp.namekey] || sample.sample_id)
			}
		}

		if (has_caseAccess) {
			row.push({ value: sample.caseIsOpenAccess ? 'Open' : 'Controlled' })
		}

		if (tk.mds.variant2samples.twLst) {
			for (const tw of tk.mds.variant2samples.twLst) {
				const v = twDisplayValueFromSample(sample, tw)
				const v2 = value2urlsOrText(v, tw)
				if (tw.baseURL || tw.pmidOrDoi) {
					row.push({ html: v2 })
				} else {
					row.push({ value: v })
				}
			}
		}

		if (has_ssm) {
			if (ssm_id_lst) {
				const htmls = []
				for (const ssm_id of ssm_id_lst) {
					const m = findMbyId(ssm_id, tk)
					const oneHtml = []
					if (m) {
						// found m data point
						let showClass
						if (m.dt == dtsnvindel) {
							if (tk.mds.queries && tk.mds.queries.snvindel && tk.mds.queries.snvindel.url) {
								oneHtml.push(`<a href=${tk.mds.queries.snvindel.url.base + m.ssm_id} target=_blank>${m.mname}</a>`)
							} else {
								oneHtml.push(m.mname)
							}
							showClass = true
						} else if (m.dt == dtsv || m.dt == dtfusionrna) {
							// server-returned data has sample._pairlst and shouldn't use m.pairlst; client-side custom data only has m.pairlst
							const p = sample._pairlst?.[0] || m.pairlst[0]
							oneHtml.push(
								`${p.a.name || ''} ${p.a.chr}:${p.a.pos} ${p.a.strand == '+' ? 'forward' : 'reverse'} > ${
									p.b.name || ''
								} ${p.b.chr}:${p.b.pos} ${p.b.strand == '+' ? 'forward' : 'reverse'}`
							)
							showClass = true
						} else if (m.dt == dtcnv) {
							const v = cnv2str(m, tk)
							oneHtml.push(v.value + ' ' + v.pos)
							showClass = Number.isFinite(m.value) // display class when using numeric value
						} else {
							throw 'unknown dt'
						}

						if (showClass) {
							oneHtml.push(
								`<span style="color:${rgb(mclass[m.class].color).darker()};font-size:0.8em;">${
									mclass[m.class].label
								}</span>`
							)
						}

						htmls.push(oneHtml.join(' '))
					} else {
						// m datapoint not found on client
						htmls.push(ssm_id + '?')
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

/*
v can be:
	a singular value
		if build url, return url
		else, return value as-is
	an array of values
		if build url, return urls built for each value, joined by <br>
		else, return array elements joined by <br>
*/
export function value2urlsOrText(v, tw) {
	if (tw.baseURL) {
		if (Array.isArray(v)) return v.map(i => `<a href=${tw.baseURL + i} target=_blank>${i}</a>`).join('<br>')
		return `<a href=${tw.baseURL + v} target=_blank>${v}</a>`
	}
	if (tw.pmidOrDoi) {
		const h = []
		for (const i of Array.isArray(v) ? v : [v]) {
			if (i.startsWith('doi: ')) {
				h.push(`<a href=https://doi.org/${i.slice(5)} target=_blank>${i}</a>`)
			} else {
				// must be pmid
				h.push(`<a href=https://pubmed.ncbi.nlm.nih.gov/${i} target=_blank>${i}</a>`)
			}
		}
		return h.join('<br>')
	}
	if (Array.isArray(v)) return v.join('<br>')
	return v
}

export function findMbyId(str, tk) {
	const lst = tk.skewer?.rawmlst || tk.custom_variants
	if (lst) {
		const m = lst.find(i => i.ssm_id == str)
		if (m) return m
	}
	if (tk.cnv?.cnvLst) {
		const m = tk.cnv.cnvLst.find(i => i.ssm_id == str)
		if (m) return m
	}
	return null
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
