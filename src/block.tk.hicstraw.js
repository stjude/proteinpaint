import {event as d3event} from 'd3-selection'
//import {hicparsestat, hicparsefragdata} from './hic.straw'
import {bplen} from './common'
import * as client from './client'
import {axisBottom} from 'd3-axis'
import {scaleLinear} from 'd3-scale'



/*
single-sample hic

JUMP 




********************** EXPORTED
loadTk()


********************** INTERNAL



*/



const defaultnmeth = 'NONE' // default normalization method, only for juicebox hic

const minimumbinnum_bp = 200 // minimum bin number at bp resolution
const minimumbinnum_frag = 200 // minimum bin number at frag resolution

const labyspace = 5


let hicstraw // loaded on the fly, will result in bundle duplication


export function loadTk( tk, block ) {

	block.tkcloakon(tk)
	block.block_setheight()

	Promise.resolve()
	.then(()=>{
		return import( './hic.straw').then(p=>{ hicstraw = p})
	})

	.then(()=>{

		// hic file is always custom, so need to stat the file the first time
		if(!tk.uninitialized) {
			// not the first time querying it, proceed to data retrieval
			return
		}

		makeTk(tk, block)

		return fetch( new Request(block.hostURL+'/hicstat',{
			method:'POST',
			body:JSON.stringify({file:tk.file, jwt:block.jwt})
		}))
		.then(data=>{return data.json()})
		.then(data=>{
			if(data.error) throw({message:data.error})
			const err = hicstraw.hicparsestat( tk.hic, data.out )
			if(err) throw({message:err})
			return
		})
	})

	.then(()=>{
		return setResolution(tk, block)
	})

	.then(()=>{
		return mayLoadDomainoverlay(tk, block)
	})

	.then( ()=>{
		return loadData( tk, block)
	})
	.then( data=>{
		const err = renderTk(data, tk, block)
		if(err) throw({message:err})
		return
	})
	.catch(err=>{
		if(err.stack) {
			console.log(err.stack)
		}
		return err.message
	})
	.then( errmsg =>{
		block.tkcloakoff(tk, {error:errmsg})
		block.block_setheight()
	})
}




function setResolution(tk, block) {
	// determine what resolution, if using fragment, will load fragment index

	// list of regions to load data from, including bb.rglst[], and bb.subpanels[]
	const regions = []

	let x=0

	for(let i=block.startidx; i<=block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			x: x+ (i==0?0:1)*block.regionspace
		})
		x += block.regionspace+r.width
	}

	for(const r of block.subpanels) {
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			x: x+r.leftpad
		})
		x += r.leftpad+r.width
	}

	/*
	which resolution? bp or frag
	the same resolution will be shared across all regions
	find biggest region by bp span, use it's pixel width to determine resolution
	*/
	const maxbpwidth = Math.max( ...regions.map(i => i.stop-i.start) )
	let resolution_bp = null
	for(const res of tk.hic.bpresolution) {
		if( maxbpwidth / res > minimumbinnum_bp ) {
			// this bp resolution is good
			resolution_bp = res
			break
		}
	}

	return Promise.resolve()
	.then(()=>{

		if(resolution_bp) {
			return
		}
		if(!tk.hic.enzymefile) {
			// no enzyme fragment data, allowed, use finest bp resolution
			resolution_bp = tk.hic.bpresolution[ tk.hic.bpresolution.length-1 ]
			return
		}

		/*
		bp resolution not applicable, will use frag resolution
		retrieve fragments in each regions, then use the fragment index to determine the resolution (# of fragments)
		*/


		const tasks = []

		// fetch fragments for each region
		for( const r of regions ) {
			tasks.push( fetch( new Request( block.hostURL+'/bedjdata', {
				method:'POST',
				body: JSON.stringify({
					jwt: block.jwt,
					file: tk.hic.enzymefile,
					isbed: true,
					rglst:[ {chr:r.chr, start:r.start, stop:r.stop } ]
				})
			}))
			.then(data=>{return data.json()})
			.then(data=>{
				if(data.error) throw({message:data.error})
				if(!data.items) throw({message:'.items[] missing at mapping coord to fragment index'})

				const [err, map, start, stop] = hicstraw.hicparsefragdata( data.items )
				if(err) throw({message:err})
				r.frag = {
					id2coord: map,
					startidx: start,
					stopidx: stop
				}
				return
			})
			)
		}

		return Promise.all( tasks )
	})
	.then( ()=>{
		let resolution_frag
		if(!resolution_bp) {
			const maxfragspan = Math.max( ...regions.map( i=> i.frag.stopidx-i.frag.startidx ) )
			for(const v of tk.hic.fragresolution) {
				if(maxfragspan/v > minimumbinnum_frag) {
					resolution_frag = v
					break
				}
			}
			if(!resolution_frag) {
				resolution_frag = tk.hic.fragresolution[ tk.hic.fragresolution.length-1 ]
			}
		}
		tk.regions = regions
		tk.resolution_bp = resolution_bp
		tk.resolution_frag = resolution_frag
		if(resolution_bp) {
			tk.label_resolution.text('Resolution: '+bplen(resolution_bp))
		} else {
			tk.label_resolution.text('Resolution: '+resolution_frag+' fragment'+(resolution_frag>1?'s':''))
		}
		return
	})
}




function mayLoadDomainoverlay(tk, block) {
	// must already have tk.regions[]

	return Promise.resolve()
	.then(()=>{
		
		if(!tk.domainoverlay || !tk.domainoverlay.inuse) return

		// fetch domains for each region
		const tasks=[]
		for(const r of tk.regions) {
			tasks.push( fetch( new Request( block.hostURL+'/bedjdata', {
				method:'POST',
				body: JSON.stringify({
					jwt:block.jwt,
					file: tk.domainoverlay.file,
					url: tk.domainoverlay.url,
					isbed: true,
					rglst:[ {chr:r.chr, start:r.start, stop:r.stop } ]
				})
			}))
			.then(data=>{return data.json()})
			.then(data=>{
				if(data.error) throw({message:data.error})
				if(!data.items || data.items.length==0) return
				r.domainlst = data.items
				// each item is a domain, may support inter-chr domains by parsing json
			})
			)
		}
		return Promise.all(tasks)
	})
}






function loadData( tk, block) {
	const resolution_bp = tk.resolution_bp
	const resolution_frag = tk.resolution_frag

	// coord string for querying to use for each region
	for(const r of tk.regions) {
		r._str = (tk.hic.nochr ? r.chr.replace('chr','') : r.chr)
			+ ':'
			+( resolution_bp ? r.start+ ':'+r.stop : r.frag.startidx+':'+r.frag.stopidx )
	}

	const tasks = []

	// 1: load data within each region

	for(const [i,r] of tk.regions.entries()) {
		const par = {
			jwt:block.jwt,
			file: tk.file,
			pos1: r._str,
			pos2: r._str,
			nmeth: tk.normalizationmethod,
			mincutoff: tk.mincutoff
		}
		if(resolution_bp) {
			par.resolution = resolution_bp
		} else {
			par.resolution = resolution_frag
			par.isfrag = true
		}
		tasks.push( fetch( new Request(block.hostURL+'/hicdata',{
			method:'POST',
			body:JSON.stringify(par)
			}))
			.then(data=>{return data.json()})
			.then(data=>{
				if(data.error) throw({message:data.error})
				if(!data.items || data.items.length==0) {
					// a region have no data
					return null
				}
				return {
					items:data.items,
					regionidx: i
				}
			})
		)
	}

	// 2: load data from each pair of regions

	for(let i=0; i<tk.regions.length-1; i++) {

		for(let j=i+1; j<tk.regions.length; j++) {
			
			const par = {
				jwt:block.jwt,
				file: tk.file,
				pos1: tk.regions[i]._str,
				pos2: tk.regions[j]._str,
				nmeth: tk.normalizationmethod,
				mincutoff: tk.mincutoff
			}
			if(resolution_bp) {
				par.resolution = resolution_bp
			} else {
				par.resolution = resolution_frag
				par.isfrag = true
			}
			tasks.push( fetch( new Request(block.hostURL+'/hicdata',{
				method:'POST',
				body:JSON.stringify(par)
				}))
				.then(data=>{return data.json()})
				.then(data=>{
					if(data.error) throw({message:data.error})
					if(!data.items || data.items.length==0) {
						return null
					}
					return {
						items: data.items,
						leftregionidx: i,
						rightregionidx: j
					}
				})
			)
		}
	}

	return Promise.all(tasks)
		.then(data=>{
			return [ data, resolution_bp, resolution_frag]
		})
}






function renderTk( tmp, tk, block ) {

	const [ datalst, resolution_bp, resolution_frag ] = tmp

	tk.data = []

	for(const data of datalst) {

		if(!data) {
			// no data over a particular region or pair
			continue
		}

		let r_left,
			r_right,
			fs_left, // # pixel per bp
			fs_right

		// using the same logic in hic.straw.js, inherently related to how straw generates data
		let firstisleft = false

		if(data.regionidx!=undefined) {
			// single region
			r_left = r_right = tk.regions[ data.regionidx ]
			fs_left = fs_right = r_left.width / (r_left.stop-r_left.start)
			firstisleft = true // doesn't matter
		} else {
			// pair of regions
			r_left = tk.regions[ data.leftregionidx ]
			fs_left = r_left.width / (r_left.stop-r_left.start)
			r_right = tk.regions[ data.rightregionidx ]
			fs_right = r_right.width / (r_right.stop-r_right.start)

			firstisleft = block.genome.chrlookup[r_left.chr.toUpperCase()].len > block.genome.chrlookup[r_right.chr.toUpperCase()].len
		}


		for(const [n1,n2,v] of data.items) {

			// a contact

			let coord1, // bp position
				coord2,
				span1, // bp span
				span2

			if(resolution_frag) {

				// fragment resolution

				// the beginning of fragment index
				const idx_left = firstisleft ? n1 : n2
				const idx_right = firstisleft ? n2 : n1

				let a = r_left.frag.id2coord.get( idx_left )
				if(!a) {
					a=r_right.frag.id2coord.get(idx_left)
					if(!a) return 'unknown frag id in region '+data.leftregionidx+': '+idx_left
				}
				coord1 = a[0]
				span1 = a[1]-a[0]

				// the end of fragment id of a, may be out of range!
				if( r_left.frag.id2coord.has( idx_left + resolution_frag ) ) {
					const x = r_left.frag.id2coord.get( idx_left+resolution_frag )
					span1 = x[1]-coord1
				}

				let b = r_right.frag.id2coord.get( idx_right )
				if(!b) {
					b=r_left.frag.id2coord.get(idx_right)
					if(!b) return 'unknown frag id in region '+data.rightregionidx+': '+idx_right
				}
				coord2 = b[0]
				span2 = b[1]-b[0]

				// the end of fragment id of b
				if( r_right.frag.id2coord.has( idx_right + resolution_frag ) ) {
					const x = r_right.frag.id2coord.get( idx_right+resolution_frag )
					span2 = x[1]-coord2
				}

			} else {

				// bp resolution
				coord1 = firstisleft ? n1 : n2
				coord2 = firstisleft ? n2 : n1
				span1 = span2 = resolution_bp

			}

			/*
			if(coord1>coord2) {
				// flip? why?
				let x=coord2
				coord2=coord1
				coord1=x
				x=span2
				span2=span1
				span1=x
			}
			*/

			// if the contact is inside a domain
			let insidedomain = false
			if( tk.domainoverlay && tk.domainoverlay.inuse ) {
				if(data.regionidx!=undefined) {
					// single region
					if(r_left.domainlst) {
						if( r_left.domainlst.find( i=> i.start<=coord1 && i.stop>=coord2 ) ) {
							insidedomain = true
						}
					}
				} else {
					// pair of region
					// only look for overlapping regions
				}
			}


			// on-screen x start/stop of left/right bins
			// x positions remain constant by screezing or shifting side

			if(data.leftregionidx!=undefined && r_left.chr==r_right.chr) {

				// a pair of regions both from same chr
				// in case the pair overlaps, contact points will need to be duplicated to appear symmetrical
				if((coord1>r_left.start-span1 && coord1<r_left.stop) && (coord2>r_right.start-span2 && coord2<r_right.stop)) {
					const left1 = r_left.x + fs_left * (coord1-r_left.start)
					const left2 = left1 + fs_left * span1
					const right1 = r_right.x + fs_right * (coord2-r_right.start)
					const right2 = right1 + fs_right * span2
					tk.data.push([ left1, left2, right1, right2, v, insidedomain ])
				}

				if((coord2>r_left.start-span2 && coord2<r_left.stop) && (coord1>r_right.start && coord1<r_right.stop)) {
					const left1 = r_left.x + fs_left * (coord2-r_left.start)
					const left2 = left1 + fs_left * span2
					const right1 = r_right.x + fs_right * (coord1-r_right.start)
					const right2 = right1 + fs_right * span1
					tk.data.push([ left1, left2, right1, right2, v, insidedomain ])
				}
			} else {

				// single region
				const left1 = r_left.x + fs_left * (coord1-r_left.start)
				const left2 = left1 + fs_left * span1
				const right1 = r_right.x + fs_right * (coord2-r_right.start)
				const right2 = right1 + fs_right * span2
				tk.data.push([ left1, left2, right1, right2, v, insidedomain ])
			}
		}
	}

	drawCanvas(tk, block)

	return
}






function drawCanvas(tk, block) {
	/* call when:
		finish loading data
		changing max value, min cutoff, color
	*/

	const canvas = tk.hiddencanvas.node()

	const canvaswidth = block.width + block.subpanels.reduce( (i,j)=> i + j.leftpad + j.width, 0 )

	// dynamic height
	const canvasheight = tk.data.reduce( (i,j)=>Math.max(i, (j[3]-j[0])/2 ), 0)

	canvas.width = canvaswidth
	canvas.height = canvasheight

	const ctx = canvas.getContext('2d')

	let maxv

	if(!maxv) {
		// somehow must not use .map, at large view range it runs out of max call stack
		//maxv = Math.max( ...tk.data.map(i=>i[4]) )
		maxv = tk.data[0][0]
		for(const i of tk.data) maxv = Math.max( maxv, i[4])
	}
	if(tk.maxpercentage) {
		maxv = maxv * tk.maxpercentage / 100
	}

	resize_label(tk, block)

	for(const [left1,left2, right1,right2, value, insidedomain] of tk.data) {

		// diamond
		// color of the diamond

		if(insidedomain) {
			const r = 200+Math.floor( 50* (maxv-value) / maxv)
			ctx.fillStyle = 'rgb('+r+','+r+','+r+')'
		} else {
			const r = Math.floor( 255* (maxv-value) / maxv)
			ctx.fillStyle = 'rgb(255,'+r+','+r+')'
		}

		ctx.beginPath()

		let x1,y1, // top
			x2,y2, // left
			x3,y3, // bottom
			x4,y4  // top
		if(tk.pyramidup) {
			x1 = (left1+right2)/2
			y1 = canvas.height - (right2-left1)/2
			x2 = (left1+right1)/2
			y2 = canvas.height - (right1-left1)/2
			x3 = (left2+right1)/2
			y3 = canvas.height - (right1-left2)/2
			x4 = (left2+right2)/2
			y4 = canvas.height - (right2-left2)/2
		} else {
			x1 = (left2+right1)/2
			y1 = (right1-left2)/2
			x2 = (left1+right1)/2
			y2 = (right1-left1)/2
			x3 = (left1+right2)/2
			y3 = (right2-left1)/2
			x4 = (left2+right2)/2
			y4 = (right2-left2)/2
		}

		ctx.moveTo(x1,y1)
		ctx.lineTo(x2,y2)
		ctx.lineTo(x3,y3)
		ctx.lineTo(x4,y4)

		ctx.closePath()
		ctx.fill()
	}

	tk.img
		.attr('width',canvaswidth)
		.attr('height',canvasheight)
		.attr('xlink:href', canvas.toDataURL())

	// update colorscale
	tk.colorscale.scale.domain([0, maxv])
	if(tk.mincutoff!=undefined && tk.mincutoff!=0) {
		const x = tk.colorscale.scale( tk.mincutoff )
		tk.colorscale.tick_mincutoff
			.attr('x1', x)
			.attr('x2', x)
			.attr('stroke','black')
		tk.colorscale.label_mincutoff
			.attr('x', x)
			.text(tk.mincutoff)
	} else {
		tk.colorscale.tick_mincutoff
			.attr('stroke','none')
		tk.colorscale.label_mincutoff.text('')
	}
	client.axisstyle({
		axis:tk.colorscale.axisg.call(
			axisBottom()
				.scale( tk.colorscale.scale )
				.tickValues([0, maxv])
		),
		showline:1,
		color:'black'
	})

	tk.height_main = tk.toppad + Math.max( tk.left_labelheight, canvasheight) + tk.bottompad
}





function resize_label(tk, block) {
	tk.leftLabelMaxwidth = tk.colorscale.barwidth
	tk.tklabel
		.each(function(){
			tk.leftLabelMaxwidth = Math.max( tk.leftLabelMaxwidth, this.getBBox().width)
		})
	tk.label_resolution
		.each(function(){
			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
		})
	block.setllabel()
}





function makeTk(tk, block) {

	delete tk.uninitialized
	tk.hic.genome = block.genome
	if(tk.hic.enzyme) {
		if(block.genome.hicenzymefragment) {
			const e = block.genome.hicenzymefragment.find( i=> i.enzyme.toUpperCase()==tk.hic.enzyme.toUpperCase() )
			if(e) {
				tk.hic.enzymefile = e.file
			} else {
				block.error('unknown Hi-C enzyme: '+tk.hic.enzyme)
				delete tk.hic.enzyme
			}
		} else {
			block.error('Hi-C enzyme fragment not available for this genome')
			delete tk.hic.enzyme
		}
	}

	if(!tk.maxpercentage) {
		tk.maxpercentage = 90
	}
	if(tk.mincutoff==undefined) {
		tk.mincutoff=0
	}
	if(!tk.normalizationmethod) {
		tk.normalizationmethod = defaultnmeth
	}

	tk.tklabel.text(tk.name)

	let laby = labyspace + block.labelfontsize
	tk.label_resolution = block.maketklefthandle(tk, laby)
		.attr('class',null)
	laby += labyspace + block.labelfontsize

	tk.colorscale = {}
	{
		tk.colorscale.barwidth = 100
		laby+=labyspace
		const barheight = 14

		const g = tk.gleft.append('g')
			.attr('transform','translate('+(block.tkleftlabel_xshift - tk.colorscale.barwidth)+', '+laby+')')

		const defs = g.append('defs')
		const id = Math.random().toString()
		const gradient = defs.append('linearGradient').attr('id',id)
		gradient.append('stop').attr('offset',0).attr('stop-color','white')
		gradient.append('stop').attr('offset',1).attr('stop-color','rgb(255,0,0)')

		const space = 1 // y space between bar and axis

		tk.colorscale.bar = g.append('rect')
			.attr('height',barheight)
			.attr('width', tk.colorscale.barwidth)
			.attr('fill','url(#'+id+')')
		tk.colorscale.axisg = g.append('g').attr('transform','translate(0,'+(barheight+space)+')')
		tk.colorscale.scale = scaleLinear().range([0, tk.colorscale.barwidth])

		// min cutoff indicator
		tk.colorscale.tick_mincutoff = g.append('line')
			.attr('y1',barheight+space-3)
			.attr('y2',barheight+space)
		tk.colorscale.label_mincutoff = g.append('text')
			.attr('text-anchor','middle')
			.attr('font-family',client.font)
			.attr('font-size', 12)
			.attr('y',barheight+space-4)

		laby += barheight+10+block.labelfontsize
	}

	laby += 10

	tk.left_labelheight = laby

	tk.img = tk.glider.append('image')

	// sneak canvas, render graph then copy to tk.img for showing
	tk.hiddencanvas = block.holder.append('canvas')
		.style('display','none')

	tk.config_handle = block.maketkconfighandle(tk)
		.on('click',()=>{
			configPanel(tk,block)
		})
}





function configPanel(tk,block) {
	tk.tkconfigtip.clear()
		.showunder( tk.config_handle.node() )
	
	// percentage of max value
	{
		const row = tk.tkconfigtip.d.append('div')
			.style('margin-bottom','10px')
		row.append('span').html('Color scale max&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value',tk.maxpercentage)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				const v = Number.parseInt(d3event.target.value)
				if(Number.isNaN(v) || v<=0 || v>100) {
					alert('Please enter integer between 1 and 100')
					return
				}
				tk.maxpercentage = v
				drawCanvas(tk, block)
			})
		row.append('span').text('%')
		row.append('div')
			.style('color','#858585')
			.style('font-size','.8em')
			.text('Percentage of actual max value in the view range')
	}

	// min cutoff
	{
		const row = tk.tkconfigtip.d.append('div')
			.style('margin-bottom','10px')
		row.append('span').html('Minimum cutoff value&nbsp;')
		row.append('input')
			.attr('type','number')
			.style('width','50px')
			.property('value',tk.mincutoff)
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				const v = Number.parseFloat(d3event.target.value)
				if(Number.isNaN(v)) {
					alert('Please enter a valid number')
					return
				}
				tk.mincutoff = v
				loadTk(tk, block)
			})
		row.append('div')
			.style('color','#858585')
			.style('font-size','.8em')
			.html('Contacting regions with scores &le; cutoff will not be shown')
	}

	// normalization method
	{
		const row = tk.tkconfigtip.d.append('div')
			.style('margin-bottom','10px')
		row.append('span').html('Normalization&nbsp;')
		const s = row.append('select')
			.on('change',()=>{
				const ss=s.node()
				tk.normalizationmethod = ss.options[ ss.selectedIndex ].innerHTML
				loadTk(tk,block)
			})
		s.append('option').text(defaultnmeth)
		s.append('option').text('VC')
		s.append('option').text('VC_SQRT')
		s.append('option').text('KR')
		for(const o of s.node().options) {
			if(o.innerHTML==tk.normalizationmethod) {
				o.selected=true
				break
			}
		}
	}

	// point up down
	{
		const row = tk.tkconfigtip.d
			.append('div')
			.style('margin-bottom','10px')
			.append('button')
			.text('Triangles point '+(tk.pyramidup ? 'down' : 'up'))
			.on('click',()=>{
				tk.pyramidup = !tk.pyramidup
				drawCanvas(tk, block)
				tk.tkconfigtip.hide()
			})
	}

	// domain overlay
	if(tk.domainoverlay) {
		// equipped with domain overlay data
		const row = tk.tkconfigtip.d.append('div')
			.style('margin-bottom','10px')
		row.append('span')
			.html('Overlay with '+tk.domainoverlay.name+' domains&nbsp;')
		row.append('button')
			.text( tk.domainoverlay.inuse ? 'No' : 'Yes' )
			.on('click',()=>{
				tk.domainoverlay.inuse = !tk.domainoverlay.inuse
				loadTk(tk, block)
			})
	}
}
