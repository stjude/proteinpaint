import * as client from '../client'
import {axisTop} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'



/*
horizontal boxplot
one boxplot for a group of dots
multiple group share the same axis


*/




export default function(arg)
{
/*
arg
.list[{}]
	.label
	.color   (optional)

	.samples[{}]
		.value

	(optional, instead of .samples[])
	.samplecount
	.minvalue
	.maxvalue
	.percentile{}
		p05
		p25
		p50
		p75
		p95

.holder
.axislabel
*/

if(!arg.holder) return '.holder missing for boxplot'
if(!arg.list) return '.list[] missing'
if(!Array.isArray(arg.list)) return '.list should be array'
for(const group of arg.list) {
	if(!group.label) return '.label missing for a group'
	if(group.samples) {
		for(const s of group.samples) {
			if(!Number.isFinite(s.value)) return '.value missing from a sample'
		}
	} else {
		// no samples, must have below
		if(!Number.isFinite(group.minvalue)) return '.minvalue missing for a group'
		if(!Number.isFinite(group.maxvalue)) return '.maxvalue missing for a group'
		//if(!Number.isFinite(group.samplecount)) return '.samplecount missing for a group'
		if(!group.percentile) return '.percentile{} missing from a group'
		if(!Number.isFinite(group.percentile.p05)) return '.percentile.p05 missing for a group'
		if(!Number.isFinite(group.percentile.p25)) return '.percentile.p25 missing for a group'
		if(!Number.isFinite(group.percentile.p50)) return '.percentile.p50 missing for a group'
		if(!Number.isFinite(group.percentile.p75)) return '.percentile.p75 missing for a group'
		if(!Number.isFinite(group.percentile.p95)) return '.percentile.p95 missing for a group'
	}
}


const label2color = scaleOrdinal(schemeCategory10) // in case .color is missing for a group

const svg = arg.holder.append('svg')

let axisheight=40,
	width=300,
	ypad=10,
	xpad=10,
	boxheight=30,
	axisfontsize=12,
	fontsize=15

let maxlabelw=0
let minv=null
let maxv=null

for(const g of arg.list) {

	const samplecount = g.samplecount ? g.samplecount : (g.samples? g.samples.length : null)

	svg.append('text')
		.text(g.label+ (samplecount? ' (n='+samplecount+')' : '') )
		.attr('font-family',client.font)
		.attr('font-size',fontsize)
		.each(function(){
			maxlabelw=Math.max(maxlabelw, this.getBBox().width)
		})
		.remove()
	if(g.samples) {
		for(const s of g.samples) {
			if(s.value==undefined) continue
			if(minv==null) {
				minv=s.value
				maxv=s.value
			} else {
				minv=Math.min(minv, s.value)
				maxv=Math.max(maxv, s.value)
			}
		}
	} else {
		if(minv==null) {
			minv=g.minvalue
			maxv=g.maxvalue
		} else {
			minv=Math.min(minv,g.minvalue)
			maxv=Math.max(maxv,g.maxvalue)
		}
	}
}

svg.attr('width',maxlabelw+xpad+width+xpad)
	.attr('height',axisheight+(ypad+boxheight)*arg.list.length+10)

const g=svg.append('g')
	.attr('transform','translate('+(maxlabelw+xpad)+','+axisheight+')')

const xscale = scaleLinear().domain([minv, maxv]).range([0, width])

const axisg=g.append('g')
client.axisstyle({
	axis:axisg.call( axisTop().scale(xscale).ticks(5)),
	showline:true,
	fontsize:axisfontsize,
	color:'black'
})

if(arg.axislabel) {
	g.append('text')
		.text(arg.axislabel)
		.attr('x',width/2)
		.attr('y', -axisfontsize-13)
		.attr('font-family',client.font)
		.attr('font-size',fontsize)
		.attr('text-anchor','middle')
}
let y=0

for(const grp of arg.list) {
	y+=ypad
	const sg = g.append('g')
		.attr('transform','translate(0,'+y+')')
	y+=boxheight

	const samplecount = grp.samplecount ? grp.samplecount : (grp.samples? grp.samples.length : null)

	sg.append('text')
		.text(grp.label+ (samplecount ? ' (n='+samplecount+')' : '') )
		.attr('x',-xpad)
		.attr('y',boxheight/2)
		.attr('text-anchor','end')
		.attr('dominant-baseline','central')
		.attr('font-family',client.font)
		.attr('font-size',fontsize)
		.attr('fill','black')

	let p05,p25,p50,p75,p95

	if(grp.samples) {
		const vlst= grp.samples.map(i=>i.value)
		vlst.sort((a,b)=>a-b)
		p05 = vlst[ Math.floor( vlst.length*.05)]
		p25 = vlst[ Math.floor( vlst.length*.25)]
		p50 = vlst[ Math.floor( vlst.length*.5)]
		p75 = vlst[ Math.floor( vlst.length*.75)]
		p95 = vlst[ Math.floor( vlst.length*.95)]
	} else {
		p05=grp.percentile.p05
		p25=grp.percentile.p25
		p50=grp.percentile.p50
		p75=grp.percentile.p75
		p95=grp.percentile.p95
	}

	const x05=xscale(p05)
	const x25=xscale(p25)
	const x50=xscale(p50)
	const x75=xscale(p75)
	const x95=xscale(p95)

	const color = grp.color || label2color(grp.label)

	sg.append('line')
		.attr('y1',boxheight/2)
		.attr('y2',boxheight/2)
		.attr('x1',x05)
		.attr('x2',x95)
		.attr('stroke',color)
		.attr('shape-rendering','crispEdges')
	sg.append('line')
		.attr('y2',boxheight)
		.attr('x1',x05)
		.attr('x2',x05)
		.attr('stroke',color)
		.attr('shape-rendering','crispEdges')
	sg.append('line')
		.attr('y2',boxheight)
		.attr('x1',x95)
		.attr('x2',x95)
		.attr('stroke',color)
		.attr('shape-rendering','crispEdges')
	sg.append('rect')
		.attr('x',x25)
		.attr('width',x75-x25)
		.attr('height',boxheight)
		.attr('stroke',color)
		.attr('fill','white')
		.attr('shape-rendering','crispEdges')
	sg.append('line')
		.attr('y2',boxheight)
		.attr('x1',x50)
		.attr('x2',x50)
		.attr('stroke',color)
		.attr('shape-rendering','crispEdges')

}

return null
}
