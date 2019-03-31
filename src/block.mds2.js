import {select as d3select,event as d3event} from 'd3-selection'
import {axisTop, axisLeft, axisRight} from 'd3-axis'
import {scaleLinear} from 'd3-scale'
import * as common from './common'
import * as client from './client'





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

		await loadTk_do( tk, block )
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
			update_legend(tk, block)

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

	// config
	tk.config_handle = block.maketkconfighandle(tk)
		.on('click', ()=>{
			configPanel(tk, block)
		})
}



async function loadTk_do ( tk, block ) {

	const par={
		genome:block.genome.name,
		dslabel: tk.dslabel,
		rglst: block.tkarg_maygm(tk),
	}

	if(block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for(const [idx,r] of block.subpanels.entries()) {
			par.rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				subpanelidx:idx,
			})
		}
	}

	addLoadParameter( par, tk )

	return client.dofetch('mds2', par)
	.then(data=>{
		if(data.error) throw data.error
		console.log(data)
	})
}






function loadTk_finish ( tk, block ) {
	return (error)=>{
		block.tkcloakoff( tk, {error: (error ? error.message||error : null)})
		block.block_setheight()
		block.setllabel()
	}
}


function addLoadParameter ( par, tk ) {
}
