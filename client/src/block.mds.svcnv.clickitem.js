import { select as d3select } from 'd3-selection'
import { axisTop } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import * as common from '#shared/common.js'
import {
	loadTk,
	focus_singlesample,
	dedup_sv,
	itemname_svfusion,
	multi_sample_addhighlight,
	multi_sample_removehighlight
} from './block.mds.svcnv'
import {
	createbutton_addfeature,
	createnewmatrix_withafeature,
	customkey_svcnv,
	customkey_vcf
} from './block.mds.svcnv.samplematrix'
import { getsjcharts } from './getsjcharts'
import { debounce } from 'debounce'

/*

********************** EXPORTED
click_multi_singleitem
tooltip_singleitem
click_multi_vcfdense
tooltip_multi_vcfdense
click_multi_svdense
tooltip_multi_svdense
tooltip_samplegroup
click_samplegroup_showmenu
click_samplegroup_showtable
may_add_sampleannotation
svchr2html
svcoord2html
detailtable_singlesample
make_svgraph
may_allow_samplesearch

********************** INTERNAL
printer_snvindel
may_show_matrixbutton
may_createbutton_survival_grouplab
matrix_view()


*/

export async function may_allow_samplesearch(tk, block) {
	/*
	for official track, allow search for sample

	create a search box for finding samples

	single or multi

	may query server to see if is allowed
	*/
	if (tk.iscustom) return
	if (tk.singlesample) return

	const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '15px')
	const input = row.append('input').attr('size', 20).attr('placeholder', 'Find sample')
	const showdiv = row.append('div').style('margin-top', '10px')

	input.on('keyup', debounce(samplesearch, 300))

	async function samplesearch() {
		showdiv.selectAll('*').remove()

		const str = input.property('value').trim()
		if (!str) return

		const par = {
			genome: block.genome.name,
			dslabel: tk.mds.label,
			querykey: tk.querykey,
			findsamplename: str
		}
		try {
			const data = await client.dofetch('mdssvcnv', par)

			if (data.error) throw data.error
			if (!data.result) return
			for (const sample of data.result) {
				const cell = showdiv.append('div')
				cell.append('span').text(sample.name)

				if (sample.grouplabel) {
					cell.append('span').style('margin-left', '10px').style('font-size', '.7em').text(sample.grouplabel)
				}

				if (sample.num_assay_tracks) {
					cell
						.append('span')
						.style('font-size', '.7em')
						.style('padding', '1px 5px')
						.style('margin-left', '10px')
						.style('background', '#bbb')
						.style('color', 'white')
						.style('border-radius', '3px')
						.text(sample.num_assay_tracks + ' track' + (sample.num_assay_tracks > 1 ? 's' : ''))
				}

				if (sample.disco) {
					cell
						.append('span')
						.style('font-size', '.7em')
						.style('padding', '1px 5px')
						.style('margin-left', '10px')
						.style('background', '#bbb')
						.style('color', 'white')
						.style('border-radius', '3px')
						.text('Genome view')
				}
				if (sample.mutation_signature) {
					cell
						.append('span')
						.style('font-size', '.7em')
						.style('padding', '1px 5px')
						.style('margin-left', '10px')
						.style('background', '#bbb')
						.style('color', 'white')
						.style('border-radius', '3px')
						.text('Mutation signature')
				}

				cell.attr('class', 'sja_menuoption').on('click', () => {
					tk.tkconfigtip.hide()

					const tabs = []

					addtab_sampleview(tabs, {
						tk: tk,
						block: block,
						sample: {
							samplename: sample.name
						},
						samplegroup: { attributes: sample.attributes }
					})

					mayaddtab_disco(tabs, {
						tk: tk,
						block: block,
						sample: {
							samplename: sample.name
						}
						//samplegroup: {attributes: sample.attributes}
					})
					mayaddtab_genome(tabs, {
						tk: tk,
						block: block,
						sample: {
							samplename: sample.name
						}
						//samplegroup: {attributes: sample.attributes}
					})
					mayaddtab_mutationsignature(tabs, sample.name, tk, block)

					if (sample.attr && tk.sampleAttribute && tk.sampleAttribute.attributes) {
						tabs.push({
							label: 'Attributes',
							callback: div => {
								for (const attr of sample.attr) {
									const a = tk.sampleAttribute.attributes[attr.k]
									if (a) attr.k = a.label
								}
								client.make_table_2col(div, sample.attr)
							}
						})
					}
					const pane = client.newpane({ x: 100, y: 100 })
					pane.header.text(sample.name)
					client.tab2box(pane.body.style('padding-top', '10px'), tabs)
				})
			}
		} catch (e) {
			client.sayerror(showdiv, err.message || err)
			if (err.stack) console.log(err.stack)
		}
	}
}

export function click_samplegroup_showmenu(samplegroup, tk, block) {
	/*
	official only, multi-sample
	dense or full
	click sample group label in track display to show menu
	this group must already has been shown
	*/

	if (tk.sampleset) return sampleset_showgrpmenu(samplegroup, tk, block)

	if (tk.iscustom) return

	if (!samplegroup.attributes) {
		// no attributes[], maybe unannotated samples, do not show menu for the moment
		return
	}

	const printerror = msg => client.sayerror(tk.tip2.d, msg)

	if (!tk.sampleAttribute) return printerror('tk.sampleAttribute missing')
	if (!tk.sampleAttribute.attributes) return printerror('tk.sampleAttribute.attributes{} missing')

	tk.tip2.d.append('div').style('margin', '4px 10px').style('font-size', '.7em').text(samplegroup.name)

	tk.tip2.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Hide')
		.on('click', () => {
			tk.tip2.clear()
			const err = samplegroup_setShowhide(samplegroup, tk, true)
			if (err) {
				//return printerror(err)
			}
			tk.tip2.hide()
			loadTk(tk, block)
		})

	tk.tip2.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Show only')
		.on('click', () => {
			tk.tip2.clear()
			for (const g of tk._data) {
				const err = samplegroup_setShowhide(g, tk, true)
				if (err) {
					//return printerror(err)
				}
			}
			samplegroup_setShowhide(samplegroup, tk, false)
			tk.tip2.hide()
			loadTk(tk, block)
		})

	{
		/*
		under the same driver attribute, any other groups are hidden?
		if so, allow to show all
		*/
		const [err, attr, attrR] = samplegroup_getdriverattribute(samplegroup, tk)
		if (err) {
			// do not abort -- unannotated group of sample won't have .attributes[]
			// return printerror(err)
		} else if (attrR.hiddenvalues.size > 0) {
			// has other hidden groups
			tk.tip2.d
				.append('div')
				.attr('class', 'sja_menuoption')
				.text('Show all')
				.on('click', () => {
					tk.tip2.hide()
					attrR.hiddenvalues.clear()
					loadTk(tk, block)
				})
		}
	}

	tk.tip2.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Table view')
		.on('click', () => {
			tk.tip2.hide()
			click_samplegroup_showtable(samplegroup, tk, block)
		})

	tk.tip2.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Matrix view')
		.on('click', () => {
			tk.tip2.hide()
			matrix_view(tk, block, samplegroup)
		})

	may_show_matrixbutton(samplegroup, tk, block)

	may_createbutton_survival_grouplab({
		tk,
		block,
		samplegroup,
		holder: tk.tip2.d
	})

	may_createbutton_assayAvailability(tk, block, tk.tip2.d, samplegroup)
}

function sampleset_showgrpmenu(grp, tk, block) {
	// display menu for a group of sampleset
	// for both official and custom tracks
	tk.tip2.d.append('div').style('margin', '4px 10px').style('font-size', '.7em').text(grp.name)
	tk.tip2.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Table view')
		.on('click', () => {
			tk.tip2.hide()
			click_samplegroup_showtable(grp, tk, block)
		})
	tk.tip2.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Matrix view')
		.on('click', () => {
			tk.tip2.hide()
			matrix_view(tk, block, grp)
		})
}

function matrix_view(tk, block, samplegroup) {
	/*
	in group-less track (custom or official lacking config)
	samplegroup will not be given, use all samples
	*/

	const r = block.rglst[block.startidx]
	const feature = {
		ismutation: 1,
		width: 60,
		chr: r.chr,
		start: r.start,
		stop: r.stop,
		cnv: {
			valuecutoff: tk.valueCutoff,
			focalsizelimit: tk.bplengthUpperLimit
		},
		loh: {
			valuecutoff: tk.segmeanValueCutoff,
			focalsizelimit: tk.lohLengthUpperLimit
		},
		itd: {},
		sv: {},
		fusion: {},
		snvindel: {
			excludeclasses: {}
		}
	}

	if (tk.legend_mclass && tk.legend_mclass.hiddenvalues) {
		// hidden class and dt
		for (const v of tk.legend_mclass.hiddenvalues) {
			if (typeof v == 'string') {
				feature.snvindel.excludeclasses[v] = 1
			} else {
				if (v == common.dtcnv) {
					feature.cnv.hidden = 1
				} else if (v == common.dtloh) {
					feature.loh.hidden = 1
				} else if (v == common.dtitd) {
					feature.itd.hidden = 1
				} else if (v == common.dtsv) {
					feature.sv.hidden = 1
				} else if (v == common.dtfusionrna) {
					feature.fusion.hidden = 1
				} else {
					console.error('unknown hidden dt?? ' + v)
				}
			}
		}
	}

	// label, try to use expression gene name
	if (tk.showinggene) {
		feature.label = tk.showinggene
	} else {
		feature.label = r.chr + ':' + r.start + '-' + r.stop
	}

	const smat_arg = { tk, block, feature }

	feature.querykeylst = []

	if (tk.iscustom) {
		if (tk.file || tk.url) feature.querykeylst.push(customkey_svcnv)
		if (tk.checkvcf) feature.querykeylst.push(customkey_vcf)
	} else if (tk.querykey) {
		feature.querykeylst.push(tk.querykey)
		if (tk.checkvcf) feature.querykeylst.push(tk.checkvcf.querykey)
	}

	if (tk.sampleset) {
		// the group is from sampleset
		for (const m of tk.samplematrices) {
			if (m.limitbysamplesetgroup && m.limitbysamplesetgroup.name == samplegroup.name) {
				client.appear(m._pane.pane)
				m.addnewfeature_update(feature)
				return
			}
		}
		smat_arg.limitbysamplesetgroup = {
			name: samplegroup.name,
			samples: JSON.parse(JSON.stringify(tk.sampleset.find(i => i.name == samplegroup.name).samples))
		}
	} else if (samplegroup.attributes) {
		// attribute that defines this group of samples
		const attr = samplegroup.attributes[samplegroup.attributes.length - 1]
		for (const m of tk.samplematrices) {
			if (m.limitsamplebyeitherannotation) {
				// hardcoded to use first attr
				const a = m.limitsamplebyeitherannotation[0]
				if (a && a.key == attr.k && a.value == attr.kvalue) {
					// found the smat of this sample group
					client.appear(m._pane.pane)
					m.addnewfeature_update(feature)
					return
				}
			}
		}
		smat_arg.limitsamplebyeitherannotation = [
			{
				key: attr.k,
				value: attr.kvalue
			}
		]
	}

	// create new smat
	createnewmatrix_withafeature(smat_arg)
}

function samplegroup_getdriverattribute(g, tk) {
	if (!g.attributes) return ['.attributes[] missing for group ' + g.name]
	if (g.attributes.length == 0) return ['.attributes[] zero length for group ' + g.name]
	const attribute = g.attributes[g.attributes.length - 1]
	/*
	.k
	.kvalue
	.full
	.fullvalue

	use this attribute to set this group to hidden in tk.sampleAttribute 
	*/
	const attrRegister = tk.sampleAttribute.attributes[attribute.k]
	if (!attrRegister) return ['"' + attribute.k + '" not registered in sampleAttribute for group ' + g.name]
	return [null, attribute, attrRegister]
}

function samplegroup_setShowhide(g, tk, tohide) {
	const [err, attr, attrR] = samplegroup_getdriverattribute(g, tk)
	if (err) return err
	if (tohide) {
		attrR.hiddenvalues.add(attr.kvalue)
	} else {
		attrR.hiddenvalues.delete(attr.kvalue)
	}
	return null
}

export function tooltip_samplegroup(g, tk) {
	const d = tk.tktip.clear().d.append('div')

	if (g.attributes) {
		// official only
		for (const a of g.attributes) {
			d.append('div').html(
				a.kvalue + (a.fullvalue ? ' <span style="opacity:.5;font-size:.8em;">' + a.fullvalue + '</span>' : '')
			)
		}
	} else if (g.name) {
		d.append('div').text(g.name)
	}

	const html = [g.samples.length + ' sample' + (g.samples.length > 1 ? 's' : '')]
	if (g.sampletotalnum)
		html.push(g.sampletotalnum + ' samples total, ' + Math.ceil((100 * g.samples.length) / g.sampletotalnum) + '%')
	if (tk.sampleset) {
		// full list of samples registered in tk.sampleset
		const s = tk.sampleset.find(i => i.name == g.name)
		if (s) {
			html.push(s.samples.length + ' samples total, ' + Math.ceil((100 * g.samples.length) / s.samples.length) + '%')
		}
	}
	tk.tktip.d.append('div').style('margin-top', '10px').style('color', '#858585').html(html.join('<br>'))

	tk.tktip.show(event.clientX, event.clientY)
}

export function click_samplegroup_showtable(samplegroup, tk, block) {
	/*
	show a table
	multi-sample
	only for native track: no group for custom track for lack of annotation
	*/
	const pane = client.newpane({ x: event.clientX + 100, y: Math.max(100, event.clientY - 100) })
	pane.header.html(samplegroup.name + ' <span style="font-size:.7em">' + tk.name + '</span>')

	if (samplegroup.samples.length == 1) {
		// one sample

		const sample = samplegroup.samples[0]

		const table = pane.body.append('table').style('margin', '10px').style('border-spacing', '4px')

		{
			const tr = table.append('tr')
			tr.append('td').text('Sample').style('opacity', 0.5)
			tr.append('td').text(sample.samplename)
		}
		if (sample.sampletype) {
			const tr = table.append('tr')
			tr.append('td').text('Sample type').style('opacity', 0.5)
			tr.append('td').text(sample.sampletype)
		}

		const [cnvlst, svlst, lohlst, itdlst, vcflst, cnvlst0, svlst0, lohlst0, itdlst0, vcflst0] =
			sortitemsbytype_onesample(sample.samplename, sample.items, tk)

		if (cnvlst.length) {
			const tr = table.append('tr')
			tr.append('td').text('CNV').style('opacity', 0.5)
			const td = tr.append('td')
			for (let i = 0; i < cnvlst.length; i++) {
				td.append('div')
					.html(cnvlst[i])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: cnvlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: cnvlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
		if (svlst.length) {
			const tr = table.append('tr')
			tr.append('td').text('SV').style('opacity', 0.5)
			const td = tr.append('td')
			for (let i = 0; i < svlst.length; i++) {
				td.append('div')
					.html(svlst[i])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: svlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: svlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
		if (lohlst.length) {
			const tr = table.append('tr')
			tr.append('td').text('LOH').style('opacity', 0.5)
			const td = tr.append('td')
			for (let i = 0; i < lohlst.length; i++) {
				td.append('div')
					.html(lohlst[i])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: lohlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: lohlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
		if (itdlst.length) {
			const tr = table.append('tr')
			tr.append('td').text('ITD').style('opacity', 0.5)
			const td = tr.append('td')
			for (let i = 0; i < itdlst.length; i++) {
				td.append('div')
					.html(itdlst[i])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: itdlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: itdlst0[i],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
		if (vcflst.length) {
			const tr = table.append('tr')
			tr.append('td').text('SNV/indel').style('opacity', 0.5)
			const td = tr.append('td')

			for (let i = 0; i < vcflst.length; i++) {
				const ms = vcflst0[i].sampledata.find(j => j.sampleobj.name == sample.samplename)

				td.append('div')
					.html(vcflst[i])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: vcflst0[i],
							m_sample: ms,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: vcflst0[i],
							sample: sample,
							m_sample: ms,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
		return
	}

	// multiple samples
	const table = pane.body.append('table').style('border-spacing', '2px').style('margin', '20px')

	const hassampletype = samplegroup.samples.find(i => i.sampletype)

	// header
	const tr = table.append('tr')
	tr.append('td').text('Sample').style('opacity', 0.5)
	if (hassampletype) {
		tr.append('td').text('Sample type').style('opacity', 0.5)
	}
	tr.append('td').text('CNV').style('opacity', 0.5)
	tr.append('td').text('SV').style('opacity', 0.5)
	tr.append('td').text('LOH').style('opacity', 0.5)
	tr.append('td').text('ITD').style('opacity', 0.5)

	if (tk.data_vcf) {
		tr.append('td').text('SNV/indel').style('opacity', 0.5)
	}

	for (const [i, sample] of samplegroup.samples.entries()) {
		const tr = table.append('tr')

		if (!(i % 2)) {
			tr.style('background', '#f1f1f1')
		}

		tr.append('td').text(sample.samplename)

		if (hassampletype) {
			tr.append('td').text(sample.sampletype || '')
		}

		const [cnvlst, svlst, lohlst, itdlst, vcflst, cnvlst0, svlst0, lohlst0, itdlst0, vcflst0] =
			sortitemsbytype_onesample(sample.samplename, sample.items, tk)

		{
			const td = tr.append('td')
			for (let j = 0; j < cnvlst.length; j++) {
				td.append('div')
					.html(cnvlst[j])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: cnvlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: cnvlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
		{
			const td = tr.append('td')
			for (let j = 0; j < svlst.length; j++) {
				td.append('div')
					.html(svlst[j])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: svlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: svlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
		{
			const td = tr.append('td')
			for (let j = 0; j < lohlst.length; j++) {
				td.append('div')
					.html(lohlst[j])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: lohlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: lohlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}

		{
			const td = tr.append('td')
			for (let j = 0; j < itdlst.length; j++) {
				td.append('div')
					.html(itdlst[j])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: itdlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: itdlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}

		if (tk.data_vcf) {
			const td = tr.append('td')
			for (let j = 0; j < vcflst.length; j++) {
				const ms = vcflst0[j].sampledata.find(k => k.sampleobj.name == sample.samplename)

				td.append('div')
					.html(vcflst[j])
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: vcflst0[j],
							m_sample: ms,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: vcflst0[j],
							m_sample: ms,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
		}
	}
}

export function tooltip_multi_svdense(g, tk, block) {
	/*
	multi-sample
	official or custom
	dense mode
	mouse over a dot
	*/

	if (g.items.length == 1) {
		const sv = g.items[0]
		tooltip_singleitem({
			item: sv,
			sample: sv._sample,
			samplegroup: sv._samplegroup,
			tk: tk,
			block: block
		})
		return
	}

	tk.tktip.clear()

	let grouplabel = 'Group'
	if (tk.groupsamplebyattr && tk.groupsamplebyattr.attrlst) {
		// passed from mds.query
		grouplabel = tk.groupsamplebyattr.attrlst[tk.groupsamplebyattr.attrlst.length - 1].label
	}

	const lst = [
		{
			k: grouplabel,
			v: g.name
		}
	]

	let svnum = 0,
		fusionnum = 0
	for (const i of g.items) {
		if (i.dt == common.dtsv) svnum++
		else if (i.dt == common.dtfusionrna) fusionnum++
	}

	if (svnum) lst.push({ k: '# of SV', v: svnum })
	if (fusionnum) lst.push({ k: '# of fusion', v: fusionnum })

	client.make_table_2col(tk.tktip.d, lst)
	tk.tktip.show(event.clientX, event.clientY)
}

export function click_multi_svdense(g, tk, block) {
	/*
	multi-sample
	native/custom
	dense
	clicking on a ball representing density of sv breakend
	*/
	if (g.items.length == 1) {
		const sv = g.items[0]
		click_multi_singleitem({
			item: sv,
			sample: sv._sample,
			samplegroup: sv._samplegroup,
			tk: tk,
			block: block
		})
		return
	}

	const pane = client.newpane({ x: event.clientX, y: event.clientY })
	pane.header.html(g.name + ' <span style="font-size:.8em">' + tk.name + '</span>')

	const sample2lst = new Map()
	for (const i of g.items) {
		if (!sample2lst.has(i.sample)) {
			sample2lst.set(i.sample, {
				sv: [],
				fusion: []
			})
		}
		if (i.dt == common.dtsv) {
			sample2lst.get(i.sample).sv.push(i)
		} else if (i.dt == common.dtfusionrna) {
			sample2lst.get(i.sample).fusion.push(i)
		}
	}

	const table = pane.body.append('table').style('border-spacing', '2px').style('margin', '10px')

	const tr = table.append('tr')
	tr.append('td').text('Sample').style('font-size', '.8em').style('opacity', 0.5)
	tr.append('td').text('SV').style('font-size', '.8em').style('opacity', 0.5)
	tr.append('td').text('RNA fusion').style('font-size', '.8em').style('opacity', 0.5)

	let j = 0
	for (const [sample, so] of sample2lst) {
		const tr = table.append('tr')
		if (!(j++ % 2)) {
			tr.style('background', '#f1f1f1')
		}

		tr.append('td').text(sample)

		const td1 = tr.append('td')
		for (const i of so.sv) {
			const breakpoint = svcoord2html(i, tk)

			td1
				.append('div')
				.attr('class', 'sja_clbtext')
				.html(
					i.cytogeneticname ? i.cytogeneticname + ' <span style="font-size:.7em">' + breakpoint + '</span>' : breakpoint
				)
				.on('mouseover', () => {
					tooltip_singleitem({
						item: i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk: tk
					})
				})
				.on('mouseout', () => {
					tk.tktip.hide()
					multi_sample_removehighlight(i._sample)
				})
				.on('click', () => {
					click_multi_singleitem({
						item: i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk: tk,
						block: block
					})
				})
		}

		const td2 = tr.append('td')
		for (const i of so.fusion) {
			td2
				.append('div')
				.attr('class', 'sja_clbtext')
				.html(itemname_svfusion(i) + ' <span style="font-size:.7em">' + svcoord2html(i, tk) + '</span>')
				.on('mouseover', () => {
					tooltip_singleitem({
						item: i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk: tk
					})
				})
				.on('mouseout', () => {
					tk.tktip.hide()
					multi_sample_removehighlight(i._sample)
				})
				.on('click', () => {
					click_multi_singleitem({
						item: i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk: tk,
						block: block
					})
				})
		}
	}
}

export function click_multi_vcfdense(g, tk, block) {
	/*
	multi-sample
	native/custom
	dense
	click on a dot representing some snvindel or itd, of same type
	g is a list of variants of the same class, shown as a dot
	*/

	const pane = client.newpane({ x: event.clientX, y: event.clientY })
	pane.header.text(tk.name)

	if (g.items.length == 1) {
		// only one variant
		const m = g.items[0]

		const butrow = pane.body.append('div').style('margin', '10px')

		if (m.dt == common.dtsnvindel) {
			if (m.sampledata.length == 1) {
				// in a single sample
				pane.pane.remove()
				// sample/group should always be found
				const [sample, samplegroup] = findsamplegroup_byvcf({
					m: m,
					m_sample: m.sampledata[0],
					tk: tk
				})
				const ms = m.sampledata[0]
				click_multi_singleitem({
					item: m,
					m_sample: m.sampledata[0],
					sample: sample,
					samplegroup: samplegroup,
					tk: tk,
					block: block
				})
				return
			}

			// one snv, in multiple samples
			/*
			createbutton_addfeature( {
				m:m,
				holder:butrow,
				tk:tk,
				block:block,
				pane: pane
			})

			may_createbutton_survival_onemutation({
				holder: butrow,
				tk: tk,
				block: block,
				m: m,
				sample: {
					samplename: m.sampledata[0].sampleobj.name
				}
			})
			*/

			const lst = printer_snvindel(m, tk)
			const table = client.make_table_2col(pane.body, lst)
			const tr = table.append('tr')
			tr.append('td').text('Samples').style('opacity', 0.5).attr('colspan', 2)

			const td = tr.append('td')
			for (const sm of m.sampledata) {
				const [sample, samplegroup] = findsamplegroup_byvcf({
					m: m,
					m_sample: sm,
					tk: tk
				})

				td.append('div')
					.text(sm.sampleobj.name)
					.attr('class', 'sja_clbtext')
					.on('mouseover', () => {
						tooltip_singleitem({
							item: m,
							m_sample: sm,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
					.on('mouseout', () => {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click', () => {
						click_multi_singleitem({
							item: m,
							m_sample: sm,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
			}
			may_findmatchingsnp_printintable(m, block, table)
		} else {
			throw 'Unknown dt: ' + m.dt
		}
		return
	}

	/* multiple variants
	list samples for each variant
	*/

	const table = pane.body.append('table').style('margin-top', '10px').style('border-spacing', '4px')

	for (const m of g.items) {
		const tr = table.append('tr')

		// col 1: mutation name
		tr.append('td')
			.text(m.mname)
			.style('color', common.mclass[m.class].color)
			.style('font-weight', 'bold')
			.style('vertical-align', 'top')
		// createbutton_addfeature

		// col 2
		{
			const td = tr.append('td')
			if (m.dt == common.dtsnvindel) {
				td.style('opacity', '.5')
					.text(m.ref + ' > ' + m.alt)
					.style('vertical-align', 'top')
			}
		}

		// col 3
		{
			const td = tr.append('td')
			if (m.dt == common.dtsnvindel) {
				// show each sample

				for (const m_sample of m.sampledata) {
					const [s, sg] = findsamplegroup_byvcf({
						m: m,
						m_sample: m_sample,
						tk: tk
					})
					td.append('div')
						.text(m_sample.sampleobj.name)
						.attr('class', 'sja_clbtext')
						.on('mouseover', () => {
							tooltip_singleitem({
								item: m,
								m_sample: m_sample,
								sample: s,
								samplegroup: sg,
								tk: tk,
								block: block
							})
						})
						.on('mouseout', () => {
							tk.tktip.hide()
							multi_sample_removehighlight(s)
						})
						.on('click', () => {
							click_multi_singleitem({
								item: m,
								m_sample: m_sample,
								sample: s,
								samplegroup: sg,
								tk: tk,
								block: block
							})
						})
				}
			} else {
				console.error('unknown dt: ' + m.dt)
			}
		}
	}
}

export function tooltip_multi_vcfdense(g, tk, block) {
	/*
	multi-sample
	official or custom
	dense mode
	mouseover a dot
	*/
	tk.tktip.clear()

	if (g.items.length == 1) {
		// single variant
		const m = g.items[0]

		if (m.dt == common.dtsnvindel) {
			if (m.sampledata.length == 1) {
				// in just one sample
				const [sample, samplegroup] = findsamplegroup_byvcf({
					m: m,
					m_sample: m.sampledata[0],
					tk: tk
				})
				tooltip_singleitem({
					item: m,
					m_sample: m.sampledata[0],
					sample: sample,
					samplegroup: samplegroup,
					tk: tk,
					block: block
				})
				return
			}

			// multiple samples have this variant
			const lst = printer_snvindel(m, tk)
			lst.push({
				k: 'Samples',
				v:
					m.sampledata.length > 10
						? m.sampledata
								.slice(0, 6)
								.map(i => i.sampleobj.name)
								.join('<br>') +
						  '<br><i>... and ' +
						  (m.sampledata.length - 6) +
						  ' more samples</i>'
						: m.sampledata.map(i => i.sampleobj.name).join('<br>')
			})

			const table = client.make_table_2col(tk.tktip.d, lst)

			// mds may indicate whether to perform snp/clinvar checking
			may_findmatchingsnp_printintable(m, block, table)

			tk.tktip.show(event.clientX, event.clientY)
		} else {
			throw 'unknown dt: ' + m.dt
		}
		return
	}

	// multiple variants, of same class
	tk.tktip.d
		.append('div')
		.style('font-size', '.7em')
		.style('margin-bottom', '5px')
		.text(g.items.length + ' ' + common.mclass[g.items[0].class].label + ' mutations, ' + g.samplecount + ' samples')
	const table = tk.tktip.d.append('table').style('border-spacing', '3px')
	for (const m of g.items) {
		const tr = table.append('tr')
		tr.append('td').style('color', common.mclass[m.class].color).style('font-weight', 'bold').text(m.mname)

		tr.append('td')
			.style('font-size', '.7em')
			.style('opacity', '.5')
			.text(m.ref + ' > ' + m.alt)

		const td = tr.append('td').style('font-size', '.7em')

		if (m.dt == common.dtsnvindel) {
			td.text(m.sampledata.length == 1 ? m.sampledata[0].sampleobj.name : '(' + m.sampledata.length + ' samples)')
		} else {
			td.text('unknown dt: ' + m.dt)
		}
	}

	tk.tktip.show(event.clientX, event.clientY)
}

export async function click_multi_singleitem(p) {
	/*
	click on a single item, of any type
	launch a panel to show details
	only in multi-sample mode, not in single-sample
	for official or custom tracks


	p {}
	.item
	.sample
	.samplegroup
	.tk
	.block

	if item is snvindel, will have:
		.m_sample
	*/

	const pane = client.newpane({ x: event.clientX, y: event.clientY })
	pane.header.text(p.tk.name)

	const tabs = []
	tabs.push({
		label: 'Details',
		callback: div => {
			p.holder = div
			detailtable_singlesample(p)
		}
	})

	addtab_sampleview(tabs, p)
	mayaddtab_svgraph(tabs, p)
	mayaddtab_disco(tabs, p)
	mayaddtab_genome(tabs, p)
	/*
	createbutton_addfeature( {
		m: p.item,
		holder:buttonrow,
		tk: p.tk,
		block: p.block,
		pane: pane
	})
	*/
	mayaddtab_mutationsignature(tabs, p.sample.samplename, p.tk, p.block)
	mayaddtab_survival_onemutation(tabs, {
		tk: p.tk,
		block: p.block,
		m: p.item,
		sample: p.sample
	})
	mayaddtab_fimo(tabs, {
		tk: p.tk,
		block: p.block,
		m: p.item,
		sample: p.sample,
		samplegroup: p.samplegroup
	})

	client.tab2box(pane.body.style('padding-top', '10px'), tabs)
}

export function tooltip_singleitem(p) {
	/*
	multi-sample
	mouse over an item
	*/

	multi_sample_addhighlight(p.sample)

	p.holder = p.tk.tktip.clear().d

	detailtable_singlesample(p)

	// show tip after content is made
	p.tk.tktip.show(event.clientX, event.clientY)
}

export function detailtable_singlesample(p) {
	/*
	multi or single
	a table to indicate basic info about an item from a sample

	.item
	.sample {}
		.samplename
	.samplegroup {}
		.name
	.tk
	*/
	const lst = []

	if (p.sample) {
		lst.push({
			k: 'Sample',
			v: p.sample.samplename
		})

		may_add_sampleannotation(p.sample.samplename, p.tk, lst)
	} else {
		// if in single-sample mode, won't have p.sample
	}

	const m = p.item

	// mutation-level attributes
	let mattr

	if (m.dt == common.dtitd) {
		lst.push({
			k: 'ITD',
			v: m.chr + ':' + (m.start + 1) + '-' + (m.stop + 1)
		})

		if (m.gene || m.isoform) {
			const t = []
			if (m.gene) t.push(m.gene)
			if (m.isoform) t.push(m.isoform)
			lst.push({ k: 'Gene', v: t.join(', ') })
		}

		if (m.rnaduplength) {
			lst.push({ k: 'RNA duplicated', v: m.rnaduplength + ' bp' })
		}
		if (m.aaduplength) {
			lst.push({ k: 'AA duplicated', v: m.aaduplength + ' aa' })
		}

		mattr = m.mattr
	} else if (m.dt == common.dtcnv || m.dt == common.dtloh) {
		if (m.dt == common.dtloh) {
			lst.push({
				k: 'LOH seg.mean',
				v: m.segmean.toFixed(2)
			})
		} else {
			lst.push({
				k: 'CNV log2(ratio)',
				v:
					'<span style="padding:0px 4px;background:' +
					(m.value > 0 ? p.tk.cnvcolor.gain.str : p.tk.cnvcolor.loss.str) +
					';color:white;">' +
					m.value.toFixed(2) +
					'</span>'
			})
			lst.push({
				k: 'Copy number',
				v: (2 * Math.pow(2, m.value)).toFixed(2)
			})
		}

		lst.push({
			k: 'Position',
			v:
				m.chr +
				':' +
				(m.start + 1) +
				'-' +
				(m.stop + 1) +
				' <span style="font-size:.7em">' +
				common.bplen(m.stop - m.start) +
				'</span>'
		})

		mattr = m.mattr
	} else if (m.dt == common.dtsv || m.dt == common.dtfusionrna) {
		{
			lst.push({
				k: m.dt == common.dtsv ? 'SV' : 'RNA fusion',
				v: itemname_svfusion(m) + ' <span style="font-size:.7em">' + svcoord2html(m, p.tk) + '</span>'
			})
		}

		if (m.clipreadA || m.clipreadB) {
			lst.push({
				k: '# clip reads',
				v:
					'<span style="font-size:.7em;opacity:.7">A CLIP / TOTAL</span> ' +
					(Number.isInteger(m.clipreadA) ? m.clipreadA : '?') +
					' / ' +
					(Number.isInteger(m.totalreadA) ? m.totalreadA : '?') +
					'<br>' +
					'<span style="font-size:.7em;opacity:.7">B CLIP / TOTAL</span> ' +
					(Number.isInteger(m.clipreadB) ? m.clipreadB : '?') +
					' / ' +
					(Number.isInteger(m.totalreadB) ? m.totalreadB : '?')
			})
		}

		mattr = m.mattr
	} else if (m.dt == common.dtsnvindel) {
		const tmp = printer_snvindel(m, p.tk)
		for (const l of tmp) lst.push(l)

		if (p.m_sample) {
			/*
			m_sample as from m.sampledata[]

			in vcf item, mutation-level attributes are in Formats
			collect them for showing later
			*/
			mattr = {}

			const formats = p.tk.checkvcf ? p.tk.checkvcf.format : null // format registry

			for (const formatfield in p.m_sample) {
				if (formatfield == 'sampleobj') {
					// skip hardcoded attribute
					continue
				}

				/*
				if this format field could be mutation signature
				*/
				if (p.tk.mds && p.tk.mds.mutation_signature) {
					const sigset = p.tk.mds.mutation_signature.sets[formatfield]
					if (sigset) {
						// this format field is a signature
						const key = p.m_sample[formatfield]
						const v = sigset.signatures[key]
						// quick fix that there may be "nodata" as the decoy for indel
						if (!v.nodata) {
							const label = v ? v.name : 'Unknown (' + key + ')'
							const color = v ? v.color : 'black'
							lst.push({
								k: sigset.name,
								v: '<span style="background:' + color + '">&nbsp;&nbsp;&nbsp;</span> ' + label
							})
						}
						continue
					}
				}

				if (p.tk.mutationAttribute && p.tk.mutationAttribute.attributes) {
					// has it; test whether this format is actually attribute
					if (p.tk.mutationAttribute.attributes[formatfield]) {
						mattr[formatfield] = p.m_sample[formatfield]
						continue
					}
				}

				/*
				this format field is not declared in mds.mutationAttribute
				confusing here
				e.g. allele count
				*/

				const formatdesc = formats ? formats[formatfield] : null

				if (formatdesc) {
					// if the FORMAT has per-allele value, like AD in vcf 4.2+
					let isperallelevalue = formatdesc.Number == 'R' || formatdesc.Number == 'A'
					if (!isperallelevalue) {
						if (formatfield == 'AD') {
							// vcf 4.1 has AD as '.'
							isperallelevalue = true
						}
					}

					if (isperallelevalue) {
						// per allele value

						const alleles = []
						const values = []
						let altvalue

						// add alt first
						for (const ale in p.m_sample[formatfield]) {
							if (ale == m.ref) continue
							alleles.push(ale)
							altvalue = p.m_sample[formatfield][ale]
							values.push(altvalue)
						}

						// add ref after alt
						const refvalue = p.m_sample[formatfield][m.ref]
						if (refvalue != undefined) {
							alleles.push(m.ref)
							values.push(refvalue)
						}

						let barsvg
						if (refvalue + altvalue > 0) {
							barsvg = client.fillbar(null, { f: altvalue / (altvalue + refvalue) })
						}

						lst.push({
							k: formatfield,
							v:
								(barsvg ? barsvg + ' ' : '') +
								'<span style="font-size:.8em;opacity:.5">' +
								alleles.join(' / ') +
								'</span> ' +
								values.join(' / ') +
								(formatdesc.Description
									? ' <span style="font-size:.7em;opacity:.5">' + formatdesc.Description + '</span>'
									: '')
						})
						continue
					}
				}

				lst.push({
					k: formatfield,
					v: p.m_sample[formatfield]
				})
			}
			// mutation attributes are FORMAT in vcf, already shown above

			mayaddRnabamstatusForsnp(p.tk, m, p.m_sample.sampleobj.name, lst)
		}
	} else {
		lst.push({ k: 'Unknown dt!!', v: m.dt })
	}

	if (mattr) {
		// show mutation-level attributes, won't do here for vcf stuff
		for (const key in mattr) {
			const attr = p.tk.mutationAttribute ? p.tk.mutationAttribute.attributes[key] : null
			const vstr = mattr[key]

			if (attr) {
				if (attr.appendto_link) {
					// quick fix for pmid

					if (!vstr) {
						// no value
						continue
					}

					lst.push({
						k: attr.label,
						v: vstr
							.split(',')
							.map(id => '<a target=_blank href=' + attr.appendto_link + id + '>' + id + '</a>')
							.join(' ')
					})
					continue
				}

				if (attr.values) {
					// values is optional
					const vv = attr.values[vstr]
					if (vv) {
						lst.push({
							k: attr.label,
							v: vv.name + (vv.label ? ' <span style="font-size:.7em;opacity:.5">' + vv.label + '</span>' : '')
						})
						continue
					}
				}

				// no attr.values{} or unregistered value
				lst.push({
					k: attr.label,
					v: vstr
				})
			} else {
				lst.push({
					k: key,
					v: vstr
				})
			}
		}
	}

	mayaddexpressionrank(p, lst)

	mayAddRnabamGenease(p, lst)

	const table = client.make_table_2col(p.holder, lst)

	if (m.dt == common.dtsnvindel) {
		may_findmatchingsnp_printintable(m, p.block, table)
	}
}

function mayaddRnabamstatusForsnp(tk, m, samplename, lst) {
	if (!tk.checkrnabam) return
	const sbam = tk.checkrnabam.samples[samplename]
	if (!sbam) return // no rna bam for this sample

	if (!common.basecolor[m.ref] || !common.basecolor[m.alt]) {
		// not snp
		lst.push({
			k: 'RNA-seq',
			v: 'RNA-seq coverage not assessed, not SNV'
		})
		return
	}

	if (!sbam.genes) return

	// this snp could be included multiple times in overlapping genes
	let rnasnp

	for (const g of sbam.genes) {
		if (g.snps) {
			const s = g.snps.find(i => i.pos == m.pos && i.ref == m.ref && i.alt == m.alt)
			if (s) {
				rnasnp = s
				break
			}
		}
	}

	if (!rnasnp) {
		lst.push({
			k: 'RNA-seq',
			v: 'RNA-seq coverage not assessed, not heterozygous in DNA'
		})
		return
	}

	if (rnasnp.rnacount.nocoverage) {
		lst.push({
			k: 'RNA-seq',
			v: 'Not covered in RNA-seq'
		})
		return
	}

	lst.push({
		k: 'RNA-seq read count',
		v:
			client.fillbar(null, { f: rnasnp.rnacount.f }) +
			' ' +
			'<span style="font-size:.8em;opacity:.5">' +
			m.alt +
			' / ' +
			m.ref +
			'</span> ' +
			rnasnp.rnacount.alt +
			' / ' +
			rnasnp.rnacount.ref +
			(rnasnp.rnacount.pvalue
				? ' <span style="font-size:.8em;opacity:.5">Binomial p</span> ' + rnasnp.rnacount.pvalue
				: '')
	})
}

function mayAddRnabamGenease(p, lst) {
	// may add ase status from rna bam
	const tk = p.tk
	if (!tk) return
	if (!tk.checkrnabam) return
	if (!p.sample) return
	const sbam = tk.checkrnabam.samples[p.sample.samplename]
	if (!sbam) return
	if (!sbam.genes) return
	const rows = []

	for (const g of sbam.genes) {
		const lst = [
			'<td><b>' +
				g.gene +
				'</b></td>' +
				'<td><span style="font-size:.8em;opacity:.5">' +
				tk.gecfg.datatype +
				'</span> ' +
				g.fpkm +
				'</td>' +
				'<td>'
		]
		if (g.estat) {
			if (g.estat.ase_uncertain) {
				lst.push(
					'<span style="padding:0px 5px;background:' +
						tk.gecfg.ase.color_uncertain +
						';color:white">ASE uncertain</span>'
				)
			} else if (g.estat.ase_biallelic) {
				lst.push(
					'<span style="padding:0px 5px;background:' + tk.gecfg.ase.color_biallelic + ';color:white">Bi-allelic</span>'
				)
			} else if (g.estat.ase_monoallelic) {
				lst.push(
					'<span style="padding:0px 5px;background:' +
						tk.gecfg.ase.color_monoallelic +
						';color:white">Mono-allelic</span>'
				)
			}
		}
		lst.push('</td>')

		rows.push('<tr>' + lst.join('') + '</tr>')
	}

	if (tk.gecfg.fixed) {
		for (const gene of tk.gecfg.fixed) {
			if (gene.sample2rnabam) {
				const g4s = gene.sample2rnabam[p.sample.samplename]
				if (g4s) {
					const lst = [
						'<td><b>' +
							gene.gene +
							'</b></td>' +
							'<td><span style="font-size:.8em;opacity:.5">' +
							tk.gecfg.datatype +
							'</span> ' +
							g4s.fpkm +
							'</td>' +
							'<td>'
					]
					if (g4s.estat) {
						if (g4s.estat.ase_uncertain) {
							lst.push(
								'<span style="padding:0px 5px;background:' +
									tk.gecfg.ase.color_uncertain +
									';color:white">ASE uncertain</span>'
							)
						} else if (g4s.estat.ase_biallelic) {
							lst.push(
								'<span style="padding:0px 5px;background:' +
									tk.gecfg.ase.color_biallelic +
									';color:white">Bi-allelic</span>'
							)
						} else if (g4s.estat.ase_monoallelic) {
							lst.push(
								'<span style="padding:0px 5px;background:' +
									tk.gecfg.ase.color_monoallelic +
									';color:white">Mono-allelic</span>'
							)
						}
					}
					lst.push('</td>')

					rows.push('<tr>' + lst.join('') + '</tr>')
				}
			}
		}
	}

	if (rows.length) {
		lst.push({
			k: 'Gene expression',
			v: '<table>' + rows.join('') + '</table>'
		})
	}
}

function mayaddexpressionrank(p, lines) {
	const tk = p.tk
	if (!tk) return
	const sample = p.sample
	if (!sample) return
	if (!sample.expressionrank) return

	// one gene per row
	const rows = []

	for (const genename in sample.expressionrank) {
		const v = sample.expressionrank[genename]
		const lst = [
			'<tr>' +
				'<td><b>' +
				genename +
				'</b></td>' +
				'<td>&nbsp;<span style="font-size:.7em">RANK</span> ' +
				client.ranksays(v.rank) +
				'</td>' +
				'<td>&nbsp;<span style="font-size:.7em">' +
				tk.gecfg.datatype +
				'</span> ' +
				v.value +
				'</td>' +
				'<td>'
		]

		if (v.estat) {
			if (v.estat.ase_uncertain) {
				lst.push(
					'<span style="padding:0px 5px;background:' +
						tk.gecfg.ase.color_uncertain +
						';color:white">ASE uncertain</span>'
				)
			} else if (v.estat.ase_biallelic) {
				lst.push(
					'<span style="padding:0px 5px;background:' + tk.gecfg.ase.color_biallelic + ';color:white">Bi-allelic</span>'
				)
			} else if (v.estat.ase_monoallelic) {
				lst.push(
					'<span style="padding:0px 5px;background:' +
						tk.gecfg.ase.color_monoallelic +
						';color:white">Mono-allelic</span>'
				)
			}
			if (v.estat.outlier) {
				lst.push(
					'<span style="padding:0px 5px;background:' +
						tk.gecfg.outlier.color_outlier +
						';color:white">Outlier HIGH</span>'
				)
			} else if (v.estat.outlier_asehigh) {
				lst.push(
					'<span style="padding:0px 5px;background:' +
						tk.gecfg.outlier.color_outlier_asehigh +
						';color:white">ASE HIGH</span>'
				)
			}
		}

		lst.push('</td></tr>')
		rows.push(lst.join(''))
	}

	if (tk.gecfg && tk.gecfg.fixed) {
		for (const fgene of tk.gecfg.fixed) {
			if (fgene.sample2rank && fgene.sample2rank[sample.samplename]) {
				const v = fgene.sample2rank[sample.samplename]
				const lst = [
					'<tr>' +
						'<td><b>' +
						fgene.gene +
						'</b></td>' +
						'<td>&nbsp;<span style="font-size:.7em">RANK</span> ' +
						client.ranksays(v.rank) +
						'</td>' +
						'<td>&nbsp;<span style="font-size:.7em">' +
						tk.gecfg.datatype +
						'</span> ' +
						v.value +
						'</td>' +
						'<td>'
				]

				if (v.estat) {
					if (v.estat.ase_uncertain) {
						lst.push(
							'<span style="padding:0px 5px;background:' +
								tk.gecfg.ase.color_uncertain +
								';color:white">ASE uncertain</span>'
						)
					} else if (v.estat.ase_biallelic) {
						lst.push(
							'<span style="padding:0px 5px;background:' +
								tk.gecfg.ase.color_biallelic +
								';color:white">Bi-allelic</span>'
						)
					} else if (v.estat.ase_monoallelic) {
						lst.push(
							'<span style="padding:0px 5px;background:' +
								tk.gecfg.ase.color_monoallelic +
								';color:white">Mono-allelic</span>'
						)
					}
					if (v.estat.outlier) {
						lst.push(
							'<span style="padding:0px 5px;background:' +
								tk.gecfg.outlier.color_outlier +
								';color:white">Outlier HIGH</span>'
						)
					} else if (v.estat.outlier_asehigh) {
						lst.push(
							'<span style="padding:0px 5px;background:' +
								tk.gecfg.outlier.color_outlier_asehigh +
								';color:white">ASE HIGH</span>'
						)
					}
				}

				lst.push('</td></tr>')
				rows.push(lst.join(''))
			}
		}
	}

	if (rows.length) {
		lines.push({
			k: 'Expression',
			v: '<table style="font-size:.9em">' + rows.join('') + '</table>'
		})
	}
}

function printer_snvindel(m, tk) {
	/*
	show attributes for a single variant
	may show INFO if they are used for filtering
	*/

	const lst = []

	{
		// somehow mname may be abscent from vep annotation
		const _c = common.mclass[m.class]
		lst.push({
			k: 'Mutation',
			v:
				(m.mname ? '<span style="color:' + _c.color + '">' + m.mname + '</span>' : '') +
				' <span style="font-size:.7em">' +
				_c.label +
				'</span>'
		})
	}

	{
		const phrases = []
		if (m.gene) phrases.push(m.gene)
		if (m.isoform) phrases.push(m.isoform)
		if (phrases.length) {
			lst.push({
				k: 'Gene',
				v: phrases.join(' ')
			})
		}
	}

	lst.push({
		k: 'Position',
		v: m.chr + ':' + (m.pos + 1)
	})
	lst.push({
		k: 'Alleles',
		v: '<span style="font-size:.8em;opacity:.5">REF/ALT</span> ' + m.ref + ' / ' + m.alt
	})

	if (tk && tk.alleleAttribute && tk.alleleAttribute.attributes) {
		for (const key in tk.alleleAttribute.attributes) {
			const attr = tk.alleleAttribute.attributes[key]
			lst.push({
				k: attr.label,
				v: m.altinfo ? m.altinfo[key] : ''
			})
		}
	}

	if (tk && tk.locusAttribute && tk.locusAttribute.attributes) {
		for (const key in tk.locusAttribute.attributes) {
			const attr = tk.locusAttribute.attributes[key]

			const vstr = m.info ? m.info[key] : ''

			// locus attribute support adding hyper links
			if (attr.appendto_link) {
				if (!vstr) {
					// no value, do not add link
					continue
				}

				lst.push({
					k: attr.label,
					v: vstr
						.split(',')
						.map(id => '<a target=_blank href=' + attr.appendto_link + id + '>' + id + '</a>')
						.join(' ')
				})
				continue
			}

			lst.push({
				k: attr.label,
				v: m.info ? m.info[key] : ''
			})
		}
	}

	return lst
}

function findsamplegroup_byvcf(p) {
	/*
	.m
	.m_sample
	p.tk
	*/

	let samplename
	if (p.m.dt == common.dtsnvindel) {
		if (!p.m_sample) throw 'm_sample missing'
		samplename = p.m_sample.sampleobj.name
	} else {
		throw 'unknown dt'
	}

	for (const g of p.tk._data) {
		for (const sample of g.samples) {
			if (sample.samplename == samplename) {
				return [sample, g]
			}
		}
	}
	return [-1, -1]
}

export function svchr2html(chr, tk) {
	// only for multi-sample, full mode
	if (tk.legend_svchrcolor.interchrs.has(chr)) {
		return (
			'<span style="background:' +
			tk.legend_svchrcolor.colorfunc(chr) +
			';font-weight:bold;padding:0px 5px;color:white">' +
			chr +
			'</span>'
		)
	}
	return chr
}

export function svcoord2html(i, tk) {
	return (
		svchr2html(i.chrA, tk) +
		':' +
		i.posA +
		(i.strandA ? ':' + i.strandA : '') +
		' &raquo; ' +
		svchr2html(i.chrB, tk) +
		':' +
		i.posB +
		(i.strandB ? ':' + i.strandB : '')
	)
}

function sortitemsbytype_onesample(samplename, lst, tk) {
	/*
	multi-sample
	dense or full
	for one sample, to show its mutation data in table, grouped by type
	*/

	const cnvlst = [], // html
		svlst = [],
		lohlst = [],
		itdlst = [],
		vcflst = [],
		cnvlst0 = [], // actual objects
		svlst0 = [],
		lohlst0 = [],
		itdlst0 = [],
		vcflst0 = []

	{
		// treat sv/fusion first: dedup breakends
		const breakends = lst.filter(i => i.dt == common.dtsv || i.dt == common.dtfusionrna)
		const deduped = dedup_sv(breakends)
		for (const i of deduped) {
			svlst.push(
				'<div style="white-space:nowrap">' +
					itemname_svfusion(i) +
					' <span style="font-size:.7em">' +
					svcoord2html(i, tk) +
					'</span>' +
					(i.dt == common.dtfusionrna ? ' <span style="font-size:.7em">(RNA fusion)</span>' : '') +
					'</div>'
			)
			svlst0.push(i)
		}
	}

	for (const i of lst) {
		if (i.dt == common.dtsv || i.dt == common.dtfusionrna) continue

		if (i.dt == common.dtloh) {
			lohlst.push(
				'<div style="white-space:nowrap">' +
					i.chr +
					':' +
					(i.start + 1) +
					'-' +
					(i.stop + 1) +
					' <span style="font-size:.8em">' +
					common.bplen(i.stop - i.start) +
					' seg.mean: ' +
					i.segmean +
					'</span>'
			)
			lohlst0.push(i)
		} else if (i.dt == common.dtcnv) {
			cnvlst.push(
				'<div style="white-space:nowrap">' +
					i.chr +
					':' +
					(i.start + 1) +
					'-' +
					(i.stop + 1) +
					' <span style="font-size:.8em">' +
					common.bplen(i.stop - i.start) +
					'</span>' +
					' <span style="background:' +
					(i.value > 0 ? tk.cnvcolor.gain.str : tk.cnvcolor.loss.str) +
					';font-size:.8em;color:white">&nbsp;' +
					i.value +
					'&nbsp;</span>' +
					'</div>'
			)
			cnvlst0.push(i)
		} else if (i.dt == common.dtitd) {
			itdlst.push(
				'<div style="white-space:nowrap">' +
					i.chr +
					':' +
					(i.start + 1) +
					'-' +
					(i.stop + 1) +
					(i.rnaduplength ? ', ' + i.rnaduplength + ' bp duplicated in RNA' : '') +
					(i.aaduplength ? ', ' + i.aaduplength + ' AA duplicated' : '') +
					'</div>'
			)
			itdlst0.push(i)
		} else {
			throw 'unknown dt: ' + i.dt
		}
	}

	if (tk.data_vcf) {
		for (const m of tk.data_vcf) {
			if (m.dt == common.dtsnvindel) {
				if (m.sampledata.find(s => s.sampleobj.name == samplename)) {
					const c = common.mclass[m.class]
					vcflst.push(
						'<div style="white-space:nowrap">' +
							'<span style="color:' +
							c.color +
							';font-weight:bold">' +
							m.mname +
							'</span> ' +
							'<span style="font-size:.7em">' +
							c.label +
							'</span></div>'
					)
					vcflst0.push(m)
				}
			} else {
				throw 'unknown dt: ' + m.dt
			}
		}
	}

	return [cnvlst, svlst, lohlst, itdlst, vcflst, cnvlst0, svlst0, lohlst0, itdlst0, vcflst0]
}

function may_show_matrixbutton(samplegroup, tk, block) {
	/*
	in sample group name menu, may add a button for showing pre-configured samplematrix for this group
	annotationsampleset2matrix has one key
	*/
	if (!tk.mds || !tk.mds.annotationsampleset2matrix) return
	if (!samplegroup.attributes) return

	// from attributes of this group, find one using that key
	const attr = samplegroup.attributes.find(i => i.k == tk.mds.annotationsampleset2matrix.key)
	if (!attr) return

	// and the value of the attribute for this group should have corresponding item
	const valueitem = tk.mds.annotationsampleset2matrix.groups[attr.kvalue]
	if (!valueitem) return

	if (!valueitem.groups) return // should not happen

	// this group will have 1 or more subgroups, each is one study group or subtype
	for (const group of valueitem.groups) {
		if (!group.name || !group.matrixconfig) continue

		tk.tip2.d
			.append('div')
			.html(group.name + ' <span style="font-size:.8em;opacity:.5">SUMMARY</span>')
			.attr('class', 'sja_menuoption')
			.on('click', () => {
				tk.tip2.hide()

				const pane = client.newpane({ x: 100, y: 100 })
				pane.header.text(group.name + ' summary')

				const arg = {
					dslabel: tk.mds.label,
					debugmode: block.debugmode,
					genome: block.genome,
					hostURL: block.hostURL,
					jwt: block.jwt,
					holder: pane.body.append('div').style('margin', '20px')
				}

				for (const k in group.matrixconfig) {
					arg[k] = group.matrixconfig[k]
				}

				import('./samplematrix').then(_ => {
					new _.Samplematrix(arg)
				})
			})
	}
}

export function may_add_sampleannotation(samplename, tk, lst) {
	if (!tk.sampleAttribute) return
	if (!tk.sampleAttribute.attributes || !tk.sampleAttribute.samples) return

	// should only be available in multi-sample, official tk

	const anno = tk.sampleAttribute.samples[samplename]
	if (!anno) return

	// show annotation for this sample
	for (const key in anno) {
		// config about this key
		const keycfg = tk.sampleAttribute.attributes[key] || {}

		const value = anno[key]

		if (value == undefined) continue

		let printvalue = value
		if (keycfg.values) {
			const o = keycfg.values[value]
			if (o && o.name) {
				printvalue = o.name
			}
		}

		lst.push({
			k: keycfg.label || key,
			v: printvalue
		})
	}
}

function mayaddtab_svgraph(tabs, p) {
	if (!p.item) return
	if (p.item.dt != common.dtsv && p.item.dt != common.dtfusionrna) return
	tabs.push({
		label: 'Fusion graph',
		callback: async div => {
			const wait = client.tab_wait(div)
			await make_svgraph(p, div)
			wait.remove()
		}
	})
}

export async function make_svgraph(p, holder) {
	const svpair = {
		a: {
			chr: p.item.chrA,
			position: p.item.posA,
			strand: p.item.strandA
		},
		b: {
			chr: p.item.chrB,
			position: p.item.posB,
			strand: p.item.strandB
		}
	}

	const wait = holder.append('div')

	try {
		// may use isoform supplied along with the data!!

		{
			wait.text('Loading gene at ' + svpair.a.chr + ':' + svpair.a.position + ' ...')
			const lst = await getisoform(p, svpair.a.chr, svpair.a.position)
			const useone = lst.find(i => i.isdefault) || lst[0]
			if (useone) {
				svpair.a.name = useone.name
				svpair.a.gm = { isoform: useone.isoform }
			}
		}
		{
			wait.text('Loading gene at ' + svpair.b.chr + ':' + svpair.b.position + ' ...')
			const lst = await getisoform(p, svpair.b.chr, svpair.b.position)
			const useone = lst.find(i => i.isdefault) || lst[0]
			if (useone) {
				svpair.b.name = useone.name
				svpair.b.gm = { isoform: useone.isoform }
			}
		}

		wait.remove()

		const svarg = {
			//jwt: p.block.jwt,
			//hostURL: p.block.hostURL,
			pairlst: [svpair],
			genome: p.block.genome,
			holder: holder
		}
		import('./svgraph').then(_ => {
			_.default(svarg)
		})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		wait.text('Error: ' + (e.message || e))
	}
}

function getisoform(p, chr, pos) {
	return client.dofetch3(`isoformbycoord?genome=${p.block.genome.name}&chr=${chr}&pos=${pos}`).then(data => {
		if (data.error) throw data.error
		return data.lst
	})
}

async function may_findmatchingsnp_printintable(m, block, table) {
	if (!block || !block.genome || !block.genome.hasSNP) return
	const tr = table.append('tr')
	tr.append('td').attr('colspan', 2).text('dbSNP').style('opacity', 0.4).style('padding', '3px')
	const td = tr.append('td')
	const wait = td.append('div').text('Loading...')
	try {
		const hits = await client.may_findmatchingsnp(m.chr, [m.pos], block.genome, [m.ref, m.altstr])
		if (!hits || hits.length == 0) {
			wait.text('No match')
			return
		}
		wait.remove()
		for (const s of hits) {
			const row = td.append('div')
			client.snp_printhtml(s, row)
		}
	} catch (e) {
		wait.text(e.message || e)
	}
}

function createbutton_focus(buttonrow, div, p, defaultshow) {
	// click focus button to show block in holder
	let blocknotshown = !defaultshow
	const holder = div
		.append('div')
		.style('margin', '10px')
		.style('display', defaultshow ? 'block' : 'none')

	// focus button
	buttonrow
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_menuoption')
		.text('Focus')
		.on('click', () => {
			if (holder.style('display') == 'none') {
				client.appear(holder)
			} else {
				client.disappear(holder)
			}

			if (blocknotshown) {
				blocknotshown = false
				focus_singlesample({
					holder: holder,
					m: p.item,
					sample: p.sample,
					samplegroup: p.samplegroup,
					tk: p.tk,
					block: p.block
				})
			}
		})

	if (defaultshow) {
		focus_singlesample({
			holder: holder,
			m: p.item,
			sample: p.sample,
			samplegroup: p.samplegroup,
			tk: p.tk,
			block: p.block
		})
	}
}

function addtab_sampleview(tabs, p) {
	tabs.push({
		label: 'Sample View',
		callback: div => {
			focus_singlesample({
				holder: div,
				m: p.item,
				sample: p.sample,
				samplegroup: p.samplegroup,
				tk: p.tk,
				block: p.block
			})
		}
	})
}

function mayaddtab_genome(tabs, p) {
	/*
if the sample has a single vcf file
will allow genome view
also allow if there is no vcf query at all
show entirety of each chr, and the mds single sample track

may allow for custom track without vcf
*/
	if (!p.tk.mds) return
	tabs.push({
		label: 'Genome',
		callback: async div => {
			const wait = client.tab_wait(div)
			try {
				const data = await client.dofetch('mdssvcnv', {
					genome: p.block.genome.name,
					dslabel: p.tk.mds.label,
					querykey: p.tk.mds.querykey,
					ifsamplehasvcf: p.sample.samplename
				})
				if (data.no) return
				// has single-sample vcf
				let maxbp = 0
				for (const chr in p.block.genome.majorchr) {
					maxbp = Math.max(maxbp, p.block.genome.majorchr[chr])
				}

				for (const chr in p.block.genome.majorchr) {
					const chrdiv = div.append('div').style('display', 'inline-block')
					const t = {}

					if (p.tk.iscustom) {
						// TODO
					} else {
						t.fixname = chr.toUpperCase()
						t.mds = p.tk.mds
						t.querykey = p.tk.querykey
						t.singlesample = {
							name: p.sample.samplename,
							waterfall: { inuse: 1 }
						}
						for (const k in p.tk.mds.queries[p.tk.querykey]) {
							if (k == 'bplengthUpperLimit' || k == 'valueCutoff') {
								// do not use default
								continue
							}
							t[k] = p.tk.mds.queries[p.tk.querykey][k]
						}
					}
					p.block.newblock({
						foldlegend: true,
						hide_mdsHandleHolder: 1,
						width: Math.ceil((900 * p.block.genome.majorchr[chr]) / maxbp),
						holder: chrdiv,
						block: 1,
						chr: chr,
						start: 0,
						stop: p.block.genome.majorchr[chr],
						tklst: [t]
					})
				}
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
				if (e.stack) console.log(e.stack)
			}
		}
	})
}

function mayaddtab_disco(tabs, p) {
	if (!p.tk.mds || !p.tk.mds.singlesamplemutationjson) return
	/*
	is official dataset, and equipped with single-sample files
	click button to retrieve all mutations and show in disco plot
	*/
	tabs.push({
		label: 'Disco plot',
		callback: async div => {
			const wait = client.tab_wait(div)
			try {
				const sjcharts = await getsjcharts()

				const arg = {
					genome: p.block.genome.name,
					dslabel: p.tk.mds.label,
					querykey: p.tk.querykey,
					getsample4disco: p.sample.samplename
				}
				const data = await client.dofetch('/mdssvcnv', arg)
				if (data.error) throw data.error
				if (!data.text) throw '.text missing'

				const disco_arg = {
					sampleName: p.sample.samplename,
					data: JSON.parse(data.text)
				}

				if (p.tk.mds.mutation_signature) {
					let hassig = false
					for (const k in p.tk.mds.mutation_signature.sets) {
						for (const m of disco_arg.data) {
							if (m[k]) {
								hassig = k
								break
							}
						}
						if (hassig) break
					}
					if (hassig) {
						const o = p.tk.mds.mutation_signature.sets[hassig]
						disco_arg.mutation_signature = {
							key: hassig,
							name: o.name,
							signatures: o.signatures
						}
					}
				}

				const renderer = await sjcharts.dtDisco({
					chromosomeType: p.block.genome.name,
					majorchr: p.block.genome.majorchr,
					holderSelector: div,
					settings: {
						showControls: false,
						selectedSamples: []
					},
					callbacks: {
						geneLabelClick: {
							type: 'genomepaint',
							hostURL: p.block.hostURL,
							genome: p.block.genome.name,
							dslabel: p.tk.mds.label,
							sample: p.sample.samplename
						}
					}
				})
				renderer.main(disco_arg)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
				if (e.stack) console.log(e.stack)
			}
		}
	})
}

function mayaddtab_mutationsignature(tabs, samplename, tk, block) {
	if (tk.iscustom || !tk.mds || !tk.mds.mutation_signature) return
	tabs.push({
		label: 'Mutation signature',
		callback: async div => {
			const wait = client.tab_wait(div)
			try {
				const data = await client.dofetch('mdssamplesignature', {
					sample: samplename,
					genome: block.genome.name,
					dslabel: tk.mds.label
				})
				if (data.error) throw data.error
				if (!data.lst) throw '.lst[] missing'
				if (data.lst.length == 0) {
					wait.text('No mutation signature for this sample.')
					return
				}
				for (const s of data.lst) {
					const ss = tk.mds.mutation_signature.sets[s.key]
					const d2 = div.append('div').style('margin-bottom', '20px')
					d2.append('div').text(ss.name)
					d2.append('div').text(s.valuename)
					const svg = d2.append('svg')
					const fontsize = 14,
						rowh = 16,
						barw = 250,
						pad = 20,
						rowspace = 2,
						labelspace = 6,
						axish = 5
					const maxv = s.annotation[0].v
					//const minv = s.annotation[s.annotation.length-1].v
					const minv = 0 // hardcode the #mutation per mb minimum value as 0
					const scale = scaleLinear().domain([minv, maxv]).range([0, barw])
					let labelw = 0
					for (const i of s.annotation) {
						svg
							.append('text')
							.attr('font-family', client.font)
							.attr('font-size', fontsize)
							.text(ss.signatures[i.k].name)
							.each(function () {
								labelw = Math.max(labelw, this.getBBox().width)
							})
							.remove()
					}
					const g = svg
						.append('g')
						.attr('transform', 'translate(' + (pad + labelw + labelspace) + ',' + (pad + axish + rowspace) + ')')
					for (const [i, a] of s.annotation.entries()) {
						const row = g.append('g').attr('transform', 'translate(0,' + (rowh + rowspace) * i + ')')
						row
							.append('text')
							.attr('font-family', client.font)
							.attr('font-size', fontsize)
							.attr('x', -labelspace)
							.attr('text-anchor', 'end')
							.attr('y', rowh / 2)
							.text(ss.signatures[a.k].name)
							.attr('dominant-baseline', 'central')
						row
							.append('rect')
							.attr('width', Math.max(1, scale(a.v)))
							.attr('height', rowh)
							.attr('shape-rendering', 'crispEdges')
							.attr('fill', ss.signatures[a.k].color)
					}

					client.axisstyle({
						axis: g
							.append('g')
							.attr('transform', 'translate(0,-' + rowspace + ')')
							.call(axisTop().scale(scale).ticks(4)),
						showline: 1,
						fontsize: fontsize - 2
					})

					svg
						.attr('width', pad + labelw + labelspace + barw + pad)
						.attr('height', pad + axish + rowspace + (rowh + rowspace) * s.annotation.length + pad)
				}
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
				if (e.stack) console.log(e.stack)
			}
		}
	})
}

function mayaddtab_fimo(tabs, arg) {
	/*
may create a tf motif find button for mutation
*/
	if (!arg.tk || !arg.block || !arg.block.genome || !arg.block.genome.fimo_motif) return
	if (!arg.m || arg.m.dt != common.dtsnvindel) return
	tabs.push({
		label: 'TF motif',
		callback: async div => {
			const wait = client.tab_wait(div)
			try {
				// generate fimo query param
				const fimoarg = {
					genome: arg.block.genome,
					div: div,
					m: {
						chr: arg.m.chr,
						pos: arg.m.pos + 1, // 1 based
						ref: arg.m.ref,
						alt: arg.m.alt
					}
				}
				// if fpkm is available and how to query
				if (arg.tk.iscustom) {
					if (arg.tk.checkexpressionrank) {
						fimoarg.factor_profiles = [
							{
								isgenevalue: 1,
								name: 'Gene ' + arg.tk.gecfg.datatype,
								file: arg.tk.checkexpressionrank.file,
								url: arg.tk.checkexpressionrank.url,
								indexURL: arg.tk.checkexpressionrank.indexURL
							}
						]

						if (arg.sample) {
							fimoarg.factor_profiles.push({
								isgenevalueonesample: 1,
								name: arg.sample.samplename + ' ' + arg.tk.gecfg.datatype,
								samplename: arg.sample.samplename,
								file: arg.tk.checkexpressionrank.file,
								url: arg.tk.checkexpressionrank.url,
								indexURL: arg.tk.checkexpressionrank.indexURL
							})
						}
					}
				} else {
					// native
					if (arg.tk.checkexpressionrank) {
						const fpro = {
							isgenevalue: 1,
							datatype: arg.tk.checkexpressionrank.datatype,
							querykey: arg.tk.checkexpressionrank.querykey,
							mdslabel: arg.tk.mds.label
						}
						if (arg.samplegroup) {
							if (arg.samplegroup.attributes) {
								// restrict expression to a group
								fpro.name = arg.samplegroup.name + ' ' + arg.tk.gecfg.datatype
								fpro.samplegroup_attrlst = arg.samplegroup.attributes
							}
						}
						if (!fpro.name) {
							fpro.name = 'Gene ' + arg.tk.gecfg.datatype
						}
						fimoarg.factor_profiles = [fpro]

						if (arg.sample) {
							fimoarg.factor_profiles.push({
								isgenevalueonesample: 1,
								name: arg.sample.samplename + ' ' + arg.tk.gecfg.datatype,
								samplename: arg.sample.samplename,
								datatype: arg.tk.checkexpressionrank.datatype,
								querykey: arg.tk.checkexpressionrank.querykey,
								mdslabel: arg.tk.mds.label
							})
						}
					}
				}
				const _ = await import('./mds.fimo')
				await _.init(fimoarg)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
				if (e.stack) console.log(e.stack)
			}
		}
	})
}

function mayaddtab_survival_onemutation(tabs, arg) {
	/*
may create a 'survival plot' button and use one mutation to divide samples
holder
tk
block
*/
	if (!arg.tk.mds || !arg.tk.mds.survivalplot) return
	tabs.push({
		label: 'Survival',
		callback: async div => {
			const wait = client.tab_wait(div)
			try {
				const m = arg.m
				// sample dividing rules
				const st = {
					mutation: 1
				}

				if (m.dt == common.dtsnvindel) {
					// default to use this specific mutation
					st.chr = m.chr
					st.start = m.pos
					st.stop = m.pos
					st.snvindel = {
						name: (m.gene ? m.gene + ' ' : '') + m.mname,
						ref: m.ref,
						alt: m.alt
					}
				} else if (m.dt == common.dtcnv) {
					st.chr = m.chr
					st.start = m.start
					st.stop = m.stop
					st.cnv = {
						focalsizelimit: arg.tk.bplengthUpperLimit,
						valuecutoff: arg.tk.valueCutoff
					}
				} else if (m.dt == common.dtloh) {
					st.chr = m.chr
					st.start = m.start
					st.stop = m.stop
					st.loh = {
						focalsizelimit: arg.tk.lohLengthUpperLimit,
						valuecutoff: arg.tk.segmeanValueCutoff
					}
				} else if (m.dt == common.dtsv) {
					st.chr = m._chr
					st.start = m._pos
					st.stop = m._pos
					st.sv = {}
				} else if (m.dt == common.dtfusionrna) {
					st.chr = m._chr
					st.start = m._pos
					st.stop = m._pos
					st.fusion = {}
				} else if (m.dt == common.dtitd) {
					st.chr = m.chr
					st.start = m.start
					st.stop = m.stop
					st.itd = {}
				}

				const plot = {
					renderplot: 1, // instruct the plot to be rendered, no wait
					samplerule: {
						full: {},
						set: st
					}
				}

				if (arg.tk.mds.survivalplot.samplegroupattrlst && arg.sample) {
					// the survivalplot has samplegrouping, and there is a single sample
					// will just use the first attribute
					const attr = arg.tk.mds.survivalplot.samplegroupattrlst[0]
					const sampleanno = arg.tk.sampleAttribute ? arg.tk.sampleAttribute.samples[arg.sample.samplename] : null
					if (sampleanno) {
						const v = sampleanno[attr.key]
						if (v) {
							plot.samplerule.full.byattr = 1
							plot.samplerule.full.key = attr.key
							plot.samplerule.full.value = v
						}
					}
				} else {
					// do not set rule for sample-full
				}

				const _ = await import('./mds.survivalplot')
				await _.init(
					{
						genome: arg.block.genome,
						mds: arg.tk.mds,
						plotlist: [plot]
					},
					div,
					arg.block.debugmode
				)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
				if (e.stack) console.log(e.stack)
			}
		}
	})
}

function may_createbutton_survival_grouplab(arg) {
	/*
in multi-sample mode, either dense or expanded
click on group label to show button
use current range for finding mutations
observe those in legend_mclass.hiddenvalues

holder
tk
block
samplegroup
	.attributes
*/
	if (!arg.tk.mds || !arg.tk.mds.survivalplot) {
		return
	}

	arg.holder
		.append('div')
		.text('Survival plot')
		.attr('class', 'sja_menuoption')
		.on('click', () => {
			arg.tk.tip2.hide()

			const m = arg.m

			// sample dividing rules
			const st = {
				mutation: 1
			}
			// get look range
			{
				const lst = arg.block.rglst
				st.chr = lst[arg.block.startidx].chr
				const a = lst[arg.block.startidx].start
				const b = lst[arg.block.stopidx].stop
				st.start = Math.min(a, b)
				st.stop = Math.max(a, b)
			}

			st.snvindel = {
				hiddenclass: {}
			}

			// hiddenvalues is a mix of dt and mclass
			{
				// check mclass first
				let hashiddensnv = false
				for (const c of arg.tk.legend_mclass.hiddenvalues) {
					if (typeof c == 'string') {
						st.snvindel.hiddenclass[c] = 1
						hashiddensnv = true
					}
				}
				if (!hashiddensnv) {
					delete st.snvindel.hiddenclass
				}
			}

			if (!arg.tk.legend_mclass.hiddenvalues.has(common.dtcnv)) {
				st.cnv = {
					focalsizelimit: arg.tk.bplengthUpperLimit,
					valuecutoff: arg.tk.valueCutoff
				}
			}
			if (!arg.tk.legend_mclass.hiddenvalues.has(common.dtloh)) {
				st.loh = {
					focalsizelimit: arg.tk.lohLengthUpperLimit,
					valuecutoff: arg.tk.segmeanValueCutoff
				}
			}
			if (!arg.tk.legend_mclass.hiddenvalues.has(common.dtsv)) {
				st.sv = {}
			}
			if (!arg.tk.legend_mclass.hiddenvalues.has(common.dtfusionrna)) {
				st.fusion = {}
			}
			if (!arg.tk.legend_mclass.hiddenvalues.has(common.dtitd)) {
				st.itd = {}
			}

			const plot = {
				renderplot: 1, // instruct the plot to be rendered, no wait
				samplerule: {
					full: {},
					set: st
				}
			}

			/*
		samplegroup.attributes[] can be more than 1
		but samplerule.full only works for 1
		*/
			const attr = arg.samplegroup.attributes[arg.samplegroup.attributes.length - 1]
			plot.samplerule.full = {
				byattr: 1,
				key: attr.k,
				value: attr.kvalue
			}

			const pane = client.newpane({ x: 100, y: 100 })
			pane.header.text('Survival plot')

			import('./mds.survivalplot').then(_ => {
				_.init(
					{
						genome: arg.block.genome,
						mds: arg.tk.mds,
						plotlist: [plot]
					},
					pane.body,
					arg.block.debugmode
				)
			})
		})
}

function may_createbutton_assayAvailability(tk, block, holder, samplegroup) {
	if (!tk.mds || !tk.mds.assayAvailability) return

	holder
		.append('div')
		.text('Assay summary')
		.attr('class', 'sja_menuoption')
		.on('click', async () => {
			tk.tip2.clear()
			const wait = tk.tip2.d.append('div').style('margin', '10px').text('Loading...')
			const par = {
				genome: block.genome.name,
				dslabel: tk.mds.label,
				querykey: tk.querykey,
				assaymap: 1
			}
			if (samplegroup.attributes) {
				// hardcoded to use the last item, to be replaced by termdb
				const k = samplegroup.attributes[samplegroup.attributes.length - 1]
				par.key = k.k
				par.value = k.kvalue
			}
			const data = await client.dofetch('mdssvcnv', par)
			if (data.error) {
				wait.text('Error: ' + data.error)
				return
			}
			wait.remove()
			initui_partition({
				data,
				par,
				div: tk.tip2.d.append('div').style('margin', '10px'),
				boxtip: tk.tktip,
				headlabel: samplegroup.name
			})
			tk.tip2.d
				.append('div')
				.style('font-size', '.7em')
				.style('margin', '10px')
				.text('Drag and move a sequencing type label up/down to change order.')
			if (samplegroup.attributes) {
				// quick fix to show full labels
				const d = tk.tip2.d.append('div').style('margin', '20px 10px 10px 10px').style('opacity', 0.7)
				for (const a of samplegroup.attributes) {
					d.append('div').text(a.kvalue + (a.fullvalue ? ': ' + a.fullvalue : ''))
				}
			}
		})
}

function initui_partition(opts) {
	// quick fix
	// call when menu option is clicked, render map with all assay types, and checkboxes for each

	const plot = {
		headlabel: opts.headlabel,
		par: opts.par,
		rows: [], // for moving rows
		hidetermid: new Set(),
		svg: opts.div.append('svg')
	}

	plot_partition(plot, opts.data)

	// make one checkbox for each term
	const div = opts.div.append('div').append('div').style('display', 'inline')
	for (const term of opts.data.terms) {
		const cell = div
			.append('div')
			.style('display', 'inline-block')
			.style('margin-right', '15px')
			.style('white-space', 'nowrap')
		const label = cell.append('label')
		label
			.append('input')
			.attr('type', 'checkbox')
			.property('checked', true)
			.on('change', async event => {
				if (event.target.checked) {
					plot.hidetermid.delete(term.id)
					if (plot.par.termidorder && !plot.par.termidorder.includes(term.id)) {
						plot.par.termidorder.push(term.id)
					}
				} else {
					plot.hidetermid.add(term.id)
				}
				plot.par.skip_termids = [...plot.hidetermid]
				const data = await client.dofetch('mdssvcnv', plot.par)
				plot_partition(plot, data)
			})
		label.append('span').text(term.name).style('padding-left', '5px')
	}
}

function plot_partition(plot, data) {
	const toppad = 20, // leave enough space for header in graphg
		bottompad = 5,
		hpad = 5,
		rowheight = 25,
		fontsize = 16,
		rowspace = 1,
		labxspace = 10,
		symbolpxwidth = 15

	// clear existing plot
	plot.rows = []
	plot.svg.selectAll('*').remove()

	let maxsymbolcount = 0
	for (const t of data.terms) {
		const b = t.blocks[t.blocks.length - 1]
		maxsymbolcount = Math.max(maxsymbolcount, b.x + b.symbolwidth)
	}
	const termwidth = symbolpxwidth * maxsymbolcount

	const graphg = plot.svg.append('g')

	// header
	graphg
		.append('rect')
		.attr('width', termwidth)
		.attr('height', data.terms.length * (rowheight + rowspace) - rowspace)
		.attr('stroke', '#858585')
		.attr('fill', 'none')
	{
		let headlabw
		const text = graphg
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('font-size', fontsize - 2)
			.attr('y', -5)
			.text((plot.headlabel ? plot.headlabel + ', ' : '') + 'n=' + data.totalsample)
			.each(function () {
				headlabw = this.getBBox().width
			})
		text.attr('x', termwidth / 2 - (headlabw > termwidth ? (headlabw - termwidth) / 2 : 0))
	}

	let maxlabelw = 0
	let y = 0
	for (const term of data.terms) {
		const rowg = graphg.append('g').attr('transform', 'translate(0,' + y + ')')
		// tick
		rowg
			.append('line')
			.attr('stroke', '#858585')
			.attr('x1', -6)
			.attr('y1', rowheight / 2)
			.attr('y2', rowheight / 2)
		const thisrow = {
			id: term.id,
			y,
			rowg
		}
		plot.rows.push(thisrow)
		thisrow.svglabel = rowg
			.append('text')
			.text(term.name + ', n=' + term.samplecount)
			.attr('font-size', fontsize)
			.attr('x', -labxspace)
			.attr('y', rowheight / 2)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'end')
			.each(function () {
				maxlabelw = Math.max(maxlabelw, this.getBBox().width)
			})
			.on('mousedown', event => {
				event.preventDefault()
				thisrow.moving = true
				const b = d3select(document.body)
				let my0 = event.clientY
				let deltay
				let nochange = true
				b.on('mousemove', event => {
					const my = event.clientY
					deltay = my - my0
					const rowidx = plot.rows.findIndex(i => i.id == thisrow.id)
					if (deltay < 0) {
						if (rowidx > 0 && -deltay >= rowheight - 2) {
							plot.rows.splice(rowidx, 1)
							plot.rows.splice(rowidx - 1, 0, thisrow)
							reorderRows()
							deltay = 0
							my0 = my
							nochange = false
						}
					} else {
						if (rowidx < plot.rows.length - 1 && deltay >= rowheight - 2) {
							plot.rows.splice(rowidx, 1)
							plot.rows.splice(rowidx + 1, 0, thisrow)
							reorderRows()
							deltay = 0
							my0 = my
							nochange = false
						}
					}
					rowg.attr('transform', 'translate(0,' + (thisrow.y + deltay) + ')')
				})
				b.on('mouseup', async () => {
					b.on('mousemove', null).on('mouseup', null)
					delete thisrow.moving
					reorderRows()
					if (nochange) return
					thisrow.svglabel.text('Loading...')
					plot.par.termidorder = plot.rows.map(i => i.id)
					plot.par.skip_termids = [...plot.hidetermid]
					const data = await client.dofetch('mdssvcnv', plot.par)
					plot_partition(plot, data)
				})
			})

		let x = 0
		for (const b of term.blocks) {
			if (0) {
				// width to scale
				const w = b.samplecount * sf
				if (b.value) {
					// this block is for samples annotated to this term
					const box = rowg
						.append('rect')
						.attr('fill', b.color)
						.attr('x', x)
						.attr('width', Math.max(1, w))
						.attr('height', rowheight)
					let numwidth
					const text = rowg
						.append('text')
						.text(b.samplecount)
						.attr('font-size', fontsize - 2)
						.each(function () {
							numwidth = this.getBBox().width
						})
					if (numwidth < w) {
						text
							.attr('fill', 'white')
							.attr('x', x + w / 2)
							.attr('y', rowheight / 2)
							.attr('dominant-baseline', 'middle')
							.attr('text-anchor', 'middle')
					} else {
						// not enough width to print width
						text.remove()
						box
							.on('mouseover', event => {
								box.attr('fill', 'black')
								opts.boxtip
									.clear()
									.showunder(event.target)
									.d.append('div')
									.html(b.samplecount + ' <span style="font-size:.7em">' + term.name + '</span>')
							})
							.on('mouseout', () => {
								box.attr('fill', b.color)
								opts.boxtip.hide()
							})
					}
				}
				x += w
			} else {
				// symbolic, print count
				const w = b.symbolwidth * symbolpxwidth
				const x = b.x * symbolpxwidth
				if (!b.isgap) {
					const box = rowg.append('rect').attr('fill', b.color).attr('x', x).attr('width', w).attr('height', rowheight)
					rowg
						.append('text')
						.text(b.samplecount)
						.attr('font-size', fontsize - 2)
						.attr('fill', 'white')
						.attr('x', x + w / 2)
						.attr('y', rowheight / 2)
						.attr('dominant-baseline', 'middle')
						.attr('text-anchor', 'middle')
				}
			}
		}
		y += rowheight + rowspace
	}
	graphg.attr('transform', 'translate(' + (hpad + maxlabelw + labxspace) + ',' + toppad + ')')
	plot.svg
		.attr('width', hpad * 2 + maxlabelw + labxspace + termwidth)
		.attr('height', toppad + (rowheight + rowspace) * data.terms.length + bottompad)

	function reorderRows() {
		let y = 0
		for (const t of plot.rows) {
			if (!t.moving) t.rowg.transition().attr('transform', 'translate(0,' + y + ')')
			t.y = y
			y += rowheight + rowspace
		}
	}
}
