import {select as d3select, event as d3event} from 'd3-selection'
import 'normalize.css'
import './style.css'
import * as client from './client'
//import * as coord from './coord'
//import {rgb as d3rgb} from 'd3-color'
//import * as common from './common'


// do not use genomes as global, no globals here



window.runproteinpaint4 = async (arg) => {
	/*
	all parameters and triggers are contained in arg
	including genomes retrieved from server
	*/

	arg.holder = d3select( arg.holder || document.body )
	arg.holder
		.style('font-family', client.font)

	// for inverse color, may do something like client.__init(arg)

	if(arg.host) {
		localStorage.setItem('host', arg.host)
	}
	if(arg.jwt) {
		localStorage.setItem('jwt', arg.jwt)
	}


	try {
		const data = await fetch_genomes( arg )

		window.hg19 = arg.genomes['hg19'] // to be removed

		if(!arg.noheader) {
			arg._headerdiv = arg.holder.append('div') // make sure header will be on top of showholder
			import('./app.header').then( _ => {
				_.makeheader(
					arg,
					data.headermessage,
					data.lastupdate
				)
			})
		}

		arg.showholder = arg.holder
			.append('div')
			.style('margin','20px')

		process_embed_url( arg )

	} catch(e){
		if(e.stack) console.log(e.stack)
		arg.holder.text('Error: '+(e.message||e))
	}
}



function fetch_genomes ( arg ) {
	/*
	arg is from runpp call
	append returned results to arg
	*/
	return client.dofetch('genomes',null,true)
	.then(data=>{
		if(data.error) throw 'Cannot get genomes: '+data.error
		if(!data.genomes) throw '.genomes missing from response'
		arg.genomes = data.genomes
		for(const n in arg.genomes) {
			const g = arg.genomes[n]
			g.chrlookup = {}
			for(const c in g.majorchr) {
				g.chrlookup[ c.toUpperCase() ] = { name: c, len: g.majorchr[c] }
			}
			if(g.minorchr) {
				for(const c in g.minorchr) {
					g.chrlookup[ c.toUpperCase() ] = { name: c, len: g.minorchr[c] }
				}
			}
		}
		arg.debugmode = data.debugmode
		return data
	})
}





function process_embed_url ( arg ) {
	try {

		if( arg.block ) {
			embed_block( arg )
			return
		}

	} catch(e) {
		if(e.stack) console.log(e.stack)
		arg.showholder.append('div').text('Error: '+(e.message||e))
	}
}


function embed_block( arg ) {
	/*
	arg is primary
	*/
	if(!arg.genome) throw '.genome is undefined'
	const genome = arg.genomes[ arg.genome ]
	if(!genome) throw 'invalid value for .genome: '+arg.genome

	const p = {
		debugmode: arg.debugmode,
		genome: genome,
		holder: arg.showholder,
		range_0based: arg.range_0based,
		range_1based: arg.range_1based,
		position_0based: arg.position_0based,
		position_1based: arg.position_1based,
		tklst: arg.tklst,
	}
	client.launch_block( p )
}
