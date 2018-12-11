import * as client from './client'
import * as common from './common'
import {axisLeft,axisBottom} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import blocklazyload from './block.lazyload'



/*
obj:
.holder
.legendtable
.genome {}
.dslabel
.dots [ {} ]
	.x
	.y
	.sample
	.s {}
.dotselection
.sample2dot MAP
.scattersvg SVG
.colorbyattributes [ {} ]
	.key
	.label
	.__inuse
	.labelhandle
	.values MAP
		k: value name
		v: {}
			.color
			.name
			.count INT
			.cell <div>
.colorbygeneexpression{}
	.querykey
	.labelhandle
	.__inuse
.tracks[]
	tracks to be shown in single sample by clicking dots


********************** EXPORTED
init()
********************** INTERNAL
init_plot()
init_dotcolor_legend
click_dot
launch_singlesample


*/



const radius=3



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
		.style('border-spacing','20px')
	
	const tr1 = _table.append('tr') // row has two <td>

	const tr1td1 = tr1.append('td')
	const tr1td2 = tr1.append('td')
		.style('vertical-align','top')

	{
		// sample search may be configurable
		const row = tr1td2.append('div')
			.style('margin-bottom','5px')
		row.append('input')
			.attr('type','text')
			.attr('placeholder','Search sample')
			.style('width','200px')
			.on('keyup',()=>{
				const str0 = d3event.target.value
				if(!str0) {
					// reset
					obj.dotselection.transition().attr('r', radius)
					return
				}
				const str = str0.toLowerCase()
				obj.dotselection
					.filter( d=> d.sample.toLowerCase().indexOf( str )!=-1 )
					.transition().attr('r', radius*2)
				obj.dotselection
					.filter( d=> d.sample.toLowerCase().indexOf( str )==-1 )
					.transition().attr('r', 1)
			})
	}
	obj.legendtable = tr1td2.append('table')
		.style('border-spacing','5px')


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

		obj.querykey = data.querykey // for the moment it should always be set

		// TODO generic attributes for legend, specify some categorical ones for coloring
		obj.colorbyattributes = data.colorbyattributes
		obj.colorbygeneexpression = data.colorbygeneexpression
		init_dotcolor_legend(obj)

		// optional stuff
		obj.tracks = data.tracks

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


	const circles=dots.append('circle')
		.attr('stroke','none')
		.on('mouseover',d=>{
			d3event.target.setAttribute('stroke','white')
			const lst=[ 
				{k:'name',v:d.sample}
			]
			for(const attrkey in obj.mds.sampleAttribute.attributes) {
				const attr = obj.mds.sampleAttribute.attributes[attrkey]
				const v = d.s[attrkey]
				lst.push( {
					k:attr.label,
					v: d.s[attrkey]
				} )
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

	assign_color4dots( obj )


	function resize() {
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




function assign_color4dots(obj) {

	let byattr

	if(obj.colorbygeneexpression && obj.colorbygeneexpression.__inuse) {

	} else if(obj.colorbyattributes) {

		byattr = obj.colorbyattributes.find( i=> i.__inuse ) || obj.colorbyattributes[0]

	}

	obj.dotselection
		.transition()
		.attr('fill', d=>{
			if(byattr) {
				const value = d.s[ byattr.key ]
				return byattr.values.get( value ).color
			}
			return '#ccc'
		})
}




function init_dotcolor_legend(obj) {
	/*
	show legend for coloring dots/samples
	by pre-defined sample attributes, categorical
	by gene expression
	*/

	if(obj.colorbyattributes) {
		if(!obj.colorbyattributes.find(i=>i.__inuse)) obj.colorbyattributes[0].__inuse=true

		for(const attr of obj.colorbyattributes) {

			const tr = obj.legendtable.append('tr')

			// legend item name
			attr.labelhandle = tr.append('td')
				.append('div')
				.style('white-space','nowrap')
				.text(attr.label)
				.attr('class','sja_clb')
				.on('click',()=>{
					// click an attribute to select it for coloring dots
					for(const attr2 of obj.colorbyattributes) {
						attr2.__inuse=false
						attr2.labelhandle.style('background','').style('border-bottom','')
					}
					attr.__inuse=true
					attr.labelhandle.style('background','#ededed').style('border-bottom','solid 2px #858585')
					assign_color4dots(obj)
				})

			if(attr.__inuse) {
				attr.labelhandle.style('background','#ededed').style('border-bottom','solid 2px #858585')
			}

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
				// for each value

				const cell = cellholder.append('div')
					.style('display','inline-block')
					.attr('class','sja_clb')
					.on('click', ()=>{
						// clicking a value from this attribute to toggle the select on this value, if selected, only show such dots

						if(o.selected) {
							// already selected, turn off
							o.selected=false
							cell.style('border','')
							obj.dotselection.transition().attr('r', radius)
							return
						}

						// not yet, select this one
						for(const o2 of attr.values.values()) {
							o2.selected = false
							o2.cell.style('border','')
						}
						o.selected = true
						cell.style('border','solid 1px #858585')
						obj.dotselection.transition().attr('r', d=> d.s[attr.key]==value ? radius : 0 )
					})
				cell.append('div')
					.style('display','inline-block')
					.attr('class','sja_mcdot')
					.style('background',o.color)
					.style('margin-right','3px')
					.text(o.count)
				cell.append('div')
					.style('display','inline-block')
					.style('color',o.color)
					.text( o.name || value )
				o.cell = cell
			}
		}
	}

	if(obj.colorbygeneexpression) {
		/*
		const tr = obj.legendtable.append('tr')
		obj.colorbygeneexpression.labelhandle = tr.append('td')
			.append('div')
			.text('Gene expression')
		const td = tr.append('td')
		*/
	}
}



function click_dot(dot, obj) {
	/*
	clicking a dot to launch browser view of tracks from this sample
	*/

	const pane = client.newpane({x:d3event.clientX,y:d3event.clientY})
	pane.header.text(dot.sample)

	const wait = pane.body.append('div')
		.style('margin','20px')
		.text('Loading ...')


	client.dofetch('/mdssvcnv',{
		genome:obj.genome.name,
		dslabel:obj.dslabel,
		querykey:obj.querykey, // TODO general track
		gettrack4singlesample:dot.sample
	})
	.then(data=>{
		// done getting assay tracks for this sample
		wait.remove()
		launch_singlesample({
			obj: obj,
			dot: dot,
			sampletracks: data.tracks,
			holder: pane.body
		})
	})
}






function launch_singlesample (p) {

	const {obj, dot, sampletracks, holder} = p

	const arg = {
		genome:obj.genome,
		hostURL:(localStorage.getItem('hostURL')||''),
		jwt:(localStorage.getItem('jwt')||''),
		holder: holder,
		chr: obj.genome.defaultcoord.chr,
		start: obj.genome.defaultcoord.start,
		stop: obj.genome.defaultcoord.stop,
		nobox:1,
		tklst:[]
	}

	if(obj.tracks) {
		// quick fix for adding tracks to single-sample view
		for(const t of obj.tracks) arg.tklst.push(t)
	}


	// TODO general track in single-sample mode

	const mdstk = obj.mds.queries[ obj.querykey ] // TODO general track
	if(mdstk) {
		const tk = {
			singlesample:{name: dot.sample},
			mds: obj.mds,
			querykey: obj.querykey,
		}
		for(const k in mdstk) {
			tk[k] = mdstk[k]
		}
		arg.tklst.push(tk)

		if(mdstk.checkexpressionrank) {

			const et = {
				type: client.tkt.mdsexpressionrank,
				name: dot.sample+' gene expression rank',
				//mds: tk.mds,
				dslabel: obj.mds.label,
				querykey: mdstk.checkexpressionrank.querykey,
				sample: dot.sample,
			}

			/*
			in what group to compare expression rank?
			use the last attr from svcnv track
			*/
			if(mdstk.groupsamplebyattr) {
				const lst = mdstk.groupsamplebyattr.attrlst
				if(lst && lst.length) {

					et.attributes = []

					for(const attr of lst) {
						et.attributes.push( {
							k: attr.k,
							label: attr.label,
							kvalue: dot.s[attr.k]
						})
					}
				}
			}

			arg.tklst.push(et)
		}
	}


	if(sampletracks) {
		for(const t of sampletracks) arg.tklst.push(t)
	}

	client.first_genetrack_tolist(obj.genome,arg.tklst)
	blocklazyload(arg)
}
