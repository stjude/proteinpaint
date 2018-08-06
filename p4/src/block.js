import {scaleLinear} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event,mouse as d3mouse} from 'd3-selection'
import {transition} from 'd3-transition'
import {format as d3format} from 'd3-format'
import {axisTop, axisLeft} from 'd3-axis'
import * as coord from './coord'
import * as common from './common'
import * as client from './client'


const ntpxwidth = 20  // max allowed pixel width for a nt
const tklabelfontsize = 14


export class Block {

constructor ( arg ) {

	try {
		validate_parameter( arg, this )
	} catch(e) {
		if(e.stack) console.log(e.stack)
		if(this.holder) {
			this.holder.append('div').style('margin','20px').text('Error: '+e)
		} else {
			alert('Error: '+e)
		}
		return
	}

	/* now has:
	.genome
	.views[]
	.tklst[]
	*/

	set_pxwidth_to_regions( this )
	init_view_boundary( this )

	init_dom_for_block( arg, this )

	this.settle_width()

	init_ruler( this )

	// init other tracks

	this.settle_height()

// END of constructor
}



//////////// methods


settle_width () {
	/*
	call after changing width of any column
	update:
		view width and clip box
		block width
		x position for each column accordingly
	*/

	let x = 0
	for(const v of this.views) {
		v.x = x
		v.g.attr('transform','translate('+x+',0)')
		if(v.regions) {
			// update view width
			v.width = v.regions.reduce((i,j)=>i+j.width,0) + (v.regions.length-1)*v.regionspace
			v.cliprect.attr('width', v.width+1 )
		} else {
			// something else
			v.width=100
		}
		x += v.width + v.rightpad
	}
	this.width = this.leftcolumnwidth + this.leftpad
		+ x
		- this.views[this.views.length-1].rightpad
		+ this.rightpad + this.rightcolumnwidth

	this.svg.svg
		.transition()
		.attr('width', this.width)
	this.svg.gleft
		.transition()
		.attr('transform','translate('+this.leftcolumnwidth+',0)')
	this.svg.gmiddle
		.transition()
		.attr('transform','translate('+(this.leftcolumnwidth+this.leftpad)+')')
	this.svg.gright
		.transition()
		.attr('transform','translate('+(this.width-this.rightcolumnwidth)+',0)')
}



settle_height () {
	this.height = 0
	for(const t of this.tklst) {
		this.height += t.toppad + t.height + t.bottompad
	}
	// update cliprect height
	for(const v of this.views) {
		v.cliprect.attr('height', this.height)
	}
	this.svg.svg
		.transition()
		.attr('height', this.height)
}


init_dom_tk ( tk ) {
	/*
	call for a newly created tk
	initialize common things
	*/

	tk.block = this
	tk.y = 0 // shift by
	tk.toppad = 3
	tk.bottompad = 3

	tk.gleft = this.svg.gleft.append('g') // y shift
	tk.tklabel = tk.gleft
		.append('text')
		.attr('fill','black')
		.attr('font-family',client.font)
		.attr('font-size', tklabelfontsize)
		.attr('font-weight','bold')
		.attr('text-anchor','end')
		.attr('y', tklabelfontsize)
		.on('mousedown',()=>{
			// TODO
		})

	tk.gright = this.svg.gright.append('g') // y shift
	tk.configlabel = tk.gright
		.append('text')
		.text('CONFIG')
		.attr('fill','#ccc')
		.attr('font-family',client.font)
		.attr('font-size', tklabelfontsize)
		.attr('y', tklabelfontsize)
		.on('click',()=>{
			// TODO
		})

	tk.views = {}
	for( const v of this.views ) {
		const tv = {
			g: v.gscroll.append('g'), // y shift
		}
		tk.views[ v.id ] = tv
	}
}


pxoff2viewregion ( v, px ) {
	/*
	relative to the start of a view
	from px offset to the region & coord in this view
	*/
	px -= v.x
	if( px > 0 ) {
		// px after v start
		for(let i=v.startidx; i<v.regions.length; i++) {
			const r = v.regions[ i ]
			if( r.width >= px ) {
				// in this region
				const sf = (r.stop - r.start) / r.width
				if( v.reverse ) {
					return [ i, r.stop - Math.floor( sf * px ) ]
				}
				return [ i, r.start + Math.ceil( sf * px ) ]
			}
			// not in this region
			px -= v.regionspace + r.width
		}
		// hit pos has not been found
		const i = v.regions.length-1
		return [ i, v.reverse ? v.regions[i].bstart : v.regions[i].bstop ]
	}

	// px before v start
	px *= -1
	for(let i=v.startidx; i>=0; i--) {
		const r = v.regions[ i ]
	}
}




// END of block
}













////////////////////////// INIT helpers


function validate_parameter ( arg, block ) {

	if(!arg.holder) throw '.holder missing'
	block.holder = arg.holder
	if(!arg.genome) throw '.genome{} missing'
	block.genome = arg.genome

	if(arg.debugmode) window.bb = block

	block.leftpad = 10
	block.rightpad = 10
	block.leftcolumnwidth = 100
	block.rightcolumnwidth = 100

	////////////////////// tracks

	if(!arg.tklst) {
		if(arg.tracks) {
			if(!Array.isArray(arg.tracks)) throw '.tracks[] must be array'
			arg.tklst = arg.tracks
		} else {
			arg.tklst = []
		}
	}
	if(!Array.isArray(arg.tklst)) throw '.tklst[] must be array'
	// parse and insert tracks
	block.tklst = []

	for(const t of arg.tklst) {
		if(!t.type) throw '.type missing from a provided track'
		// TODO if track type is valid
		// validate track by type
	}


	////////////////////// views and regions

	block.views = []
	// each view is a list of regions

	if( arg.gm ) {
		// single gm
		// TODO add new tk, also set rglst
		block.holder.text('show protein view for '+arg.gm.isoform)

	} else if( arg.gmlst ) {
		// list of gm from the same gene
		block.holder.text('show protein view for '+arg.gmlst[0].name)

	} else if( arg.range_0based ) {
		// single region { chr, start, stop }
		const r = arg.range_0based
		const e =  coord.invalidcoord(
			arg.genome,
			r.chr,
			r.start,
			r.stop
		)
		if(e) throw '.range_0based: '+e
		block.holder.text('show '+r.chr+':'+r.start+'-'+r.stop)

	} else if( arg.range_1based ) {
		// single region { chr, start, stop } 1-based
		const r = arg.range_1based
		r.start -= 1
		r.stop -= 1
		const e =  coord.invalidcoord(
			arg.genome,
			r.chr,
			r.start,
			r.stop
		)
		if(e) throw '.range_1based: '+e
		block.holder.text('show '+r.chr+':'+r.start+'-'+r.stop)

	} else if( arg.position_0based ) {
		// single region, "chr:start-stop"
		const r = coord.string2pos( arg.position_0based, block.genome, true )
		if(r) {
			// 
		} else {
			throw 'invalid region: '+arg.position_0based
		}
		block.holder.text('show '+r.chr+':'+r.start+'-'+r.stop)

	} else if( arg.position_1based ) {
		// single region, "chr:start-stop"
		const r= coord.string2pos( arg.position_1based, block.genome )
		if(r) {
			// 
		} else {
			throw 'invalid region: '+arg.position_1based
		}
		block.holder.text('show '+r.chr+':'+r.start+'-'+r.stop)

	} else {
		// no position given; use genome default position
		const r = block.genome.defaultcoord
		const chr = block.genome.chrlookup[ r.chr.toUpperCase() ]
		if(!chr) throw 'invalid chr from defaultcoord'
		const region = { 
			chr: r.chr,
			bstart: 0,
			bstop: chr.len,
			start: r.start,
			stop: r.stop,
		}
		if( arg.width ) {
			if( !common.isPositiveInteger( arg.width)) throw 'invalid width'
			region.width = arg.width
		}
		block.views.push({
			regions: [ region ],
			regionspace: 10,
			rightpad: 10,
		})
	}
}



function set_pxwidth_to_regions ( b ) {
	/*
	initialize px width for regions
	*/
	const uncovered_regions = []
	let covered_bpsum   = 0,
		covered_pxsum   = 0,
		uncovered_bpsum = 0
	for(const view of b.views) {
		if(!view.regions) continue
		for(const r of view.regions) {
			if(r.width) {
				// width set
				covered_pxsum += r.width
				covered_bpsum += r.stop-r.start
			} else {
				// width not set
				uncovered_regions.push( r )
				uncovered_bpsum += r.stop-r.start
			}
		}
	}
	if(uncovered_bpsum==0) return
	// there are regions without width

	let pxperbp

	if(covered_bpsum) {
		// there are regions already have width set
		// not working
	} else {
		// ideal width
		const minwidth = 800
		const w = b.holder.node().getBoundingClientRect().width
		const idealwidth = Math.ceil( Math.max(w*.63,minwidth) )
		pxperbp = idealwidth / uncovered_bpsum
	}

	for(const r of uncovered_regions) {
		r.width = Math.ceil( pxperbp * (r.stop-r.start) )
	}
}



function init_view_boundary ( b ) {
	for(const v of b.views) {
		if(v.regions) {
			v.startidx = 0
			v.stopidx = v.regions.length-1
		}
	}
}



function init_dom_for_block ( arg, b ) {
	/*
	init dom for block
	*/
	b.dom = {}
	b.dom.row1 = b.holder.append('div')
	b.dom.svgdiv = b.holder.append('div')
		.style('border','solid 1px black') // remove
	b.svg = {}
	b.svg.svg = b.dom.svgdiv.append('svg')



	// insert negative layers here
	//b.svg.layer_neg1


	// layer #0
	b.svg.layer_0 = b.svg.svg.append('g')

	// insert plus layers here
	//b.svg.layer_pos1

	// render in layer #0

	b.svg.gleft = b.svg.layer_0.append('g')
	//	.attr('transform','translate('+b.leftcolumnwidth+',0)')

	b.svg.gmiddle = b.svg.layer_0.append('g')
	//	.attr('transform','translate('+(b.leftcolumnwidth+b.leftpad)+',0)')

	for(const v of b.views) {
		init_dom_view( v, b )
	}

	b.svg.gright = b.svg.layer_0.append('g')
	//	.attr('transform','translate('+(b.width-b.rightpad)+',0)')
}



function init_dom_view ( v, b ) {
	/* call when adding a new view
	not include creating components for each track
	*/


	v.id = Math.random().toString()
	v.g = b.svg.gmiddle.append('g')

	const clipid = v.id+'clip'
	const clippath = v.g.append('clipPath')
		.attr('id',clipid)
	v.cliprect = clippath.append('rect')

	v.clipframe = v.g.append('g')
		.attr('clip-path','url(#'+clipid+')')

	// panning
	v.gscroll = v.clipframe.append('g')
	.on('mousedown', ()=>{

		if( b.busy )  return

		b.busy = true

		d3event.preventDefault()
		const body = d3select(document.body)
		const x0 = b.rotated ? d3event.clientY : d3event.clientX

		body.on('mousemove', ()=>{
			const xoff = ( b.rotated ? d3event.clientY : d3event.clientX ) - x0
			v.gscroll.attr( 'transform', 'translate('+xoff+',0)' )
		})

		body.on('mouseup', ()=>{
			body.on('mousemove', null)
				.on('mouseup', null)
			v.gscroll.attr( 'transform', 'translate(0,0)' )

			// panned dist
			const xoff = ( b.rotated ? d3event.clientY : d3event.clientX ) - x0

			for(const tk of b.tklst) {
				const tv = tk.views[ v.id ]
				if(!tv) continue
				//  keep shifted until track updates
				tv.g.attr( 'transform', 'translate('+xoff+',0)' )
				tk.update()
			}
		})
	})

	// set scale, dependent on view type

	v.rulerscale = scaleLinear() // assist ruler
	{
		// single-region genomic view
		const r = v.regions[ 0 ]
		if( v.reverse ) {
			v.rulerscale.domain([ r.stop, r.start ])
		} else {
			v.rulerscale.domain([ r.start, r.stop ])
		}
		v.rulerscale.range([ 0, r.width ])
	}
	// TODO gm view
}




function init_ruler ( b ) {
	// call at init; ruler is initiated only once
	const tk = new TKruler( b )
	b.tklst.push( tk )
}





class TKruler {
	constructor ( b ) {

		this.ticksize = 4
		this.fontsize = 14
		this.tickpad = 3
		this.height = this.fontsize + this.tickpad + this.ticksize

		b.init_dom_tk( this )

		this.tklabel
			.text(b.genome.name)
			.attr('y', this.height)
			.attr('font-weight','normal')

		// initialize rulers
		for( const v of b.views ) {
			const tv = this.views[ v.id ]
			if(!tv) continue
			// always a single axis across all regions of this view
			tv.axisfunc = axisTop( v.rulerscale )
				.tickSize( this.ticksize )
				.tickPadding( this.tickpad )

			tv.gaxis = tv.g.append('g')
				.attr('transform', 'translate(0,'+(this.height)+')')
				.call( tv.axisfunc )

			tv.gaxis.selectAll('text')
				.attr('font-family',client.font)
				.attr('font-size', this.fontsize)
		}
		this.update()
	}

	update ( ) {
		for(const v of this.block.views) {
			const tv = this.views[ v.id ]
			if( tv ) {
				tv.gaxis.call( tv.axisfunc )
				tv.g.attr('transform','translate(0,0)')
			}
		}
	}
}
