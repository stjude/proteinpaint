import {scaleLinear} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event,mouse as d3mouse} from 'd3-selection'
import {transition} from 'd3-transition'
import {format as d3format} from 'd3-format'
import {axisTop, axisLeft} from 'd3-axis'
import * as coord from './coord'




export class Block {

constructor ( arg ) {

	try {
		validate_parameter( arg, this )
	} catch(e) {
		if(e.stack) console.log(e.stack)
		if(arg.holder) {
			arg.holder.append('div')
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




// END of constructor
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
		block.holder.text('show '+r.chr+':'+r.start+'-'+r.stop)
	}
}
