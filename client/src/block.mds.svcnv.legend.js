import { scaleOrdinal } from 'd3-scale'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import * as client from './client'
import { legend_newrow } from './block.legend'
import * as common from '#shared/common.js'
import { loadTk } from './block.mds.svcnv'
import { rgb as d3rgb } from 'd3-color'

/*
*********** exported:

makeTk_legend
update_legend
updateLegend_singleSample
updateLegend_multiSample


*********** internal:
may_legend_svchr
may_legend_mclass
may_legend_attribute
may_legend_signature_singlesample
*/

const fontsize = 14
const xpad = 15
const barh = 20

export function makeTk_legend(block, tk) {
	/*
	only run once, to initialize legend
	for all cases:
		single- and multi-sample
		official and custom track
	*/

	const [tr, td] = legend_newrow(block, tk.name)
	tk.tr_legend = tr
	tk.td_legend = td

	const table = td.append('table').style('border-spacing', '5px')

	tk.legend_table = table
	// track hideable rows that are non-mutation attr
	tk.legend_hideable = []

	create_mclass(tk)

	if (!tk.nocnvlohsv) {
		// has svcnv file
		create_cnv(tk, block)
		create_loh(tk)
		create_svchrcolor(tk)
	}

	create_mutationsignature_single(tk)

	create_sampleAttribute(tk)

	create_mutationAttribute(tk)

	if (tk.alleleAttribute) create_vcfAttribute(tk.alleleAttribute, tk, block)
	if (tk.locusAttribute) create_vcfAttribute(tk.locusAttribute, tk, block)

	tk.legend_more_row = table.append('tr')
	tk.legend_more_label = tk.legend_more_row.append('td').style('text-align', 'right').append('span')
	// blank cell for now since hidden legend items
	// are displayed in pop-down menu, not in this row
	tk.legend_more_row.append('td')
}

export function update_legend(tk, block) {
	/*
	for all cases
	*/
	may_legend_svchr(tk)
	may_legend_mclass(tk, block)
	if (tk.singlesample) {
		// only do above for single sample case
		may_legend_signature_singlesample(tk, block)
		return
	}
	// is multi-sample: also do following
	may_legend_attribute(tk, block)
}

// helpers

function create_mclass(tk) {
	/* quick fix
	if in rnabam mode, suppress mclass legend, 
	*/
	if (tk.checkrnabam) {
		create_checkrnabam_snpusage(tk)
		return
	}

	/*
	list all mutation classes
	attribute may have already been created with customization
	*/
	if (!tk.legend_mclass) tk.legend_mclass = {}
	if (!tk.legend_mclass.hiddenvalues) tk.legend_mclass.hiddenvalues = new Set()

	tk.legend_mclass.hidden = false

	tk.legend_mclass.row = tk.legend_table.append('tr')

	tk.legend_mclass.row.append('td').style('text-align', 'right').style('opacity', 0.5).text('Mutation')
	tk.legend_mclass.holder = tk.legend_mclass.row.append('td')
	tk.legend_hideable.push(tk.legend_mclass)
}

function create_checkrnabam_snpusage(tk) {
	/*
create static legend
to illusrate colors about snp usage (if has valid pvalue or not)
*/
	const tr = tk.legend_table.append('tr')
	tr.append('td').style('text-align', 'right').style('opacity', 0.5).text('DNA marker usage')
	const td = tr.append('td')
	{
		const row = td.append('div')
		row
			.append('span')
			.html('&times;&nbsp;')
			.style('color', tk.checkrnabam.clientcolor_snpinuse)
			.style('font-size', '1.5em')
		row.append('span').text('Heterozygous SNP with a p-value from binomial test').style('opacity', 0.5)
	}
	{
		const row = td.append('div')
		row
			.append('span')
			.html('&times;&nbsp;')
			.style('color', tk.checkrnabam.clientcolor_markernotinuse)
			.style('font-size', '1.5em')
		row.append('span').text('Marker not in use and without binomial test').style('opacity', 0.5)
	}

	tk.checkrnabam.legend = {
		snpusage: {
			row: tr
		}
	}
}

function create_cnv(tk, block) {
	/*
	cnv log ratio color scale

	*/

	const leftpad = 50

	//// cnv color scale

	tk.cnvcolor.cnvlegend = {
		axistickh: 4,
		barw: 55
	}

	tk.cnvcolor.cnvlegend.row = tk.legend_table.append('tr')
	tk.cnvcolor.cnvlegend.row.append('td').style('text-align', 'right').style('opacity', 0.5).text('CNV log2(ratio)')
	tk.legend_hideable.push(tk.cnvcolor.cnvlegend)

	const btn = tk.cnvcolor.cnvlegend.row
		.append('td')
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_clb')
		.style('padding', '0px')
		.on('click', () => {
			// quick fix to allow to show only gain or loss
			tk.tkconfigtip.clear().showunder(btn.node())
			{
				const lab = tk.tkconfigtip.d.append('div').append('label')
				lab
					.append('input')
					.attr('type', 'checkbox')
					.property('checked', !tk.hide_cnvgain)
					.on('change', () => {
						tk.hide_cnvgain = !tk.hide_cnvgain
						loadTk(tk, block)
					})
				lab.append('span').html('&nbsp;Show copy number gain')
			}
			{
				const lab = tk.tkconfigtip.d.append('div').style('margin-top', '10px').append('label')
				lab
					.append('input')
					.attr('type', 'checkbox')
					.property('checked', !tk.hide_cnvloss)
					.on('change', () => {
						tk.hide_cnvloss = !tk.hide_cnvloss
						loadTk(tk, block)
					})
				lab.append('span').html('&nbsp;Show copy number loss')
			}
		})

	const svg = btn
		.append('svg')
		.attr('width', (leftpad + tk.cnvcolor.cnvlegend.barw) * 2)
		.attr('height', fontsize + tk.cnvcolor.cnvlegend.axistickh + barh)

	tk.cnvcolor.cnvlegend.svg = svg

	tk.cnvcolor.cnvlegend.nodatadiv = btn
		.append('div')
		.text('no data')
		.style('opacity', 0.3)
		.style('padding-left', '10px')

	tk.cnvcolor.cnvlegend.axisg = svg
		.append('g')
		.attr('transform', 'translate(' + leftpad + ',' + (fontsize + tk.cnvcolor.cnvlegend.axistickh) + ')')

	const gain_id = Math.random().toString()
	const loss_id = Math.random().toString()

	const defs = svg.append('defs')
	{
		// loss
		const grad = defs.append('linearGradient').attr('id', loss_id)
		tk.cnvcolor.cnvlegend.loss_stop = grad.append('stop').attr('offset', '0%').attr('stop-color', tk.cnvcolor.loss.str)
		grad.append('stop').attr('offset', '100%').attr('stop-color', 'white')
	}
	{
		// gain
		const grad = defs.append('linearGradient').attr('id', gain_id)
		grad.append('stop').attr('offset', '0%').attr('stop-color', 'white')
		tk.cnvcolor.cnvlegend.gain_stop = grad
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', tk.cnvcolor.gain.str)
	}

	svg
		.append('rect')
		.attr('x', leftpad)
		.attr('y', fontsize + tk.cnvcolor.cnvlegend.axistickh)
		.attr('width', tk.cnvcolor.cnvlegend.barw)
		.attr('height', barh)
		.attr('fill', 'url(#' + loss_id + ')')

	svg
		.append('rect')
		.attr('x', leftpad + tk.cnvcolor.cnvlegend.barw)
		.attr('y', fontsize + tk.cnvcolor.cnvlegend.axistickh)
		.attr('width', tk.cnvcolor.cnvlegend.barw)
		.attr('height', barh)
		.attr('fill', 'url(#' + gain_id + ')')

	svg
		.append('text')
		.attr('x', leftpad - 5)
		.attr('y', fontsize + tk.cnvcolor.cnvlegend.axistickh + barh / 2)
		.attr('font-family', client.font)
		.attr('font-size', fontsize)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('fill', 'black')
		.text('Loss')
	svg
		.append('text')
		.attr('x', leftpad + tk.cnvcolor.cnvlegend.barw * 2 + 5)
		.attr('y', fontsize + tk.cnvcolor.cnvlegend.axistickh + barh / 2)
		.attr('font-family', client.font)
		.attr('font-size', fontsize)
		.attr('dominant-baseline', 'central')
		.attr('fill', 'black')
		.text('Gain')
}

function create_loh(tk) {
	if (tk.mds && tk.mds.queries && tk.mds.queries[tk.querykey] && tk.mds.queries[tk.querykey].no_loh) {
		// quick dirty
		return
	}

	//// loh color legend

	const leftpad = 20

	tk.cnvcolor.lohlegend = {
		axistickh: 4,
		barw: 55
	}

	tk.cnvcolor.lohlegend.row = tk.legend_table.append('tr')
	tk.cnvcolor.lohlegend.row.append('td').style('text-align', 'right').style('opacity', 0.5).text('LOH seg.mean')
	tk.legend_hideable.push(tk.cnvcolor.lohlegend)

	const td = tk.cnvcolor.lohlegend.row.append('td')

	const svg = td
		.append('svg')
		.attr('width', (leftpad + tk.cnvcolor.lohlegend.barw) * 2)
		.attr('height', fontsize + tk.cnvcolor.lohlegend.axistickh + barh)

	tk.cnvcolor.lohlegend.svg = svg
	tk.cnvcolor.lohlegend.nodatadiv = td.append('div').text('no data').style('opacity', 0.3).style('padding-left', '10px')

	tk.cnvcolor.lohlegend.axisg = svg
		.append('g')
		.attr('transform', 'translate(' + leftpad + ',' + (fontsize + tk.cnvcolor.lohlegend.axistickh) + ')')

	const loh_id = Math.random().toString()

	const defs = svg.append('defs')
	{
		const grad = defs.append('linearGradient').attr('id', loh_id)
		grad.append('stop').attr('offset', '0%').attr('stop-color', 'white')
		tk.cnvcolor.lohlegend.loh_stop = grad.append('stop').attr('offset', '100%').attr('stop-color', tk.cnvcolor.loh.str)
	}

	svg
		.append('rect')
		.attr('x', leftpad)
		.attr('y', fontsize + tk.cnvcolor.lohlegend.axistickh)
		.attr('width', tk.cnvcolor.lohlegend.barw)
		.attr('height', barh)
		.attr('fill', 'url(#' + loh_id + ')')
}

function create_svchrcolor(tk) {
	const row = tk.legend_table.append('tr').style('display', 'none') // default hide

	tk.legend_svchrcolor = {
		row: row,
		interchrs: new Set(),
		colorfunc: scaleOrdinal(schemeCategory20),
		hidden: true
	}
	row.append('td').style('text-align', 'right').style('opacity', 0.5).text('SV chromosome')
	tk.legend_svchrcolor.holder = row.append('td')
	tk.legend_hideable.push(tk.legend_svchrcolor)
}

function create_sampleAttribute(tk) {
	if (tk.singlesample) return
	if (!tk.sampleAttribute) return
	/*
	official only
	sampleAttribute is copied over from mds.queries
	initiate attributes used for filtering & legend display
	*/
	for (const key in tk.sampleAttribute.attributes) {
		const attr = tk.sampleAttribute.attributes[key]
		if (!attr.filter) {
			// not a filter
			continue
		}

		// do not override customization from embedding
		if (!attr.hiddenvalues || !(attr.hiddenvalues instanceof Set)) {
			attr.hiddenvalues = new Set()
			// k: key in mutationAttribute.attributes{}
		}

		attr.value2count = new Map()
		/*
		k: key
		v: {
			totalitems: INT
			dt2count: Map( dt => count )
		}
		*/

		attr.legendrow = tk.legend_table.append('tr')
		attr.legendcell = attr.legendrow.append('td').style('text-align', 'right').style('opacity', 0.5).text(attr.label)

		attr.legendholder = attr.legendrow.append('td')
	}
}

function create_mutationsignature_single(tk) {
	if (!tk.singlesample) return
	if (!tk.mds || !tk.mds.mutation_signature) return
	/* dataset has mutation signature
	will create legend for this track
	but does not know if this sample has signature or not
	so the legend <tr> remains hidden
	and only show if it has signature for data in view range

	also one sample could have mutation from more than one set of signature
	thus, one legend <tr> should be shown for each signature set

	*/
	tk.mutation_signature_legend = {
		sets: {}
	}
	for (const k in tk.mds.mutation_signature.sets) {
		const tr = tk.legend_table.append('tr').style('display', 'none')

		tr.append('td').text(tk.mds.mutation_signature.sets[k].name).style('text-align', 'right').style('opacity', 0.5)

		const td = tr.append('td')
		const table = td.append('table').style('border-spacing', '0px').style('margin', '10px')

		tk.mutation_signature_legend.sets[k] = {
			tr: tr,
			td: td,
			table: table
		}
	}
}

function create_mutationAttribute(tk) {
	if (tk.singlesample) return
	if (!tk.mutationAttribute) return
	/*
	official only
	mutationAttribute is copied over from mds.queries
	initiate attributes used for filtering & legend display
	*/
	for (const key in tk.mutationAttribute.attributes) {
		const attr = tk.mutationAttribute.attributes[key]
		if (!attr.filter) {
			// not a filter
			continue
		}
		attr.hiddenvalues = new Set()
		// k: key in mutationAttribute.attributes{}

		attr.value2count = new Map()
		/*
		k: key
		v: {
			totalitems: INT
			dt2count: Map( dt => count )
		}
		*/

		attr.legendrow = tk.legend_table.append('tr')
		attr.legendcell = attr.legendrow.append('td').style('text-align', 'right').style('opacity', 0.5).text(attr.label)

		attr.legendholder = attr.legendrow.append('td')
	}
}

function create_vcfAttribute(attrSet, tk, block) {
	// for both alleleAttribute and locusAttribute
	/*
	official only
	alleleAttribute/locusAttribute is copied over from mds.queries
	initiate attributes used for filtering & legend display
	*/
	for (const key in attrSet.attributes) {
		const attr = attrSet.attributes[key]
		if (!attr.filter) {
			// not a filter
			continue
		}

		attr.legendrow = tk.legend_table.append('tr')
		attr.legendcell = attr.legendrow.append('td').style('text-align', 'right').style('opacity', 0.5).text(attr.label)

		attr.legendholder = attr.legendrow.append('td')

		if (attr.isnumeric) {
			/*
			numeric cutoff with options:
			<= no greater than
			>= no smaller than
			x  do not use
			*/

			const select = attr.legendholder
				.append('select')
				.style('margin', '0px 10px 0px 10px')
				.on('change', () => {
					const value = select.property('value')

					if (value == 'x') {
						attr.disable = true
					} else {
						delete attr.disable
						attr.keeplowerthan = value == '<'
					}

					loadTk(tk, block)
				})

			const lowerthan = select.append('option').attr('value', '<').property('text', '≤')

			const higherthan = select.append('option').attr('value', '>').property('text', '≥')

			const disable = select.append('option').attr('value', 'x').property('text', 'X')

			if (attr.disable) {
				disable.property('selected', 1)
			} else if (attr.keeplowerthan) {
				lowerthan.property('selected', 1)
			} else {
				higherthan.property('selected', 1)
			}

			attr.legendholder
				.append('input')
				.attr('type', 'number')
				.style('width', '50px')
				.property('value', attr.cutoffvalue)
				.on('keyup', event => {
					if (event.key != 'Enter') return
					attr.cutoffvalue = event.target.valueAsNumber
					loadTk(tk, block)
				})
		} else {
			// categorical
			attr.hiddenvalues = new Set()
			// k: key in mutationAttribute.attributes{}

			attr.value2count = new Map()
			/*
			k: key
			v: {
				totalitems: INT
				dt2count: Map( dt => count )
			}
			*/

			attr.legendrow = tk.legend_table.append('tr')
			attr.legendcell = attr.legendrow.append('td').style('text-align', 'right').style('opacity', 0.5).text(attr.label)

			attr.legendholder = attr.legendrow.append('td')
		}
	}
}

function may_legend_svchr(tk) {
	if (!tk.legend_svchrcolor) {
		// not there when there is no svcnv file
		return
	}

	tk.legend_svchrcolor.holder.selectAll('*').remove()
	if (tk.legend_svchrcolor.interchrs.size == 0) return
	tk.legend_svchrcolor.row.style('display', 'table-row')
	for (const chr of tk.legend_svchrcolor.interchrs) {
		const color = tk.legend_svchrcolor.colorfunc(chr)
		const d = tk.legend_svchrcolor.holder
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '3px 10px 3px 0px')
		d.append('div')
			.style('display', 'inline-block')
			.style('border-radius', '10px')
			.style('padding', '0px 10px')
			.style('border', 'solid 1px ' + color)
			.style('color', color)
			.style('font-size', '.9em')
			.text(chr)
	}
}

function may_legend_mclass(tk, block) {
	/*
	full or dense
	native or custom
	single or multi-sample
	always shown! both snvindel class & dt included (cnv/loh/sv/fusion/itd)
	*/

	if (!tk.legend_mclass || !tk.legend_mclass.holder) return

	tk.legend_mclass.holder.selectAll('*').remove()

	const classes = new Map()
	/*
	k: class
	v: {cname, count}
	if is snvindel class, key is class code e.g. "M"
	if not, key is dt
	*/

	// vcf classes
	if (tk.data_vcf) {
		for (const m of tk.data_vcf) {
			if (!classes.has(m.class)) {
				classes.set(m.class, {
					isvcf: 1,
					cname: m.class,
					count: 0
				})
			}
			classes.get(m.class).count++
		}
	}
	// non-vcf classes
	if (tk.singlesample) {
		if (tk.data) {
			for (const i of tk.data) {
				if (!classes.has(i.dt)) {
					classes.set(i.dt, {
						dt: i.dt,
						count: 0
					})
				}
				classes.get(i.dt).count++
			}
		}
	} else if (tk._data) {
		for (const g of tk._data) {
			for (const s of g.samples) {
				for (const i of s.items) {
					if (!classes.has(i.dt)) {
						classes.set(i.dt, {
							dt: i.dt,
							count: 0
						})
					}
					classes.get(i.dt).count++
				}
			}
		}
	}

	const classlst = [...classes.values()]
	classlst.sort((i, j) => j.count - i.count)
	tk.legend_mclass.total_count = classlst.reduce((a, b) => a + b.count, 0)

	for (const c of classlst) {
		let key,
			label,
			desc,
			color = '#858585'

		if (c.dt) {
			key = c.dt
			label = common.dt2label[c.dt]
			if (c.dt == common.dtcnv) desc = 'Copy number variation.'
			else if (c.dt == common.dtloh) desc = 'Loss of heterozygosity.'
			else if (c.dt == common.dtitd) {
				color = common.mclass[common.mclassitd].color
				desc = 'Internal tandem duplication.'
			} else if (c.dt == common.dtsv) desc = 'Structural variation of DNA.'
			else if (c.dt == common.dtfusionrna) desc = 'Fusion gene from RNA-seq.'
		} else {
			key = c.cname
			label = common.mclass[c.cname].label
			color = common.mclass[c.cname].color
			desc = common.mclass[c.cname].desc
		}

		const cell = tk.legend_mclass.holder
			.append('div')
			.attr('class', 'sja_clb')
			.style('display', 'inline-block')
			.on('click', () => {
				tk.tip2
					.clear()
					.d.append('div')
					.attr('class', 'sja_menuoption')
					.text('Hide')
					.on('click', () => {
						tk.legend_mclass.hiddenvalues.add(key)
						applychange()
					})

				tk.tip2.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text('Show only')
					.on('click', () => {
						for (const c2 of classes.keys()) {
							tk.legend_mclass.hiddenvalues.add(c2)
						}
						tk.legend_mclass.hiddenvalues.delete(key)
						applychange()
					})

				if (tk.legend_mclass.hiddenvalues.size) {
					tk.tip2.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.text('Show all')
						.on('click', () => {
							tk.legend_mclass.hiddenvalues.clear()
							applychange()
						})
				}

				tk.tip2.d.append('div').style('padding', '10px').style('font-size', '.8em').style('width', '150px').text(desc)

				tk.tip2.showunder(cell.node())
			})

		cell
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_mcdot')
			.style('background', color)
			.html(c.count > 1 ? c.count : '&nbsp;')
		cell
			.append('div')
			.style('display', 'inline-block')
			.style('color', color)
			.html('&nbsp;' + label)
	}

	// hidden
	for (const key of tk.legend_mclass.hiddenvalues) {
		tk.legend_mclass.holder
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_clb')
			.style('text-decoration', 'line-through')
			.text(Number.isInteger(key) ? common.dt2label[key] : common.mclass[key].label)
			.on('click', () => {
				tk.legend_mclass.hiddenvalues.delete(key)
				applychange()
			})
	}

	if (tk.vcfrangelimit) {
		// range too big for vcf, no vcf data
		tk.legend_mclass.holder
			.append('div')
			.style('display', 'inline-block')
			.text('Zoom in under ' + common.bplen(tk.vcfrangelimit) + ' to view SNV/indel data')
			.style('white-space', 'nowrap')
			.style('margin', '10px')
	}

	const applychange = () => {
		tk.tip2.hide()
		loadTk(tk, block)
	}
}

function may_legend_signature_singlesample(tk, block) {
	/*
	only for single sample
	if mds has signature
	*/

	if (!tk.mds || !tk.mds.mutation_signature) return

	// dataset is equipped with signature, but the sample may not have it, or there may not be any variants from view range
	// still need to clear legend
	for (const k in tk.mutation_signature_legend.sets) {
		tk.mutation_signature_legend.sets[k].tr.style('display', 'none')
	}

	if (!tk.data_vcf) {
		// currently signature data all come from vcf
		return
	}

	const set2signatures = new Map()

	for (const m of tk.data_vcf) {
		if (m.x == undefined) continue
		if (!m.sampledata || !m.sampledata[0]) continue
		for (const k in tk.mds.mutation_signature.sets) {
			const v = m.sampledata[0][k]
			if (v == undefined) continue
			const obj = tk.mds.mutation_signature.sets[k].signatures[v]
			if (obj) {
				// has a valid signature for this set
				// but will not count the 'no data' placeholder
				if (obj.nodata) continue
				if (!set2signatures.has(k)) set2signatures.set(k, new Map())
				set2signatures.get(k).set(v, 1 + (set2signatures.get(k).get(v) || 0))
			}
		}
	}

	for (const [k, o1] of set2signatures) {
		const leg = tk.mutation_signature_legend.sets[k]
		// turn on this tr
		leg.tr.style('display', 'table-row')
		leg.table.selectAll('*').remove()

		const lst = [...o1].sort((i, j) => j[1] - i[1])
		for (const [v, count] of lst) {
			const obj = tk.mds.mutation_signature.sets[k].signatures[v]

			const tr = leg.table.append('tr')
			tr.append('td')
				.style('background', obj.color)
				.style('padding', '0px 4px')
				.style('color', 'white')
				.style('text-align', 'right')
				.html(count > 1 ? count : '')
			const c = d3rgb(obj.color)
			tr.append('td')
				.html('&nbsp;' + obj.name)
				.style('background', 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',.2)')
				.style('opacity', 0.6)
		}
	}
}

function may_legend_attribute(tk, block) {
	if (tk.singlesample) {
		// multi-sample only
		return
	}

	// collects attributes that are selected to be hidden
	const hiddenAttributes = []

	/*
	official-only, multi-sample
	filtering by mutation attribute is done on server
	*/
	for (const attrGrp of ['sampleAttribute', 'mutationAttribute', 'locusAttribute']) {
		if (!tk[attrGrp]) continue

		// clear
		for (const key in tk[attrGrp].attributes) {
			const attr = tk[attrGrp].attributes[key]
			if (!attr.filter) continue
			attr.value2count.clear()
		}

		// count
		if (attrGrp == 'sampleAttribute') {
			for (const key in tk.sampleAttribute.attributes) {
				for (const sample in tk.sampleAttribute.samples) {
					count_sampleAttribute(key, tk.sampleAttribute.attributes[key], tk.sampleAttribute.samples[sample])
				}
			}
		} else {
			if (tk._data) {
				for (const g of tk._data) {
					for (const s of g.samples) {
						for (const i of s.items) {
							// won't count if i.mattr is undefined
							count_mutationAttribute(i.mattr, tk, i.dt)
						}
					}
				}
			}
			if (tk.data_vcf) {
				for (const m of tk.data_vcf) {
					if (m.dt == common.dtsnvindel) {
						if (m.sampledata) {
							for (const s of m.sampledata) {
								count_mutationAttribute(s, tk, m.dt)
							}
						}
						if (m.info) {
							count_locusAttribute(tk, m)
						}
						// TODO altinfo may be supported in the same way?
					} else {
						console.error('unknown dt: ' + m.dt)
					}
				}
			}
		}

		// show legend
		for (const key in tk[attrGrp].attributes) {
			const attr = tk[attrGrp].attributes[key]
			if (!attr.filter) continue

			attr.legendcell.classed('sja_hideable_legend', true).on('click', () => {
				tk.tip2.hide()
				attr.hidden = 1
				tk.legend_more_row.style('display', 'table-row')
				client.flyindi(attr.legendcell, tk.legend_more_label)
				attr.legendrow.transition().delay(500).style('display', 'none')
				setTimeout(() => {
					may_legend_attribute(tk, block)
				}, 500)
			})

			if (attr.hidden) {
				// this attribute is hidden
				attr.legendrow.style('display', 'none')
				hiddenAttributes.push(attr)
				continue
			}

			// this attribute is not hidden

			if (attr.value2count.size + attr.hiddenvalues.size == 0) {
				// no value after counting, no hidden value either: no data for this attribute
				attr.legendrow.style('display', 'none')
				continue
			}

			// this attribute is shown
			attr.legendrow.style('display', 'table-row')

			attr.legendholder.selectAll('*').remove()

			const lst = [...attr.value2count]
			lst.sort((i, j) => j[1].totalitems - i[1].totalitems)

			for (const [valuestr, _o] of lst) {
				const printstr = attr.values[valuestr] ? attr.values[valuestr].name : valuestr

				const cell = attr.legendholder
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_clb')
					.on('click', () => {
						tk.tip2.clear()

						if (attr.hiddenvalues.has(valuestr)) {
							tk.tip2.d
								.append('div')
								.attr('class', 'sja_menuoption')
								.text('Show')
								.on('click', () => {
									tk.tip2.hide()
									attr.hiddenvalues.delete(valuestr)
									loadTk(tk, block)
								})
						} else {
							tk.tip2.d
								.append('div')
								.attr('class', 'sja_menuoption')
								.text('Hide')
								.on('click', () => {
									tk.tip2.hide()
									attr.hiddenvalues.add(valuestr)
									loadTk(tk, block)
								})
						}
						tk.tip2.d
							.append('div')
							.attr('class', 'sja_menuoption')
							.text('Show only')
							.on('click', () => {
								tk.tip2.hide()
								for (const [vstr, c] of lst) {
									attr.hiddenvalues.add(vstr)
								}
								attr.hiddenvalues.delete(valuestr)
								loadTk(tk, block)
							})
						if (attr.hiddenvalues.size) {
							tk.tip2.d
								.append('div')
								.attr('class', 'sja_menuoption')
								.text('Show all')
								.on('click', () => {
									tk.tip2.hide()
									attr.hiddenvalues.clear()
									loadTk(tk, block)
								})
						}

						// label for this value?
						if (attr.values[valuestr] && attr.values[valuestr].label) {
							tk.tip2.d
								.append('div')
								.text(attr.values[valuestr].label)
								.style('opacity', 0.5)
								.style('font-size', '.7em')
								.style('margin', '10px')
						}

						// show by-dt count
						if (_o.dt2count) {
							const lst2 = [..._o.dt2count]
							lst2.sort((i, j) => j[1] - i[1])

							const table = tk.tip2.d
								.append('div')
								.style('margin', '5px')
								.style('font-size', '.7em')
								.style('opacity', 0.8)
								.style('border-spacing', '4px')
							for (const [dt, count] of lst2) {
								const tr = table.append('tr')
								tr.append('td').text(common.dt2label[dt])
								tr.append('td').text(count)
							}
						}
						tk.tip2.showunder(cell.node())
					})

				const color =
					attrGrp == 'sampleAttribute' && tk.legend_samplegroups && tk.legend_samplegroups.color(valuestr)
						? tk.legend_samplegroups.color(valuestr)
						: '#858585'

				cell
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_mcdot')
					.style('background', color)
					.text(_o.totalitems)
				cell.append('span').html('&nbsp;' + printstr)
			}

			if (attr.hiddenvalues.size) {
				// this attribute has hidden values, show with strike-through
				for (const valuestr of attr.hiddenvalues) {
					const printstr = attr.values[valuestr] && attr.values[valuestr].name ? attr.values[valuestr].name : valuestr

					attr.legendholder
						.append('div')
						.style('display', 'inline-block')
						.attr('class', 'sja_clb')
						.style('text-decoration', 'line-through')
						.text(printstr)
						.on('click', () => {
							attr.hiddenvalues.delete(valuestr)
							loadTk(tk, block)
						})
				}
			}
		}
	}
	may_process_hideable_rows(tk, block, hiddenAttributes)
}

function may_process_hideable_rows(tk, block, hiddenAttributes) {
	// handle non-mutation attribute
	let numHiddenRows = 0
	for (const hideable of tk.legend_hideable) {
		hideable.row
			.select('td')
			.classed('sja_hideable_legend', true)
			.on('click', () => {
				tk.tip2.hide()
				hideable.hidden = 1
				tk.legend_more_row.style('display', 'table-row')
				client.flyindi(hideable.row.select('td'), tk.legend_more_label)
				hideable.row.transition().delay(500).style('display', 'none')
				setTimeout(() => {
					may_legend_attribute(tk, block)
				}, 500)
			})

		hideable.row.style('display', hideable.hidden ? 'none' : 'table-row')
		if (hideable.hidden) {
			numHiddenRows++
		}
	}

	if (!hiddenAttributes.length && !numHiddenRows) {
		tk.legend_more_row.style('display', 'none')
	} else {
		tk.legend_more_row.style('display', 'table-row')
		tk.legend_more_label.selectAll('*').remove()

		const btn = tk.legend_more_label
			.attr('class', 'sja_legend_more_btn')
			.html('MORE...')
			.on('click', () => {
				tk.tip2.clear()

				for (const hideable of tk.legend_hideable) {
					if (!hideable.hidden) continue
					const div = tk.tip2.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							tk.tip2.hide()
							hideable.hidden = 0
							may_legend_attribute(tk, block)
						})

					if (hideable.hidden && hideable.total_count) {
						div
							.append('div')
							.style('display', 'inline-block')
							.attr('class', 'sja_mcdot')
							.style('background', '#858585')
							.text(hideable.total_count)
					}

					div.append('span').html('&nbsp;' + hideable.row.node().firstChild.innerHTML)
				}

				for (const attr of hiddenAttributes) {
					if (!attr.hidden) continue
					const total = [...attr.value2count.values()].reduce((a, b) => a + b.totalitems, 0)
					const div = tk.tip2.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							tk.tip2.hide()
							attr.hidden = 0
							may_legend_attribute(tk, block)
						})

					div
						.append('div')
						.style('display', 'inline-block')
						.attr('class', 'sja_mcdot')
						.style('background', '#858585')
						.text(total)

					div.append('span').html('&nbsp;' + attr.label)
				}

				tk.tip2.showunder(btn.node())
			})
	}
}

function count_sampleAttribute(key, attr, sample) {
	if (!(key in sample)) return

	if (!attr.filter) return // not a filter

	const value = sample[key]
	if (!attr.value2count.has(value)) {
		attr.value2count.set(value, {
			totalitems: 0
		})
	}
	attr.value2count.get(value).totalitems++
	if (!attr.values) {
		attr.values = {}
	}
	if (!attr.values[value]) {
		attr.values[value] = {
			name: value,
			label: value
		}
	}
}

function count_mutationAttribute(mattr, tk, itemdt) {
	if (!mattr) {
		// the item does not have mattr, do not count
		return
	}
	if (!tk.mutationAttribute) return

	for (const key in tk.mutationAttribute.attributes) {
		const attr = tk.mutationAttribute.attributes[key]
		if (!attr.filter) continue

		const value = mattr[key]

		if (value == undefined) {
			// not annotated, do not count
			continue
		}

		/*
		no longer acknowledge unannotated values
		if( value==undefined ) {
			// this item is not annotated, change its label to hardcoded
			value = common.not_annotated
		}
		*/

		// even if this value is not cataloged in attr.values{}, still record it for displaying
		if (!attr.value2count.has(value)) {
			attr.value2count.set(value, {
				totalitems: 0,
				dt2count: new Map()
			})
		}
		attr.value2count.get(value).totalitems++

		if (!attr.value2count.get(value).dt2count.has(itemdt)) {
			attr.value2count.get(value).dt2count.set(itemdt, 0)
		}

		attr.value2count.get(value).dt2count.set(itemdt, attr.value2count.get(value).dt2count.get(itemdt) + 1)
	}
}

function count_locusAttribute(tk, m) {
	if (!tk.locusAttribute) return

	for (const key in tk.locusAttribute.attributes) {
		const attr = tk.locusAttribute.attributes[key]
		if (!attr.filter) continue

		const _value = m.info[key]

		if (_value == undefined) continue // not annotated, do not count

		// quick fix! should refer to info field definition
		let value
		if (Array.isArray(_value)) {
			value = _value[0]
			if (value == '.') continue
		} else {
			value = _value
		}

		if (attr.hiddenvalues.has(value)) continue

		// even if this value is not cataloged in attr.values{}, still record it for displaying
		if (!attr.value2count.has(value)) {
			attr.value2count.set(value, {
				totalitems: 0,
				dt2count: new Map()
			})
		}
		attr.value2count.get(value).totalitems++

		if (!attr.value2count.get(value).dt2count.has(m.dt)) {
			attr.value2count.get(value).dt2count.set(m.dt, 0)
		}

		attr.value2count.get(value).dt2count.set(m.dt, attr.value2count.get(value).dt2count.get(m.dt) + 1)
	}
}
