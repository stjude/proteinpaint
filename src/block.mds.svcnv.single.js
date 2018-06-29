import * as client from './client'
import * as common from './common'
import { tooltip_singleitem } from './block.mds.svcnv.clickitem'
import { map_cnv, labelspace, draw_colorscale_cnv, draw_colorscale_loh, intrasvcolor, trackclear, vcfvariantisgermline } from './block.mds.svcnv'
import { update_legend } from './block.mds.svcnv.legend'



export function render_singlesample( tk, block ) {
	/*
	single-sample mode
	may not have any data!
	sv/fusion with both feet in view range as legged
	cnv & loh & snvindel & itd as stack bars
	*/


	trackclear( tk )

	const svlst  = []
	const cnvlst = []
	const lohlst = []
	const itdlst = []
	const id2sv  = {} // must dedup sv, tell by breakpoint position

	const usecopynumber=false // but not logratio

	let gainmaxvalue=0, // for cnv logratio
		lossmaxvalue=0,
		copynumbermax=0, // for copy number converted from logratio, instead of logratio
		segmeanmax=0

	if(tk.data) {
		// divide cnv/loh/sv/itd data into holders

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

			// cnv, loh, itd

			map_cnv(item, tk, block)
			if(item.x1==undefined || item.x2==undefined) {
				console.log('unmappable: '+item.chr+' '+item.start+' '+item.stop)
				continue
			}

			if(item.dt==common.dtloh) {
				// loh
				segmeanmax = Math.max(segmeanmax, item.segmean)
				lohlst.push(item)

			} else if(item.dt == common.dtcnv) {

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

			} else if(item.dt == common.dtitd) {
				itdlst.push( item )
			}
		}

		if(cnvlst.length) {
			tk.cnvcolor.cnvmax = Math.max(gainmaxvalue, -lossmaxvalue)
			draw_colorscale_cnv(tk)
		}

		if(lohlst.length) {
			tk.cnvcolor.segmeanmax=segmeanmax
			draw_colorscale_loh(tk)
		}
	}


	// sv on top
	const svheight = render_singlesample_sv( svlst, tk, block )


	/*
	stack bar plot on bottom:
		cnv, itd, loh as bars
		snvindel: show label
	*/
	tk.cnv_g.attr('transform','translate(0,'+ svheight +')')

	const items = [ ...cnvlst, ...lohlst, ...itdlst ] // stack bar items
	if(tk.data_vcf) {
		for(const m of tk.data_vcf) {
			if(m.x!=undefined) {
				items.push(m)
			}
		}
	}

	const stackploth = render_singlesample_stack( items, tk, block )

	tk.height_main = tk.toppad+ svheight + stackploth + tk.bottompad

	update_legend(tk, block)
}





function render_singlesample_stack( items, tk, block, svheight ) {

	if(items.length==0) return 0

	/*
	stack for cnv/loh/snvindel/itd
	all in items[]
	*/

	const stackheight = 12 // hardcoded
	const stackspace  = 1

	// prep & pre-render snvindel
	for(const m of items) {

		if(m.dt != common.dtsnvindel) continue

		const g = tk.cnv_g.append('g')
		m._p = {
			g:g
		}
		/* for later use:
		stackw
		stackx
		g_x
		*/

		const color = common.mclass[ m.class ].color

		/////////////////////////////////// label is the same for snvindel/itd
		// mouseover event not on label but on cover box
		const lab = g.append('text')
			.attr('font-size', stackheight)
			.attr('font-family', client.font)
			.attr('fill', color)
			.attr('dominant-baseline','central')
			.text( m.mname )


		let labelw
		lab.each(function(){ labelw = this.getBBox().width })

		const bgbox = g.append('rect')
			.attr('x', -stackheight/2)
			.attr('y', -stackheight/2)
			.attr('width', stackheight)
			.attr('height', stackheight)
			.attr('fill', color)
			.attr('fill-opacity', 0)

		let fgline1,
			fgline2

		if( m.sampledata && vcfvariantisgermline(m.sampledata[0], tk) ) {
			fgline1 = g.append('line')
				.attr('stroke', color)
				.attr('stroke-width',2)
				.attr('y1', 1-stackheight/2)
				.attr('y2', stackheight/2-1)
			fgline2 = g.append('line')
				.attr('stroke', color)
				.attr('stroke-width',2)
				.attr('x1', 1-stackheight/2)
				.attr('x2', stackheight/2-1)
		} else {
			fgline1 = g.append('line')
				.attr('stroke', color)
				.attr('stroke-width',2)
				.attr('x1', 1-stackheight/2)
				.attr('x2', stackheight/2-1)
				.attr('y1', 1-stackheight/2)
				.attr('y2', stackheight/2-1)
			fgline2 = g.append('line')
				.attr('stroke', color)
				.attr('stroke-width',2)
				.attr('x1', 1-stackheight/2)
				.attr('x2', stackheight/2-1)
				.attr('y1', stackheight/2-1)
				.attr('y2', 1-stackheight/2)
		}

		// to cover both cross & label, will be placed after deciding whether label is on left/right
		m._p.cover = g.append('rect')
			.attr('y', -stackheight/2)
			.attr('width', stackheight+labelspace+labelw)
			.attr('height', stackheight)
			.attr('fill','white')
			.attr('fill-opacity', 0)
			.on('mouseover',()=>{
				bgbox.attr('fill-opacity',1)
				fgline1.attr('stroke','white')
				fgline2.attr('stroke','white')
				tooltip_singleitem({
					item: m,
					m_sample: m.sampledata[0],
					tk: tk,
				})
			})
			.on('mouseout',()=>{
				tk.tktip.hide()
				bgbox.attr('fill-opacity',0)
				fgline1.attr('stroke',color)
				fgline2.attr('stroke',color)
			})

		//////////////////////////////// set position for text label & cover

		m._p.stackw = stackheight + 5 + labelw

		if(block.width - m.x > labelw + labelspace + stackheight/2) {
			// label on right
			m._p.stackx = m.x-stackheight/2
			m._p.g_x = stackheight/2
			lab.attr('x', stackheight/2+labelspace)
			m._p.cover.attr('x', -stackheight/2)

		} else {
			// label on left
			m._p.stackx = m.x-stackheight/2-labelspace-labelw
			m._p.g_x = stackheight/2+labelspace+labelw
			lab
				.attr('x', -stackheight/2-labelspace)
				.attr('text-anchor','end')
			m._p.cover.attr('x', -labelw-labelspace-stackheight/2 )
		}
	}


	items.sort( (i,j)=> {
		const xi = i._p ? i._p.stackx : Math.min(i.x1,i.x2)
		const xj = j._p ? j._p.stackx : Math.min(j.x1,j.x2)
		return xi - xj
	})


	const stacks=[ 0 ]
	for(const item of items) {

		const itemstart = item._p ? item._p.stackx : Math.min(item.x1, item.x2)
		const itemwidth = item._p ? item._p.stackw : Math.abs(item.x1-item.x2)

		for(let i=0; i<stacks.length; i++) {
			if(stacks[i] <= itemstart ) {
				stacks[i] = itemstart + itemwidth
				item.stack=i
				break
			}
		}
		if(item.stack==undefined) {
			item.stack=stacks.length
			stacks.push( itemstart + itemwidth )
		}
	}

	for(const item of items) {

		if(item.dt==common.dtloh || item.dt==common.dtcnv || item.dt==common.dtitd) {

			let color

			if(item.dt==common.dtloh) {

				color = 'rgba('+tk.cnvcolor.loh.r+','+tk.cnvcolor.loh.g+','+tk.cnvcolor.loh.b+','+(item.segmean/tk.cnvcolor.segmeanmax)+')'

			} else if(item.dt==common.dtcnv){

				if(item.value>0) {
					color = 'rgba('+tk.cnvcolor.gain.r+','+tk.cnvcolor.gain.g+','+tk.cnvcolor.gain.b+','+(item.value/tk.cnvcolor.cnvmax)+')'
				} else {
					color = 'rgba('+tk.cnvcolor.loss.r+','+tk.cnvcolor.loss.g+','+tk.cnvcolor.loss.b+','+(-item.value/tk.cnvcolor.cnvmax)+')'
				}
			} else if(item.dt==common.dtitd) {

				color = common.mclass[common.mclassitd].color
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
					tooltip_singleitem({
						item:item,
						tk: tk
					})
				})
				.on('mouseout',()=> {
					tk.tktip.hide()
				})
			continue
		}

		if(item.dt==common.dtsnvindel) {

			item._p.g
				.attr('transform','translate('+(item._p.stackx+item._p.g_x)+','+(stackheight/2 + (stackheight+stackspace)*item.stack)+')')
			continue
		}
	}

	return stacks.length*(stackheight+stackspace)-stackspace
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






function render_singlesample_sv( svlst, tk, block ) {

	if(svlst.length==0) return 0

	// if sv has both x0/x1 will show both legs, will be higher, else lower
	const svheight = tk.discradius*2 + tk.midpad
		+ (svlst.find(s=> s.x0 && s.x1) ?
			tk.stem1+tk.legheight :
			tk.stem1+tk.stem2+tk.stem3
		)

	tk.svvcf_g.attr('transform','translate(0,'+ (svheight-tk.midpad) +')')

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
		const g = tk.svvcf_g.append('g')
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
			.on('mouseover',()=>{
				tooltip_singleitem({
					item:sv,
					tk: tk
				})
			})
			.on('mouseout',()=> tk.tktip.hide() )
			.on('click',()=>{
				// click sv may add subpanel
				click_sv_single(sv, tk, block)
			})

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
	return svheight
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
