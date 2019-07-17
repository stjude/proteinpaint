import * as common from './common'
import * as client from './client'
import {scaleOrdinal,schemeCategory10} from 'd3-scale'


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

	// assign a color for each group, show color legend
	{
		const row = plotdiv.append('div')
			.style('margin','10px')
		const f = scaleOrdinal(schemeCategory10)
		for(const name in groups) {
			groups[ name ].color = f(name)
			row.append('div')
				.style('font-size','.7em')
				.style('color','white')
				.style('display','inline-block')
				.style('background',groups[name].color)
				.style('padding','2px 4px')
				.text(groups[name].size)
			row.append('div')
				.style('display','inline-block')
				.style('padding','1px 5px')
				.style('margin-right','5px')
				.text(name)
		}
	}



	const obj = {
		mds: tk.mds,
		genome: block.genome,
		div: plotdiv,
		default_rootterm: {},
		modifier_ssid_barchart: {
			chr: m.chr, // chr and pos needed for computing AF with respect to sex & par
			pos: m.pos,
			mutation_name: m.mname,
			ssid: ssid,
			groups: groups
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
