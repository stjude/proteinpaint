import * as client from './client'
import * as common from './common'
import {axisLeft,axisBottom} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
//import {interpolateRgb} from 'd3-interpolate'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'


/*
obj:
.holder
.genome {}
.dslabel
.dots [ {} ]
	.x
	.y
	.sample
	.s {}
.sample2dot MAP
.scattersvg SVG
.colorbyattributes [ {} ]
	.key
	.label
	.values

*/


export function init (obj,holder, debugmode) {
	/*
	holder
	genome
	dslabel

	*/

	if(debugmode) {
		window.obj = obj
	}

	obj.menu = new client.Menu({padding:'5px'})
	obj.tip = new client.Menu({padding:'5px'})

	obj.errordiv = holder.append('div')
		.style('margin','10px')

	obj.sayerror = e=>{
		client.sayerror(obj.errordiv, typeof(e)=='string' ? e : e.message)
		if(e.stack) console.log(e.stack)
	}

	const scatterdiv0 = holder.append('div')
		.style('margin','10px')
		.style('display','inline-block')

	const scatterdiv = scatterdiv0.append('div')
		.style('position','relative')

	obj.scattersvg = scatterdiv.append('svg')
	obj.scattersvg_resizehandle = scatterdiv.append('div')


	const par = {
		genome: obj.genome.name,
		dslabel: obj.dslabel
	}

	client.dofetch('mdssamplescatterplot', par)
	.then(data=>{
		if(data.error) throw data.error
		if(!data.dots) throw 'server error'


		obj.sample2dot = new Map()

		for(const dot of data.dots) {
			obj.sample2dot.set( dot.sample, dot )
		}
		obj.dots = data.dots

		// TODO generic attributes for legend, specify some categorical ones for coloring
		if(data.colorbyattributes) {
			obj.colorbyattributes = data.colorbyattributes
			init_legend(obj,holder)
		}

		init_plot(obj)
	})
	.catch(e=>{
		obj.sayerror(e)
	})
}














function init_plot (obj) {

	let minx=obj.dots[0].x,
		maxx=minx,
		miny=obj.dots[0].y,
		maxy=miny
	for(const d of obj.dots) {
		minx = Math.min(minx, d.x)
		maxx = Math.max(maxx, d.x)
		miny = Math.min(miny, d.y)
		maxy = Math.max(maxy, d.y)
	}

	const xscale=scaleLinear().domain([minx,maxx])
	const yscale=scaleLinear().domain([miny,maxy])



	let toppad=30,
		bottompad=50,
		leftpad=100,
		rightpad=30,
		vpad=20,
		width=500,
		height=500

	const svg = obj.scattersvg

	const xaxisg=svg.append('g')
	const yaxisg=svg.append('g')
	const dotg=svg.append('g')

	const dots=dotg.selectAll()
		.data( obj.dots )
		.enter().append('g')

	const defaultcolorbyattr = obj.colorbyattributes ? obj.colorbyattributes[0] : null

	const circles=dots.append('circle')
		.attr('fill', d=>{
			if(defaultcolorbyattr) {
				const value = d.s[ defaultcolorbyattr.key ]
				return defaultcolorbyattr.values.get( value ).color
			}
			return '#ccc'
		})
		.attr('stroke','none')
		.on('mouseover',d=>{
			d3event.target.setAttribute('stroke','white')
			const lst=[ 
				{k:'name',v:d.sample}
			]
			for(const attrkey in obj.mds.sampleAttribute.attributes) {
				const attr = obj.mds.sampleAttribute.attributes[attrkey]
				lst.push( { k:attr.label, v: d.s[attrkey] } )
			}

			obj.tip.clear()
			client.make_table_2col(obj.tip.d, lst)
			obj.tip.show(d3event.clientX, d3event.clientY)
		})
		.on('mouseout',d=>{
			d3event.target.setAttribute('stroke','none')
			obj.tip.hide()
		})
	
	obj.dotselection = circles



	function resize() {
		const radius=3
		bottompad=width/20+20
		svg.attr('width',leftpad+vpad+width+rightpad)
			.attr('height',toppad+height+vpad+bottompad)
		xaxisg.attr('transform','translate('+(leftpad+vpad)+','+(toppad+height+vpad)+')')
		yaxisg.attr('transform','translate('+leftpad+','+toppad+')')
		dotg.attr('transform','translate('+(leftpad+vpad)+','+toppad+')')
		xscale.range([0,width])
		yscale.range([height,0])
		client.axisstyle({
			axis:xaxisg.call(axisBottom().scale(xscale)),
			color:'black',
			fontsize:width/40,
			showline:true,
		})
		client.axisstyle({
			axis:yaxisg.call(axisLeft().scale(yscale)),
			color:'black',
			fontsize:height/40,
			showline:true,
		})
		dots.attr('transform',d=>'translate('+xscale(d.x)+','+yscale(d.y)+')')
		circles.attr('r',radius)
	}
	resize()

	// drag resize
	obj.scattersvg_resizehandle
		.style('position','absolute')
		.style('right','0px')
		.style('bottom','0px')
		.attr('class','sja_clbtext')
		.text('drag to resize')
		.on('mousedown',()=>{
			d3event.preventDefault()
			const b=d3select(document.body)
			const x=d3event.clientX
			const y=d3event.clientY
			const w0=width
			const h0=height
			b.on('mousemove',()=>{
				width=w0+d3event.clientX-x
				height=h0+d3event.clientY-y
				resize()
			})
			b.on('mouseup',()=>{
				b.on('mousemove',null).on('mouseup',null)
			})
		})
}





function init_legend(arg,holder) {
	const legendholder = holder.append('table')
		.style('margin','10px')
		.style('border-spacing','5px')

	for(const attr of obj.colorbyattributes) {

		// in case value2color is not provided
		const colorfunc = scaleOrdinal(schemeCategory10)
		attr.values = new Map()

		for(const d of obj.dots) {
			const value = d.s[attr.key]
			const color = colorfunc( value )
			if(!attr.values.has(value)) {
				attr.values.set(value,{ count:1, color:color })
			}
			attr.values.get( value ).count++
		}


		const row = legendholder.append('div')
		row.append('div')
			.style('display','inline-block')
			.style('opacity',.5)
			.text(attr.label)
		const celldiv = row.append('div')
			.style('display','inline-block')

		for(const [value,o] of attr.values) {
			const cell = celldiv.append('div')
				.style('display','inline-block')
				.attr('class','sja_clb')
			cell.append('div')
				.style('display','inline-block')
				.attr('class','sja_mcdot')
				.style('background',o.color)
				.style('margin-right','3px')
				.text(o.count)
			cell.append('div')
				.style('display','inline-block')
				.style('color',o.color)
				.text(value)
		}
	}
}
