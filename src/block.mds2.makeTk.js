import {select as d3select,event as d3event} from 'd3-selection'
import * as common from './common'
import * as client from './client'
import * as mds2legend from './block.mds2.legend'
import {may_setup_numerical_axis} from './block.mds2.vcf.numericaxis'


/*

********************** EXPORTED
makeTk
********************** INTERNAL
may_setup_numerical_axis
parse_client_config
configPanel
*/


export async function makeTk ( tk, block ) {

	tk.tip2 = new client.Menu({padding:'0px'})

	if( tk.dslabel ) {

		// official dataset

		tk.mds = block.genome.datasets[ tk.dslabel ]
		if(!tk.mds) throw 'dataset not found for '+tk.dslabel
		if(!tk.mds.track) throw 'mds.track{} missing: dataset not configured for mds2 track'
		tk.name = tk.mds.track.name

		// copy server-side configs

		if( tk.mds.track.vcf ) {
			// do not allow dom
			tk.vcf = JSON.parse(JSON.stringify(tk.mds.track.vcf))
		}

		// TODO other file types


	} else {

		// custom
		if(!tk.name) tk.name = 'Unamed'

		if( tk.vcf ) {
			await mds2vcf.getvcfheader_customtk( tk.vcf, block.genome )
		}
	}

	parse_client_config( tk )

	tk.tklabel.text( tk.name )

	if( tk.vcf ) {
		// vcf row
		tk.g_vcfrow = tk.glider.append('g')
		tk.leftaxis_vcfrow = tk.gleft.append('g')
	}

	may_setup_numerical_axis( tk )

	// TODO <g> for other file types

	// config
	tk.config_handle = block.maketkconfighandle(tk)
		.on('click', ()=>{
			configPanel(tk, block)
		})

	await mds2legend.init( tk, block )
}



function parse_client_config ( tk ) {
/* for both official and custom
configurations and their location are not stable
*/
	if( tk.termdb2groupAF ) {
		if(!tk.mds) throw '.mds missing'
		if(!tk.mds.termdb) throw '.mds.termdb missing'
		// hardcoded for vcf numeric axis
		if(!tk.vcf) throw 'tk.vcf missing'
		if(!tk.vcf.numerical_axis) {
			tk.vcf.numerical_axis = {}
		}
		// this is moved to .numerical_axis{}
		tk.vcf.numerical_axis.termdb2groupAF = tk.termdb2groupAF
		delete tk.termdb2groupAF
		// will be validated in may_setup_numerical_axis
	}
}







function configPanel ( tk, block ) {
}
