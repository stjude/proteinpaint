import {scaleLinear} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event,mouse as d3mouse} from 'd3-selection'
import {transition} from 'd3-transition'
import {format as d3format} from 'd3-format'
import {axisTop, axisLeft} from 'd3-axis'
import * as coord from './coord'
import * as common from './common'


const ntpxwidth = 20  // max allowed pixel width for a nt


export class Block {

constructor ( arg ) {

	if(arg.debugmode) {
		window.bb = this
	}

	try {
		validate_parameter( arg, this )
	} catch(e) {
		if(e.stack) console.log(e.stack)
		if(this.holder) {
			this.holder.append('div')
				.style('margin','20px')
				.text('Error: '+e)
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


	init_view_pxwidth( this )

	this.set_block_width()


// END of constructor
}



set_block_width() {
}

// END of block
}



////////////////////////// INIT helpers


function validate_parameter ( arg, block ) {

	if(!arg.holder) throw '.holder missing'
	block.holder = arg.holder
	if(!arg.genome) throw '.genome{} missing'
	block.genome = arg.genome

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
			xspace: 10,
			rightpad: 10,
		})
	}
}



function init_view_pxwidth ( block ) {
	/*
	initialize px width for regions
	*/
	const uncovered_regions = []
	let covered_bpsum   = 0,
		covered_pxsum   = 0,
		uncovered_bpsum = 0
	for(const view of block.views) {
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
		const w = block.holder.node().getBoundingClientRect().width
		const idealwidth = Math.ceil( Math.max(w*.63,minwidth) )
		pxperbp = idealwidth / uncovered_bpsum
	}

	for(const r of uncovered_regions) {
		r.width = Math.ceil( pxperbp * (r.stop-r.start) )
	}
}
