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
		const data = await fetch_genomes()
		init_genomes( data, arg )

		window.hg19 = arg.genomes['hg19']

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

	} catch(e){
		arg.holder.text('Error: '+(e.message||e))
	}
}



function fetch_genomes () {
	return client.dofetch('genomes',null,true)
	.then(data=>{
		if(data.error) throw 'Cannot get genomes: '+data.error
		return data
	})
}


function init_genomes ( data, arg ) {
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
}



