import * as client from './client'
import * as coord from './coord'


/******** EXTERNAL
findgene()

********* INTERNAL
string2snp
findgene_byname
fetch_genelookup


handle keyup event in a gene search box
when typing letters, find matching gene names and show as menu:
	 - clicking one gene in menu to find all isoforms by that name
	 - hitting enter to search for the first gene in menu, if any
	 - searching by isoform accession to find a single isoform
	 - searching by snp or genomic position

callback should be able to process:
	single gene model, as from isoform search
	multiple gene models of the same name
	one genomic position

error handling contained
*/


export async function findgene ( genome, tip, inputdom, eventkey, callback ) {
/*
genome: {}
tip: Menu
inputdom: <input>
eventkey: event.key
callback: with arg (gm, gmlst, pos)
*/

	const str = inputdom.value.trim()
	if(!str) {
		tip.hide()
		return
	}

	tip.showunder( inputdom )

	try {
		if( eventkey == 'Enter' ) {
			/*
			hitting enter

			1 - gene
			symbol/alias, convert to neat symbol
			isoform, use isoform
			any hit will be displayed as buttons in tip, otherwise it's not a gene
			*/
			const hitgene = tip.d.select('.sja_menuoption')
			if(hitgene.size()>0) {
				// input indeed matches with gene name
				return findgene_byname (
					genome,
					hitgene.attr('isoform'),
					hitgene.attr('genename'),
					tip,
					callback
				)
			}

			// 2 - single region
			// assume the region is 1-based
			const position = coord.string2pos( str, genome )
			if(position) {
				return callback( null, null, position )
			}

			// 3 - multiple regions TODO

			// 4 - snp
			const snp = await string2snp( str, genome.name )
			if(snp) {
				// hit a snp
				// TODO highlight snp
				return callback( null, null,
					{
						chr: snp.chrom,
						start: snp.chromStart,
						stop: snp.chromEnd
					}
				)
			}
			throw 'Not a gene or snp'
		}

		// show list of matching gene names
		tip.clear()

		const names = await fetch_genelookup( {input:str, genome:genome.name } )

		if(names.length==0) {
			// not a gene, hide tip
			tip.hide()
			return
		}

		for(const n of names) {
			const row = tip.d.append('div')
				.attr('class','sja_menuoption')
				.attr('genename', n.name)
				.on('click',()=>{
					findgene_byname(
						genome,
						n.isoform,
						n.name,
						tip,
						callback
					)
				})
			if(n.alias) {
				row.html( '<span style="opacity:.7;font-size:.7em">'+n.alias+'</span> '+n.name )
			} else if(n.isoform) {
				row.html( n.name+' <span style="opacity:.7;font-size:.7em">'+n.isoform+'</span>' )
				row.attr('isoform', n.isoform) // upon hitting Enter this will be captured
			} else {
				row.text(n.name)
			}
		}
	} catch( e ) {
		if(e.stack) console.log(e.stack)
		tip.d
			.append('div')
			.style('margin','5px')
			.style('color','red')
			.text('Error: '+(e.message||e))
	}
}


function string2snp ( str, genome ) {
	return client.dofetch( 'snpbyname', {genome:genome, str:str} )
	.then(data=>{
		if(data.error) throw data.error
		return data.hit
	})
}


async function findgene_byname ( genome, isoform, genename, tip, callback ) {
	/*
	*/
	try {
		if(isoform) {
			// one isoform name could still match with multiple gm
			const gmlst = await fetch_genelookup( {input:isoform, genome:genome.name, deep:1, isisoform:1} )
			if(gmlst.length==0) throw 'No gene found by '+isoform
			if(gmlst.length>1) {
				for(const m of gmlst) {
					tip.append('div')
					.attr('class','sja_menuoption')
					.text(m.isoform+' '+m.chr+':'+m.start+'-'+m.stop)
					.on('click',()=>{
						tip.hide()
						callback( m )
					})
				}
				return
			}
			tip.hide()
			callback( gmlst[0] )
			return
		}

		// by gene symbol
		const gmlst = await fetch_genelookup( {input:genename, genome:genome.name, deep:1 } )
		if(gmlst.length==0) throw 'No gene found by '+genename
		tip.hide()
		callback( null, gmlst )

	} catch(e) {
		if(e.stack) console.log(e.stack)
		throw e.message || e
		//tip.append('div').text('ERROR: '+(e.message||e))
	}
}



function fetch_genelookup( p ) {
	/*
	input
	genome
	deep
	isisoform
	*/
	return client.dofetch( 'genelookup', p )
	.then(data=>{
		if(data.error) throw data.error
		if(!data.lst) throw '.lst[] missing'
		return data.lst
	})
}
