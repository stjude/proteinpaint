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
.resultdiv
	if provided, to show gene list here, otherwise to show in client.tip
*/
	// for auto gene column, show 
	const input = p.div.append('input')
		.attr('placeholder','Search gene')
		.style('width', p.width || '100px')


	function fold() {
		if( p.resultdiv ) {
			p.resultdiv.selectAll('*').remove()
		} else {
			client.tip.hide()
		}
	}

	input.on('keyup',()=>{

		const str = d3event.target.value
		if(str.length<=1) {
			fold()
			return
		}

		if(client.keyupEnter()) {
			const hitgene = ( p.resultdiv || client.tip.d ).select('.sja_menuoption')
			if( hitgene.size()>0 ) {
				p.callback( hitgene.text() )
				fold()
			}
			return
		}

		client.dofetch('genelookup',{genome:p.genome,input:str})
		.then(data=>{
			if(data.error) throw data.error
			if(!data.hits) throw '.hits[] missing'

			if( p.resultdiv ) {
				p.resultdiv.selectAll('*').remove()
			} else {
				client.tip.clear().showunder( input.node() )
			}

			for(const name of data.hits) {
				( p.resultdiv || client.tip.d )
					.append('div')
					.attr('class','sja_menuoption')
					.text(name)
					.on('click',()=>{
						p.callback( name )
						fold()
					})
			}
		})
		.catch(err=>{
			( p.resultdiv || client.tip.d )
				.append('div').text( err.message || err )
			if(err.stack) console.log(err.stack)
		})
	})

	input.node().focus()
}






export function findgenemodel_bysymbol ( genome, str ) {
	return client.dofetch('genelookup',{
		deep:1,
		input: str,
		genome: genome
	})
	.then(data=>{
		if(data.error) throw data.error
		if(!data.gmlst || data.gmlst.length==0) return null
		return data.gmlst
	})
}
