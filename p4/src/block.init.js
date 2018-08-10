import {scaleLinear} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import * as coord from './coord'
import * as common from './common'
import * as client from './client'





export function validate_parameter_init ( arg, block ) {

	if(!arg.holder) throw '.holder missing'
	block.holder = arg.holder
	if(!arg.genome) throw '.genome{} missing'
	block.genome = arg.genome

	if(arg.debugmode) window.bb = block

	block.ntpxwidth = 20  // max allowed pixel width for a nt
	block.leftpad = 10
	block.rightpad = 10
	block.leftcolumnwidth = 100
	block.rightcolumnwidth = 100
	block.tklabelfontsize = 14
	block.dom = {}

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
		if(!t.name) throw '.name missing for a track'
		if(!t.type) throw '.type missing for track '+t.name
		if(!common.tkt[ t.type ]) throw 'invalid type for track '+t.name+': '+t.type
		// TODO if track type is valid
		// validate track by type
		// tracks stay in arg.tklst
	}

	if( !arg.nativetracks ) arg.nativetracks = []
	if(!Array.isArray(arg.nativetracks)) throw '.nativetracks[] should be array'
	{
		const lst = []
		for(const t of arg.nativetracks) {
			if(typeof t == 'string') {
				lst.push({name: t})
			} else {
				if(!t.name) throw 'name missing from a native track'
				lst.push(t)
			}
		}
		arg.nativetracks = lst
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
	
	} else if( arg.multi_range_0based ) {
		// list of regions
		if( common.isBadArray( arg.multi_range_0based ) ) throw '.multi_range_0based[] is not non-empty array'
		for(const r of arg.multi_range_0based) {
			const e =  coord.invalidcoord(
				arg.genome,
				r.chr,
				r.start,
				r.stop
			)
			if(e) throw '.multi_range_0based[]: '+e
			init_view_bysingleregion( r, block, arg )
		}

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
		init_view_bysingleregion( r, block, arg )

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
		init_view_bysingleregion( r, block, arg )

	} else if( arg.position_0based ) {

		// single region, "chr:start-stop"
		const r = coord.string2pos( arg.position_0based, block.genome, true )
		if(r) {
			init_view_bysingleregion( r, block, arg )
		} else {
			throw 'invalid region: '+arg.position_0based
		}

	} else if( arg.position_1based ) {

		// single region, "chr:start-stop"
		const r= coord.string2pos( arg.position_1based, block.genome )
		if(r) {
			init_view_bysingleregion( r, block, arg )
		} else {
			throw 'invalid region: '+arg.position_1based
		}
		block.holder.text('show '+r.chr+':'+r.start+'-'+r.stop)

	} else {

		// no position given; use genome default position
		init_view_bysingleregion( block.genome.defaultcoord, block, arg )
	}

	for(const v of block.views) {
		if( v.regions ) {
			for(const r of v.regions) {
				if(!Number.isFinite(r.bstart)) throw 'region.bstart missing'
				if(!Number.isFinite(r.bstop)) throw 'region.bstop missing'
				if(!Number.isFinite(r.start)) throw 'region.start missing'
				if(!Number.isFinite(r.stop)) throw 'region.stop missing'
			}
		}
	}

	init_dom_for_block( arg, block )

	init_regionpxwidth_viewresolution( block )
}



function init_view_bysingleregion ( r, block, arg ) {
	// simplest condition
	const chr = block.genome.chrlookup[ r.chr.toUpperCase() ]
	if(!chr) throw 'invalid chr: '+r.chr
	// start/stop are 0-based and must have all been validated
	const region = {
		chr: r.chr,
		bstart: 0,
		bstop: chr.len,
		start: r.start,
		stop: r.stop,
	}

	if( r.width ) {
		if( !common.isPositiveInteger( r.width)) throw 'width is not positive integer'
		region.width = r.width
	} else if( arg.width ) {
		if( !common.isPositiveInteger( arg.width)) throw 'width is not positive integer'
		region.width = arg.width
	}

	if( region.width ) {
		region.width = Math.min( region.width, block.ntpxwidth * (region.stop-region.start) )
	}
	block.views.push({
		regions: [ region ],
		regionspace: 10,
		rightpad: 10,
		reverse: ( r.reverse || arg.reverse )
	})
}



function init_regionpxwidth_viewresolution( b ) {
	/*
	initialize px width for regions
	only to calculate resolution of view

	should not use region.width; use view bpperpx
	
	calculate region width:
	if region overlaps with viewport: (stop-start)/v.bpperpx
	if region is outside viewport: (bstop-bstart)/v.bpperpx

	initialize viewport of each view,
	to show all regions by default, unless to be customized
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
	if( uncovered_bpsum > 0 ) {
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


	/*
	upon init, show all regions in each view
	*/

	for(const view of b.views) {
		if(view.regions) {
			view.startidx = 0
			view.stopidx = view.regions.length-1

			// set resolution for this region
			let sumw = 0,
				sumbp = 0
			for(const r of view.regions) {
				sumw += r.width
				sumbp += r.stop-r.start
				delete r.width
			}
			view.bpperpx = sumbp / sumw

			view.rulerscale = scaleLinear() // init blank scale

			b.view_updaterulerscale( view ) // update scale
		}
	}
}







function init_dom_for_block ( arg, b ) {
	/*
	init dom for block
	*/

	b.dom.row1 = b.holder.append('div')
		.style('margin-bottom','5px')
	b.dom.coord = {}
	b.dom.coord.input = b.dom.row1.append('input')
		.attr('type','text')
		.style('width','200px')
	b.dom.coord.says = b.dom.row1.append('span')
		.style('margin','0px 10px')
		.style('font-size','.8em')
		.style('font-family',client.font)

	b.dom.zoom = {}
	b.dom.zoom.in2 = b.dom.row1.append('button')
		.text('In')
		.on('click',()=> b.zoomin_default(2) )
	b.dom.zoom.out2 = b.dom.row1.append('button')
		.html('Out &times;2')
		.on('click',()=> b.zoomout_default(2) )
	b.dom.zoom.out10 = b.dom.row1.append('button')
		.html('&times;10')
		.on('click',()=> b.zoomout_default(10) )
	b.dom.zoom.out50 = b.dom.row1.append('button')
		.html('&times;50')
		.on('click',()=> b.zoomout_default(50) )

	b.dom.svgdiv = b.holder.append('div')

	b.svg = {}
	b.svg.svg = b.dom.svgdiv.append('svg')


	// insert negative layers here
	//b.svg.layer_neg1


	// layer #0
	b.svg.layer_0 = b.svg.svg.append('g')

	// insert plus layers here
	b.svg.layer_pos1 = b.svg.svg.append('g')
	// drag to zoom in
	b.svg.drag = {}
	b.svg.drag.g = b.svg.layer_pos1.append('g')
	b.svg.drag.bar = b.svg.drag.g.append('rect')
		.attr('fill-opacity',.3)
	b.svg.drag.text = b.svg.drag.g.append('text')
		.attr('text-anchor','middle')
		.attr('dominant-baseline','central')
		.attr('font-family',client.font)
		.attr('font-size','1.5em')
		.attr('fill','black')


	// render in layer #0

	b.svg.gleft = b.svg.layer_0.append('g')

	b.svg.gmiddle = b.svg.layer_0.append('g')

	for(const v of b.views) {
		init_dom_view( v, b )
	}

	b.svg.gright = b.svg.layer_0.append('g')
}



function init_dom_view ( view, block ) {
	/* call when adding a new view
	not include creating components for each track
	*/

	view.id = Math.random().toString()
	view.g = block.svg.gmiddle.append('g')

	const clipid = view.id+'clip'
	const clippath = view.g.append('clipPath')
		.attr('id',clipid)

	view.cliprect = clippath.append('rect')

	view.clipframe = view.g.append('g')
		.attr('clip-path','url(#'+clipid+')')

	// panning
	view.gscroll = view.clipframe.append('g')
	.on('mousedown', ()=>{

		if( block.ifbusy() )  return

		d3event.preventDefault()
		const body = d3select( document.body )
		const x0 = block.rotated ? d3event.clientY : d3event.clientX

		body.on('mousemove', ()=>{
			const xoff = ( block.rotated ? d3event.clientY : d3event.clientX ) - x0
			view.gscroll.attr( 'transform', 'translate('+xoff+',0)' )
			view.gscroll_noclip.attr( 'transform', 'translate('+xoff+',0)' )
		})

		body.on('mouseup', ()=>{
			body.on('mousemove', null)
				.on('mouseup', null)

			// panned dist
			const xoff = ( block.rotated ? d3event.clientY : d3event.clientX ) - x0

			block.pannedby( view, xoff )
		})
	})

	view.gscroll_noclip = view.g.append('g')
}
