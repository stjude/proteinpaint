import * as client from './client'
import {event as d3event} from 'd3-selection'



export function gene_searchbox ( p ) {
/*
make a <input> to search for gene names as you type into it
matching genes are shown beneath the input

.div
.width: 100px
.genome
.callback
*/
	// for auto gene column, show 
	const input = p.div.append('input')
		.attr('placeholder','Search gene')
		.style('width', p.width || '100px')

	input.on('keyup',()=>{

		const str = d3event.target.value
		if(str.length<=1) {
			client.tip.hide()
			return
		}

		if(client.keyupEnter()) {
			const hitgene = client.tip.d.select('.sja_menuoption')
			if( hitgene.size()>0 ) {
				p.callback( hitgene.text() )
				client.tip.hide()
			}
			return
		}

		client.dofetch('genelookup',{genome:p.genome,input:str})
		.then(data=>{
			if(data.error) throw data.error
			if(!data.hits) throw '.hits[] missing'

			client.tip.clear().showunder( input.node() )

			for(const name of data.hits) {
				client.tip.d
				.append('div')
				.attr('class','sja_menuoption')
				.text(name)
				.on('click',()=>{
					p.callback( name )
					client.tip.hide()
				})
			}
		})
		.catch(err=>{
			client.tip.d.append('div').text( err.message || err )
			if(err.stack) console.log(err.stack)
		})
	})

	input.node().focus()
}
