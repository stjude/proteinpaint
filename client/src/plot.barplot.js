import * as client from './client'
import {scaleLinear} from 'd3-scale'
import {axisTop} from 'd3-axis'
import {format as d3format} from 'd3-format'



export default function plot_barplot(data,barcolor,label,pos) {
	const pane=client.newpane({x:pos.left+200,y:pos.top})
	pane.body.style('padding','10px')
	pane.header.html(label)
	data.sort((a,b)=> b.size-a.size)
	plot({
		lst:data,
		holder:pane.body,
		barcolor:barcolor,
		limit:Math.min(data.length,20),
	})
}



function plot(p) {
	p.holder.selectAll('*').remove()
	const row=p.holder.append('div').style('margin-bottom','10px')
	row.append('button').text('more').on('click',()=>{
		p.limit=Math.min(p.lst.length,p.limit+10)
		plot(p)
	})
	row.append('button').text('less').on('click',()=>{
		p.limit=Math.max(1,p.limit-10)
		plot(p)
	})
	row.append('button').text('screenshot').on('click',()=>client.to_svg(svg.node(),'barplot'))
	let barheight=20,
		barwidth=300,
		space=5,
		axisheight=barheight+5,
		barspace=barheight/8,
		maxlabelwidth=0,
		maxvalue=0
	const svg=p.holder.append('svg')
	const axisg=svg.append('g')
	for(let i=0; i<p.limit; i++) {
		let j=p.lst[i]
		maxvalue=Math.max(maxvalue,j.size)
		svg.append('text')
		.text(j.name)
		.attr('font-size',barheight-2)
		.attr('font-family',client.font)
		.each(function(){
			maxlabelwidth=Math.max(maxlabelwidth,this.getBBox().width)
			})
		.remove()
	}
	svg.attr('width',maxlabelwidth+space+barwidth+space)
		.attr('height',axisheight+space+p.limit*(barheight+barspace))
	axisg.attr('transform','translate('+(maxlabelwidth+space)+','+axisheight+')')
		.call(axisTop().scale(
			scaleLinear().domain([0,maxvalue]).range([0,barwidth])
			)
			.tickFormat(d3format('d'))
		)
	client.axisstyle({
		axis:axisg,
		showline:true,
		fontsize:barheight*.8,
		color:'black'
	})
	let y=axisheight+space
	const sf=barwidth/maxvalue
	for(let i=0; i<p.limit; i++) {
		const j=p.lst[i]
		svg.append('text')
		.text(j.name)
		.attr('x',maxlabelwidth)
		.attr('y',y+barheight/2)
		.attr('text-anchor','end')
		.attr('font-size',barheight-2)
		.attr('font-family',client.font)
		.attr('dominant-baseline','central')
		svg.append('rect')
		.attr('x',maxlabelwidth+space)
		.attr('y',y)
		.attr('width',sf*j.size)
		.attr('height',barheight-1)
		.attr('fill',p.barcolor)
		y+=barheight+barspace
	}
}
