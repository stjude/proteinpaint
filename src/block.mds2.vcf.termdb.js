import * as common from './common'
import * as client from './client'


/*
********************** EXPORTED
termdb_bygenotype
********************** INTERNAL
get_ssid_by_onevcfm
*/




export async function termdb_bygenotype( plotdiv, m, tk, block ) {
/*
launch termdb by the genotype of one vcf variant

official track only
*/

	// sample session id
	const {ssid, groups} = await get_ssid_by_onevcfm( m, tk.mds.label, block.genome.name )

	const obj = {
		mds: tk.mds,
		genome: block.genome,
		div: plotdiv,
		default_rootterm: {
			modifier_ssid: ssid
		}
	}
	const _ = await import('./mds.termdb')
	_.init( obj )
}



function get_ssid_by_onevcfm ( m, dslabel, genome ) {
/*
using the genotype of one variant from the vcf file
divide samples to groups
record it in a temp file at cache
and get the file name
use the file name as a session in termdb
*/
	const arg = {
		dslabel: dslabel,
		genome: genome,
		m: {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt
		},
		trigger_ssid_onevcfm:true
	}

	return client.dofetch('mds2', arg )
	.then(data=>{
		if(data.error) throw data.error
		return data
	})
}
