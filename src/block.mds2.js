import {select as d3select,event as d3event} from 'd3-selection'
import {axisTop, axisLeft, axisRight} from 'd3-axis'
import {scaleLinear} from 'd3-scale'
import * as common from './common'
import * as client from './client'
import * as mds2legend from './block.mds2.legend'
import * as vcf_numericaxis from './block.mds2.vcf.numericaxis'



/*
********************** EXPORTED
loadTk
********************** INTERNAL
addparameter_rangequery


*/


export async function loadTk( tk, block ) {
/*
*/

	block.tkcloakon(tk)
	block.block_setheight()

	const _finish = loadTk_finish( tk, block ) // function used at multiple places

	try {

		if(tk.uninitialized) {
			makeTk(tk,block)
			delete tk.uninitialized
		}

		tk.tklabel.each(function(){ tk.leftLabelMaxwidth = this.getBBox().width }) // do this when querying each time

		const data = await loadTk_do( tk, block )

		const rowheight_vcf = may_render_vcf( data, tk, block )

		// set height_main
		tk.height_main = rowheight_vcf

		_finish()

	} catch( e ) {

		tk.height_main = 50

		if(e.nodata) {
			/*
			central place to handle "no data", no mutation data in any sample
			for both single/multi-sample
			*/
			trackclear( tk )
			// remove old data so the legend can update properly
			//delete tk.data_vcf

			_finish({message:tk.name+': no data in view range'})
			return
		}

		if(e.stack) console.log( e.stack )
		_finish( e )
		return
	}
}



function makeTk ( tk, block ) {

	/* step 1
	validate tk
	upon error, throw
	*/
	if( !tk.dslabel ) throw '.dslabel missing'
	tk.mds = block.genome.datasets[ tk.dslabel ]
	if(!tk.mds) throw 'dataset not found for '+tk.dslabel
	if(!tk.mds.track) throw 'mds.track{} missing: dataset not configured for mds2 track'

	tk.tklabel.text( tk.mds.track.name )

	// vcf row
	tk.g_vcfrow = tk.glider.append('g')
	tk.leftaxis_vcfrow = tk.gleft.append('g')

	// config
	tk.config_handle = block.maketkconfighandle(tk)
		.on('click', ()=>{
			configPanel(tk, block)
		})

	mds2legend.init( tk, block )
}



async function loadTk_do ( tk, block ) {

	const par = addparameter_rangequery( tk, block )

	return client.dofetch('mds2', par)
	.then(data=>{
		if(data.error) throw data.error
		return data
	})
}






function loadTk_finish ( tk, block ) {
	return (error)=>{
		mds2legend.update(tk, block)
		block.tkcloakoff( tk, {error: (error ? error.message||error : null)})
		block.block_setheight()
		block.setllabel()
	}
}



function addparameter_rangequery ( tk, block ) {
// to get data for current view range

	/*
	for vcf track, server may render image when too many variants
	need to supply all options regarding rendering:
	*/
	const par={
		genome:block.genome.name,
		dslabel: tk.dslabel,
		rglst: block.tkarg_rglst(tk), // note here: not tkarg_usegm
	}

	if( block.usegm ) {
		/* to merge par.rglst[] into one region
		this does not apply to subpanels
		*/
		const r = par.rglst[0]
		r.usegm_isoform = block.usegm.isoform
		for(let i=1; i<par.rglst.length; i++) {
			const ri = par.rglst[i]
			r.width += ri.width + block.regionspace
			r.start = Math.min( r.start, ri.start )
			r.stop  = Math.max( r.stop,  ri.stop )
		}
		par.rglst = [ r ]
	}

	// append xoff to each r from block
	let xoff = 0
	for(const r of par.rglst) {
		r.xoff = 0
		xoff += r.width + block.regionspace
	}

	if(block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for(const r of block.subpanels) {
			par.rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				xoff: xoff
			})
			xoff += r.width + r.leftpad
		}
	}

	if( tk.mds.track.vcf ) {
		par.trigger_vcfbyrange = 1
	}
	// add trigger for other data types

	/* TODO
	for vcf, when rendering image on server, need to know 
	if any categorical attr is used to class variants instead of mclass
	*/

	return par
}




function may_render_vcf ( data, tk, block ) {
/* for now, assume always in variant-only mode for vcf
*/
	if( !tk.mds.track.vcf ) return 0
	if( !data.vcf ) return 0
	if( !data.vcf.rglst ) return 0

	tk.g_vcfrow.selectAll('*').remove()

	/* current implementation ignore subpanels
	to be fixed in p4
	*/

	//apply_scale_to_region( data.vcf.rglst )

	let rowheight = 0

	for(const r of data.vcf.rglst) {
		
		const g = tk.g_vcfrow.append('g')
			.attr('transform','translate('+r.xoff+',0)')

		if( r.rangetoobig ) {
			r.text_rangetoobig = g.append('text')
				.text( r.rangetoobig )
				.attr('text-anchor','middle')
				.attr('dominant-baseline','central')
				.attr('x', r.width/2 )
				// set y after row height is decided
			rowheight = Math.max( rowheight, 50 )
			continue
		}

		if( r.imgsrc ) {
			g.append('image')
				.attr('width', r.width)
				.attr('height', r.imgheight)
				.attr('xlink:href', r.imgsrc)
			rowheight = Math.max( rowheight, r.imgheight )
			continue
		}

		if( r.variants ) {
			const height = vcf_render_variants( r, g, tk, block )
			rowheight = Math.max( rowheight, height )
			continue
		}
	}

	// row height set
	for(const r of data.vcf.rglst) {
		if(r.rangetoobig) {
			r.text_rangetoobig.attr('y', rowheight/2 )
		}
	}

	return rowheight
}




function vcf_render_variants ( r, g, tk, block ) {
/*
got the actual list of variants at r.variants[], render them
*/

	if( tk.mds.track.vcf.numerical_axis && tk.mds.track.vcf.numerical_axis.in_use ) {
		// numerical axis by info field
		const height = vcf_numericaxis.render( r, g, tk, block )
		return height
	}

	// not numerical axis
	return 50
}









function apply_scale_to_region ( rglst ) {
// do not use, this does not account for rglst under gm mode
	// such as data.vcf.rglst
	for(const r of rglst) {
		r.scale = scaleLinear()
		if(r.reverse) {
			r.scale.domain([r.stop, r.start]).range([0,r.width])
		} else {
			r.scale.domain([r.start, r.stop]).range([0,r.width])
		}
	}
}
