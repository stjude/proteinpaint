import * as client from './client'
import {select as d3select,event as d3event, mouse as d3mouse} from 'd3-selection'
import {legend_newrow} from './block.legend'
import * as blockmds from './block.mds'
import {rgb as d3rgb} from 'd3-color'
import {axisTop, axisLeft, axisRight} from 'd3-axis'
import {scaleLinear,scaleLog,scaleOrdinal,schemeCategory10,schemeCategory20} from 'd3-scale'
import * as common from './common'
import * as expressionstat from './block.mds.expressionstat'
import * as vcfcopymclass from './vcf.copymclass'


/*
sv-cnv-fpkm ranking, two modes
	multi-sample:
		one row per sample
		two forms:
			dense
				sv breakpoint density in separate track
				cnv shown densily
			full
				cnv & sv shown together at sample-level
	single-sample:
		show cnv & sv data from a single sample
		indicated by tk.singlesample {name:"samplename"}
		spawn from sample group, mode won't mutate
		fpkm ranking shown as independent track

sv/cnv/loh data mixed in same file, sv has _chr and _pos which are indexing fields, along with chrA/posA/chrB/posB
fpkm data in one file, fpkm may contain Yu's results on ASE/outlier

JUMP __cohortfilter __multi __maketk __boxplot


********************** EXPORTED
loadTk()


********************** INTERNAL

makeTk()
render_samplegroups
	render_multi_vcfdensity
	render_multi_svdensity
		click_svdense
	render_multi_cnvloh
		click_samplegroup_showtable
		** click_multi2single
		tooltip_multi_cnvloh
	render_multi_genebar
		genebar_config
render_singlesample
configPanel()



integrate other pieces of information from the same mds
- expression level of certain gene
- mutation status of certain gene or region

*/




const labyspace=5
const intrasvcolor = '#858585' // inter-chr sv color is defined on the fly
const cnvhighlightcolor = '#E8FFFF'
const minlabfontsize=7
const minsvradius=5
const svdensitynogroupcolor='#40859C'
//const fpkmbarcolor='#40859C'
const fpkmbarcolor_bg='#222'
const leftlabelticksize=5

const hardcode_cellline='CELLLINE'
const novalue_max_cnvloh=0 // for max scale of log2ratio and segmean, if there is no cnv or loh data in view range



export function loadTk( tk, block ) {

	block.tkcloakon(tk)
	block.block_setheight()

	if(tk.uninitialized) {
		makeTk(tk,block)
	}

	const par={
		jwt:block.jwt,
		genome:block.genome.name,
		rglst: block.tkarg_maygm(tk),
	}

	if(block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for(const [idx,r] of block.subpanels.entries()) {
			par.rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				subpanelidx:idx,
			})
		}
	}

	addLoadParameter( par, tk )

	if(tk.uninitialized) {
		/* only delete the flag here after adding load parameter
		   for custom track, it tells this is first time querying it, thus will modify parameter to retrieve list of samples from track header
		*/
		delete tk.uninitialized
	}

	fetch( new Request(block.hostURL+'/mdssvcnv', {
		method:'POST',
		body:JSON.stringify(par)
	}))
	.then(data=>{return data.json()})
	.then(data=>{

		// throw errors

		if(data.error) throw({message:data.error})

		if(tk.singlesample) {
			if(!data.lst || data.lst.length==0) throw({message:tk.singlesample.name+': no CNV or SV in view range'})
			return data
		}

		if(!data.samplegroups || data.samplegroups.length==0) throw({message:'no data in view range'})

		tk.data_vcf = data.data_vcf
		tk.vcfrangelimit = data.vcfrangelimit
		vcfdata_prepmclass(tk, block)

		return data

	})
	.catch(obj=>{
		if(obj.stack) console.log(obj)
		return {error: tk.name+': '+obj.message}
	})
	.then(obj=>{
		
		// preps common to both single and multi sample
		tk.legend_svchrcolor.interchrs.clear()
		tk.legend_svchrcolor.row.style('display','none')

		if(tk.singlesample) {

			tk.data = obj.lst
			render_singlesample( tk, block )

		} else {

			tk._data=obj.samplegroups
			tk.gene2coord = obj.gene2coord
			tk.expressionrangelimit=obj.expressionrangelimit
			render_samplegroups( tk, block )

		}

		block.tkcloakoff(tk, {error:obj.error})
		block.block_setheight()
		block.setllabel()
	})
}





function vcfdata_prepmclass(tk, block) {
	if(!tk.data_vcf || tk.data_vcf.length==0) return
	for(const m of tk.data_vcf) {
		vcfcopymclass.copymclass(m, block)
	}
}





function addLoadParameter( par, tk ) {
	if(tk.iscustom) {
		par.iscustom=1
		par.file=tk.file
		par.url=tk.url
		par.indexURL=tk.indexURL
		if(tk.checkexpressionrank) {
			par.checkexpressionrank={}
			for(const k in tk.checkexpressionrank) {
				par.checkexpressionrank[k]=tk.checkexpressionrank[k]
			}
		}
	} else {
		par.dslabel=tk.mds.label
		par.querykey=tk.querykey
	}

	// cnv
	if(tk.valueCutoff) par.valueCutoff=tk.valueCutoff
	if(tk.bplengthUpperLimit) par.bplengthUpperLimit=tk.bplengthUpperLimit
	if(tk.showonlycnvwithsv) par.showonlycnvwithsv=1

	// loh
	if(tk.segmeanValueCutoff) par.segmeanValueCutoff=tk.segmeanValueCutoff
	if(tk.lohLengthUpperLimit) par.lohLengthUpperLimit=tk.lohLengthUpperLimit

	if(tk.singlesample) {

		par.singlesample = tk.singlesample.name

	} else {

		if(tk.hiddensgnames && tk.hiddensgnames.size) {
			par.hiddensgnames = [ ...tk.hiddensgnames ]
		}
	}
}






function render_singlesample( tk, block ) {
	/*
	single-sample mode
	sv as leg-disc
	cnv as wiggle track, also converts log ratio to copy number
	loh share space with cnv, but axis on the other end
	updated: cnv & loh as bar segments
	*/

	tk.sv_g.selectAll('*').remove()
	tk.cnv_g.selectAll('*').remove()
	tk.label_sv.text('')
	tk.axis_label_cnv.text('')
	tk.axisg_cnvleft.selectAll('*').remove()
	tk.axisg_lohright.selectAll('*').remove()
	tk.cnvcolor.cnvlegend.div.style('display','none')
	tk.cnvcolor.lohlegend.div.style('display','none')
	tk.tklabel.each(function(){
		tk.leftLabelMaxwidth = this.getBBox().width
	})
	if(!tk.data || tk.data.length==0) {
		tk.height_main=50
		return
	}

	const svlst = []
	const cnvlst =[]
	const lohlst =[]
	const id2sv = {} // must dedup sv, tell by breakpoint position

	const usecopynumber=false // but not logratio

	let gainmaxvalue=0, // for cnv logratio
		lossmaxvalue=0,
		copynumbermax=0, // for copy number converted from logratio, instead of logratio
		segmeanmax=0

	for(const item of tk.data) {

		if( item.dt==common.dtfusionrna || item.dt==common.dtsv ) {
			// sv
			const id=item.chrA+'.'+item.posA+'.'+item.chrB+'.'+item.posB
			if(!id2sv[id]){
				map_sv(item,block)
				if(item.x0 || item.x1) {
					id2sv[id]=1
					svlst.push(item)
					if(item.chrA!=item._chr) {
						tk.legend_svchrcolor.interchrs.add(item.chrA)
						tk.legend_svchrcolor.colorfunc(item.chrA)
					}
					if(item.chrB!=item._chr) {
						tk.legend_svchrcolor.interchrs.add(item.chrB)
						tk.legend_svchrcolor.colorfunc(item.chrB)
					}
				}
			}
			continue
		}

		// cnv or loh

		map_cnv(item, block)
		if(item.x1==undefined || item.x2==undefined) {
			console.log('unmappable: '+item.chr+' '+item.start+' '+item.stop)
			continue
		}

		if(item.dt==common.dtloh) {
			// loh
			segmeanmax = Math.max(segmeanmax, item.segmean)
			lohlst.push(item)
			continue
		}

		// cnv

		if(usecopynumber) {
			const v = 2*Math.pow(2, item.value)
			copynumbermax = Math.max( copynumbermax, v )
		} else {
			// item.value is log2 ratio by default
			if(item.value>0) {
				gainmaxvalue = Math.max(gainmaxvalue, item.value)
			} else {
				lossmaxvalue = Math.min(lossmaxvalue, item.value)
			}
		}

		cnvlst.push(item)
	}

	may_legend_svchr2(tk)

	// sv on top
	let svheight=0
	if(svlst.length) {

		// if sv has both x0/x1 will show both legs, will be higher, else lower
		svheight = tk.discradius*2 + tk.midpad
			+ (svlst.find(s=> s.x0 && s.x1) ?
				tk.stem1+tk.legheight :
				tk.stem1+tk.stem2+tk.stem3
				)
		//tk.label_sv .text('SV') .attr('y',block.labelfontsize*2)

		tk.sv_g.attr('transform','translate(0,'+ (svheight-tk.midpad) +')')

		// clean sv
		for(const i of svlst) {
			i.radius = tk.discradius
			if(i.x0!=undefined && i.x1!=undefined) {
				if(i.x0 > i.x1) {
					// x0 maybe bigger than x1
					const a=i.x1
					i.x1=i.x0
					i.x0=a
				}
				i._x = (i.x0+i.x1)/2
			} else {
				i._x = i.x0 || i.x1
			}
			i.x=i._x
		}

		const entirewidth = block.width+block.subpanels.reduce((i,j)=>i+j.leftpad+j.width,0)

		//horiplace( svlst, entirewidth )

		for(const sv of svlst) {
			const doubleleg = sv.x0 && sv.x1
			const g = tk.sv_g.append('g')
				.attr('transform','translate('+ sv.x +','+(doubleleg ? -tk.stem1-tk.legheight : -tk.stem1-tk.stem2-tk.stem3) +')')

			const otherchr=sv.chrA==sv._chr ? sv.chrB : sv.chrA
			const color =  otherchr==sv._chr ? intrasvcolor : tk.legend_svchrcolor.colorfunc(otherchr)

			g.append('circle')
				.attr('r', tk.discradius)
				.attr('cy',-tk.discradius)
				.attr('fill',color)
				.attr('stroke','white')
			g.append('circle')
				.attr('r', tk.discradius)
				.attr('cy',-tk.discradius)
				.attr('fill','white')
				.attr('fill-opacity',0)
				.attr('stroke',color)
				.attr('stroke-opacity',0)
				.attr('class','sja_aa_disckick')
				.on('click',()=>{
					click_sv_single(sv, tk, block)
				})
				.on('mouseover',()=>{
					tooltip_svitem( sv, tk)
				})
				.on('mouseout',()=> tk.tktip.hide() )

			if(doubleleg) {
				g.append('line')
					.attr('stroke',color)
					.attr('y2',tk.stem1)
					.attr('shape-rendering','crispEdges')
				g.append('line') // right leg
					.attr('stroke',color)
					.attr('y1', tk.stem1)
					.attr('x2', (sv.x1-sv.x0)/2-(sv.x-sv._x) )
					.attr('y2', tk.stem1+tk.legheight)
				g.append('line') // left leg
					.attr('stroke',color)
					.attr('y1', tk.stem1)
					.attr('x2', -(sv.x1-sv.x0)/2-(sv.x-sv._x) )
					.attr('y2', tk.stem1+tk.legheight)
			} else {
				g.append('line')
					.attr('stroke',color)
					.attr('y2', tk.stem1)
					.attr('shape-rendering','crispEdges')
				g.append('line')
					.attr('stroke',color)
					.attr('y1', tk.stem1)
					.attr('y2', tk.stem1+tk.stem2)
					.attr('x2', sv._x-sv.x)
				g.append('line')
					.attr('stroke',color)
					.attr('y1', tk.stem1+tk.stem2)
					.attr('y2', tk.stem1+tk.stem2+tk.stem3)
					.attr('x1', sv._x-sv.x)
					.attr('x2', sv._x-sv.x)
					.attr('shape-rendering','crispEdges')
			}
		}
	}


	// stack bar plot for cnv loh

	const items = [...cnvlst, ...lohlst]

	if(items.length > 0) {

		tk.cnv_g.attr('transform','translate(0,'+ svheight +')')

		items.sort( (i,j)=> Math.min(i.x1,i.x2) - Math.min(j.x1,j.x2) )

		const stacks=[ 0 ]
		for(const item of items) {
			let addnew=true
			for(let i=0; i<stacks.length; i++) {
				if(stacks[i]<= Math.min(item.x1,item.x2) ) {
					stacks[i] = Math.max( stacks[i], Math.max(item.x1,item.x2) )
					item.stack=i
					addnew=false
					break
				}
			}
			if(addnew) {
				stacks.push( Math.max(item.x1,item.x2) )
				item.stack=stacks.length-1
			}
		}

		const stackheight = 12
		const stackspace  = 1

		tk.cnvcolor.cnvmax = Math.max(gainmaxvalue, -lossmaxvalue)

		for(const item of items) {
			let color

			if(item.dt==common.dtloh) {

				color = 'rgba('+tk.cnvcolor.loh.r+','+tk.cnvcolor.loh.g+','+tk.cnvcolor.loh.b+','+(item.segmean/segmeanmax)+')'

			} else {

				if(item.value>0) {
					color = 'rgba('+tk.cnvcolor.gain.r+','+tk.cnvcolor.gain.g+','+tk.cnvcolor.gain.b+','+(item.value/tk.cnvcolor.cnvmax)+')'
				} else {
					color = 'rgba('+tk.cnvcolor.loss.r+','+tk.cnvcolor.loss.g+','+tk.cnvcolor.loss.b+','+(-item.value/tk.cnvcolor.cnvmax)+')'
				}
			}

			tk.cnv_g.append('rect')
				.attr('x', Math.min(item.x1, item.x2) )
				.attr('y', (stackheight+stackspace)*item.stack)
				.attr('width', Math.max(1, Math.abs(item.x2-item.x1) ) )
				.attr('height', stackheight)
				.attr('fill',color)
				.attr('shape-rendering','crispEdges')
				.attr('stroke','none')
				.attr('class','sja_aa_skkick')
				.on('mouseover',()=>{
					tooltip_cnvitem_singlesample(item, tk)
				})
				.on('mouseout',()=> {
					tk.tktip.hide()
				})
		}
		if(cnvlst.length) {
			tk.cnvcolor.cnvmax = Math.max(gainmaxvalue, -lossmaxvalue)
			draw_colorscale_cnv(tk)
		}
		if(lohlst.length) {
			tk.cnvcolor.segmeanmax=segmeanmax
			draw_colorscale_loh(tk)
		}

		tk.height_main = tk.toppad+ svheight + stacks.length*(stackheight+stackspace)-stackspace + tk.bottompad

	} else {

		tk.height_main = tk.toppad+ svheight + tk.bottompad
	}
}





function horiplace(lst,width) {
	/*
	j._x: ideal position
	j.x:  shifted position
	*/

	lst.forEach(i=>i.tox=i._x)
	const todo = lst

	todo.sort((a,b)=>{
		return a.tox-b.tox
	})

	// push all to left
	// set initial x for all for shifting
	let cumx= todo.length==0 ? 0 : todo[0].radius
	for(const i of todo) {
		i.x=cumx+i.radius
		cumx+=i.radius*2
	}

	for(let i=0; i<todo.length; i++) {
		while(1) {
			let currsum=0,
				newsum=0
			for(let j=i; j<todo.length; j++) {
				const k=todo[j]
				// detect conditions to stop
				if(j>0) {
					const prev=todo[j-1]
					if(prev.x+prev.radius<=k.x-k.radius) {
						// not overlapping with previous
						if(k.x>=k.tox) {
							// so it can stop
							break
						}
					}
				} else {
					if(k.x>=k.tox) {
						// the first one, it can stop too
						break
					}
				}
				const z=todo[todo.length-1]
				if(z.x+z.radius >=width) {
					// last one out of range
					break
				}
				currsum+=Math.abs(k.x-k.tox)
				k.x++
				newsum+=Math.abs(k.x-k.tox)
			}
			if(newsum<currsum) {
			} else {
				// reject
				for(let j=i; j<todo.length; j++) {
					todo[j].x--
				}
				break
			}
		}
	}
	todo.forEach(i=> delete i.tox)
}








/////////////////////// __multi





function render_samplegroups( tk, block ) {

	/*
	sample groups

	a sample should have 1 or more of cnv/sv/loh/snvindel, cannot be empty
	sv that are fully in view range will be shown as 2 circles
	one sample per row, equal row height
	for dense/full

	draw cnv/loh first; then sv; then vcf
	*/

	tk.cnvleftg.selectAll('*').remove()
	tk.vcfdensitylabelg.selectAll('*').remove()
	tk.vcfdensityg.selectAll('*').remove()
	tk.svdensitylabelg.selectAll('*').remove()
	tk.svdensityg.selectAll('*').remove()
	tk.cnvmidg.selectAll('*').remove()
	tk.cnvrightg.selectAll('*').remove()

	// initiate
	tk.tklabel.each(function(){
		tk.leftLabelMaxwidth = this.getBBox().width
	})

	/*
	_data is sample groups generated by server
	includes vcf samples
	contains cnv/sv/loh data but not vcf
	vcf data is in separate attr, variants will not be combined into samplegroup
	*/
	if(!tk._data || tk._data.length==0) {
		tk.height_main = 100
		return
	}


	// sv to be drawn in separate process from cnv/loh, both dense and full
	const svlst=[] 


	// map sv/cnv to view range, exclude unmappable stuff
	tk.samplegroups=[]
	for( const samplegroup of tk._data) {

		const g2={}
		for(const k in samplegroup) g2[k]=samplegroup[k]
		g2.samples=[]

		for( const sample of samplegroup.samples ) {

			const s2={}
			for(const k in sample) s2[k]=sample[k]
			s2.items=[]

			for(const item of sample.items) {

				if(item.dt==common.dtsv || item.dt==common.dtfusionrna) {
					// sv
					map_sv_2(item,block)
					if(item.x==undefined) {
						console.log('unmappable sv: '+item._chr+' '+item._pos)
						continue
					}


					if(item.chrA!=item._chr){
						tk.legend_svchrcolor.interchrs.add(item.chrA)
						tk.legend_svchrcolor.colorfunc(item.chrA)
					}
					if(item.chrB!=item._chr){
						tk.legend_svchrcolor.interchrs.add(item.chrB)
						tk.legend_svchrcolor.colorfunc(item.chrB)
					}

					if(tk.isdense) {
						const i= {
							_samplegroup:samplegroup,
							_sample:sample,
						}
						for(const k in item) {
							i[k]=item[k]
						}
						svlst.push(i)
						continue
					}

					// not dense
					s2.items.push(item)

					continue
				}

				// cnv
				map_cnv( item, block )
				if(item.x1==undefined || item.x2==undefined) {
					console.log('unmappable cnv: ',item)
					continue
				}
				s2.items.push(item)
			}
			if(s2.items.length==0) continue
			g2.samples.push(s2)
		}
		if(g2.samples.length==0) continue
		tk.samplegroups.push(g2)
	}


	if(tk.data_vcf) {
		// map vcf variants to view range
		for(const m of tk.data_vcf) {
			m._chr = m.chr
			m._pos = m.pos
			map_sv_2( m, block )
			delete m._chr
			delete m._pos
		}
	}


	// cnv/sv/vcf mapped, if in dense mode, sv moved from samplegroups to svlst
	// if there is anything to render
	if( tk.samplegroups.length+svlst.length == 0 && !tk.data_vcf) {
		tk.height_main=100
		return
	}

	if(tk.isfull) {
		// TODO change sv legend to type
		may_legend_svchr2(tk)
	}

	// show legend for mclass of vcf data
	may_legend_vcfmclass(tk)


	// if dense, draw vcf density and return height; otherwise variants are dispersed among samplegroup and won't affect tk height
	const vcfdensityheight = render_multi_vcfdensity( tk, block )

	// likewise for sv
	const svdensityheight = render_multi_svdensity( svlst, tk, block )

	// draw cnv bars, will draw sv and vcf if in full mode
	const cnvheight = render_multi_cnvloh( tk, block )

	multi_expressionstatus_ase_outlier(tk)

	const genebaraxisheight = render_multi_genebar(tk, block)

	// padding between sv/vcf, if both drawn
	const vcfsvpad = vcfdensityheight && svdensityheight ? 3 : 0

	// track top blank height
	let hpad = Math.max(
		block.labelfontsize,
		vcfdensityheight+svdensityheight + vcfsvpad,
		genebaraxisheight
		)
	// may increase hpad: don't allow tk label to overlap with density plot label
	if(vcfdensityheight) {
		hpad += Math.max( 0, block.labelfontsize*1.5 - (hpad-svdensityheight-vcfsvpad-vcfdensityheight/2) )
	} else if(svdensityheight) {
		hpad += Math.max( 0, block.labelfontsize*1.5 - (hpad-svdensityheight/2) )
	}

	tk.cnvleftg.transition().attr('transform','translate(0,'+hpad+')')
	tk.cnvmidg.transition().attr('transform','translate(0,'+hpad+')')
	tk.vcfdensityg.transition()
		.attr('transform','translate(0,'+(hpad-svdensityheight - vcfsvpad)+')')
	tk.svdensityg.transition().attr('transform','translate(0,'+hpad+')')
	tk.cnvrightg.transition().attr('transform','translate(0,'+hpad+')')

	{
		// if showing density plots, put labels
		const color='#858585'
		if(vcfdensityheight) {
			tk.vcfdensitylabelg
				.attr('transform','translate(0,'+(hpad-vcfdensityheight-vcfsvpad-svdensityheight)+')')
				.append('text')
				.text('SNV/indel density')
				.attr('text-anchor','end')
				.attr('x',block.tkleftlabel_xshift)
				.attr('y',vcfdensityheight/2)
				.attr('dominant-baseline','central')
				.attr('font-size', Math.min(block.labelfontsize,vcfdensityheight)-1 )
				.attr('font-family',client.font)
				.attr('fill',color)
				.each(function(){
					tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth,this.getBBox().width)
				})
			tk.vcfdensitylabelg.append('line')
				.attr('stroke',color)
				.attr('y2',vcfdensityheight)
				.attr('shape-rendering','crispEdges')
			tk.vcfdensitylabelg.append('line')
				.attr('stroke',color)
				.attr('shape-rendering','crispEdges')
				.attr('x1', -leftlabelticksize)
				.attr('y1',vcfdensityheight/2)
				.attr('y2',vcfdensityheight/2)
		}

		if(svdensityheight) {
			tk.svdensitylabelg
				.attr('transform','translate(0,'+(hpad-svdensityheight)+')')
				.append('text')
				.text('SV breakpoint density')
				.attr('text-anchor','end')
				.attr('x',block.tkleftlabel_xshift)
				.attr('y',svdensityheight/2)
				.attr('dominant-baseline','central')
				.attr('font-size', Math.min(block.labelfontsize, svdensityheight)-1 )
				.attr('font-family',client.font)
				.attr('fill',color)
				.each(function(){
					tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth,this.getBBox().width)
				})
			tk.svdensitylabelg.append('line')
				.attr('stroke',color)
				.attr('y2',svdensityheight)
				.attr('shape-rendering','crispEdges')
			tk.svdensitylabelg.append('line')
				.attr('stroke',color)
				.attr('shape-rendering','crispEdges')
				.attr('x1', -leftlabelticksize)
				.attr('y1',svdensityheight/2)
				.attr('y2',svdensityheight/2)
		}
	}

	tk.height_main = tk.toppad + hpad + cnvheight + tk.bottompad

	tk.config_handle
		.transition()
		.attr('text-anchor', genebaraxisheight ? 'end' : 'start')
		.attr('x', genebaraxisheight ? -(block.rpad) : 0)

	may_legend_samplegroup(tk, block)
}







function render_multi_vcfdensity( tk, block) {
	/*
	multi-sample
	native/custom
	dense
	*/
	if(!tk.isdense || !tk.data_vcf || tk.data_vcf.length==0) return 0

	// list of bins
	const binw=10 // pixel
	const bins=[]
	let x=0
	while(x<block.width) {
		bins.push({
			x1:x,
			x2:x+binw,
			lst:[]
		})
		x+=binw
	}
	x=block.width
	for(const p of block.subpanels) {
		x+=p.leftpad
		let b=0
		while(b<p.width) {
			bins.push({
				x1:x+b,
				x2:x+b+binw,
				lst:[]
			})
			b+=binw
		}
		x+=p.width
	}

	// m to bins
	for(const m of tk.data_vcf) {
		if(m.x==undefined) {
			// unmapped
			continue
		}
		for(const b of bins) {
			if(b.x1<=m.x && b.x2>=m.x) {
				b.lst.push(m)
				break
			}
		}
	}

	// group items in each bin
	for(const b of bins) {
		if(b.lst.length==0) continue
		const name2group = new Map()
		// k: mclass key
		// v: mlst[]

		for(const m of b.lst) {
			if(!name2group.has(m.class)) {
				name2group.set(m.class, [])
			}
			name2group.get(m.class).push(m)
		}
		const lst=[]
		for(const [ classname, mlst ] of name2group) {
			lst.push({
				name:  common.mclass[classname].label,
				items: mlst,
				color: common.mclass[classname].color
			})
		}
		lst.sort((i,j)=>j.items.length-i.items.length)
		b.groups = lst
	}


	let maxcount=0 // per group
	for(const b of bins) {
		if(!b.groups) continue
		for(const g of b.groups) {
			maxcount=Math.max(maxcount, g.items.length)
		}
	}

	let maxheight=0 // of all bins
	{
		const radius=4
		let mrd=0 // max radius
		const w=Math.pow(radius,2)*Math.PI // unit area
		if(maxcount<=3) {
			mrd=w * maxcount*.9
		} else if(maxcount<=10) {
			mrd=w * 5
		} else if(maxcount<=100) {
			mrd=w * 7
		} else {
			mrd=w * 10
		}
		const sf_discradius=scaleLinear()
			.domain([1,
				maxcount*.5+.1,
				maxcount*.6+.1,
				maxcount*.7+.1,
				maxcount*.8+.1,
				maxcount])
			.range([w,
				w+(mrd-w)*.8,
				w+(mrd-w)*.85,
				w+(mrd-w)*.9,
				w+(mrd-w)*.95,
				mrd])
		for(const b of bins) {
			if(!b.groups) continue
			for(const g of b.groups) {
				g.radius=Math.sqrt( sf_discradius( g.items.length )/Math.PI )
			}
			// offset of a bin determined by the total number of items
			b.offset=Math.sqrt( sf_discradius( b.lst.length )/Math.PI )
			const sumheight=b.groups.reduce((i,j)=>i+j.radius*2,0)
			maxheight = Math.max(maxheight, b.offset + sumheight)
		}
	}


	for(const b of bins) {
		if(!b.groups) continue

		const g=tk.vcfdensityg.append('g').attr('transform','translate('+((b.x1+b.x2)/2)+',0)')

		let y=b.offset
		for(const grp of b.groups) {
			y+=grp.radius
			g.append('circle')
				.attr('cy',-y)
				.attr('r',grp.radius)
				.attr('fill',grp.color)
				.attr('stroke','white')
			g.append('circle')
				.attr('cy',-y)
				.attr('r',grp.radius)
				.attr('fill','white')
				.attr('fill-opacity',0)
				.attr('stroke',grp.color)
				.attr('stroke-opacity',0)
				.attr('class','sja_aa_disckick')
				.on('mouseover',()=>{
					tooltip_vcfdense(grp, tk, block)
				})
				.on('mouseout',()=>{
					tk.tktip.hide()
				})
				.on('click',()=>{
					//click_svdense(grp, tk, block)
				})
			y+=grp.radius
		}
		g.append('line')
			.attr('y2',-b.offset)
			.attr('stroke', b.groups[0].color)
	}
	return maxheight
}





function render_multi_svdensity( svlst, tk,block) {
	/*
	multi-sample
	native/custom
	dense
	list of sv provided
	*/
	if(!tk.isdense || svlst.length==0) return 0

	// list of bins
	const binw=10 // pixel
	const bins=[]
	let x=0
	while(x<block.width) {
		bins.push({
			x1:x,
			x2:x+binw,
			lst:[]
		})
		x+=binw
	}
	x=block.width
	for(const p of block.subpanels) {
		x+=p.leftpad
		let b=0
		while(b<p.width) {
			bins.push({
				x1:x+b,
				x2:x+b+binw,
				lst:[]
			})
			b+=binw
		}
		x+=p.width
	}

	// sv to bins
	for(const sv of svlst) {
		for(const b of bins) {
			if(b.x1<=sv.x && b.x2>=sv.x) {
				b.lst.push(sv)
				break
			}
		}
	}

	// group items in each bin
	for(const b of bins) {
		if(b.lst.length==0) continue
		const name2group = new Map()
		const nonamelst=[]
		for(const i of b.lst) {
			if(i._samplegroup.name) {
				if(!name2group.has(i._samplegroup.name)) {
					name2group.set(i._samplegroup.name, [])
				}
				name2group.get(i._samplegroup.name).push(i)
			} else {
				nonamelst.push(i)
			}
		}
		const lst=[]
		if(nonamelst.length) {
			lst.push({ 
				items:nonamelst,
				color:svdensitynogroupcolor
				})
		}
		for(const [name,items] of name2group) {
			lst.push({
				name:  name,
				items: items,
				color: ( tk.samplegroupcolor ? tk.samplegroupcolor.color(name) : '#aaa')
			})
		}
		lst.sort((i,j)=>j.items.length-i.items.length)
		b.groups = lst
	}


	let maxcount=0 // per group
	for(const b of bins) {
		if(!b.groups) continue
		for(const g of b.groups) {
			maxcount=Math.max(maxcount, g.items.length)
		}
	}

	let maxheight=0 // of all bins
	{
		const radius=4
		let mrd=0 // max radius
		const w=Math.pow(radius,2)*Math.PI // unit area
		if(maxcount<=3) {
			mrd=w * maxcount*.9
		} else if(maxcount<=10) {
			mrd=w * 5
		} else if(maxcount<=100) {
			mrd=w * 7
		} else {
			mrd=w * 10
		}
		const sf_discradius=scaleLinear()
			.domain([1,
				maxcount*.5+.1,
				maxcount*.6+.1,
				maxcount*.7+.1,
				maxcount*.8+.1,
				maxcount])
			.range([w,
				w+(mrd-w)*.8,
				w+(mrd-w)*.85,
				w+(mrd-w)*.9,
				w+(mrd-w)*.95,
				mrd])
		for(const b of bins) {
			if(!b.groups) continue
			for(const g of b.groups) {
				g.radius=Math.sqrt( sf_discradius( g.items.length )/Math.PI )
			}
			// offset of a bin determined by the total number of items
			b.offset=Math.sqrt( sf_discradius( b.lst.length )/Math.PI )
			const h = b.groups.reduce((i,j)=>i+j.radius*2,0)
			maxheight = Math.max( maxheight, b.offset + h )
		}
	}


	for(const b of bins) {
		if(!b.groups) continue

		const g=tk.svdensityg.append('g').attr('transform','translate('+((b.x1+b.x2)/2)+',0)')

		let y=b.offset
		for(const grp of b.groups) {
			y+=grp.radius
			g.append('circle')
				.attr('cy',-y)
				.attr('r',grp.radius)
				.attr('fill',grp.color)
				.attr('stroke','white')
			g.append('circle')
				.attr('cy',-y)
				.attr('r',grp.radius)
				.attr('fill','white')
				.attr('fill-opacity',0)
				.attr('stroke',grp.color)
				.attr('stroke-opacity',0)
				.attr('class','sja_aa_disckick')
				.on('mouseover',()=>{
					tooltip_svdense(grp, tk, block)
				})
				.on('mouseout',()=>{
					tk.tktip.hide()
				})
				.on('click',()=>{
					click_svdense(grp, tk, block)
				})
			y+=grp.radius
		}
		g.append('line')
			.attr('y2',-b.offset)
			.attr('stroke', b.groups[0].color)
	}
	return maxheight
}





function render_multi_cnvloh(tk,block) {

	/*
	draws cnv & loh segments

	multi-sample
	official or custom
	full or dense
	*/

	{
		// get value cutoff for varying color of cnv or loh segments

		const gain=[], // log2ratio values
			loss=[],
			segmean=[] // segmean values

		for(const g of tk.samplegroups) {
			for(const s of g.samples) {
				for(const i of s.items) {
					if(i.dt==common.dtloh) {
						segmean.push(i.segmean)
						continue
					}
					if(i.dt==common.dtcnv) {
						if(i.value>0) gain.push(i.value)
						else loss.push(-i.value)
					}
				}
			}
		}
		const gainmaxvalue = common.getMax_byiqr(gain, novalue_max_cnvloh)
		const lossmaxvalue = -common.getMax_byiqr(loss, novalue_max_cnvloh)
		tk.cnvcolor.cnvmax = Math.max( gainmaxvalue, -lossmaxvalue )

		if(segmean.length) {
			tk.cnvcolor.segmeanmax= Math.max(...segmean)
		} else {
			tk.cnvcolor.segmeanmax=novalue_max_cnvloh
		}
	}



	let groupspace
	if(tk.isdense) {

		// densely plot sample rows
		tk.rowheight=1
		tk.rowspace=0
		groupspace=4

	} else if(tk.isfull) {

		/*
		not in use
		// dynamically set heights by number of samples
		const totalsample = tk.samplegroups.reduce( (i,j)=>i+j.samples.length, 0 )
		tk.rowheight = Math.min( 12, Math.max( 1, Math.ceil(400/totalsample) ) )
		tk.rowspace = totalsample > 300 ? 0 : 1
		*/

		// fixed fat row height in full mode
		tk.rowheight=8
		tk.rowspace=1
		groupspace=10
	}

	const grouplabelfontsize = block.labelfontsize - (tk.isfull ? 0 : 1)

	let yoff=groupspace

	for(const [groupidx, samplegroup] of tk.samplegroups.entries() ) {

		/*
		for each group (custom track has just 1)
		*/

		const thisgroupheight = samplegroup.samples.length * (tk.rowheight+tk.rowspace)

		// a group may have just 1 sample so height is smaller than label font size, need to have a ypad
		let thisgroupypad = 0
		if(thisgroupheight < grouplabelfontsize) {
			thisgroupypad = (grouplabelfontsize - thisgroupheight) / 2
		}

		if(samplegroup.name) {

			// the group's got a name, show name and border lines
			const color = tk.samplegroupcolor ? tk.samplegroupcolor.color(samplegroup.name) : '#0A7FA6'

			tk.cnvleftg.append('text')
				.attr('font-size', grouplabelfontsize)
				.attr('font-family', client.font)
				.attr('y', yoff + thisgroupypad + thisgroupheight/2)
				.attr('text-anchor','end')
				.attr('dominant-baseline','central')
				.attr('fill',color)
				.attr('x',block.tkleftlabel_xshift)
				.text(
					samplegroup.name
					+' ('+samplegroup.samples.length
					+( samplegroup.sampletotalnum ? ', '+Math.ceil(100*samplegroup.samples.length/samplegroup.sampletotalnum)+'%' : '')
					+')'
					)
				.each(function(){
					tk.leftLabelMaxwidth = Math.max( tk.leftLabelMaxwidth, this.getBBox().width )
				})
				.on('mouseover',()=>{
					tooltip_samplegroup( samplegroup, tk )
				})
				.on('mouseout',()=>{
					tk.tktip.hide()
				})
				.on('click',()=>{
					tk.tip2.showunder(d3event.target)
						.clear()
					click_samplegroup_showmenu( samplegroup, tk, block )
				})

			// v span
			tk.cnvleftg.append('line')
				.attr('y1', yoff + thisgroupypad)
				.attr('y2', yoff + thisgroupypad + thisgroupheight)
				.attr('stroke',color)
				.attr('shape-rendering','crispEdges')
			// tick
			tk.cnvleftg.append('line')
				.attr('y1', yoff + thisgroupypad + thisgroupheight/2)
				.attr('y2', yoff + thisgroupypad + thisgroupheight/2)
				.attr('x2', -leftlabelticksize)
				.attr('stroke',color)
				.attr('shape-rendering','crispEdges')
		}


		let yoff1 = yoff + thisgroupypad
		samplegroup.y = yoff1

		for( const sample of samplegroup.samples ) {
			
			/* for each sample from this group
			*/

			if(sample.samplename && tk.iscustom && tk.rowheight>=minlabfontsize) {
				// for custom track, show sample name since all of them are in one nameless group
				tk.cnvleftg.append('text')
					.text(sample.samplename)
					.attr('text-anchor','end')
					.attr('dominant-baseline','central')
					.attr('x',-5)
					.attr('y',yoff1+tk.rowheight/2)
					.attr('font-family',client.font)
					.attr('font-size',Math.min(15, Math.max(minlabfontsize,tk.rowheight)))
					.each(function(){
						tk.leftLabelMaxwidth=Math.max(tk.leftLabelMaxwidth,this.getBBox().width)
					})
			}

			const g = tk.cnvmidg.append('g')
				.attr('transform','translate(0,'+yoff1+')')

			////////////////////////
			//    jinghui nbl cell line mixed into st/nbl
			if(tk.isfull && sample.sampletype==hardcode_cellline) {
				g.append('rect')
					.attr('x',-5)
					.attr('y',0)
					.attr('width',5)
					.attr('height', tk.rowheight)
					.attr('fill','black')
					.attr('shape-rendering','crispEdges')
			}

			for( const item of sample.items ) {

				if(item.dt==common.dtsv || item.dt==common.dtfusionrna) {

					/////// sv
					// sv appears here in full mode, not in dense mode

					const otherchr= item.chrA==item._chr ? item.chrB : item.chrA

					const color = otherchr==item._chr ? intrasvcolor : tk.legend_svchrcolor.colorfunc(otherchr)

					g.append('circle')
						.attr('cx',item.x)
						.attr('cy',tk.rowheight/2)
						.attr('r', Math.max( minsvradius, 1+tk.rowheight/2) )
						.attr('fill',color)
						.attr('fill-opacity',0)
						.attr('stroke', color)
						.on('mouseover', ()=> {
							d3event.target.setAttribute('fill-opacity',1)
							tooltip_svitem_2( item, sample, samplegroup, tk )
							})
						.on('mouseout',()=>{
							d3event.target.setAttribute('fill-opacity',0)
							tk.tktip.hide()
						})
						.on('click',()=>{
							click_multi2single( null, item, sample, samplegroup, tk, block )
						})
					continue
				}

				/////// cnv or loh

				// segment color set by numeric value against a cutoff
				let color
				if(item.dt==common.dtloh) {
					if(item.segmean >= tk.cnvcolor.segmeanmax) {
						color=tk.cnvcolor.loh.str
					} else {
						color = 'rgba('+tk.cnvcolor.loh.r+','+tk.cnvcolor.loh.g+','+tk.cnvcolor.loh.b+','+(item.segmean/tk.cnvcolor.segmeanmax).toFixed(2)+')'
					}
				} else {
					// cnv
					if(item.value>0) {
						if(item.value >= tk.cnvcolor.cnvmax) {
							color = tk.cnvcolor.gain.str
						} else {
							color = 'rgba('+tk.cnvcolor.gain.r+','+tk.cnvcolor.gain.g+','+tk.cnvcolor.gain.b+','+(item.value/tk.cnvcolor.cnvmax).toFixed(2)+')'
						}
					} else {
						if(item.value <= -tk.cnvcolor.cnvmax) {
							color = tk.cnvcolor.loss.str
						} else {
							color = 'rgba('+tk.cnvcolor.loss.r+','+tk.cnvcolor.loss.g+','+tk.cnvcolor.loss.b+','+(-item.value/tk.cnvcolor.cnvmax).toFixed(2)+')'
						}
					}
				}

				// cnv/loh bar
				g.append('rect')
					.attr('x', Math.min(item.x1, item.x2) )
					.attr('width', Math.max( 1, Math.abs( item.x1-item.x2 ) ) )
					.attr('height', tk.rowheight )
					.attr('shape-rendering','crispEdges')
					.attr('stroke','none')
					.attr('class','sja_aa_skkick')
					.attr('fill', color)
					.on('mousemove',()=>{
						// get cursor x offset on block
						const x = d3mouse( tk.glider.node() )[0]
						tooltip_multi_cnvloh( item, sample, samplegroup, tk, block, x )
					})
					.on('mouseout',()=>{
						tk.tktip.hide()
					})
					.on('click',()=>{
					// FIXME prevent click while dragging
						click_multi2single( item, null, sample, samplegroup, tk, block )
					})

			}
			yoff1 += tk.rowheight + tk.rowspace
			// done a sample
		}
		yoff += thisgroupheight + thisgroupypad*2 + groupspace
		// done a group
	}

	if(tk.cnvcolor.cnvmax==novalue_max_cnvloh) {
		tk.cnvcolor.cnvlegend.div.style('display','none')
	} else {
		draw_colorscale_cnv(tk)
	}

	if(tk.cnvcolor.segmeanmax==novalue_max_cnvloh) {
		tk.cnvcolor.lohlegend.div.style('display','none')
	} else {
		draw_colorscale_loh(tk)
	}

	return yoff
}




function multi_expressionstatus_ase_outlier(tk) {
	/*
	multi-sample
	for all genes
	calculate expression status including ase and outlier, using Yu's data & method
	only do this when getting new data, or changing cutoffs
	*/
	if(!tk.samplegroups) return
	for(const g of tk.samplegroups) {
		if(!g.samples) continue
		for(const s of g.samples) {
			if(!s.expressionrank) continue
			for(const gene in s.expressionrank) {
				const v=s.expressionrank[gene]
				expressionstat.measure(v, tk.gecfg)
			}
		}
	}
}






function click_samplegroup_showmenu( samplegroup, tk, block ) {
	/*
	official only
	dense or full
	click sample group label in track display to show menu, not legend
	this group must already been shown
	*/
	tk.tip2.d.append('div')
		.style('margin','4px 10px')
		.style('font-size','.7em')
		.text(samplegroup.name)

	tk.tip2.d.append('div')
		.attr('class','sja_menuoption')
		.text('Hide')
		.on('click',()=>{
			tk.tip2.hide()
			tk.hiddensgnames.add( samplegroup.name )
			loadTk(tk, block)
		})

	tk.tip2.d.append('div')
		.attr('class','sja_menuoption')
		.text('Show only')
		.on('click',()=>{
			tk.tip2.hide()
			for(const g of tk._data) {
				if(g.name && g.name!='Unannotated' && g.name!=samplegroup.name) tk.hiddensgnames.add(g.name)
			}
			loadTk(tk, block)
		})
	
	if(tk.hiddensgnames.size) {
		tk.tip2.d.append('div')
			.attr('class','sja_menuoption')
			.text('Show all')
			.on('click',()=>{
				tk.tip2.hide()
				tk.hiddensgnames.clear()
				loadTk(tk, block)
			})
	}

	tk.tip2.d.append('div')
		.attr('class','sja_menuoption')
		.text('Table view')
		.on('click',()=>{
			tk.tip2.hide()
			click_samplegroup_showtable( samplegroup, tk, block )
		})
}





function may_legend_samplegroup(tk, block) {
	if(!tk.samplegroupcolor) {
		// official only
		return
	}

	tk.samplegroupcolor.row.style('display','block')
	tk.samplegroupcolor.holder.selectAll('*').remove()

	const shownamegroups = []
	for(const g of tk._data) {
		if(g.name && g.name!='Unannotated') {
			shownamegroups.push(g)
		}
	}
	if(shownamegroups.length>0) {

		for(const g of shownamegroups) {

			const cell = tk.samplegroupcolor.holder.append('div')
				.style('display','inline-block')
				.attr('class','sja_clb')
				.on('click',()=>{
					tk.tip2.showunder(d3event.target)
						.clear()
					if(tk.hiddensgnames.has(g.name)) {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Show')
							.on('click',()=>{
								tk.tip2.hide()
								tk.hiddensgnames.delete( g.name )
								loadTk(tk,block)
							})
					} else {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Hide')
							.on('click',()=>{
								tk.tip2.hide()
								tk.hiddensgnames.add( g.name )
								loadTk(tk,block)
							})
					}
					tk.tip2.d.append('div')
						.attr('class','sja_menuoption')
						.text('Show only')
						.on('click',()=>{
							tk.tip2.hide()
							for(const g2 of tk._data) {
								if(g2.name && g2.name!='Unannotated') tk.hiddensgnames.add(g2.name)
							}
							tk.hiddensgnames.delete( g.name )
							loadTk(tk,block)
						})
					if(tk.hiddensgnames.size) {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Show all')
							.on('click',()=>{
								tk.tip2.hide()
								tk.hiddensgnames.clear()
								loadTk(tk,block)
							})
					}
				})


			cell.append('div')
				.style('display','inline-block')
				.attr('class','sja_mcdot')
				.style('background', tk.samplegroupcolor.color(g.name) )
				.text(g.samples.length)
			cell.append('div')
				.style('display','inline-block')
				.style('color', tk.samplegroupcolor.color(g.name))
				.text(g.name)
		}
	}

	// hidden groups
	for(const name of tk.hiddensgnames) {
		const cell = tk.samplegroupcolor.holder.append('div')
			.style('display','inline-block')
			.attr('class','sja_clb')
			.style('text-decoration','line-through')
			.text(name)
			.on('click',()=>{
				// directly click to show
				tk.hiddensgnames.delete( name )
				loadTk(tk, block)
			})
	}
}







function render_multi_genebar( tk, block) {
	/*
	multi-sample
	native or custom
	dense or full
	*/
	if(tk.expressionrangelimit) {
		// too big to do it
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
	for(const g of tk.samplegroups) {
		for(const s of g.samples) {
			if(s.expressionrank) {
				for(const gene in s.expressionrank) {
					genes.add(gene)
				}
			}
		}
	}
	if(genes.size==0) {
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

	const barwidth=80

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

			if(s.expressionrank) {

				const v = s.expressionrank[usegene]
				if(v!=undefined) {

					const row = tk.cnvrightg.append('g').attr('transform','translate(0,'+y+')')

					const bar=row.append('rect')
						.attr('fill',  expressionstat.ase_color( v, tk.gecfg ) ) // bar color set by ase status
						.attr('width', barwidth * v.rank / maxvalue )
						.attr('height',tk.rowheight)
						.attr('shape-rendering','crispEdges')

					if(tk.isfull) {
						// only show dots for outlier status in full, not dense
						if(v.estat.outlier) {
							row.append('circle')
								.attr('cx',barwidth)
								.attr('cy',tk.rowheight/2)
								.attr('r',tk.rowheight/2)
								.attr('fill', tk.gecfg.outlier.color_outlier)
						} else if(v.estat.outlier_asehigh) {
							row.append('circle')
								.attr('cx',barwidth)
								.attr('cy',tk.rowheight/2)
								.attr('r',tk.rowheight/2)
								.attr('fill', tk.gecfg.outlier.color_outlier_asehigh)
						}
					}

					const barbg=row.append('rect')
						.attr('fill',  fpkmbarcolor_bg)
						.attr('fill-opacity',.1)
						.attr('width',barwidth)
						.attr('height',tk.rowheight)
						.attr('shape-rendering','crispEdges')
						.on('mouseover',()=>{
							tk.tktip
								.clear()
								.show(d3event.clientX, d3event.clientY)
							const lst=[{k:'sample',v:s.samplename}]
							if(g.name) {
								lst.push({k:'group',v:g.name})
							}
							lst.push({k:'rank',  v:client.ranksays(v.rank)})
							lst.push({k:tk.gecfg.datatype,  v:v.value})

							const table = client.make_table_2col(tk.tktip.d,lst)

							expressionstat.showsingleitem_table( v, tk.gecfg, table )

							barbg.attr('fill','orange')
						})
						.on('mouseout',()=>{
							tk.tktip.hide()
							barbg.attr('fill',fpkmbarcolor_bg)
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

							p.clicksample = (thissample, group, plot)=>{
								// click outlier sample to launch browser and show sv/cnv+expression rank for single sample
								const cnv={
									chr:plot.chr,
									start:plot.start,
									stop:plot.stop
								}
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
								click_multi2single( cnv, null, sample, samplegroup, tk, plot.block )
							}
							import('./block.mds.geneboxplot').then(_=>{
								_.init(p)
							})
						})
				}
			}
			y += tk.rowheight + tk.rowspace
		}
	}
	// axis label
	const axispad = 0
	const labelpad=3
	const ticksize = 5
	const fontsize=12
	const headg = tk.cnvrightg.append('g')
		.attr('transform','translate(0,-'+axispad+')')
	client.axisstyle({
		axis: headg.append('g').call( axisTop().scale(
			scaleLinear().domain([minvalue,maxvalue]).range([0,barwidth])
			)
			.tickValues([0,50,100])
			.tickSize(ticksize)
			),
		fontsize:fontsize,
		showline:1
	})

	const text = headg.append('text')
		.attr('text-anchor','middle')
		.attr('x',barwidth/2)
		.attr('y',-(fontsize+labelpad+ticksize+axispad))
		.attr('font-family',client.font)
		.attr('font-size',fontsize)
		.text(usegene+' rank')

	text.attr('class','sja_clbtext')
	.on('click',()=>{

		const d=text.node().getBoundingClientRect()
		tk.tkconfigtip.clear()
			.show(d.left-100, d.top+d.height)

		genebar_config( tk.tkconfigtip.d, genes, tk, block )
	})

	return fontsize+fontsize+labelpad+ticksize+axispad
}




function genebar_config( holder, genes, tk, block ) {
	
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
		let usegene
		if(tk.selectedgene && genes.has(tk.selectedgene)) {
			usegene = tk.selectedgene
		} else {
			usegene = [...genes][0]
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




function draw_colorscale_cnv( tk ) {
	tk.cnvcolor.cnvlegend.div.style('display','inline-block')
	client.axisstyle({
		axis: tk.cnvcolor.cnvlegend.axisg.call(
			axisTop().scale(
				scaleLinear().domain([-tk.cnvcolor.cnvmax, 0, tk.cnvcolor.cnvmax])
				.range([0, tk.cnvcolor.cnvlegend.barw, tk.cnvcolor.cnvlegend.barw*2] )
			)
			.tickValues([-tk.cnvcolor.cnvmax, 0, tk.cnvcolor.cnvmax])
			.tickSize( tk.cnvcolor.cnvlegend.axistickh )
		)
	})
}



function draw_colorscale_loh( tk ) {
	tk.cnvcolor.lohlegend.div.style('display','inline-block')
	client.axisstyle({
		axis: tk.cnvcolor.lohlegend.axisg.call(
			axisTop().scale(
				scaleLinear().domain([0, tk.cnvcolor.segmeanmax])
				.range([0, tk.cnvcolor.lohlegend.barw] )
			)
			.tickValues([ 0, tk.cnvcolor.segmeanmax])
			.tickSize( tk.cnvcolor.lohlegend.axistickh )
		)
	})
}




function svdense_tolist(lst) {
	const k2item=new Map()
	for(const i of lst) {
		const k=i.sample+'.'+i.chrA+'.'+i.posA+'.'+i.strandA+'.'+i.chrB+'.'+i.posB+'.'+i.strandB
		k2item.set(k, i)
	}
	return [...k2item.values()]
}




function tooltip_svdense(g, tk, block) {
	tk.tktip.clear()
		.show(d3event.clientX,d3event.clientY)
	const hold=tk.tktip.d
	const svlst=svdense_tolist(g.items)
	if(svlst.length==1) {
		const i=svlst[0]
		hold.append('div')
			.html(i.sample+ (i._samplegroup.name ? ' <span style="font-size:.8em">'+i._samplegroup.name+'</span>' : ''))
			.style('margin-bottom','10px')
		hold.append('div')
			.html(
				svchr2html(i.chrA, tk)
				+':'+i.posA+':'+i.strandA
				+' &raquo; '
				+svchr2html(i.chrB, tk)
				+':'+i.posB+':'+i.strandB
				+( i.dt==common.dtfusionrna? ' (RNA fusion)' : '')
			)
		return
	}
	const lst=[
		{k:'cancer',v:g.name},
		{k:'# of SV',v:svlst.length}
	]
	client.make_table_2col( hold, lst )
}




function tooltip_vcfdense(g, tk, block) {
	tk.tktip.clear()
		.show(d3event.clientX,d3event.clientY)
	const hold=tk.tktip.d
	hold.append('div').text(g.items.length)
}




function click_svdense(g, tk, block) {
	/*
	multi-sample
	native/custom
	dense
	clicking on a ball representing density of sv breakend
	*/
	const svlst=svdense_tolist(g.items)
	if(svlst.length==1) {
		const i=svlst[0]
		click_multi2single( null, i, i._sample, i._samplegroup, tk, block )
		return
	}
	const pane = client.newpane({x:d3event.clientX,y:d3event.clientY})
	pane.header.html(g.name+' <span style="font-size:.8em">'+tk.name+'</span>')
	const sample2lst=new Map()
	for(const i of svlst) {
		if(!sample2lst.has(i.sample)) sample2lst.set(i.sample, [])
		sample2lst.get(i.sample).push(i)
	}
	const table=pane.body.append('table')
		.style('border-spacing','2px')
		.style('margin','10px')
	const tr=table.append('tr')
	tr.append('td')
		.text('Sample')
		.style('font-size','.8em')
		.style('color','#858585')
	tr.append('td')
		.text('SV')
		.style('font-size','.8em')
		.style('color','#858585')
	
	let j=0
	for(const [sample,lst] of sample2lst) {
		const tr=table.append('tr')
		if(!(j++%2)) {
			tr.style('background','#f1f1f1')
		}

		tr.append('td').text(sample)
		const td=tr.append('td')
		for(const i of lst) {
			td.append('div')
				.attr('class','sja_clbtext')
				.html(
					svchr2html(i.chrA, tk)
					+':'+i.posA+':'+i.strandA
					+' &raquo; '
					+svchr2html(i.chrB, tk)
					+':'+i.posB+':'+i.strandB
					+( i.dt==common.dtfusionrna? ' (RNA fusion)' : '')
					)
				.on('click',()=>{
					click_multi2single(null, i, i._sample, i._samplegroup, tk, block)
				})
		}
	}
}







function click_multi2single( cnv, sv, sample, samplegroup, tk, block ) {
	/*
	multi-sample
	native or custom
	click cnv/loh or sv but not both, launch a new block instance, show sv-cnv track in single-sample mode,
	and expression rank
	view range determined by cnv or sv

	no return value
	*/

	const pane = client.newpane({x:100, y:100})
	const arg={
		tklst:[],
		holder:pane.body,
		subpanels:[]
	}
	client.first_genetrack_tolist( block.genome, arg.tklst )


	// expression rank
	if(tk.iscustom) {
		if(tk.checkexpressionrank) {
			const et = {
				type: client.tkt.mdsexpressionrank,
				name: sample.samplename+' expression rank',
				sample: sample.samplename,
				iscustom:1,
			}
			for(const k in tk.checkexpressionrank) {
				et[k]=tk.checkexpressionrank[k]
			}
			arg.tklst.push(et)
		}
	} else if(tk.mds && tk.mds.queries[tk.querykey].checkexpressionrank) {
		// add expression rank via official mds
		const et = {
			type: client.tkt.mdsexpressionrank,
			name: sample.samplename+' expression rank',
			mds:tk.mds,
			querykey: tk.mds.queries[tk.querykey].checkexpressionrank.querykey,
			sample: sample.samplename,
			attributes: samplegroup.attributes
		}
		arg.tklst.push(et)
	}

	// add sv-cnv track in single-sample mode
	const t2 = {
		cnvheight:40,
		midpad:3,
		stem1:10,
		stem2:0,
		stem3:5,
		legheight:40,
		discradius:8,
		bplengthUpperLimit:tk.bplengthUpperLimit,
		valueCutoff:tk.valueCutoff,
		lohLengthUpperLimit:tk.lohLengthUpperLimit,
		segmeanValueCutoff:tk.segmeanValueCutoff,
		singlesample:{
			name:sample.samplename
		}
	}
	if(tk.iscustom) {
		t2.type=client.tkt.mdssvcnv
		t2.file=tk.file
		t2.url=tk.url
		t2.indexURL=tk.indexURL
	} else {
		// official
		t2.mds = tk.mds
		t2.querykey = tk.querykey
		for(const k in tk.mds.queries[tk.querykey]) {
			if(k=='bplengthUpperLimit' || k=='valueCutoff') {
				// do not use default
				continue
			}
			t2[k] = tk.mds.queries[tk.querykey][k]
		}
	}
	arg.tklst.push(t2)

	if(cnv) {
		const span = Math.ceil((cnv.stop-cnv.start)/2)
		arg.chr = cnv.chr
		arg.start = Math.max(0, cnv.start-span)
		arg.stop = Math.min( block.genome.chrlookup[cnv.chr.toUpperCase()].len, cnv.stop+span )
	} else if(sv) {
		if(sv.chrA==sv.chrB) {
			const span = Math.ceil(Math.abs(sv.posA-sv.posB)/4)
			arg.chr = sv.chrA
			arg.start = Math.max(0, Math.min(sv.posA, sv.posB)-span)
			arg.stop = Math.min( block.genome.chrlookup[sv.chrA.toUpperCase()].len, Math.max(sv.posA,sv.posB)+span )
		} else {
			const span=10000
			arg.chr=sv.chrA
			arg.start=Math.max(0, sv.posA-span)
			arg.stop = Math.min( block.genome.chrlookup[sv.chrA.toUpperCase()].len, sv.posA+span )
			arg.subpanels.push({
				chr:sv.chrB,
				start: Math.max(0, sv.posB-span),
				stop: Math.min( block.genome.chrlookup[sv.chrB.toUpperCase()].len, sv.posB+span),
				width:600,
				leftpad:10,
				leftborder:'rgba(50,50,50,.1)'
			})
		}
	} else {
		const r = block.tkarg_maygm(tk)[0]
		arg.chr=r.chr
		arg.start=r.start
		arg.stop=r.stop
	}


	Promise.resolve()
	.then(()=>{
		if(tk.iscustom) {
			// custom track, no serverside config
			return
		}

		// get sample-level track from serverside dataset config
		const par={
			jwt:block.jwt,
			genome:block.genome.name,
			dslabel:tk.mds.label,
			querykey:tk.querykey,
			gettrack4singlesample: sample.samplename
		}

		return fetch( new Request(block.hostURL+'/mdssvcnv', {
			method:'POST',
			body:JSON.stringify(par)
		}))
		.then(data=>{return data.json()})
		.then(data=>{

			if(data.error) throw({message:data.error})
			if(data.tracks) {
				for(const t of data.tracks) {
					arg.tklst.push( t )
				}
			}
		})
	})
	.catch(err=>{
		client.sayerror(pane.body, err.message)
		if(err.stack) console.log(err.stack)
	})
	.then(()=>{

		const bb = block.newblock(arg)

		if(block.debugmode) {
			window.bbb=bb
		}
		if(cnv) {
			bb.addhlregion( cnv.chr, cnv.start, cnv.stop, cnvhighlightcolor )
		}
		// done launching single-sample view from multi-sample
	})
}







////////////////////// __multi ends






















/////////////  __maketk



function makeTk(tk, block) {

	tk.tip2 = new client.Menu({padding:'0px'})

	if(!tk.attrnamespacer) {
		// fill in for custom track
		tk.attrnamespacer=', '
	}

	if(tk.singlesample) {

		tk.tklabel.text( (tk.name? tk.name+', ' : '') + tk.singlesample.name )
		tk.label_sv= tk.gleft.append('text')
			.attr('text-anchor','end')
			.attr('x',block.tkleftlabel_xshift)
			.attr('dominant-baseline','central')
			.attr('font-size',block.labelfontsize)
			.attr('font-family',client.font)

		tk.axis_label_cnv = tk.gleft.append('text')
			.attr('text-anchor','end')
			.attr('x',block.tkleftlabel_xshift)
			.attr('dominant-baseline','central')
			.attr('font-size',block.labelfontsize)
			.attr('font-family',client.font)
		tk.axis_label_loh = tk.gright.append('text')
			.attr('x',1)
			.attr('dominant-baseline','central')
			.attr('font-size',block.labelfontsize)
			.attr('font-family',client.font)

		tk.axisg_cnvleft = tk.gleft.append('g') // for log ratio
		tk.axisg_lohright = tk.gright.append('g') // for segmean
		tk.sv_g=tk.glider.append('g') // show sv as lollipops
		tk.cnv_g=tk.glider.append('g') // show cnv/loh as bed track

	} else {

		// multi-sample
		tk.tklabel.text( tk.name )
		tk.isdense=true
		tk.isfull=false
		tk.cnvleftg= tk.gleft.append('g')
		tk.vcfdensityg = tk.glider.append('g')
		tk.vcfdensitylabelg = tk.gleft.append('g')
		tk.svdensityg = tk.glider.append('g')
		tk.svdensitylabelg = tk.gleft.append('g')
		tk.cnvmidg = tk.glider.append('g')
		tk.cnvrightg = tk.gright.append('g')
	}

	tk.cnvcolor={}

	{
		const t = d3rgb(tk.gaincolor)
		tk.cnvcolor.gain = {
			str: tk.gaincolor,
			r: t.r,
			g: t.g,
			b: t.b
		}
		delete tk.gaincolor
	}
	{
		const t = d3rgb(tk.losscolor)
		tk.cnvcolor.loss = {
			str: tk.losscolor,
			r: t.r,
			g: t.g,
			b: t.b
		}
		delete tk.losscolor
	}
	{
		const t = d3rgb(tk.lohcolor)
		tk.cnvcolor.loh = {
			str: tk.lohcolor,
			r: t.r,
			g: t.g,
			b: t.b
		}
		delete tk.lohcolor
	}


	// config
	tk.config_handle = block.maketkconfighandle(tk)
		.on('click', ()=>{
			configPanel(tk, block)
		})


	const [tr,td] = legend_newrow(block,tk.name)
	tk.tr_legend = tr
	tk.td_legend = td


	{
		// cnv/loh color scale showing in legend, only for multi-sample
		const fontsize = 14
		const xpad = 15
		const barh = 20
		let leftpad = 50


		//// cnv color legend

		tk.cnvcolor.cnvlegend = {
			axistickh:4,
			barw:55
		}

		tk.cnvcolor.cnvlegend.div=td.append('div')
			.style('margin','10px')
		tk.cnvcolor.cnvlegend.div.append('div')
			.style('display','inline-block')
			.style('color','#858585')
			.text('CNV log2(ratio)')

		{
			const svg = tk.cnvcolor.cnvlegend.div.append('svg')
				.attr('width', (leftpad+tk.cnvcolor.cnvlegend.barw)*2)
				.attr('height',fontsize+tk.cnvcolor.cnvlegend.axistickh+barh)

			tk.cnvcolor.cnvlegend.axisg = svg.append('g')
				.attr('transform','translate('+leftpad+','+(fontsize+tk.cnvcolor.cnvlegend.axistickh)+')')

			const gain_id = Math.random().toString()
			const loss_id = Math.random().toString()

			const defs = svg.append('defs')
			{
				// loss
				const grad = defs.append('linearGradient')
					.attr('id', loss_id)
				tk.cnvcolor.cnvlegend.loss_stop = grad.append('stop')
					.attr('offset','0%')
					.attr('stop-color', tk.cnvcolor.loss.str)
				grad.append('stop')
					.attr('offset','100%')
					.attr('stop-color', 'white')
			}
			{
				// gain
				const grad = defs.append('linearGradient')
					.attr('id', gain_id)
				grad.append('stop')
					.attr('offset','0%')
					.attr('stop-color', 'white')
				tk.cnvcolor.cnvlegend.gain_stop = grad.append('stop')
					.attr('offset','100%')
					.attr('stop-color', tk.cnvcolor.gain.str)
			}

			svg.append('rect')
				.attr('x',leftpad)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh)
				.attr('width', tk.cnvcolor.cnvlegend.barw)
				.attr('height',barh)
				.attr('fill', 'url(#'+loss_id+')')

			svg.append('rect')
				.attr('x', leftpad+tk.cnvcolor.cnvlegend.barw)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh)
				.attr('width', tk.cnvcolor.cnvlegend.barw)
				.attr('height',barh)
				.attr('fill', 'url(#'+gain_id+')')

			svg.append('text')
				.attr('x',leftpad-5)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh+barh/2)
				.attr('font-family',client.font)
				.attr('font-size',fontsize)
				.attr('text-anchor','end')
				.attr('dominant-baseline','central')
				.attr('fill','black')
				.text('Loss')
			svg.append('text')
				.attr('x', leftpad+tk.cnvcolor.cnvlegend.barw*2+5)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh+barh/2)
				.attr('font-family',client.font)
				.attr('font-size',fontsize)
				.attr('dominant-baseline','central')
				.attr('fill','black')
				.text('Gain')
		}


		//// loh color legend

		leftpad=20

		tk.cnvcolor.lohlegend = {
			axistickh:4,
			barw:55
		}

		tk.cnvcolor.lohlegend.div=td.append('div')
			.style('margin','10px')
		tk.cnvcolor.lohlegend.div.append('div')
			.style('display','inline-block')
			.style('color','#858585')
			.text('LOH seg.mean')

		{
			const svg = tk.cnvcolor.lohlegend.div.append('svg')
				.attr('width', (leftpad+tk.cnvcolor.lohlegend.barw)*2)
				.attr('height',fontsize+tk.cnvcolor.lohlegend.axistickh+barh)

			tk.cnvcolor.lohlegend.axisg = svg.append('g')
				.attr('transform','translate('+leftpad+','+(fontsize+tk.cnvcolor.lohlegend.axistickh)+')')

			const loh_id = Math.random().toString()

			const defs = svg.append('defs')
			{
				// gain mock segmean
				const grad = defs.append('linearGradient')
					.attr('id', loh_id)
				grad.append('stop')
					.attr('offset','0%')
					.attr('stop-color', 'white')
				tk.cnvcolor.lohlegend.loh_stop = grad.append('stop')
					.attr('offset','100%')
					.attr('stop-color', tk.cnvcolor.loh.str)
			}


			svg.append('rect')
				.attr('x', leftpad)
				.attr('y',fontsize+tk.cnvcolor.lohlegend.axistickh)
				.attr('width', tk.cnvcolor.lohlegend.barw)
				.attr('height',barh)
				.attr('fill', 'url(#'+loh_id+')')
		}

	}

	if(!tk.singlesample && !tk.iscustom) {
		// official, not single sample

		tk.hiddensgnames = new Set()

		// sample group color for sv density
		const row=td.append('div')
			.style('display','none')
			.style('margin','10px')
		row.append('div')
			.style('color','#858585')
			.style('display','inline-block')
			.text('Cancer')
		tk.samplegroupcolor={
			color:scaleOrdinal(schemeCategory20),
			row:row,
			holder:row.append('div')
				.style('display','inline-block')
				.style('margin-left','10px')
		}
	}

	{
		const row=td.append('div')
				.style('margin','10px')
		tk.legend_svchrcolor={
			row:row,
			interchrs:new Set(),
			colorfunc: scaleOrdinal(schemeCategory20)
			//color:new Map()
		}
		row.append('div')
			.style('display','inline-block')
			.text('SV chromosome')
			.style('color','#858585')
		tk.legend_svchrcolor.holder=row.append('div')
			.style('display','inline-block')
			.style('margin','5px')
	}

	// gene expression config

	let hasexpression = false
	if(tk.iscustom) {
		// custom
		if(tk.checkexpressionrank) {
			hasexpression = true
			tk.gecfg = {
				datatype: tk.checkexpressionrank.datatype
			}
		}
	} else {
		// official
		if(tk.mds.queries[tk.querykey].checkexpressionrank) {
			hasexpression=true
			tk.gecfg = tk.mds.queries[ tk.mds.queries[tk.querykey].checkexpressionrank.querykey ]
		}
	}
	if(hasexpression) {
		/* inherit configs from official tk, if not, rebuild
		this can make sure the same configurations are also available under the dataset.queries.genefpkm
		allowing it to be shared for boxplots etc.
		*/
		if(!tk.gecfg) tk.gecfg={}

		expressionstat.init_config( tk.gecfg )
	}


	// end of makeTk
}





function may_legend_svchr(tk) {
	if(tk.legend_svchrcolor.interchrs.size==0) return
	tk.legend_svchrcolor.row.style('display','block')
	const color=scaleOrdinal( tk.legend_svchrcolor.interchrs.size>10 ? schemeCategory20 : schemeCategory10 )
	tk.legend_svchrcolor.holder.selectAll('*').remove()
	for(const chr of tk.legend_svchrcolor.interchrs) {
		tk.legend_svchrcolor.color.set( chr, color(chr) )
		const d=tk.legend_svchrcolor.holder.append('div')
			.style('display','inline-block')
			.style('margin','3px 10px 3px 0px')
		d.append('div')
			.style('display','inline-block')
			.style('border-radius','10px')
			.style('padding','0px 10px')
			.style('border','solid 1px ' + color(chr) )
			.style('color', color(chr) )
			.style('font-size','.9em')
			.text(chr)
	}
}




function may_legend_svchr2(tk) {
	if(tk.legend_svchrcolor.interchrs.size==0) return
	tk.legend_svchrcolor.row.style('display','block')
	tk.legend_svchrcolor.holder.selectAll('*').remove()
	for(const chr of tk.legend_svchrcolor.interchrs) {
		const color=tk.legend_svchrcolor.colorfunc(chr)
		const d=tk.legend_svchrcolor.holder.append('div')
			.style('display','inline-block')
			.style('margin','3px 10px 3px 0px')
		d.append('div')
			.style('display','inline-block')
			.style('border-radius','10px')
			.style('padding','0px 10px')
			.style('border','solid 1px ' + color )
			.style('color', color )
			.style('font-size','.9em')
			.text(chr)
	}
}




function may_legend_vcfmclass(tk) {
}







function multi_changemode(tk, block) {
	tk.tkconfigtip.hide()
	if(tk.mode_radio_1.property('checked')) {
		tk.isdense=true
		tk.isfull=false
	} else if(tk.mode_radio_2.property('checked')) {
		tk.isdense=false
		tk.isfull=true
	}
	render_samplegroups(tk,block)
	block.block_setheight()
	block.setllabel()
}





function configPanel(tk, block) {
	tk.tkconfigtip.clear()
		.showunder(tk.config_handle.node())

	const holder=tk.tkconfigtip.d

	if(!tk.singlesample) {

		// multi-sample modes

		const div=holder.append('div')
			.style('background','#FAF9DE')
			.style('margin-bottom','20px')
			.style('padding','15px')

		const id1=Math.random().toString()
		const id2=Math.random().toString()
		const name=Math.random().toString()
		const row1=div.append('div')
			.style('margin-bottom','5px')
		tk.mode_radio_1=row1.append('input')
			.attr('type','radio')
			.attr('id',id1)
			.attr('name',name)
			.property('checked', tk.isdense)
			.on('change',()=>{
				multi_changemode( tk, block )
			})
		row1.append('label')
			.attr('for',id1)
			.attr('class','sja_clbtext')
			.html('&nbsp;Compact <span style="font-size:.7em;color:#858585;">Showing SV breakpoint density, independently from CNV/LOH</span>')

		const row2=div.append('div')
		tk.mode_radio_2=row2.append('input')
			.attr('type','radio')
			.attr('id',id2)
			.attr('name',name)
			.property('checked', tk.isfull)
			.on('change',()=>{
				multi_changemode( tk, block )
			})
		row2.append('label')
			.attr('for',id2)
			.attr('class','sja_clbtext')
			.html('&nbsp;Expanded <span style="font-size:.7em;color:#858585;">Showing SV together with CNV/LOH for each sample</span>')
	}


	// for official track, allow search for sample
	if(!tk.iscustom) {
		// show in both multi- or single-sample
		const row=holder.append('div').style('margin-bottom','5px')
		row.append('input')
			.attr('size',20)
			.attr('placeholder', 'Find sample')
			.on('keyup',()=>{

				row2.selectAll('*').remove()
				
				const str = d3event.target.value
				if(!str) return

				const par={
					jwt:block.jwt,
					genome:block.genome.name,
					dslabel:tk.mds.label,
					querykey:tk.querykey,
					findsamplename: str
				}
				return fetch( new Request(block.hostURL+'/mdssvcnv', {
					method:'POST',
					body:JSON.stringify(par)
				}))
				.then(data=>{return data.json()})
				.then(data=>{

					if(data.error) throw({message:data.error})
					if(data.result) {
						for(const sample of data.result) {

							const cell= row2.append('div')
							cell.append('span')
								.text(sample.name)

							if(sample.attributes) {
								const groupname = sample.attributes.map(i=>i.kvalue).join( tk.attrnamespacer )
								cell.append('div')
									.style('display','inline-block')
									.style('margin-left','10px')
									.style('font-size','.7em')
									.style('color', tk.samplegroupcolor.color( groupname ) )
									.html( groupname )
							}

							cell
								.attr('class','sja_menuoption')
								.on('click',()=>{
									click_multi2single(
										null,
										null,
										{samplename:sample.name},
										sample.group,
										tk,
										block
									)
								})
						}
					}
				})
				.catch(err=>{
					client.sayerror(row2, err.message)
					if(err.stack) console.log(err.stack)
				})
			})

		const row2=holder.append('div').style('margin-bottom','15px')
		holder.append('hr').style('margin','20px')
	}


	// filter cnv with sv
	{
		const row=holder.append('div').style('margin-bottom','15px')
		const id = Math.random().toString()
		row.append('input')
			.attr('type','checkbox')
			.attr('id', id)
			.property( 'checked', tk.showonlycnvwithsv )
			.on('change',()=>{
				tk.showonlycnvwithsv = d3event.target.checked
				loadTk(tk, block)
			})
		row.append('label')
			.attr('for',id)
			.html('&nbsp;Show only CNV with SV support')
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('SV breakpoint must be inside a CNV or within its 1 Kb flanking.')
	}

	// cnv log2 ratio
	{
		const row=holder.append('div').style('margin-bottom','15px')
		row.append('span').html('CNV log2(ratio) cutoff&nbsp;')
		row.append('input')
			.property( 'value', tk.valueCutoff || 0 )
			.attr('type','number')
			.style('width','50px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(tk.valueCutoff) {
						// cutoff has been set, cancel and refetch data
						tk.valueCutoff=0
						loadTk(tk,block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(tk.valueCutoff) {
					// cutoff has been set
					if(tk.valueCutoff==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.valueCutoff=v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.valueCutoff=v
					loadTk(tk, block)
				}
			})
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Only show CNV with absolute log2(ratio) no less than cutoff.<br>Set to 0 to cancel.')
	}

	// focal cnv
	{
		const row=holder.append('div').style('margin-bottom','15px')
		row.append('span')
			.html('CNV segment size limit&nbsp;')
		row.append('input')
			.property('value',tk.bplengthUpperLimit || 0)
			.attr('type','number')
			.style('width','80px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v = Number.parseInt(d3event.target.value)
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(tk.bplengthUpperLimit) {
						// cutoff has been set, cancel and refetch data
						tk.bplengthUpperLimit=0
						loadTk(tk,block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(tk.bplengthUpperLimit) {
					// cutoff has been set
					if(tk.bplengthUpperLimit==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.bplengthUpperLimit=v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.bplengthUpperLimit=v
					loadTk(tk, block)
				}
			})
		row.append('span').text('bp')
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Limit the CNV segment length to show only focal events.<br>Set to 0 to cancel.')
	}

	// cnv color
	{
		const row=holder.append('div')
		row.append('span')
			.html('Copy number gain&nbsp;')
		row.append('input')
			.attr('type','color')
			.property('value',tk.cnvcolor.gain.str)
			.on('change',()=>{
				tk.cnvcolor.gain.str=d3event.target.value
				const c = d3rgb(tk.cnvcolor.gain.str)
				tk.cnvcolor.gain.r = c.r
				tk.cnvcolor.gain.g = c.g
				tk.cnvcolor.gain.b = c.b
				if(tk.singlesample) {
					render_singlesample(tk,block)
				} else {
					tk.cnvcolor.cnvlegend.gain_stop.attr('stop-color', tk.cnvcolor.gain.str)
					render_samplegroups(tk, block)
				}
			})
		row.append('span').html('&nbsp;&nbsp;loss&nbsp;')
		row.append('input')
			.attr('type','color')
			.property('value',tk.cnvcolor.loss.str)
			.on('change',()=>{
				tk.cnvcolor.loss.str=d3event.target.value
				const c = d3rgb(tk.cnvcolor.loss.str)
				tk.cnvcolor.loss.r = c.r
				tk.cnvcolor.loss.g = c.g
				tk.cnvcolor.loss.b = c.b
				if(tk.singlesample) {
					render_singlesample(tk,block)
				} else {
					tk.cnvcolor.cnvlegend.loss_stop.attr('stop-color', tk.cnvcolor.loss.str)
					render_samplegroups(tk, block)
				}
			})
	}

	holder.append('hr').style('margin','20px')


	// loh segmean cutoff
	{
		const row=holder.append('div')
			.style('margin-bottom','15px')
		row.append('span').html('LOH seg.mean cutoff&nbsp;')
		row.append('input')
			.property( 'value', tk.segmeanValueCutoff || 0 )
			.attr('type','number')
			.style('width','50px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(tk.segmeanValueCutoff) {
						// cutoff has been set, cancel and refetch data
						tk.segmeanValueCutoff=0
						loadTk(tk,block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(tk.segmeanValueCutoff) {
					// cutoff has been set
					if(tk.segmeanValueCutoff==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.segmeanValueCutoff=v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.segmeanValueCutoff=v
					loadTk(tk, block)
				}
			})
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Only show LOH with seg.mean no less than cutoff.<br>Set to 0 to cancel.')
	}

	// focal loh
	{
		const row=holder.append('div').style('margin-bottom','15px')
		row.append('span')
			.html('LOH segment size limit&nbsp;')
		row.append('input')
			.property('value',tk.lohLengthUpperLimit || 0)
			.attr('type','number')
			.style('width','80px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v = Number.parseInt(d3event.target.value)
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(tk.lohLengthUpperLimit) {
						// cutoff has been set, cancel and refetch data
						tk.lohLengthUpperLimit=0
						loadTk(tk,block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(tk.lohLengthUpperLimit) {
					// cutoff has been set
					if(tk.lohLengthUpperLimit==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.lohLengthUpperLimit=v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.lohLengthUpperLimit=v
					loadTk(tk, block)
				}
			})
		row.append('span').text('bp')
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Limit the LOH segment length to show only focal events.<br>Set to 0 to cancel.')
	}

	// loh color
	{
		const row=holder.append('div').style('margin-bottom','1px')
		row.append('span')
			.html('LOH color&nbsp;')
		row.append('input')
			.attr('type','color')
			.property('value',tk.cnvcolor.loh.str)
			.on('change',()=>{
				tk.cnvcolor.loh.str=d3event.target.value
				const c = d3rgb(tk.cnvcolor.loh.str)
				tk.cnvcolor.loh.r = c.r
				tk.cnvcolor.loh.g = c.g
				tk.cnvcolor.loh.b = c.b
				if(tk.singlesample) {
					render_singlesample(tk,block)
				} else {
					tk.cnvcolor.lohlegend.loh_stop.attr('stop-color', tk.cnvcolor.loh.str)
					render_samplegroups(tk, block)
				}
			})
	}

	// end of config
}




/////////////  __maketk ENDS















function map_cnv(item,block) {
	const lst=[]
	const main=block.tkarg_maygm(block.tklst[0])[0]
	if(item.chr==main.chr && Math.max(item.start,main.start)<Math.min(item.stop,main.stop)) {
		item.x1=block.seekcoord(item.chr, Math.max(item.start,main.start))[0].x
		item.x2=block.seekcoord(item.chr, Math.min(item.stop,main.stop))[0].x
	}
	let x=block.width
	for(const p of block.subpanels) {
		x+=p.leftpad
		if(item.chr==p.chr && Math.max(item.start,p.start)<Math.min(item.stop,p.stop)) {
			const x1=x+(Math.max(item.start,p.start)-p.start)*p.exonsf
			const x2=x+(Math.min(item.stop,p.stop)-p.start)*p.exonsf
			if(item.x1==undefined) {
				item.x1=x1
				item.x2=x2
			} else {
				item.x2=x2
			}
		}
		x+=p.width
	}
	return
	const r1 = block.seekcoord(item.chr, item.start)[0]
	if(r1) {
		if(r1.ridx!=undefined) {
			if(r1.x<0 || r1.x>block.width) {
				let x=block.width
				for(const p of block.subpanels) {
					x+=p.leftpad
					if(item.chr==p.chr && item.start<p.stop) {
						item.x1=x+(Math.max(item.start,p.start)-p.start)*p.exonsf
						break
					}
					x+=p.width
				}
				if(item.x1==undefined) {
					if(r1.x<0) item.x1=0
					else item.x1=block.width
				}
			}
		}
		if(item.x1==undefined) item.x1=r1.x
	} else {
		let x=block.width
		for(const [i,panel] of block.subpanels.entries()) {
			x+=panel.leftpad
			if(item.chr == panel.chr && item.start < panel.stop) {
				item.x1=x + ( Math.max(item.start,panel.start)-panel.start ) * panel.exonsf
				break
			}
			x+=panel.width
		}
	}
	const r2 = block.seekcoord(item.chr, item.stop)[0]
	if(r2) {
		if(r2.ridx!=undefined) {
			if(r2.x<0 || r2.x>block.width) {
				let x=block.width
				for(const p of block.subpanels) {
					x+=p.leftpad
					if(item.chr==p.chr && item.stop<p.start) {
						item.x2=x+(Math.min(item.stop,p.stop)-p.start)*p.exonsf
						break
					}
					x+=p.width
				}
				if(item.x2==undefined) {
					if(r2.x<0) item.x2=0
					else item.x2=block.width
				}
			}
		}
		if(item.x2==undefined) item.x2=r2.x
	} else {
		let x=block.width
		for(const panel of block.subpanels) {
			x+=panel.leftpad
			if(item.chr == panel.chr && item.stop > panel.start) {
				item.x2= x + ( Math.min(item.stop,panel.stop)-panel.start ) * panel.exonsf
				break
			}
			x+=panel.width
		}
	}
}



function map_sv_2(item,block) {
	const lst = block.seekcoord(item._chr, item._pos)
	for(const r of lst) {
		if(r.ridx!=undefined) {
			// in main, if outside won't show this end
			if(r.x>0 && r.x<block.width) {
				item.x = r.x
				break
			}
		} else if(r.subpanelidx!=undefined) {
			item.x = r.x
		}
	}
}



function map_sv(sv, block) {
	const lst1 = block.seekcoord(sv.chrA, sv.posA)
	for(const r of lst1) {
		if(r.ridx!=undefined) {
			// in main, if outside won't show this end
			if(r.x>0 && r.x<block.width) {
				sv.x0 = r.x
				break
			}
		} else if(r.subpanelidx!=undefined) {
			sv.x0 = r.x
		}
	}
	const lst2 = block.seekcoord(sv.chrB, sv.posB)
	for(const r of lst2) {
		if(r.ridx!=undefined) {
			// in main, if outside won't show this end
			if(r.x>0 && r.x<block.width) {
				sv.x1 = r.x
				break
			}
		} else if(r.subpanelidx!=undefined) {
			sv.x1 = r.x
		}
	}
}




function print_sv(s) {
	return s.chrA+':'+(s.posA+1)+':'+s.strandA+' &nbsp;&raquo;&nbsp; '+s.chrB+':'+(s.posB+1)+':'+s.strandB
		+ (s.type ? ' '+s.type : '')
}



function tooltip_samplegroup( g, tk ) {
	tk.tktip.clear()
		.show( d3event.clientX, d3event.clientY )

	const d = tk.tktip.d.append('div')
	
	if(g.attributes) {
		// official only
		for(let i=0; i<g.attributes.length; i++) {
			d.append('div')
				.style('margin-left', (i*20)+'px')
				.html( (i==0?'':'&raquo;&nbsp;') + (g.attributes[i].fullvalue || g.attributes[i].kvalue) )
		}
	} else if(g.name) {
		d.append('div').text(g.name)
	}

	const p= tk.tktip.d.append('div').style('margin-top','10px').style('color','#858585')
	p.html( g.samples.length+' sample'+(g.samples.length>1?'s':'')
		+ (g.sampletotalnum ?  '<br>'+g.sampletotalnum+' samples total, '+Math.ceil(100*g.samples.length/g.sampletotalnum)+'%' : ''))
}




function tooltip_multi_cnvloh( item, sample, samplegroup, tk, block, xoff ) {
	/*
	multi-sample
	native or custom
	dense or full
	mouse over a cnv or loh
	*/

	tk.tktip.clear()
		.show( d3event.clientX, d3event.clientY )

	const lst = [
		{
			k:'Sample',
			v: sample.samplename
				+ (sample.sampletype ? ' <span style="font-size:.7em;color:#858585;">'+sample.sampletype+'</span>' : '')
				+ (samplegroup.name  ? ' <span style="font-size:.7em">'+samplegroup.name+'</span>' : '')
		}
	]

	if(item.dt==common.dtloh) {
		lst.push({
			k:'LOH seg.mean',
			v: item.segmean.toFixed(2)
		})
	} else {
		lst.push({
			k:'CNV log2(ratio)',
			v: '<span style="padding:0px 4px;background:'
				+(item.value>0?tk.cnvcolor.gain.str:tk.cnvcolor.loss.str)+';color:white;">'
				+item.value.toFixed(2)
				+'</span>'
		})
	}
	
	lst.push( {
		k:'Position',
		v: item.chr+':'+(item.start+1)+'-'+(item.stop+1)
			+' <span style="font-size:.7em">'+common.bplen(item.stop-item.start)+'</span>'
	})

	{
		/*
		cnv & loh may overlap in a sample but can only mouse over one segment
		in that case must also show any items hidding behind the cursor position
		*/
		const thiskey = (item.dt==common.dtloh ? 'loh'+item.segmean:'cnv'+item.value)+item.chr+'.'+item.start+'.'+item.stop

		const [ridx, cursorcoord] = block.pxoff2region( xoff )
		const thischr = block.rglst[ridx].chr

		for(const i2 of sample.items) {
			const thatkey = (i2.dt==common.dtloh ?'loh'+i2.segmean:'cnv'+i2.value)+i2.chr+'.'+i2.start+'.'+i2.stop
			if(thiskey==thatkey) {
				// same item
				continue
			}
			// not same item
			if(item.chr==i2.chr && (i2.start<cursorcoord && i2.stop>cursorcoord)) {
				// the other item overlaps with cursor, show
				lst.push({
					k:'Overlap with',
					v: (i2.dt==common.dtloh ? 'LOH <span style="font-size:.7em">seg.mean</span> '+i2.segmean :
						'CNV <span style="font-size:.7em">log2(ratio)</span> <span style="padding:0px 4px;background:'
							+(i2.value>0?tk.cnvcolor.gain.str:tk.cnvcolor.loss.str)+';color:white;">'
							+i2.value.toFixed(2)
							+'</span>')
						+' <span style="font-size:.8em;opacity:.7">'
						+i2.chr+':'+(i2.start+1)+'-'+(i2.stop+1)
						+' '+common.bplen(item.stop-item.start)
				})
			}
		}
	}

	// expression rank
	const tmp=tooltip_svcnv_addexpressionrank(sample, tk)
	if(tmp) {
		lst.push(tmp)
	}
	client.make_table_2col( tk.tktip.d, lst )
}






function tooltip_svcnv_addexpressionrank( sample, tk ) {
	if(!sample.expressionrank) return null
	const rows=[]  // one gene per row
	for(const genename in sample.expressionrank) {
		const v = sample.expressionrank[genename]
		const lst=[
			'<tr>'
			+'<td><b>'+genename+'</b></td>'
			+'<td>&nbsp;<span style="font-size:.7em">RANK</span> '+client.ranksays(v.rank)+'</td>'
			+'<td>&nbsp;<span style="font-size:.7em">'+tk.gecfg.datatype+'</span> '+v.value+'</td>'
			+'<td>'
		]
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

		lst.push('</td></tr>')

		rows.push(lst.join(''))
	}
	if(rows.length) return {k:'Expression', v:'<table style="font-size:.9em">'+rows.join('')+'</table>'}
	return null
}





function tooltip_svitem( sv, tk ) {
	// single sample mode
	tk.tktip.clear()
		.show(d3event.clientX, d3event.clientY)
	const row=tk.tktip.d.append('div')
	row.append('span').html( print_sv(sv) )
	
	if(sv.dt==common.dtfusionrna) {
		row.append('span').html('&nbsp;(RNA fusion)')
	}
}




function tooltip_svitem_2( sv, sample, samplegroup, tk ) {
	/*
	multi-sample
	full mode
	mouse over a sv circle
	sv or fusion
	*/
	tk.tktip.clear()
		.show(d3event.clientX, d3event.clientY)

	const lst = [
		{k:'Sample',
		v: sample.samplename
			+ (sample.sampletype ? ' <span style="font-size:.7em;color:#858585;">'+sample.sampletype+'</span>' : '')
			+ (samplegroup.name ? ' <span style="font-size:.7em">'+samplegroup.name+'</span>' : '')
		},
		{k: (sv.dt==common.dtsv ? 'SV' : 'RNA fusion'),
		v: svchr2html(sv.chrA, tk) +':'+sv.posA+':'+sv.strandA+' &raquo; '
			+svchr2html(sv.chrB,tk)+':'+sv.posB+':'+sv.strandB
		}
	]

	if(sv.clipreadA) {
		lst.push({
			k:'# of reads',
			v:'A <span style="font-size:.7em">clip/total</span> '+sv.clipreadA+' / '+sv.totalreadA+'<br>'+
				'B <span style="font-size:.7em">clip/total</span> '+sv.clipreadB+' / '+sv.totalreadB
		})
	}


	const tmp=tooltip_svcnv_addexpressionrank(sample,tk)
	if(tmp) {
		lst.push(tmp)
	}

	client.make_table_2col( tk.tktip.d, lst )
}




function svchr2html(chr, tk) {
	// only for multi-sample, full mode
	if( tk.legend_svchrcolor.interchrs.has(chr) ) {
		return '<span style="background:'+tk.legend_svchrcolor.colorfunc(chr)+';font-weight:bold;padding:0px 5px;color:white">'+chr+'</span>'
	}
	return chr
}



function tooltip_cnvitem_singlesample(item, tk) {
	/*
	single sample
	mouse over cnv/loh
	*/
	tk.tktip.clear()
		.show( d3event.clientX, d3event.clientY )
	const lst = []

	if(item.dt==common.dtloh) {
		// loh
		lst.push({k:'LOH seg.mean',v:item.segmean})
	} else {
		// cnv
		lst.push({
			k:'CNV log2(ratio)',
			v:'<span style="padding:0px 4px;background:'+(item.value>0?tk.cnvcolor.gain.str:tk.cnvcolor.loss.str)+';color:white;">'+item.value.toFixed(2)+'</span>'
		})
	}

	lst.push( {
		k:'Position',
		v: item.chr+':'+(item.start+1)+'-'+(item.stop+1)
			+' <span style="font-size:.7em">'+common.bplen(item.stop-item.start)+'</span>'
	})

	client.make_table_2col( tk.tktip.d, lst )
}








function click_samplegroup_showtable( samplegroup, tk, block ) {
	/*
	click on the left label of a sample group, show cnv/sv items in table
	multi-sample
	only for native track; requires sample annotation & hierarchy
	*/
	const pane = client.newpane({x:d3event.clientX+100, y:Math.max(100,d3event.clientY-100)})
	pane.header.html(samplegroup.name+' <span style="font-size:.7em">'+tk.name+'</span>')
	if(samplegroup.samples.length==1) {
		// one sample
		const sample=samplegroup.samples[0]

		const lst=[ {k:'Sample',v:sample.samplename} ]
		if(sample.sampletype) {
			lst.push({k:'Sample type', v:sample.sampletype})
		}
		if(sample.pmid) {
			lst.push({k:'PubMed', v: sample.pmid.split(',').map(i=>'<a href=https://www.ncbi.nlm.nih.gov/pubmed/'+i+' target=_blank>'+i+'</a>').join(' ')})
		}
		const [cnvlst, svlst, lohlst] = printitems_svcnv(sample.items, tk)

		// TODO make button for cnv/sv/loh to launch single-sample

		if(cnvlst.length) {
			lst.push({k:'CNV', v:cnvlst.join('')})
		}
		if(svlst.length) {
			lst.push({k:'SV', v:svlst.join('')})
		}
		if(lohlst.length) {
			lst.push({k:'LOH', v:lohlst.join('')})
		}
		client.make_table_2col( pane.body, lst)
		return
	}

	// multiple samples
	const table=pane.body.append('table')
		.style('border-spacing','2px')
		.style('margin','20px')

	const hassampletype = samplegroup.samples.find(i=>i.sampletype)
	const haspmid=samplegroup.samples.find(i=>i.pmid)

	// header
	const tr=table.append('tr')
	tr.append('td')
		.text('Sample')
		.style('color','#aaa')
	if(hassampletype) {
		tr.append('td')
			.text('Sample type')
			.style('color','#aaa')
	}
	tr.append('td')
		.text('CNV')
		.style('color','#aaa')
	tr.append('td')
		.text('SV')
		.style('color','#aaa')
	tr.append('td')
		.text('LOH')
		.style('color','#aaa')
	if(haspmid) {
		tr.append('td')
			.text('PubMed ID')
			.style('color','#aaa')
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

		const [ cnvlst, svlst, lohlst, cnvlst0, svlst0, lohlst0 ] = printitems_svcnv(sample.items, tk)

		{
			const td=tr.append('td')
			for(let j=0; j<cnvlst.length; j++) {
				td.append('div')
					.html(cnvlst[j])
					.attr('class', 'sja_clbtext')
					.on('click',()=>{
						click_multi2single( cnvlst0[j], null, sample, samplegroup, tk, block )
					})
			}
		}
		{
			const td= tr.append('td')
			for(let j=0; j<svlst.length; j++) {
				td.append('div')
					.html(svlst[j])
					.attr('class','sja_clbtext')
					.on('click',()=>{
						click_multi2single( null, svlst0[j], sample, samplegroup, tk, block )
					})
			}
		}
		{
			const td=tr.append('td')
			for(let j=0; j<lohlst.length; j++) {
				td.append('div')
					.html(lohlst[j])
					.attr('class','sja_clbtext')
					.on('click',()=>{
						click_multi2single( lohlst0[j], null, sample, samplegroup, tk, block )
					})
			}
		}
		if(haspmid) {
			tr.append('td').html( sample.pmid ? sample.pmid.split(',').map(i=>'<a href=https://www.ncbi.nlm.nih.gov/pubmed/'+i+' target=_blank>'+i+'</a>').join(' ') : '')
		}
	}
}



function printitems_svcnv(lst, tk) {
	/* multi-sample
	full mode
	for a set of items from the same sample
	*/
	const cnvlst=[], // html
		svlst=[],
		lohlst=[],
		cnvlst0=[], // actual obj
		svlst0=[],
		lohlst0=[]
	for(const i of lst) {
		if(i.dt==common.dtloh) {
			lohlst.push(
				'<div>'+i.chr+':'+(i.start+1)+'-'+(i.stop+1)
				+' <span style="font-size:.8em">'+common.bplen(i.stop-i.start)
				+' seg.mean: '+i.segmean+'</span>'
			)
			lohlst0.push(i)
		} else if(i.dt==common.dtsv || i.dt==common.dtfusionrna) {
			svlst.push('<div>'+svchr2html(i.chrA,tk)+':'+i.posA+':'+i.strandA
				+' &raquo; '
				+svchr2html(i.chrB,tk)+':'+i.posB+':'+i.strandB
				+(i.dt==common.dtfusionrna ? ' <span style="font-size:.7em;opacity:.7">(RNA fusion)</span>':'')
				+'</div>'
			)
			svlst0.push(i)
		} else if(i.dt==common.dtcnv) {
			cnvlst.push(
				'<div>'+i.chr+':'+(i.start-1)+'-'+(i.stop-1)
				+' <span style="font-size:.8em">'+common.bplen(i.stop-i.start)+'</span>'
				+' <span style="background:'+(i.value>0?tk.cnvcolor.gain.str:tk.cnvcolor.loss.str)+';font-size:.8em;color:white">&nbsp;'+i.value+'&nbsp;</span>'
				+'</div>'
			)
			cnvlst0.push(i)
		}
	}
	return [ cnvlst, svlst, lohlst, cnvlst0, svlst0, lohlst0 ]
}



function click_sv_single(sv, tk, block) {
	let otherchr
	let otherpos
	if(sv._chr!=sv.chrA) {
		otherchr=sv.chrA
		otherpos=sv.posA
	} else if(sv._chr!=sv.chrB) {
		otherchr=sv.chrB
		otherpos=sv.posB
	}
	if(!otherchr) return
	const chr=block.genome.chrlookup[otherchr.toUpperCase()]
	if(!chr) {
		block.error('Invalid chr name: '+otherchr)
		return
	}
	const span=10000
	const p={
		chr:chr.name,
		start: Math.max(0, otherpos-span),
		stop: Math.min( chr.len, otherpos+span),
		width:600,
		leftpad:10,
		leftborder:'rgba(50,50,50,.1)'
	}
	p.exonsf=p.width/(p.stop-p.start)
	block.init_coord_subpanel(p)
	block.subpanels.push(p)
	block.ifbusy()
}





function integrate_vcf(data) {
	
}
