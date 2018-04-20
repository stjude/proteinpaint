import * as client from './client'
import {event as d3event} from 'd3-selection'
import {axisTop} from 'd3-axis'
import {scaleLinear} from 'd3-scale'
import * as common from './common'
import * as expressionstat from './block.mds.expressionstat'
import { may_add_sampleannotation } from './block.mds.svcnv.clickitem'
import {createbutton_addfeature} from './block.mds.svcnv.samplematrix'
import {focus_singlesample,
	coverbarcolor_silent,
	multi_sample_addhighlight,
	multi_sample_removehighlight
	} from './block.mds.svcnv'


/*
add columns
column could be gene expression rank and sample attribute

*/






//const fpkmbarcolor='#40859C'




export function render_multi_genebar( tk, block) {
	/*
	multi-sample
	native or custom
	dense or full
	*/

	const attrlst = [] // list of sample attributes to show alongside expression
	if(tk.sampleAttribute && tk.sampleAttribute.attributes && tk.sampleAttribute.samples) {
		for(const attrkey in tk.sampleAttribute.attributes) {
			const attr = tk.sampleAttribute.attributes[ attrkey ]
			if(!attr.showintrack) continue

			const attrobj = {
				key: attrkey,
				label: attr.label,
				min: null,
				max: null
			}
			// determine min/max
			for(const g of tk.samplegroups) {
				for(const s of g.samples) {
					const v0 = tk.sampleAttribute.samples[s.samplename]
					if(!v0) continue
					const v = v0[ attrkey ]
					if(Number.isNaN(v)) continue
					if(attrobj.min==null) {
						attrobj.min=attrobj.max=v
					} else {
						attrobj.min = Math.min(attrobj.min, v)
						attrobj.max = Math.max(attrobj.max, v)
					}
				}
			}
			attrlst.push(attrobj)
		}
	}

	if(tk.expressionrangelimit) {
		// too big to do it
		// FIXME if attrlst should keep render, but also need to show this message
		const g=tk.cnvrightg
		const h=15
		let y=12
		g.append('text').text('Zoom in').attr('y',y).attr('font-size',12)
		y+=h
		g.append('text').text('under').attr('y',y).attr('font-size',12)
		y+=h
		g.append('text').text(common.bplen(tk.expressionrangelimit)).attr('y',y).attr('font-size',12)
		y+=h
		g.append('text').text('for').attr('y',y).attr('font-size',12)
		y+=h
		g.append('text').text('expression').attr('y',y).attr('font-size',12)
		y+=h
		g.append('text').text('ranking').attr('y',y).attr('font-size',12)
		return 0
	}


	const genes = new Set()
	for(const g of tk._data) {
		for(const s of g.samples) {
			if(s.expressionrank) {
				for(const gene in s.expressionrank) {
					genes.add(gene)
				}
			}
		}
	}
	if(genes.size + attrlst.length == 0) {
		return 0
	}

	// TODO multiple genes

	let usegene
	if(tk.selectedgene && genes.has(tk.selectedgene)) {
		usegene=tk.selectedgene
	} else {
		usegene = [...genes][0]
	}

	let minvalue=0
	let maxvalue=100

	// hardcoded bar width for expression rank
	const expbarwidth=80
	// hardcoded bar width for numeric attribute
	const numattrbarwidth=80
	const xspace = 10

	// any gene has ase info? if so, tooltip will show 'no info' for those missing
	// otherwise won't indicate ase status
	let anygenehasase=false
	for(const g of tk.samplegroups) {
		for(const s of g.samples) {
			if(s.expressionrank) {
				for(const n in s.expressionrank) {
					if(s.expressionrank[n].ase) {
						anygenehasase=true
					}
				}
			}
		}
	}


	for(const g of tk.samplegroups) {

		let y = g.y

		for(const s of g.samples) {

			s.columnbars = []

			const row = tk.cnvrightg.append('g').attr('transform','translate(0,'+y+')')

			/*
			may be multiple columns, show gene expression rank first, then attrlst
			x is xoffset in each sample
			*/
			let x = 0

			if(s.expressionrank && usegene ) {

				const v = s.expressionrank[usegene]
				if(v!=undefined) {


					const bar=row.append('rect')
						.attr('x',x)
						.attr('fill',  expressionstat.ase_color( v, tk.gecfg ) ) // bar color set by ase status
						.attr('width', expbarwidth * v.rank / maxvalue )
						.attr('height', s.height)
						.attr('shape-rendering','crispEdges')

					if(tk.isfull) {
						// only show dots for outlier status in full, not dense
						if(v.estat.outlier) {
							row.append('circle')
								.attr('cx',expbarwidth)
								.attr('cy', s.height/2)
								.attr('r', s.height/2)
								.attr('fill', tk.gecfg.outlier.color_outlier)
						} else if(v.estat.outlier_asehigh) {
							row.append('circle')
								.attr('cx',expbarwidth)
								.attr('cy', s.height/2)
								.attr('r',  s.height/2)
								.attr('fill', tk.gecfg.outlier.color_outlier_asehigh)
						}
					}

					const cover = row.append('rect')
						.attr('fill',  coverbarcolor_silent)
						.attr('fill-opacity',.1)
						.attr('width',expbarwidth)
						.attr('height', s.height)

					if(tk.isfull) {
						s.columnbars.push(cover)
					}

					cover.on('mouseover',()=>{
						tk.tktip
							.clear()
							.show(d3event.clientX, d3event.clientY)

						const lst=[{k:'Sample',v:s.samplename}]
						may_add_sampleannotation( s.samplename, tk, lst )

						lst.push({k:'Rank',  v:client.ranksays(v.rank)})
						lst.push({k:tk.gecfg.datatype,  v:v.value})

						const table = client.make_table_2col(tk.tktip.d,lst)

						expressionstat.showsingleitem_table( v, tk.gecfg, table )

						multi_sample_addhighlight(s)
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
						multi_sample_removehighlight(s)
					})
					.on('click',()=>{
						const pane=client.newpane({x:window.innerWidth/2,y:100})
						pane.header.text( usegene+' '+tk.gecfg.datatype+' from '+tk.name )
						const c=tk.gene2coord[usegene]
						if(!c) {
							pane.body.text('No coordinate for '+usegene)
							return
						}

						const p={
							gene:usegene,
							chr:c.chr,
							start:c.start,
							stop:c.stop,
							holder:pane.body,
							block:block,
							genome:block.genome,
							jwt:block.jwt,
							hostURL:block.hostURL,
							sample:{name:s.samplename,value:v.value}
						}

						// expression
						if(tk.iscustom) {
							for(const k in tk.checkexpressionrank) {
								p[k]=tk.checkexpressionrank[k]
							}
						} else {
							p.dslabel=tk.mds.label
							p.querykey=tk.mds.queries[tk.querykey].checkexpressionrank.querykey
						}
						// svcnv
						p.color={
							cnvgain:tk.cnvcolor.gain.str,
							cnvloss:tk.cnvcolor.loss.str,
							sv:'black'
						}
						if(tk.iscustom) {
							p.svcnv={
								iscustom:1,
								file: tk.file,
								url: tk.url,
								indexURL: tk.indexURL
							}
						} else {
							p.svcnv={
								dslabel:tk.mds.label,
								querykey:tk.querykey
							}
						}
						p.svcnv.valueCutoff=tk.valueCutoff
						p.svcnv.bplengthUpperLimit=tk.bplengthUpperLimit

						p.clicksample = (thissample, group, plot) => {
							// click outlier sample to launch browser and show sv/cnv+expression rank for single sample
							const sample={
								samplename:thissample.sample
							}
							const samplegroup={
								attributes: group.attributes
							}
							const tk={} // svcnv track
							if(plot.svcnv.iscustom) {
							} else {
								for(const k in plot.svcnv) {
									tk[k] = plot.svcnv[k]
								}
								tk.mds = plot.block.genome.datasets[ plot.svcnv.dslabel ]
							}
							focus_singlesample({
								m: {
									dt: common.dtcnv,
									chr:plot.chr,
									start:plot.start,
									stop:plot.stop
								},
								sample: sample,
								samplegroup: samplegroup,
								tk: tk,
								block: plot.block
							})
						}
						import('./block.mds.geneboxplot').then(_=>{
							_.init(p)
						})
					})
				}
				x += expbarwidth + xspace
			}

			// numeric attributes follow expression rank

			for(const attr of attrlst) {
				const v0 = tk.sampleAttribute.samples[ s.samplename ]
				if(v0) {
					const v = v0[ attr.key ]
					if(!Number.isNaN(v)) {
						row.append('rect')
							.attr('x',x)
							.attr('width', Math.max(1, numattrbarwidth * (v-attr.min)/(attr.max-attr.min)) )
							.attr('height', s.height)
							.attr('fill','#858585')
							.attr('shape-rendering','crispEdges')
						row.append('rect')
							.attr('x',x)
							.attr('width', numattrbarwidth )
							.attr('height', s.height)
							.attr('fill','#858585')
							.attr('fill-opacity',.1)
						const cover = row.append('rect')
							.attr('fill',  coverbarcolor_silent)
							.attr('fill-opacity',.1)
							.attr('width',numattrbarwidth)
							.attr('height', s.height)

						s.columnbars.push(cover)

						cover.on('mouseover',()=>{
							tk.tktip
								.clear()
								.show(d3event.clientX, d3event.clientY)

							const lst=[{k:'Sample',v:s.samplename}]
							may_add_sampleannotation( s.samplename, tk, lst )

							client.make_table_2col(tk.tktip.d,lst)
							multi_sample_addhighlight(s)
						})
						.on('mouseout',()=>{
							tk.tktip.hide()
							multi_sample_removehighlight(s)
						})
					}
				}
				x += numattrbarwidth + xspace
			}

			// done this sample
			y += s.height + tk.rowspace
		}

		// done this group
	}

	// axis label
	const axispad = 0
	const labelpad=3
	const ticksize = 5
	const fontsize=12

	const headg = tk.cnvrightg.append('g')
		.attr('transform','translate(0,-'+axispad+')')

	let x=0

	if( usegene ) {
		client.axisstyle({
			axis: headg.append('g').call( axisTop().scale(
				scaleLinear().domain([minvalue,maxvalue]).range([0,expbarwidth])
				)
				.tickValues([0,50,100])
				.tickSize(ticksize)
				),
			fontsize:fontsize,
			showline:1
		})

		const text = headg.append('text')
			.attr('text-anchor','middle')
			.attr('x',expbarwidth/2)
			.attr('y',-(fontsize+labelpad+ticksize+axispad))
			.attr('font-family',client.font)
			.attr('font-size',fontsize)
			.text(usegene+' rank')

		text.attr('class','sja_clbtext')
		.on('click',()=>{

			tk.tkconfigtip.clear()
				.showunder(d3event.target)

			genebar_config( tk.tkconfigtip.d, genes, tk, block )
		})
		x += expbarwidth + xspace
	}

	for(const attr of attrlst) {
		client.axisstyle({
			axis: headg.append('g')
				.attr('transform','translate('+x+',0)')
				.call( axisTop().scale(
					scaleLinear().domain([attr.min,attr.max]).range([0,numattrbarwidth])
				)
				.ticks(3)
				),
			fontsize:fontsize,
			showline:1
		})

		const text = headg.append('text')
			.attr('x', x + numattrbarwidth/2)
			.attr('text-anchor','middle')
			.attr('y',-(fontsize+labelpad+ticksize+axispad))
			.attr('font-family',client.font)
			.attr('font-size',fontsize)
			.text(attr.label)
		x += numattrbarwidth + xspace
	}

	// TODO when multiple columns, must adjust block.rightheadw

	return fontsize+fontsize+labelpad+ticksize+axispad
}




function genebar_config( holder, genes, tk, block ) {
	/*
	*/

	let usegene
	if(tk.selectedgene && genes.has(tk.selectedgene)) {
		usegene = tk.selectedgene
	} else {
		usegene = [...genes][0]
	}

	createbutton_addfeature({
		m: {
			dt: common.dtgeneexpression,
			genename: usegene,
		},
		holder: holder.append('div').style('margin-bottom','10px'),
		tk: tk,
		block: block
	})

	// scatter plot button

	if(genes.size>1) {
		// more than one gene
		const scrollholder=holder.append('div')
			.style('margin-bottom','15px')
		if(genes.size>8) {
			scrollholder
				.style('height','200px')
				.style('padding','15px')
				.style('overflow-y','scroll')
				.style('resize','vertical')
		}
		const id0=Math.random().toString()
		for(const gene of genes) {
			const row= scrollholder.append('div')
			const id=Math.random().toString()
			const r = row.append('input')
				.attr('type','radio')
				.attr('id',id)
				.attr('name',id0)
				.on('change',()=>{
					tk.tkconfigtip.hide()
					tk.selectedgene = gene
					tk.cnvrightg.selectAll('*').remove()
					render_multi_genebar(tk,block)
				})
			if(gene==usegene) r.attr('checked',1)
			row.append('label')
				.attr('for',id)
				.attr('class','sja_clbtext')
				.html('&nbsp;'+gene)
		}
	}

	expressionstat.ui_config( holder, tk.gecfg, ()=>{
		tk.tkconfigtip.hide()
		tk.cnvrightg.selectAll('*').remove()
		multi_expressionstatus_ase_outlier(tk)
		render_multi_genebar(tk,block)
	})
}
