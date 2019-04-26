import {select as d3select,event as d3event} from 'd3-selection'
import * as common from './common'
import * as client from './client'
import * as mds2legend from './block.mds2.legend'
import {may_setup_numerical_axis} from './block.mds2.vcf.numericaxis'


/*
1. initialize tk object
2. parse client configurations
3. validate
4. initialize legend

********************** EXPORTED
makeTk
********************** INTERNAL
parse_client_config
configPanel
may_initiate_vcf
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

	may_initiate_vcf( tk )

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
		// temp
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
	if( tk.numericaxis_inuse_ebgatest ) {
		// temp
		// this may be a convenient way for customizing the numerical axis type on client
		if(!tk.vcf) throw 'tk.vcf missing'
		if(!tk.vcf.numerical_axis) {
			tk.vcf.numerical_axis = {}
		}
		tk.vcf.numerical_axis.inuse_ebgatest = true
		delete tk.vcf.numerical_axis.inuse_infokey
		delete tk.vcf.numerical_axis.inuse_termdb2groupAF
	}
}







function configPanel ( tk, block ) {
}




function may_initiate_vcf ( tk ) {
	if( !tk.vcf ) return
	
	// vcf row
	tk.g_vcfrow = tk.glider.append('g')
	tk.leftaxis_vcfrow = tk.gleft.append('g')

	try {
		may_setup_numerical_axis( tk )
	} catch(e) {
		throw 'numerical axis error: '+e
	}
}
