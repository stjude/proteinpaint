//import dofetch from './client'

function invalidcoord ( thisgenome, chrom, start, stop ) {
	if(!thisgenome) return 'no genome'
	if(!chrom) return 'no chr name'
	const chr=thisgenome.chrlookup[chrom.toUpperCase()]
	if(!chr) return 'Invalid chromosome name: '+chr
	if(!Number.isInteger(start)) return 'Non-numerical position: '+start
	if(start<0 || start>=chr.len) return 'Position out of range: '+start
	if(!Number.isInteger(stop)) return 'Non-numerical position: '+stop
	if(stop<0 || stop>chr.len) return 'Position out of range: '+stop
	if(start>stop) return 'Start position is greater than stop'
	return false
}
exports.invalidcoord=invalidcoord






exports.string2pos = function ( s, genome, is0based ) {
	/*
	by default all input positions are treated as 1-based
	and will subtract by 1 during parsing
	otherwise specify it is 0-based
	*/

	if(!genome) throw 'string2pos: genome missing'
	if(!genome.chrlookup) throw 'string2pos: genome.chrlookup missing'

	s = s.replace(/,/g,'') // remove comma

	// see if input is a chr name
	{
		const chr = genome.chrlookup[ s.toUpperCase() ]
		if(chr) {
			// chr name only, to middle
			return {
				chr:chr.name,
				//chrlen:chr.len,
				start:Math.max(0, Math.ceil(chr.len/2)-10000),
				stop:Math.min(chr.len, Math.ceil(chr.len/2)+10000)
			}
		}
	}

	{
		// special handling for snv4
		const tmp = s.split('.')
		if(tmp.length ==  4) {
			const chr=genome.chrlookup[tmp[0].toUpperCase()]
			const pos=Number.parseInt(tmp[1]) - (is0based ? 0 : 1)
			const e=invalidcoord(genome,tmp[0],pos,pos+1)
			if(!e) {
				// valid snv4
				return {
					chr:chr.name,
					//chrlen:chr.len,
					start: pos,
					stop: pos
				}
			}
		}
	}

	const tmp = s.split(/[-:\s]+/)
	if(tmp.length==2) {
		// see if is chr : pos
		const pos = Number.parseInt(tmp[1]) - (is0based ? 0 : 1)
		const e=invalidcoord(genome,tmp[0],pos,pos+1)
		if(e) {
			// either chr or pos is wrong
			return null
		}
		const chr = genome.chrlookup[ tmp[0].toUpperCase() ]
		return {
			chr: chr.name,
			start: pos,
			stop: pos
		}
	}

	if(tmp.length==3) {
		// see if is chr - start - stop
		const start = Number.parseInt(tmp[1]) - (is0based ? 0 : 1),
			stop  = Number.parseInt(tmp[2]) - (is0based ? 0 : 1)
		const e = invalidcoord( genome, tmp[0], start, stop )
		if(e){
			return null
		}
		const chr = genome.chrlookup[ tmp[0].toUpperCase() ]
		return {
			chr:chr.name,
			start: start,
			stop: stop,
		}
	}

	return null
}



/*
exports.string2snp = function( str, genome ) {
	return dofetch( 'snpbyname', {genome:genome, str:str} )
	.then(data=>{
		if(data.error) throw data.error
		return data.hit
	})
}
*/
