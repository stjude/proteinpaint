import {select as d3select,event as d3event} from 'd3-selection'
import * as client from './client'



export function newboxplot(ep,data,label,id,handle) {
	for(const bp of ep.boxplots) {
		if(bp.id==id) return
	}
	handle.style('border-color',ep.boxcolor)
	for(const bp of ep.boxplots) {
		bp.highlight=false
		bp.label.attr('fill',ep.boxcolor)
		bp.label2.attr('fill',ep.boxcolor)
	}
	// find free space intervals
	let free=[[0,ep.height]]
	for(const bp of ep.boxplots) {
		const y=bp.yoff
		const h=bp.height
		for(const i of free) {
			if(Math.max(y,i[0])<Math.min(y+h,i[1])) {
				if(y+h<i[1]) {
					free.push([y+h+1,i[1]])
				}
				// shrink i
				i[1]=y-1
			}
		}
	}
	const labelfontsize=ep.sf_boxlabelfontsize(Math.log(data.length))
	const boxheight=ep.sf_boxheight(data.length)
	let y=0
	for(const s of free) {
		if(s[1]-s[0]>Math.max(boxheight,labelfontsize)) {
			y=s[0]+3
			break
		}
	}
	// y is anchor in free land
	const holder=ep.boxbag.append('g').attr('transform','translate(0,'+y+')')
	const box={
		labeltext:label,
		lst:data,
		holder:holder,
		yoff:y,
		highlight:false,
		id:id,
		handle:handle,
		height:Math.max(boxheight,labelfontsize),
		lookuphash:{}
	}
	for(const d of data) {
		box.lookuphash[d[ep.p.sampletype]]=1
	}
	ep.boxplots.push(box)
	const p9=data[Math.floor((data.length-1)*.91)].value,
		p25=data[Math.floor((data.length-1)*.75)].value,
		p50=data[Math.floor((data.length-1)*.50)].value,
		p75=data[Math.floor((data.length-1)*.25)].value,
		p91=data[Math.floor((data.length-1)*.09)].value
	box.percentile={
		9:(p9==0?0.0001:p9),
		25:(p25==0?0.0001:p25),
		50:(p50==0?0.0001:p50),
		75:(p75==0?0.0001:p75),
		91:(p91==0?0.0001:p91)
		}
	// horizontal through line
	box.hline=holder.append('line')
		.attr('y1',boxheight/2)
		.attr('y2',boxheight/2)
		.attr('stroke',ep.boxcolor)
		.attr('stroke-dasharray','5,3')
		.attr('shape-rendering','crispEdges')
	box.hline.transition().duration(ep.dur)
		.attr('x1',Math.max(0,ep.x_scale(p9)))
		.attr('x2',Math.max(0,ep.x_scale(p91)))
	// label, also need to get label width to draw connect line between p91 and label
	box.label=holder.append('text')
		.attr('y',boxheight/2)
		.attr('font-size',labelfontsize)
		.attr('font-family',client.font)
		.attr('text-anchor','end')
		.attr('dominant-baseline','middle')
		.attr('fill',box.highlight?ep.p.hlcolor:ep.boxcolor)
		.style('cursor','default')
		.text(label)
		.on('mousedown',()=>boxplot_md(ep,box))
		.on('click',()=>boxplot_clicklabel(ep,box))
		.each(function(){box.labelwidth=this.getBBox().width})
		.attr('x',ep.width+ep.width2+box.labelwidth)
	box.label
		.transition().duration(ep.dur)
		.attr('x',ep.width+ep.width2-ep.width2_-3)
	// label2
	box.label2=holder.append('text')
		.attr('x',ep.width+ep.width2+box.labelwidth)
		.attr('y',boxheight/2)
		.attr('font-size',labelfontsize)
		.attr('font-family',client.font)
		.attr('dominant-baseline','middle')
		.attr('fill',box.highlight?ep.p.hlcolor:ep.boxcolor)
		.style('cursor','default')
		.text(data.length)
		.on('mousedown',()=>boxplot_md(ep,box))
		.on('click',()=>boxplot_clicklabel(ep,box))
	box.label2.transition().duration(ep.dur)
		.attr('x',ep.width+ep.width2-ep.width2_+3)
	box.connline=holder.append('line')
		.attr('y1',boxheight/2)
		.attr('y2',boxheight/2)
		.attr('stroke',ep.boxcolor)
		.attr('stroke-dasharray','1,3')
		.attr('shape-rendering','crispEdges')
	box.connline
		.transition().duration(ep.dur)
		.attr('x1',Math.max(0,ep.x_scale(box.percentile[91])))
		.attr('x2',Math.max(0,ep.width+ep.width2-box.labelwidth-ep.width2_-3))
	box.box=holder.append('rect')
		.attr('height',boxheight)
		.attr('shape-rendering','crispEdges')
		.attr('fill','white')
		.attr('stroke',ep.boxcolor)
		.on('click',()=>boxplotremove(ep,box))
		.on('mousedown',()=>{
			const t=d3event.target
			t.setAttribute('fill','#FFeeee')
			t.setAttribute('stroke','#D10000')
			})
		.on('mouseover',()=>{
			ep.dottip.show(d3event.clientX,d3event.clientY)
				.clear()
			const lst = [
				{k:'Group', v: (box.labeltext || 'All samples')},
				{k:'1st quartile',v: box.percentile[25]},
				{k:'Median', v: box.percentile[50]},
				{k:'3rd quartile', v: box.percentile[75]}
			]
			client.make_table_2col(ep.dottip.d.append('div'), lst)
		})
		.on('mouseout',()=>{
			ep.dottip.hide()
		})
	box.box.transition().duration(ep.dur)
		.attr('x',Math.max(0,ep.x_scale(box.percentile[25])))
		.attr('width',Math.max(0,ep.x_scale(box.percentile[75]))-Math.max(0,ep.x_scale(box.percentile[25])))
	box.vlines=holder.selectAll()
		.data([box.percentile[9],
			box.percentile[25],
			box.percentile[50],
			box.percentile[75],
			box.percentile[91]])
		.enter().append('line')
		.attr('x1',0)
		.attr('x2',0)
		.attr('y1',0)
		.attr('y2',boxheight)
		.attr('stroke',ep.boxcolor)
		.attr('shape-rendering','crispEdges')
	box.vlines.transition().duration(ep.dur)
		.attr('x1',d=> Math.max(0,ep.x_scale(d)))
		.attr('x2',d=> Math.max(0,ep.x_scale(d)))
	if(label!='') {
		// this is not the bigbox for all so highlight
		boxplot_clicklabel(ep,box)
	}
}



export function boxplotremove(ep,arg) {
	let box=null
	if(typeof(arg)=='object') {
		box=arg
	} else {
		for(const b of ep.boxplots) {
			if(b.id==arg) box=b
		}
	}
	if(!box) {
		console.log('cannot remove boxplot')
		return
	}
	box.handle.style('border-color','transparent')
	if(box.label.attr('fill')==ep.p.hlcolor) {
		boxplot_clicklabel(ep,box)
	}
	box.holder.transition()
		.attr('transform','translate('+(ep.width+20)+','+box.yoff+')')
		.each(()=>box.holder.remove())
	for(let i=0; i<ep.boxplots.length; i++) {
		if(ep.boxplots[i].id==box.id) {
			ep.boxplots.splice(i,1)
			return
		}
	}
}



function boxplot_clicklabel(ep, box) {
	if(ep.busy) return
	for(const b of ep.boxplots) {
		if(b.id!=box.id) b.highlight=false
	}
	// this highlight doesnot involve text label
	box.highlight=!box.highlight
	ep.epdot.transition().duration(1000)
		.attr('r',d=>{
			if(d[ep.p.sampletype] in box.lookuphash)
				return box.highlight ? ep.dotsize*.7 : ep.dotsize/2
			return box.highlight ? ep.dotsize*.2 : ep.dotsize/2
		})
		.attr('stroke',d=>{
			if(d[ep.p.sampletype] in box.lookuphash)
				return box.highlight ? ep.p.hlcolor : 'black'
			return 'black'
		})
		.attr('stroke-opacity',d=>{
			if(d[ep.p.sampletype] in box.lookuphash)
				return box.highlight ? .4 : .2
			return box.highlight ? .1 : .2
		})
	for(const b of ep.boxplots) {
		b.label.attr('fill',b.highlight?ep.p.hlcolor:ep.boxcolor)
		b.label2.attr('fill',b.highlight?ep.p.hlcolor:ep.boxcolor)
	}
}



function boxplot_md(ep, box) {
	d3event.preventDefault()
	const y=d3event.clientY,
		oldboxy=box.yoff
	const b=d3select(document.body)
	b.on('mousemove', ()=>{
		ep.busy=true
		box.yoff=oldboxy+d3event.clientY-y
		box.holder.attr('transform','translate(0,'+box.yoff+')')
	})
	.on('mouseup',()=>{
		b.on('mousemove',null).on('mouseup',null)
		setTimeout(()=>ep.busy=false, 100)
	})
}



