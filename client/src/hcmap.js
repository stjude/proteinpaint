import * as client from './client'




export default function inithcmap(hm,holder)
{
const err=m=>{
	client.sayerror(holder,m)
}
if(!hm.metadata) return err('no metadata')
const mdh=hm.metadata
const legendholder=holder.append('div').style('display','inline-block').style('border','solid 1px #ccc').style('margin','20px').style('padding','20px')
const svg=holder.append('svg')
if(!hm.text) return err('text missing')
const lines=hm.text.trim().split('\n')
// samples
hm.samples=[]
const l=lines[0].split('\t')
for(let i=2; i<l.length; i++) {
	hm.samples.push(l[i])
}
if(hm.samples.length==0) return err('no column names')
hm.items=[]
for(let i=1; i<lines.length; i++) {
	const l=lines[i].split('\t')
	const type=l[0]
	const md=mdh[type]
	if(!md) return err('invalid data type '+type)
	const name=l[1]
	const lst=[]
	for(let j=2; j<l.length; j++) {
		const vlst=l[j].split(';')
		const colorlst=[]
		for(const v of vlst) {
			if(!md[v]) {
				return err('invalid value '+v+' at '+name+' and '+hm.samples[j-2])
			}
			colorlst.push(md[v].color)
		}
		lst.push(colorlst)
	}
	hm.items.push({
		name:name,
		type:type,
		lst:lst
	})
}
hm.geneonrow=true
if(!hm.rowh) {
	hm.rowh=20
}
if(!hm.colw) {
	hm.colw=20
}
if(!hm.rowspace) {
	hm.rowspace=2
}
if(!hm.colspace) {
	hm.colspace=2
}
if(!hm.rowlabtickspace) {
	hm.rowlabtickspace=4
}
if(!hm.collabtickspace) {
	hm.collabtickspace=4
}
if(!hm.rowtick) {
	hm.rowtick=5
}
if(!hm.coltick) {
	hm.coltick=5
}
render(hm,svg,legendholder,err)
}





function render(hm,svg,legendholder,err)
{
const mdh=hm.metadata
for(const key in mdh) {
	for(const value in mdh[key]) {
		const o=mdh[key][value]
		if(!o.label) return err('.label missing for metadata '+key+'['+value+']')
		if(!o.color) return err('.color missing for metadata '+key+'['+value+']')
	}
}
for(const key in mdh) {
	const d1=legendholder.append('div').style('display','inline-block').style('margin','20px').style('vertical-align','top')
	d1.append('div').text(key).style('margin','5px 3px').style('font-weight','bold')
	const d2=d1.append('div').style('margin','3px')
	for(const v in mdh[key]) {
		const o=mdh[key][v]
		const row=d2.append('div').style('margin','3px')
		row.append('div').style('display','inline-block').style('background-color',o.color).style('width','14px').style('height','14px').style('margin-right','10px')
		row.append('span').text(o.label)
	}
}


const rowlabfontsize=hm.rowh-3,	
	collabfontsize=hm.colw-3


// max label width
// label for gene and md are always shown
let labels=[]
for(const i of hm.items) {
	labels.push(i.name)
}
let genenamewidth=0
for(const n of labels) {
	svg.append('text').text(n)
	.attr('font-size', hm.geneonrow ? rowlabfontsize : collabfontsize)
	.attr('font-family',client.font)
	.each(function(){genenamewidth=Math.max(genenamewidth,this.getBBox().width)})
	.remove()
}
let samplenamewidth=0
for(const n of hm.samples) {
	svg.append('text').text(n)
	.attr('font-size', hm.geneonrow ? collabfontsize : rowlabfontsize)
	.attr('font-family',client.font)
	.each(function(){samplenamewidth=Math.max(samplenamewidth,this.getBBox().width)})
	.remove()
}
const rowlabw=hm.geneonrow ? genenamewidth : samplenamewidth
const collabh=hm.geneonrow ? samplenamewidth : genenamewidth

const mapwidth=hm.samples.length*(hm.colw+hm.colspace)-hm.colspace
const mapheight=hm.items.length*(hm.rowh+hm.rowspace)-hm.rowspace
svg.attr('width',rowlabw+hm.rowlabtickspace+hm.rowtick+mapwidth+100)
	.attr('height',collabh+hm.collabtickspace+hm.coltick+mapheight)
const originx= rowlabw+hm.rowlabtickspace+hm.rowtick 
const originy= collabh+hm.collabtickspace+hm.coltick

// row label, item
let y=originy
for(const item of hm.items) {
	const g=svg.append('g').attr('transform','translate('+(originx-hm.rowlabtickspace-hm.rowtick)+','+(y+hm.rowh/2)+')')
	g.append('text').text(item.name)
	.attr('font-size',rowlabfontsize)
	.attr('font-family',client.font)
	.attr('fill', 'black')
	.attr('text-anchor', 'end')
	.attr('dominant-baseline','central')
	// tick
	g.append('line')
	.attr('stroke','black')
	.attr('shape-rendering','crispEdges')
	.attr('x1', hm.rowlabtickspace)
	.attr('x2', hm.rowlabtickspace+hm.rowtick)
	y+=hm.rowh+hm.rowspace
}
// col label, samples
let x= originx
for(const sample of hm.samples) {
	const g=svg.append('g').attr('transform','translate('+(x+hm.colw/2)+','+collabh+')')
	g.append('text').text(sample)
		.attr('font-size',collabfontsize)
		.attr('font-family',client.font)
		.attr('fill', 'black')
		.attr('dominant-baseline','central')
		.attr('transform','rotate(-90)')
	// tick
	g.append('line')
		.attr('stroke','black')
		.attr('shape-rendering','crispEdges')
		.attr('y1', hm.collabtickspace)
		.attr('y2', hm.collabtickspace+hm.coltick)
	x+=hm.colw+hm.colspace
}
// cells
y=originy
for(const item of hm.items) {
	let x=originx
	for(let i=0; i<hm.samples.length; i++) {
		const sample=hm.samples[i]
		const g=svg.append('g').attr('transform','translate('+(x+hm.colw/2)+','+(y+hm.rowh/2)+')')
		const pieceh=hm.rowh/item.lst[i].length
		const colorlst=item.lst[i]
		for(let j=0; j<colorlst.length; j++) {
			const v=colorlst[j]
			g.append('rect')
				.attr('x',-hm.colw/2)
				.attr('y',-hm.rowh/2+j*pieceh)
				.attr('width',hm.colw)
				.attr('height',pieceh)
				.attr('fill',v)
				.attr('shape-rendering','crispEdges')
		}
		x+=hm.colw+hm.colspace
	}
	y+=hm.rowh+hm.rowspace
}
svg.append('rect')
	.attr('x',originx)
	.attr('y',originy)
	.attr('width',hm.samples.length*(hm.colw+hm.colspace)-hm.colspace)
	.attr('height',hm.items.length*(hm.rowh+hm.rowspace)-hm.rowspace)
	.attr('stroke','black')
	.attr('fill','none')
	.attr('shape-rendering','crispEdges')
}
