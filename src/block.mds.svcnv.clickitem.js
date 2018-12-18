import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import {
	loadTk,
	focus_singlesample,
	dedup_sv,
	itemname_svfusion,
	multi_sample_addhighlight,
	multi_sample_removehighlight
	} from './block.mds.svcnv'
import { createbutton_addfeature, createnewmatrix_withafeature } from './block.mds.svcnv.samplematrix'
import {getsjcharts}     from './getsjcharts'


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

********************** INTERNAL
printer_snvindel
may_show_matrixbutton
may_createbutton_survival_onemutation
matrix_view()


*/


export function click_samplegroup_showmenu ( samplegroup, tk, block ) {
	/*
	official only, multi-sample
	dense or full
	click sample group label in track display to show menu
	this group must already has been shown
	*/

	if(tk.iscustom) return

	if(!samplegroup.attributes) {
		// no attributes[], maybe unannotated samples, do not show menu for the moment
		return
	}

	const printerror = msg=> client.sayerror( tk.tip2.d, msg )

	if(!tk.sampleAttribute) return printerror('tk.sampleAttribute missing')
	if(!tk.sampleAttribute.attributes) return printerror('tk.sampleAttribute.attributes{} missing')

	tk.tip2.d.append('div')
		.style('margin','4px 10px')
		.style('font-size','.7em')
		.text(samplegroup.name)

	tk.tip2.d.append('div')
		.attr('class','sja_menuoption')
		.text('Hide')
		.on('click',()=>{

			tk.tip2.clear()
			const err = samplegroup_setShowhide( samplegroup, tk, true )
			if(err) {
				//return printerror(err)
			}
			tk.tip2.hide()
			loadTk(tk, block)
		})

	tk.tip2.d.append('div')
		.attr('class','sja_menuoption')
		.text('Show only')
		.on('click',()=>{
			tk.tip2.clear()
			for(const g of tk._data) {
				const err = samplegroup_setShowhide( g, tk, true)
				if(err) {
					//return printerror(err)
				}
			}
			samplegroup_setShowhide( samplegroup, tk, false)
			tk.tip2.hide()
			loadTk(tk, block)
		})

	{
		/*
		under the same driver attribute, any other groups are hidden?
		if so, allow to show all
		*/
		const [err, attr, attrR] = samplegroup_getdriverattribute( samplegroup, tk )
		if(err) {
			// do not abort -- unannotated group of sample won't have .attributes[]
			// return printerror(err)
		} else if(attrR.hiddenvalues.size>0) {
			// has other hidden groups
			tk.tip2.d.append('div')
				.attr('class','sja_menuoption')
				.text('Show all')
				.on('click',()=>{
					tk.tip2.hide()
					attrR.hiddenvalues.clear()
					loadTk(tk, block)
				})
		}
	}

	tk.tip2.d.append('div')
		.attr('class','sja_menuoption')
		.text('Table view')
		.on('click',()=>{
			tk.tip2.hide()
			click_samplegroup_showtable( samplegroup, tk, block )
		})


	tk.tip2.d.append('div')
		.attr('class','sja_menuoption')
		.text('Matrix view')
		.on('click',()=>{
			tk.tip2.hide()
			matrix_view(tk, block, samplegroup)
		})


	may_show_matrixbutton(samplegroup, tk, block)

	may_createbutton_survival_grouplab({
		tk: tk,
		block: block,
		holder: tk.tip2.d,
		samplegroup: samplegroup
	})
}





function matrix_view(tk, block, samplegroup) {
	/*
	in group-less track (custom or official lacking config)
	samplegroup will not be given, use all samples
	*/

	const r = block.rglst[ block.startidx ]
	const feature = {
		ismutation:1,
		width:60,
		chr: r.chr,
		start: r.start,
		stop: r.stop,
		cnv: {
			valuecutoff: tk.valueCutoff,
			focalsizelimit: tk.bplengthUpperLimit,
		},
		loh: {
			valuecutoff: tk.segmeanValueCutoff,
			focalsizelimit: tk.lohLengthUpperLimit
		},
		itd:{},
		sv:{},
		fusion:{},
		snvindel:{
			excludeclasses:{}
		}
	}

	if(tk.legend_mclass && tk.legend_mclass.hiddenvalues) {
		// hidden class and dt
		for(const v of tk.legend_mclass.hiddenvalues) {
			if(typeof v=='string') {
				feature.snvindel.excludeclasses[v]=1
			} else {
				if(v==common.dtcnv) {
					feature.cnv.hidden=1
				} else if(v==common.dtloh) {
					feature.loh.hidden=1
				} else if(v==common.dtitd) {
					feature.itd.hidden=1
				} else if(v==common.dtsv) {
					feature.sv.hidden=1
				} else if(v==common.dtfusionrna) {
					feature.fusion.hidden=1
				} else {
					console.error('unknown hidden dt?? '+v)
				}
			}
		}
	}

	// label, try to use expression gene name
	if(tk.showinggene) {
		feature.label = tk.showinggene
	} else {
		feature.label = r.chr+':'+r.start+'-'+r.stop
	}

	if(tk.iscustom) {
		console.error('solve it here')
	} else {
		feature.querykeylst=[
			tk.querykey
		]
		if(tk.checkvcf) {
			feature.querykeylst.push( tk.checkvcf.querykey )
		}
	}

	// attribute that defines this group of samples
	const attr = samplegroup.attributes[ samplegroup.attributes.length-1 ]

	for(const m of tk.samplematrices) {
		if(m.limitsamplebyeitherannotation) {
			// hardcoded to use first attr
			const a = m.limitsamplebyeitherannotation[0]
			if(a && a.key==attr.k && a.value==attr.kvalue) {
				// found the smat of this sample group
				client.appear(m._pane.pane)
				m.addnewfeature_update( feature )
				return
			}
		}
	}

	// create new smat
	createnewmatrix_withafeature({
		tk:tk,
		block: block,
		feature: feature,
		limitsamplebyeitherannotation:[{
			key: attr.k,
			value: attr.kvalue
		}]
	})
}





function samplegroup_getdriverattribute( g, tk ) {
	if(!g.attributes) return ['.attributes[] missing for group '+g.name]
	if(g.attributes.length==0) return ['.attributes[] zero length for group '+g.name]
	const attribute = g.attributes[ g.attributes.length-1 ]
	/*
	.k
	.kvalue
	.full
	.fullvalue

	use this attribute to set this group to hidden in tk.sampleAttribute 
	*/
	const attrRegister = tk.sampleAttribute.attributes[ attribute.k ]
	if(!attrRegister) return ['"'+attribute.k+'" not registered in sampleAttribute for group '+g.name]
	return [null, attribute, attrRegister]
}

function samplegroup_setShowhide( g, tk, tohide ) {
	const [err, attr, attrR] = samplegroup_getdriverattribute( g, tk )
	if(err) return err
	if(tohide) {
		attrR.hiddenvalues.add( attr.kvalue )
	} else {
		attrR.hiddenvalues.delete( attr.kvalue )
	}
	return null
}






export function tooltip_samplegroup( g, tk ) {
	tk.tktip.clear()
		.show( d3event.clientX, d3event.clientY )

	const d = tk.tktip.d.append('div')
	
	if(g.attributes) {
		// official only
		for(const a of g.attributes) {
			d.append('div')
				.html( a.kvalue + (a.fullvalue ? ' <span style="opacity:.5;font-size:.8em;">'+a.fullvalue+'</span>' : '') )
		}
	} else if(g.name) {
		d.append('div').text(g.name)
	}

	const p= tk.tktip.d.append('div').style('margin-top','10px').style('color','#858585')
	p.html( g.samples.length+' sample'+(g.samples.length>1?'s':'')
		+ (g.sampletotalnum ?  '<br>'+g.sampletotalnum+' samples total, '+Math.ceil(100*g.samples.length/g.sampletotalnum)+'%' : ''))
}








export function click_samplegroup_showtable( samplegroup, tk, block ) {
	/*
	show a table
	multi-sample
	only for native track: no group for custom track for lack of annotation
	*/
	const pane = client.newpane({x:d3event.clientX+100, y:Math.max(100,d3event.clientY-100)})
	pane.header.html(samplegroup.name+' <span style="font-size:.7em">'+tk.name+'</span>')

	if(samplegroup.samples.length==1) {

		// one sample

		const sample=samplegroup.samples[0]

		const table = pane.body.append('table')
			.style('margin','10px')
			.style('border-spacing','4px')

		{
			const tr = table.append('tr')
			tr.append('td')
				.text('Sample')
				.style('opacity',.5)
			tr.append('td').text(sample.samplename)
		}
		if(sample.sampletype) {
			const tr = table.append('tr')
			tr.append('td')
				.text('Sample type')
				.style('opacity',.5)
			tr.append('td').text(sample.sampletype)
		}


		const [ cnvlst, svlst, lohlst, itdlst, vcflst, cnvlst0, svlst0, lohlst0, itdlst0, vcflst0 ] = sortitemsbytype_onesample( sample.samplename, sample.items, tk )

		if(cnvlst.length) {
			const tr=table.append('tr')
			tr.append('td')
				.text('CNV')
				.style('opacity',.5)
			const td = tr.append('td')
			for(let i=0; i<cnvlst.length; i++) {
				td.append('div')
					.html(cnvlst[i])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item:cnvlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk
						})
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:cnvlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}
		if(svlst.length) {
			const tr=table.append('tr')
			tr.append('td')
				.text('SV')
				.style('opacity',.5)
			const td = tr.append('td')
			for(let i=0; i<svlst.length; i++) {
				td.append('div')
					.html(svlst[i])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item:svlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk
						})
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:svlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}
		if(lohlst.length) {
			const tr=table.append('tr')
			tr.append('td')
				.text('LOH')
				.style('opacity',.5)
			const td = tr.append('td')
			for(let i=0; i<lohlst.length; i++) {
				td.append('div')
					.html(lohlst[i])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item:lohlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk
						})
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:lohlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}
		if(itdlst.length) {
			const tr=table.append('tr')
			tr.append('td')
				.text('ITD')
				.style('opacity',.5)
			const td = tr.append('td')
			for(let i=0; i<itdlst.length; i++) {
				td.append('div')
					.html(itdlst[i])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item:itdlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk
						})
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:itdlst0[i],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}
		if(vcflst.length) {
			const tr=table.append('tr')
			tr.append('td')
				.text('SNV/indel')
				.style('opacity',.5)
			const td = tr.append('td')

			for(let i=0; i<vcflst.length; i++) {

				const ms = vcflst0[i].sampledata.find(j=>j.sampleobj.name==sample.samplename)

				td.append('div')
					.html(vcflst[i])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item:vcflst0[i],
							m_sample: ms,
							sample:sample,
							samplegroup:samplegroup,
							tk:tk
						})
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:vcflst0[i],
							sample:sample,
							m_sample:ms,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}
		return
	}

	// multiple samples
	const table=pane.body.append('table')
		.style('border-spacing','2px')
		.style('margin','20px')

	const hassampletype = samplegroup.samples.find(i=>i.sampletype)

	// header
	const tr=table.append('tr')
	tr.append('td')
		.text('Sample')
		.style('opacity',.5)
	if(hassampletype) {
		tr.append('td')
			.text('Sample type')
			.style('opacity',.5)
	}
	tr.append('td')
		.text('CNV')
		.style('opacity',.5)
	tr.append('td')
		.text('SV')
		.style('opacity',.5)
	tr.append('td')
		.text('LOH')
		.style('opacity',.5)
	tr.append('td')
		.text('ITD')
		.style('opacity',.5)
	
	if(tk.data_vcf) {
		tr.append('td')
			.text('SNV/indel')
			.style('opacity',.5)
	}


	for(const [i,sample] of samplegroup.samples.entries()) {

		const tr=table.append('tr')

		if(!(i%2)) {
			tr.style('background','#f1f1f1')
		}

		tr.append('td').text(sample.samplename)

		if(hassampletype) {
			tr.append('td').text( sample.sampletype || '' )
		}

		const [ cnvlst, svlst, lohlst, itdlst, vcflst, cnvlst0, svlst0, lohlst0, itdlst0, vcflst0 ] = sortitemsbytype_onesample(sample.samplename, sample.items, tk)

		{
			const td=tr.append('td')
			for(let j=0; j<cnvlst.length; j++) {
				td.append('div')
					.html(cnvlst[j])
					.attr('class', 'sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item: cnvlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk:tk,
						})
					})
					.on('mouseout',()=> {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item: cnvlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}
		{
			const td= tr.append('td')
			for(let j=0; j<svlst.length; j++) {
				td.append('div')
					.html(svlst[j])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item: svlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk:tk,
						})
					})
					.on('mouseout',()=> {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:svlst0[j],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}
		{
			const td=tr.append('td')
			for(let j=0; j<lohlst.length; j++) {
				td.append('div')
					.html(lohlst[j])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item: lohlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk:tk,
						})
					})
					.on('mouseout',()=> {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:lohlst0[j],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}

		{
			const td=tr.append('td')
			for(let j=0; j<itdlst.length; j++) {
				td.append('div')
					.html(itdlst[j])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item: itdlst0[j],
							sample: sample,
							samplegroup: samplegroup,
							tk:tk,
						})
					})
					.on('mouseout',()=> {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item:itdlst0[j],
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
						})
					})
			}
		}

		if(tk.data_vcf) {
			const td=tr.append('td')
			for(let j=0; j<vcflst.length; j++) {

				const ms = vcflst0[j].sampledata.find( k=> k.sampleobj.name == sample.samplename )

				td.append('div')
					.html(vcflst[j])
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item: vcflst0[j],
							m_sample: ms,
							sample: sample,
							samplegroup: samplegroup,
							tk:tk,
						})
					})
					.on('mouseout',()=> {
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
						click_multi_singleitem({
							item: vcflst0[j],
							m_sample: ms,
							sample:sample,
							samplegroup:samplegroup,
							tk:tk,
							block:block
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

	if(g.items.length==1) {
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
		.show(d3event.clientX,d3event.clientY)

	let grouplabel = 'Group'
	if(tk.groupsamplebyattr && tk.groupsamplebyattr.attrlst) {
		// passed from mds.query
		grouplabel = tk.groupsamplebyattr.attrlst[ tk.groupsamplebyattr.attrlst.length-1 ].label
	}
		
	const lst = [{
		k: grouplabel,
		v: g.name
	}]

	let svnum=0,
		fusionnum=0
	for(const i of g.items) {
		if(i.dt==common.dtsv) svnum++
		else if(i.dt==common.dtfusionrna) fusionnum++
	}

	if(svnum) lst.push({k:'# of SV', v:svnum})
	if(fusionnum) lst.push({k:'# of fusion', v:fusionnum})

	client.make_table_2col( tk.tktip.d, lst )
}





export function click_multi_svdense(g, tk, block) {
	/*
	multi-sample
	native/custom
	dense
	clicking on a ball representing density of sv breakend
	*/
	if(g.items.length==1) {
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

	const pane = client.newpane({x:d3event.clientX,y:d3event.clientY})
	pane.header.html(g.name+' <span style="font-size:.8em">'+tk.name+'</span>')

	const sample2lst=new Map()
	for(const i of g.items) {
		if(!sample2lst.has(i.sample)) {
			sample2lst.set(i.sample, {
				sv:[],
				fusion:[]
			})
		}
		if(i.dt==common.dtsv) {
			sample2lst.get(i.sample).sv.push(i)
		} else if(i.dt==common.dtfusionrna) {
			sample2lst.get(i.sample).fusion.push(i)
		}
	}

	const table=pane.body.append('table')
		.style('border-spacing','2px')
		.style('margin','10px')

	const tr=table.append('tr')
	tr.append('td')
		.text('Sample')
		.style('font-size','.8em')
		.style('opacity',.5)
	tr.append('td')
		.text('SV')
		.style('font-size','.8em')
		.style('opacity',.5)
	tr.append('td')
		.text('RNA fusion')
		.style('font-size','.8em')
		.style('opacity',.5)
	
	let j=0
	for(const [ sample, so] of sample2lst) {
		const tr=table.append('tr')
		if(!(j++%2)) {
			tr.style('background','#f1f1f1')
		}

		tr.append('td').text(sample)

		const td1=tr.append('td')
		for(const i of so.sv) {

			const breakpoint = svcoord2html(i,tk)

			td1.append('div')
				.attr('class','sja_clbtext')
				.html( i.cytogeneticname ? i.cytogeneticname+' <span style="font-size:.7em">'+breakpoint+'</span>' : breakpoint )
				.on('mouseover',()=>{
					tooltip_singleitem({
						item:i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk:tk,
					})
				})
				.on('mouseout', ()=>{
					tk.tktip.hide()
					multi_sample_removehighlight(i._sample)
				})
				.on('click',()=>{
					click_multi_singleitem({
						item:i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk:tk,
						block:block
					})
				})
		}

		const td2=tr.append('td')
		for(const i of so.fusion) {

			td2.append('div')
				.attr('class','sja_clbtext')
				.html( itemname_svfusion(i) + ' <span style="font-size:.7em">'+ svcoord2html(i,tk) +'</span>' )
				.on('mouseover',()=>{
					tooltip_singleitem({
						item:i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk:tk,
					})
				})
				.on('mouseout', ()=>{
					tk.tktip.hide()
					multi_sample_removehighlight(i._sample)
				})
				.on('click',()=>{
					click_multi_singleitem({
						item:i,
						sample: i._sample,
						samplegroup: i._samplegroup,
						tk:tk,
						block:block
					})
				})
		}
	}
}




export function click_multi_vcfdense( g, tk, block ) {
	/*
	multi-sample
	native/custom
	dense
	click on a dot representing some snvindel or itd, of same type
	g is a list of variants of the same class, shown as a dot
	*/

	const pane = client.newpane({ x:d3event.clientX, y:d3event.clientY })
	pane.header.text(tk.name)

	if(g.items.length==1) {
		// only one variant
		const m = g.items[0]

		const butrow = pane.body.append('div').style('margin','10px')

		if(m.dt==common.dtsnvindel) {

			if(m.sampledata.length==1) {

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

			const lst = printer_snvindel( m, tk )
			const table = client.make_table_2col( pane.body, lst)
			const tr = table.append('tr')
			tr.append('td')
				.text('Samples')
				.style('opacity',.5)
				.attr('colspan',2)

			const td = tr.append('td')
			for(const sm of m.sampledata) {

				const [ sample, samplegroup ] = findsamplegroup_byvcf({
					m: m,
					m_sample: sm,
					tk: tk
				})

				td.append('div')
					.text(sm.sampleobj.name)
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						tooltip_singleitem({
							item: m,
							m_sample: sm,
							sample: sample,
							samplegroup: samplegroup,
							tk: tk,
							block: block
						})
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
						multi_sample_removehighlight(sample)
					})
					.on('click',()=>{
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
			may_findmatchingsnp_printintable( m, block, table)
			may_findmatchingclinvar_printintable( m, block, table )
		} else {
			throw('Unknown dt: '+m.dt)
		}
		return
	}

	/* multiple variants
	list samples for each variant
	*/

	const table = pane.body.append('table')
		.style('margin-top','10px')
		.style('border-spacing','4px')

	for(const m of g.items) {
		const tr = table.append('tr')

		// col 1: mutation name
		tr.append('td')
			.text(m.mname)
			.style('color', common.mclass[m.class].color)
			.style('font-weight','bold')
			.style('vertical-align','top')
			// createbutton_addfeature

		// col 2
		{
			const td = tr.append('td')
			if(m.dt==common.dtsnvindel) {
				td.style('opacity','.5')
					.text(m.ref+' > '+m.alt)
					.style('vertical-align','top')
			}
		}

		// col 3
		{
			const td = tr.append('td')
			if(m.dt==common.dtsnvindel) {

				// show each sample

				for(const m_sample of m.sampledata) {

					const [s, sg] = findsamplegroup_byvcf({
						m: m,
						m_sample:m_sample,
						tk: tk
					})
					td.append('div')
						.text(m_sample.sampleobj.name)
						.attr('class','sja_clbtext')
						.on('mouseover',()=>{
							tooltip_singleitem({
								item: m,
								m_sample: m_sample,
								sample: s,
								samplegroup: sg,
								tk: tk,
								block: block
							})
						})
						.on('mouseout',()=>{
							tk.tktip.hide()
							multi_sample_removehighlight(s)
						})
						.on('click',()=>{
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
				console.error('unknown dt: '+m.dt)
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
		.show(d3event.clientX,d3event.clientY)

	if(g.items.length == 1) {

		// single variant
		const m = g.items[0]

		if(m.dt==common.dtsnvindel) {

			if(m.sampledata.length == 1) {
				// in just one sample
				const [sample, samplegroup] = findsamplegroup_byvcf({
					m: m,
					m_sample: m.sampledata[0],
					tk: tk
				})
				tooltip_singleitem( {
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
			const lst = printer_snvindel( m, tk )
			lst.push({
				k:'Samples',
				v: (m.sampledata.length>10 ?
					m.sampledata.slice(0,6).map(i=>i.sampleobj.name).join('<br>')+'<br><i>... and '+(m.sampledata.length-6)+' more samples</i>'
					: m.sampledata.map(i=>i.sampleobj.name).join('<br>')
				)
			})

			const table = client.make_table_2col( tk.tktip.d, lst)

			// mds may indicate whether to perform snp/clinvar checking 
			may_findmatchingsnp_printintable( m, block, table )
			may_findmatchingclinvar_printintable( m, block, table )


		} else {

			throw('unknown dt: '+m.dt)
		}
		return
	}

	// multiple variants, of same class
	tk.tktip.d.append('div')
		.style('font-size','.7em')
		.style('margin-bottom','5px')
		.text(
			g.items.length+' '+common.mclass[g.items[0].class].label+' mutations, '
			+g.samplecount+' samples'
		)
	const table=tk.tktip.d.append('table')
		.style('border-spacing','3px')
	for(const m of g.items) {
		const tr=table.append('tr')
		tr.append('td')
			.style('color',common.mclass[m.class].color)
			.style('font-weight','bold')
			.text(m.mname)

		tr.append('td')
			.style('font-size','.7em')
			.style('opacity','.5')
			.text(m.ref+' > '+m.alt)

		const td=tr.append('td')
			.style('font-size','.7em')

		if(m.dt==common.dtsnvindel) {
			td.text( m.sampledata.length==1 ? m.sampledata[0].sampleobj.name : '('+m.sampledata.length+' samples)')
		} else {
			td.text('unknown dt: '+m.dt)
		}
	}
}



export async function click_multi_singleitem( p ) {
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

	const pane = client.newpane({x:d3event.clientX, y:d3event.clientY})
	pane.header.text(p.tk.name)

	const buttonrow = pane.body.append('div')
		.style('margin','10px')


	may_show_svgraph( p, buttonrow, pane.body )


	// click focus button to show block in holder
	{
		let blocknotshown = true
		const holder = pane.body.append('div')
			.style('margin','10px')
			.style('display','none')

		// focus button
		buttonrow.append('div')
			.style('display','inline-block')
			.attr('class', 'sja_menuoption')
			.text('Focus')
			.on('click',()=>{

				if(holder.style('display')=='none') {
					client.appear(holder)
				} else {
					client.disappear(holder)
				}

				if(blocknotshown) {
					blocknotshown=false
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
	}


	if(!p.tk.iscustom && p.tk.singlesampledirectory) {
		/*
		is official dataset, and equipped with single-sample files
		click button to retrieve all mutations and show in disco plot
		*/
		let plotnotshown = true
		const holder = pane.body.append('div')
			.style('margin','10px')
			.style('display','none')
		const sjcharts = await getsjcharts()
		const discoPromise = sjcharts.dtDisco({
			holderSelector: holder,
			settings: {
				showControls: false,
				selectedSamples: []
			}
		})

		buttonrow.append('div')
			.style('display','inline-block')
			.attr('class', 'sja_menuoption')
			.text('Genome view')
			.on('click',()=>{

				if(holder.style('display')=='none') {
					client.appear(holder)
				} else {
					client.disappear(holder)
				}

				if(plotnotshown) {
					plotnotshown=false

					const arg = {
						genome: p.block.genome.name,
						dslabel: p.tk.mds.label,
						querykey: p.tk.querykey,
						getsample4disco: p.sample.samplename
					}
					client.dofetch('/mdssvcnv', arg)
					.then(data=>{
						if(data.error) throw(data.error)
						if(!data.text) throw('.text missing')

						let json
						try{
							json = JSON.parse(data.text)
						} catch(e){
							throw(e.message)
						}

						const disco_arg = {
							sampleName: p.sample.samplename,
							data: json
						}

						if(p.tk.mds.mutation_signature) {
							let hassig=false
							for(const k in p.tk.mds.mutation_signature.sets) {
								for(const m of json) {
									if(m[k]) {
										hassig = k
										break
									}
								}
								if(hassig) break
							}
							if(hassig) {
								const o = p.tk.mds.mutation_signature.sets[hassig]
								disco_arg.mutation_signature = {
									key: hassig,
									name: o.name,
									signatures: o.signatures
								}
							}
						}

						discoPromise.then(renderer=> renderer.main( disco_arg ) )
					})
					.catch(err=>{
						client.sayerror(holder, typeof(err)=='string'?err:err.message)
						if(err.stack) console.log(err.stack)
					})
				}
			})
	}


	createbutton_addfeature( {
		m: p.item,
		holder:buttonrow,
		tk: p.tk,
		block: p.block,
		pane: pane
	})

	may_createbutton_survival_onemutation({
		holder: buttonrow,
		tk: p.tk,
		block: p.block,
		m: p.item,
		sample: p.sample,
	})


	p.holder = pane.body
	detailtable_singlesample( p )
}






export function tooltip_singleitem( p ) {
	/*
	multi-sample
	mouse over an item
	*/

	multi_sample_addhighlight(p.sample)

	p.tk.tktip.clear()
		.show(d3event.clientX, d3event.clientY)

	p.holder = p.tk.tktip.d

	detailtable_singlesample( p )
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

	if(p.sample) {
		lst.push({
			k:'Sample',
			v: p.sample.samplename
		})

		may_add_sampleannotation( p.sample.samplename, p.tk, lst )

	} else {
		// if in single-sample mode, won't have p.sample
	}

	const m = p.item

	// mutation-level attributes
	let mattr

	if( m.dt == common.dtitd) {

		lst.push( {
			k:'ITD',
			v:m.chr+':'+(m.start+1)+'-'+(m.stop+1)
		})

		if(m.gene || m.isoform) {
			const t = []
			if(m.gene) t.push(m.gene)
			if(m.isoform) t.push(m.isoform)
			lst.push({k:'Gene', v: t.join(', ')})
		}

		if(m.rnaduplength) {
			lst.push({k: 'RNA duplicated', v: m.rnaduplength+' bp'})
		}
		if(m.aaduplength) {
			lst.push({k:'AA duplicated', v: m.aaduplength+' aa'})
		}

		mattr = m.mattr

	} else if( m.dt == common.dtcnv  || m.dt == common.dtloh ) {

		if(m.dt==common.dtloh) {
			lst.push({
				k:'LOH seg.mean',
				v: m.segmean.toFixed(2)
			})
		} else {
			lst.push({
				k:'CNV log2(ratio)',
				v: '<span style="padding:0px 4px;background:'
					+(m.value>0? p.tk.cnvcolor.gain.str : p.tk.cnvcolor.loss.str)+';color:white;">'
					+m.value.toFixed(2)
					+'</span>'
			})
			lst.push({
				k:'Copy number',
				v: (2*Math.pow(2, m.value)).toFixed(2)
			})
		}
	
		lst.push( {
			k:'Position',
			v: m.chr+':'+(m.start+1)+'-'+(m.stop+1)
				+' <span style="font-size:.7em">'+common.bplen(m.stop-m.start)+'</span>'
		})

		mattr = m.mattr

	} else if( m.dt == common.dtsv || m.dt==common.dtfusionrna ) {

		{
			lst.push({
				k: (m.dt==common.dtsv ? 'SV' : 'RNA fusion'),
				v: itemname_svfusion(m)+' <span style="font-size:.7em">'+svcoord2html(m,p.tk)+'</span>'
			})
		}

		if(m.clipreadA || m.clipreadB) {
			lst.push({
				k:'# clip reads',
				v:'<span style="font-size:.7em;opacity:.7">A CLIP / TOTAL</span> '
					+( Number.isInteger(m.clipreadA) ? m.clipreadA : '?' )
					+' / '
					+( Number.isInteger(m.totalreadA) ? m.totalreadA : '?')
					+'<br>'
					+'<span style="font-size:.7em;opacity:.7">B CLIP / TOTAL</span> '
					+( Number.isInteger(m.clipreadB) ? m.clipreadB : '?' )
					+' / '
					+( Number.isInteger(m.totalreadB) ? m.totalreadB : '?' )
			})
		}

		mattr = m.mattr

	} else if( m.dt == common.dtsnvindel ) {

		const tmp = printer_snvindel( m, p.tk )
		for(const l of tmp) lst.push(l)

		if(p.m_sample) {

			/*
			m_sample as from m.sampledata[]

			in vcf item, mutation-level attributes are in Formats
			collect them for showing later
			*/
			mattr = {}

			const formats = p.tk.checkvcf ? p.tk.checkvcf.format : null // format registry

			for(const formatfield in p.m_sample) {

				if(formatfield=='sampleobj') {
					// skip hardcoded attribute
					continue
				}

				/*
				if this format field could be mutation signature
				*/
				if(p.tk.mds && p.tk.mds.mutation_signature ) {
					const sigset = p.tk.mds.mutation_signature.sets[ formatfield ]
					if(sigset) {
						// this format field is a signature
						const key = p.m_sample[ formatfield ]
						const v = sigset.signatures[ key ]
						// quick fix that there may be "nodata" as the decoy for indel
						if(!v.nodata) {
							const label = v ? v.name : 'Unknown ('+key+')'
							const color = v ? v.color : 'black'
							lst.push({
								k: sigset.name,
								v: '<span style="background:'+color+'">&nbsp;&nbsp;&nbsp;</span> '+label
							})
						}
						continue
					}
				}

				if(p.tk.mutationAttribute && p.tk.mutationAttribute.attributes) {
					// has it; test whether this format is actually attribute
					if(p.tk.mutationAttribute.attributes[ formatfield ]) {
						mattr[ formatfield ] = p.m_sample[ formatfield ]
						continue
					}
				}

				/*
				this format field is not declared in mds.mutationAttribute
				confusing here
				e.g. allele count
				*/


				const formatdesc = formats ? formats[ formatfield ] : null

				if(formatdesc) {

					// if the FORMAT has per-allele value, like AD in vcf 4.2+
					let isperallelevalue = formatdesc.Number=='R' || formatdesc.Number=='A'
					if(!isperallelevalue) {
						if(formatfield=='AD') {
							// vcf 4.1 has AD as '.'
							isperallelevalue=true
						}
					}

					if(isperallelevalue) {
						// per allele value

						const alleles= []
						const values = []
						let altvalue

						// add alt first
						for(const ale in p.m_sample[ formatfield ]) {
							if(ale == m.ref) continue
							alleles.push(ale)
							altvalue = p.m_sample[ formatfield ][ ale ]
							values.push( altvalue )
						}

						// add ref after alt
						const refvalue = p.m_sample[ formatfield ][ m.ref ]
						if(refvalue!=undefined) {
							alleles.push( m.ref )
							values.push( refvalue )
						}

						let barsvg
						if(refvalue+altvalue>0) {
							barsvg = client.fillbar(null, {f:(altvalue/(altvalue+refvalue))})
						}

						lst.push({
							k: formatfield,
							v: (barsvg ? barsvg+' ' : '' ) + '<span style="font-size:.8em;opacity:.5">'+alleles.join(' / ')+'</span> '+values.join(' / ')
								+(formatdesc.Description ? ' <span style="font-size:.7em;opacity:.5">'+formatdesc.Description+'</span>' : '')
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

			mayaddRnabamstatusForsnp( p.tk, m, p.m_sample.sampleobj.name, lst )
		}


	} else {
		lst.push({k:'Unknown dt!!', v: m.dt })
	}

	if(mattr) {
		// show mutation-level attributes, won't do here for vcf stuff
		for(const key in mattr) {
			const attr = p.tk.mutationAttribute ? p.tk.mutationAttribute.attributes[ key ] : null
			const vstr = mattr[ key ]

			if(attr) {
				if(attr.appendto_link) {
					// quick fix for pmid

					if(!vstr) {
						// no value
						continue
					}

					lst.push({
						k: attr.label,
						v: vstr.split(',').map(id=> '<a target=_blank href='+attr.appendto_link + id+'>'+id+'</a>').join(' ')
					})
					continue
				}

				if(attr.values) {
					// values is optional
					const vv = attr.values[vstr]
					if(vv) {
						lst.push({
							k: attr.label,
							v: vv.name + (vv.label ? ' <span style="font-size:.7em;opacity:.5">'+vv.label+'</span>' : '')
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

	mayaddexpressionrank( p, lst )

	mayAddRnabamGenease( p, lst )

	const table = client.make_table_2col( p.holder, lst )

	if( m.dt == common.dtsnvindel ) {
		may_findmatchingsnp_printintable( m, p.block, table )
		may_findmatchingclinvar_printintable( m, p.block, table )
	}
}




function mayaddRnabamstatusForsnp ( tk, m, samplename, lst ) {
	if(!tk.checkrnabam) return
	const sbam = tk.checkrnabam.samples[ samplename ]
	if(!sbam) return // no rna bam for this sample

	if(!common.basecolor[m.ref] || !common.basecolor[m.alt]) {
		// not snp
		lst.push({
			k:'RNA-seq',
			v:'RNA-seq coverage not assessed, not SNV'
		})
		return
	}

	if(!sbam.genes) return

	// this snp could be included multiple times in overlapping genes
	let rnasnp

	for(const g of sbam.genes) {
		if(g.snps) {
			const s = g.snps.find( i=> i.pos==m.pos && i.ref==m.ref && i.alt==m.alt )
			if(s) {
				rnasnp = s
				break
			}
		}
	}

	if(!rnasnp) {
		lst.push({
			k:'RNA-seq',
			v: 'RNA-seq coverage not assessed, not heterozygous in DNA'
		})
		return
	}

	if( rnasnp.rnacount.nocoverage ) {
		lst.push({
			k: 'RNA-seq',
			v: 'Not covered in RNA-seq'
		})
		return
	}

	lst.push({
		k: 'RNA-seq read count',
		v: client.fillbar(null,{f:rnasnp.rnacount.f})+' '
			+'<span style="font-size:.8em;opacity:.5">'+m.alt+' / '+m.ref+'</span> '+rnasnp.rnacount.alt+' / '+rnasnp.rnacount.ref
			+(rnasnp.rnacount.pvalue ? ' <span style="font-size:.8em;opacity:.5">Binomial p</span> '+rnasnp.rnacount.pvalue : '')
	})
}



function mayAddRnabamGenease ( p, lst ) {
	// may add ase status from rna bam
	const tk = p.tk
	if(!tk) return
	if(!tk.checkrnabam) return
	if(!p.sample) return
	const sbam = tk.checkrnabam.samples[ p.sample.samplename ]
	if( !sbam ) return
	if(!sbam.genes) return
	const rows = []

	for(const g of sbam.genes) {
		const lst = [
			'<td><b>'+g.gene+'</b></td>'
			+'<td><span style="font-size:.8em;opacity:.5">'+tk.gecfg.datatype+'</span> '+g.fpkm+'</td>'
			+'<td>'
		]
		if(g.estat) {
			if(g.estat.ase_uncertain) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_uncertain+';color:white">ASE uncertain</span>')
			} else if(g.estat.ase_biallelic) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_biallelic+';color:white">Bi-allelic</span>')
			} else if(g.estat.ase_monoallelic) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_monoallelic+';color:white">Mono-allelic</span>')
			}
		}
		lst.push('</td>')

		rows.push( '<tr>'+lst.join('')+'</tr>' )
	}
	
	if( tk.gecfg.fixed ) {
		for(const gene of tk.gecfg.fixed ) {
			if( gene.sample2rnabam ) {
				const g4s = gene.sample2rnabam[ p.sample.samplename ]
				if( g4s ) {
					const lst = [
						'<td><b>'+gene.gene+'</b></td>'
						+'<td><span style="font-size:.8em;opacity:.5">'+tk.gecfg.datatype+'</span> '+g4s.fpkm+'</td>'
						+'<td>'
					]
					if(g4s.estat) {
						if(g4s.estat.ase_uncertain) {
							lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_uncertain+';color:white">ASE uncertain</span>')
						} else if(g4s.estat.ase_biallelic) {
							lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_biallelic+';color:white">Bi-allelic</span>')
						} else if(g4s.estat.ase_monoallelic) {
							lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_monoallelic+';color:white">Mono-allelic</span>')
						}
					}
					lst.push('</td>')

					rows.push( '<tr>'+lst.join('')+'</tr>' )
				}
			}
		}
	}

	if(rows.length) {
		lst.push({
			k:'Gene expression',
			v:'<table>'+rows.join('')+'</table>'
		})
	}
}



function mayaddexpressionrank( p, lines ) {
	const tk = p.tk
	if(!tk) return
	const sample = p.sample
	if(!sample) return
	if(!sample.expressionrank) return

	// one gene per row
	const rows = []

	for(const genename in sample.expressionrank) {
		const v = sample.expressionrank[genename]
		const lst=[
			'<tr>'
			+'<td><b>'+genename+'</b></td>'
			+'<td>&nbsp;<span style="font-size:.7em">RANK</span> '+client.ranksays(v.rank)+'</td>'
			+'<td>&nbsp;<span style="font-size:.7em">'+tk.gecfg.datatype+'</span> '+v.value+'</td>'
			+'<td>'
		]

		if( v.estat ) {
			if(v.estat.ase_uncertain) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_uncertain+';color:white">ASE uncertain</span>')
			} else if(v.estat.ase_biallelic) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_biallelic+';color:white">Bi-allelic</span>')
			} else if(v.estat.ase_monoallelic) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_monoallelic+';color:white">Mono-allelic</span>')
			}
			if(v.estat.outlier) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.outlier.color_outlier+';color:white">Outlier HIGH</span>')
			} else if(v.estat.outlier_asehigh) {
				lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.outlier.color_outlier_asehigh+';color:white">ASE HIGH</span>')
			}
		}

		lst.push('</td></tr>')
		rows.push(lst.join(''))
	}

	if(tk.gecfg && tk.gecfg.fixed) {
		for(const fgene of tk.gecfg.fixed) {
			if(fgene.sample2rank && fgene.sample2rank[ sample.samplename ]) {
				const v = fgene.sample2rank[ sample.samplename ]
				const lst=[
					'<tr>'
					+'<td><b>'+ fgene.gene +'</b></td>'
					+'<td>&nbsp;<span style="font-size:.7em">RANK</span> '+client.ranksays(v.rank)+'</td>'
					+'<td>&nbsp;<span style="font-size:.7em">'+tk.gecfg.datatype+'</span> '+v.value+'</td>'
					+'<td>'
				]

				if(v.estat) {
					if(v.estat.ase_uncertain) {
						lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_uncertain+';color:white">ASE uncertain</span>')
					} else if(v.estat.ase_biallelic) {
						lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_biallelic+';color:white">Bi-allelic</span>')
					} else if(v.estat.ase_monoallelic) {
						lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.ase.color_monoallelic+';color:white">Mono-allelic</span>')
					}
					if(v.estat.outlier) {
						lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.outlier.color_outlier+';color:white">Outlier HIGH</span>')
					} else if(v.estat.outlier_asehigh) {
						lst.push('<span style="padding:0px 5px;background:'+tk.gecfg.outlier.color_outlier_asehigh+';color:white">ASE HIGH</span>')
					}
				}

				lst.push('</td></tr>')
				rows.push(lst.join(''))
			}
		}
	}

	if(rows.length) {
		lines.push({
			k:'Expression',
			v:'<table style="font-size:.9em">'+rows.join('')+'</table>'
		})
	}
}









function printer_snvindel( m, tk ) {

	/*
	show attributes for a single variant
	may show INFO if they are used for filtering
	*/

	const lst=[]


	{
		// somehow mname may be abscent from vep annotation
		const _c = common.mclass[m.class]
		lst.push({
			k:'Mutation',
			v: (m.mname ? '<span style="color:'+_c.color+'">'+m.mname+'</span>' : '')
				+' <span style="font-size:.7em">'+_c.label+'</span>'
		})
	}

	{
		const phrases=[]
		if(m.gene) phrases.push(m.gene)
		if(m.isoform) phrases.push(m.isoform)
		if(phrases.length) {
			lst.push({
				k:'Gene',
				v:phrases.join(' ')
			})
		}
	}

	lst.push({
		k:'Position',
		v:m.chr+':'+(m.pos+1)
	})
	lst.push({
		k:'Alleles',
		v:'<span style="font-size:.8em;opacity:.5">REF/ALT</span> '+m.ref+' / '+m.alt
	})

	if(tk && tk.alleleAttribute && tk.alleleAttribute.attributes) {
		for(const key in tk.alleleAttribute.attributes) {
			const attr = tk.alleleAttribute.attributes[key]
			lst.push({
				k: attr.label,
				v: ( m.altinfo ? m.altinfo[key] : '')
			})
		}
	}

	if(tk && tk.locusAttribute && tk.locusAttribute.attributes) {
		for(const key in tk.locusAttribute.attributes) {
			const attr = tk.locusAttribute.attributes[key]
			lst.push({
				k: attr.label,
				v: ( m.info ? m.info[key] : '')
			})
		}
	}

	return lst
}





function findsamplegroup_byvcf( p ) {
	/*
	.m
	.m_sample
	p.tk
	*/
	
	let samplename
	if(p.m.dt==common.dtsnvindel) {
		if(!p.m_sample) throw('m_sample missing')
		samplename = p.m_sample.sampleobj.name
	} else {
		throw('unknown dt')
	}

	for(const g of p.tk._data) {
		for(const sample of g.samples) {
			if(sample.samplename == samplename) {
				return [sample, g]
			}
		}
	}
	return [-1,-1]
}




export function svchr2html(chr, tk) {
	// only for multi-sample, full mode
	if( tk.legend_svchrcolor.interchrs.has(chr) ) {
		return '<span style="background:'+tk.legend_svchrcolor.colorfunc(chr)+';font-weight:bold;padding:0px 5px;color:white">'+chr+'</span>'
	}
	return chr
}



export function svcoord2html(i, tk) {
	return svchr2html(i.chrA,tk)+':'+i.posA + (i.strandA ? ':'+i.strandA : '')
		+' &raquo; '
		+svchr2html(i.chrB,tk)+':'+i.posB+ (i.strandB ? ':'+i.strandB : '')
}



function sortitemsbytype_onesample( samplename, lst, tk ) {
	/*
	multi-sample
	dense or full
	for one sample, to show its mutation data in table, grouped by type
	*/

	const cnvlst=[], // html
		svlst=[],
		lohlst=[],
		itdlst=[],
		vcflst=[],
		cnvlst0=[], // actual objects
		svlst0=[],
		lohlst0=[],
		itdlst0=[],
		vcflst0=[]

	{
		// treat sv/fusion first: dedup breakends
		const breakends = lst.filter( i=> i.dt==common.dtsv || i.dt==common.dtfusionrna )
		const deduped = dedup_sv( breakends )
		for(const i of deduped) {

			svlst.push(
				'<div style="white-space:nowrap">'
				+ itemname_svfusion(i) + ' <span style="font-size:.7em">'
				+ svcoord2html(i,tk)+'</span>'
				+(i.dt==common.dtfusionrna ? ' <span style="font-size:.7em">(RNA fusion)</span>':'')
				+'</div>'
			)
			svlst0.push(i)
		}
	}


	for(const i of lst) {

		if(i.dt==common.dtsv || i.dt==common.dtfusionrna) continue

		if(i.dt==common.dtloh) {
			lohlst.push(
				'<div style="white-space:nowrap">'+i.chr+':'+(i.start+1)+'-'+(i.stop+1)
				+' <span style="font-size:.8em">'+common.bplen(i.stop-i.start)
				+' seg.mean: '+i.segmean+'</span>'
			)
			lohlst0.push(i)
		} else if(i.dt==common.dtcnv) {
			cnvlst.push(
				'<div style="white-space:nowrap">'+i.chr+':'+(i.start+1)+'-'+(i.stop+1)
				+' <span style="font-size:.8em">'+common.bplen(i.stop-i.start)+'</span>'
				+' <span style="background:'+(i.value>0?tk.cnvcolor.gain.str:tk.cnvcolor.loss.str)+';font-size:.8em;color:white">&nbsp;'+i.value+'&nbsp;</span>'
				+'</div>'
			)
			cnvlst0.push(i)
		} else if(i.dt==common.dtitd) {
			itdlst.push(
				'<div style="white-space:nowrap">'+i.chr+':'+(i.start+1)+'-'+(i.stop+1)
				+(i.rnaduplength ? ', '+i.rnaduplength+' bp duplicated in RNA' : '')
				+(i.aaduplength ? ', '+i.aaduplength+' AA duplicated' : '')
				+'</div>'
			)
			itdlst0.push(i)
		} else {
			throw('unknown dt: '+i.dt)
		}
	}

	if(tk.data_vcf) {
		for(const m of tk.data_vcf) {

			if(m.dt == common.dtsnvindel) {
				if(m.sampledata.find( s=> s.sampleobj.name == samplename )) {
					const c = common.mclass[m.class]
					vcflst.push(
						'<div style="white-space:nowrap">'
						+'<span style="color:'+c.color+';font-weight:bold">'+m.mname+'</span> '
						+'<span style="font-size:.7em">'+c.label+'</span></div>'
					)
					vcflst0.push(m)
				}
			} else {
				throw('unknown dt: '+m.dt)
			}
		}
	}

	return [ cnvlst, svlst, lohlst, itdlst, vcflst, cnvlst0, svlst0, lohlst0, itdlst0, vcflst0 ]
}




function may_show_matrixbutton(samplegroup, tk, block) {
	/*
	in sample group name menu, may add a button for showing pre-configured samplematrix for this group
	annotationsampleset2matrix has one key
	*/
	if(!tk.mds || !tk.mds.annotationsampleset2matrix) return
	if(!samplegroup.attributes) return

	// from attributes of this group, find one using that key
	const attr = samplegroup.attributes.find( i=> i.k == tk.mds.annotationsampleset2matrix.key )
	if(!attr) return

	// and the value of the attribute for this group should have corresponding item
	const valueitem = tk.mds.annotationsampleset2matrix.groups[ attr.kvalue ]
	if(!valueitem) return

	if(!valueitem.groups) return // should not happen

	// this group will have 1 or more subgroups, each is one study group or subtype
	for(const group of valueitem.groups) {

		if(!group.name || !group.matrixconfig) continue

		tk.tip2.d.append('div')
			.html(group.name+' <span style="font-size:.8em;opacity:.5">SUMMARY</span>')
			.attr('class', 'sja_menuoption')
			.on('click',()=>{

				tk.tip2.hide()

				const pane = client.newpane({ x:100, y:100 })
				pane.header.text(group.name+' summary')

				const arg = {
					dslabel: tk.mds.label,
					debugmode: block.debugmode,
					genome: block.genome,
					hostURL: block.hostURL,
					jwt:block.jwt,
					holder: pane.body.append('div').style('margin','20px'),
				}

				for(const k in group.matrixconfig) {
					arg[k] = group.matrixconfig[k]
				}

				import('./samplematrix').then(_=>{
					new _.Samplematrix( arg )
				})
			})
	}
}




export function may_add_sampleannotation(samplename, tk, lst) {
	if(!tk.sampleAttribute) return
	if(!tk.sampleAttribute.attributes || !tk.sampleAttribute.samples) return

	// should only be available in multi-sample, official tk

	const anno = tk.sampleAttribute.samples[ samplename ]
	if(!anno) return

	// show annotation for this sample
	for(const key in anno) {

		// config about this key
		const keycfg = tk.sampleAttribute.attributes[ key ] || {}

		const value = anno[ key ]

		if(value==undefined) continue

		let printvalue = value
		if(keycfg.values) {
			const o = keycfg.values[ value ]
			if(o && o.name) {
				printvalue = o.name
			}
		}

		lst.push({
			k: ( keycfg.label || key),
			v: printvalue
		})
	}
}



function may_show_svgraph ( p, buttonrow, holder0 ) {
	if(!p.item) return
	if(p.item.dt != common.dtsv && p.item.dt != common.dtfusionrna) return

	const holder = holder0.append('div')
		.style('margin','10px')
	make_svgraph( p, holder )

	buttonrow.append('div')
		.style('display','inline-block')
		.attr('class', 'sja_menuoption')
		.text('SVGraph')
		.on('click',()=>{
			if(holder.style('display')=='none') {
				client.appear(holder)
			} else {
				client.disappear(holder)
			}
		})
}



export async function make_svgraph( p, holder ) {
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
			wait.text('Loading gene at '+svpair.a.chr+':'+svpair.a.position+' ...')
			const lst = await getisoform( p, svpair.a.chr, svpair.a.position )
			const useone = lst.find( i=> i.isdefault ) || lst[0]
			if(useone) {
				svpair.a.name = useone.name
				svpair.a.gm = { isoform: useone.isoform }
			}
		}
		{
			wait.text('Loading gene at '+svpair.b.chr+':'+svpair.b.position+' ...')
			const lst = await getisoform( p, svpair.b.chr, svpair.b.position )
			const useone = lst.find( i=> i.isdefault ) || lst[0]
			if(useone) {
				svpair.b.name = useone.name
				svpair.b.gm = { isoform: useone.isoform }
			}
		}

		wait.remove()

		const svarg={
			jwt: p.block.jwt,
			hostURL: p.block.hostURL,
			pairlst: [ svpair ],
			genome: p.block.genome,
			holder:holder
		}
		import('./svgraph').then(_=>{
			_.default(svarg)
		})


	} catch(e) {
		if(e.stack) console.log(e.stack)
		wait.text('Error: '+(e.message||e))
	}
}

function getisoform ( p, chr, pos ) {
	return client.dofetch('isoformbycoord',{ genome: p.block.genome.name, chr: chr, pos: pos })
	.then(data=>{
		if(data.error) throw data.error
		return data.lst
	})
}



async function may_findmatchingsnp_printintable( m, block, table ) {
	if(!block || !block.genome || !block.genome.hasSNP) return
	const tr = table.append('tr')
	tr.append('td')
		.attr('colspan',2)
		.text('dbSNP')
		.style('opacity',.4)
		.style('padding','3px')
	const td = tr.append('td')
	const wait = td.append('div').text('Loading...')
	try {
		const hits = await client.may_findmatchingsnp( m.chr, [m.pos], block.genome)
		if(!hits || hits.length==0) {
			wait.text('No SNP')
			return
		}
		wait.remove()
		for(const s of hits) {
			const row = td.append('div')
			client.snp_printhtml(s, row)
		}
	} catch(e) {
		wait.text(e.message||e)
	}
}



async function may_findmatchingclinvar_printintable( m, block, table ) {
	if(!block || !block.genome || !block.genome.hasClinvarVCF) return
	const tr = table.append('tr')
	tr.append('td')
		.attr('colspan',2)
		.text('ClinVar')
		.style('opacity',.4)
		.style('padding','3px')
	const td = tr.append('td')
	const wait = td.append('div').text('Loading...')
	try {
		const hit = await client.may_findmatchingclinvar( m.chr, m.pos, m.ref, m.alt, block.genome)
		if(!hit) {
			wait.text('No match')
			return
		}
		wait.remove()
		client.clinvar_printhtml(hit, td)
	} catch(e) {
		wait.text(e.message||e)
	}
}



function may_createbutton_survival_onemutation(arg) {
/*
may create a 'survival plot' button and use one mutation to divide samples
holder
tk
block
*/
	if(!arg.tk.mds || !arg.tk.mds.survivalplot) {
		return
	}

	arg.holder.append('div')
	.style('display','inline-block')
	.text('Survival plot')
	.attr('class','sja_menuoption')
	.on('click',()=>{

		const m = arg.m

		// sample dividing rules
		const st = {
			mutation: 1
		}

		if(m.dt == common.dtsnvindel) {
			// default to use this specific mutation
			st.chr = m.chr
			st.start = m.pos
			st.stop = m.pos
			st.snvindel = {
				name: (m.gene ? m.gene+' ' : '') + m.mname,
				ref: m.ref,
				alt: m.alt,
			}
		} else if(m.dt == common.dtcnv) {
			st.chr = m.chr
			st.start = m.start
			st.stop = m.stop
			st.cnv = {
				focalsizelimit: arg.tk.bplengthUpperLimit,
				valuecutoff: arg.tk.valueCutoff,
			}
		} else if(m.dt == common.dtloh) {
			st.chr = m.chr
			st.start = m.start
			st.stop = m.stop
			st.loh = {
				focalsizelimit: arg.tk.lohLengthUpperLimit,
				valuecutoff: arg.tk.segmeanValueCutoff,
			}
		} else if(m.dt == common.dtsv) {
			st.chr = m._chr
			st.start = m._pos
			st.stop = m._pos
			st.sv = {}

		} else if(m.dt == common.dtfusionrna) {
			st.chr = m._chr
			st.start = m._pos
			st.stop = m._pos
			st.fusion = {}
		} else if(m.dt == common.dtitd) {
			st.chr = m.chr
			st.start = m.start
			st.stop = m.stop
			st.itd = {}
		}

		const plot = {
			renderplot: 1, // instruct the plot to be rendered, no wait
			samplerule:{
				full:{},
				set: st
			}
		}

		if(arg.tk.mds.survivalplot.samplegroupattrlst && arg.sample ) {
			// the survivalplot has samplegrouping, and there is a single sample
			// will just use the first attribute
			const attr = arg.tk.mds.survivalplot.samplegroupattrlst[0]
			const sampleanno = arg.tk.sampleAttribute ? arg.tk.sampleAttribute.samples[ arg.sample.samplename ]  : null
			if(sampleanno) {
				const v = sampleanno[ attr.key ]
				if(v) {
					plot.samplerule.full.byattr = 1
					plot.samplerule.full.key = attr.key
					plot.samplerule.full.value = v
				}
			}
		} else {
			// do not set rule for sample-full
		}

		const pane = client.newpane({x:100, y: 100})
		pane.header
			.text('Survival plot')

		import('./mds.survivalplot').then(_=>{
			_.init(
				{
					genome: arg.block.genome,
					mds: arg.tk.mds,
					plotlist:[ plot ]
				},
				pane.body,
				arg.block.debugmode
			)
		})
	})
}



function may_createbutton_survival_grouplab (arg) {
/*
in multi-sample mode, either dense or expanded
click on group label to show button
use current range

holder
tk
block
samplegroup
*/
	if(!arg.tk.mds || !arg.tk.mds.survivalplot) {
		return
	}

	arg.holder.append('div')
	.text('Survival plot')
	.attr('class','sja_menuoption')
	.on('click',()=>{

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
			st.start = Math.min(a,b)
			st.stop = Math.max(a,b)
		}

		st.snvindel = {}

		if(!arg.tk.legend_mclass.hiddenvalues.has( common.dtcnv )) {
			st.cnv = {
				focalsizelimit: arg.tk.bplengthUpperLimit,
				valuecutoff: arg.tk.valueCutoff,
			}
		}
		if(!arg.tk.legend_mclass.hiddenvalues.has( common.dtloh )) {
			st.loh = {
				focalsizelimit: arg.tk.lohLengthUpperLimit,
				valuecutoff: arg.tk.segmeanValueCutoff,
			}
		}
		if(!arg.tk.legend_mclass.hiddenvalues.has( common.dtsv )) {
			st.sv = {}
		}
		if(!arg.tk.legend_mclass.hiddenvalues.has( common.dtfusionrna )) {
			st.fusion = {}
		}
		if(!arg.tk.legend_mclass.hiddenvalues.has( common.dtitd )) {
			st.itd = {}
		}

		const plot = {
			renderplot: 1, // instruct the plot to be rendered, no wait
			samplerule:{
				full:{},
				set: st
			}
		}

		/*
		samplegroup.attributes[] can be more than 1
		but samplerule.full only works for 1
		*/
		const attr = arg.samplegroup.attributes[ arg.samplegroup.attributes.length-1 ]
		plot.samplerule.full = {
			byattr:1,
			key: attr.k,
			value: attr.kvalue
		}

		const pane = client.newpane({x:100, y: 100})
		pane.header
			.text('Survival plot')

		import('./mds.survivalplot').then(_=>{
			_.init(
				{
					genome: arg.block.genome,
					mds: arg.tk.mds,
					plotlist:[ plot ]
				},
				pane.body,
				arg.block.debugmode
			)
		})
	})
}
