import * as client from './client'
import * as common from './common'
import {axisLeft,axisBottom} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import blocklazyload from './block.lazyload'



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

	const _table = holder.append('table')
		.style('border-spacing','10px')
	
	const tr1 = _table.append('tr') // row has two <td>

	const tr1td1 = tr1.append('td')
	const tr1td2 = tr1.append('td')
		.style('vertical-align','top')


	const scatterdiv = tr1td1.append('div')
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

		// TODO general track
		obj.querykey = data.querykey

		// TODO generic attributes for legend, specify some categorical ones for coloring
		if(data.colorbyattributes) {
			obj.colorbyattributes = data.colorbyattributes
			init_legend_beforeplot(obj,tr1td2)
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
		.on('click',d=>{
			click_dot(d, obj)
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





function init_legend_beforeplot(arg,holder) {
	/*
	*/

	const table = holder.append('table')
		.style('border-spacing','5px')

	for(const attr of obj.colorbyattributes) {

		const tr = table.append('tr')

		// legend item name
		tr.append('td')
			.style('opacity',.5)
			.style('white-space','nowrap')
			.text(attr.label)

		const colorfunc = scaleOrdinal(schemeCategory10)
		if(attr.values) {
			/*
			provided by dataset config
			{ value: {color} }
			convert to map
			*/
			const values = new Map()
			for(const value in attr.values) {
				const v = attr.values[value]
				v.count = 0
				values.set( value, v)
			}
			attr.values = values
		} else {
			attr.values = new Map()
		}

		for(const d of obj.dots) {
			const value = d.s[attr.key]
			const color = colorfunc( value )
			if(!attr.values.has(value)) {
				attr.values.set(value,{ count:1, color:color })
			}
			attr.values.get( value ).count++
		}

		// legend values
		const cellholder = tr.append('td')

		for(const [value,o] of attr.values) {
			const cell = cellholder.append('div')
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



function click_dot(dot, obj) {
	const pane = client.newpane({x:d3event.clientX,y:d3event.clientY})
	pane.header.text(dot.sample)

	const wait = pane.body.append('div')
		.style('margin','20px')
		.text('Loading ...')

	let sampletracks

	client.dofetch('/mdssvcnv',{
		genome:obj.genome.name,
		dslabel:obj.dslabel,
		querykey:obj.querykey, // TODO general track
		gettrack4singlesample:dot.sample
	})
	.then(data=>{
		wait.text('Loading ... ...')
		sampletracks = data.tracks
		//return import('./block')
	})
	.then(_=>{
		wait.remove()
		const arg = {
			genome:obj.genome,
			hostURL:(localStorage.getItem('hostURL')||''),
			jwt:(localStorage.getItem('jwt')||''),
			holder:pane.body,
			chr: obj.genome.defaultcoord.chr,
			start: obj.genome.defaultcoord.start,
			stop: obj.genome.defaultcoord.stop,
			nobox:1,
			tklst:[]
		}

		// TODO general track in single-sample mode
		const tk = {
			singlesample:{name:dot.sample},
			mds: obj.mds,
			querykey: obj.querykey,
		}
		for(const k in tk.mds.queries[tk.querykey]) {
			tk[k] = tk.mds.queries[tk.querykey][k]
		}
		arg.tklst.push(tk)


		if(sampletracks) {
			for(const t of sampletracks) arg.tklst.push(t)
		}

		client.first_genetrack_tolist(obj.genome,arg.tklst)
		//new _.Block(arg)
		blocklazyload(arg)
	})
}
