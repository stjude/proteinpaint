




function invalidcoord(thisgenome,chrom,start,stop) {
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



exports.string2pos=function(s,genome) {
	s=s.replace(/,/g,'')
	const chr=genome.chrlookup[s.toUpperCase()]
	if(chr) {
		// chr name only, to middle
		return {
			chr:chr.name,
			chrlen:chr.len,
			start:Math.max(0, Math.ceil(chr.len/2)-10000),
			stop:Math.min(chr.len, Math.ceil(chr.len/2)+10000)
		}
	}
	{
		// special handling for snv4
		const tmp=s.split('.')
		if(tmp.length>=2) {
			const chr=genome.chrlookup[tmp[0].toUpperCase()]
			const pos=Number.parseInt(tmp[1])
			const e=invalidcoord(genome,tmp[0],pos,pos+1)
			if(!e) {
				// valid snv4
				const bpspan=400
				return {
					chr:chr.name,
					chrlen:chr.len,
					start:Math.max(0, pos-Math.ceil(bpspan/2)),
					stop:Math.min(chr.len,pos+Math.ceil(bpspan/2)),
					actualposition:{position:pos,len:1}
				}
			}
		}
	}
	const tmp=s.split(/[-:\s]+/)
	if(tmp.length==2) {
		// must be chr - pos
		const pos=Number.parseInt(tmp[1])
		const e=invalidcoord(genome,tmp[0],pos,pos+1)
		if(e) {
			return null
		}
		const chr=genome.chrlookup[tmp[0].toUpperCase()]
		const bpspan=400
		return {
			chr:chr.name,
			chrlen:chr.len,
			start:Math.max(0, pos-Math.ceil(bpspan/2)),
			stop:Math.min(chr.len,pos+Math.ceil(bpspan/2)),
			actualposition:{position:pos,len:1}
		}
	}
	if(tmp.length==3) {
		// must be chr - start - stop
		let start=Number.parseInt(tmp[1]),
			stop=Number.parseInt(tmp[2])
		const e=invalidcoord(genome,tmp[0],start,stop)
		if(e){
			return null
		}
		const actualposition = {position:start, len:stop-start}
		const chr=genome.chrlookup[tmp[0].toUpperCase()]
		const minspan=400
		if(stop-start<minspan) {
			let center=Math.ceil((start+stop)/2)
			if(center+minspan/2 >=chr.len) {
				center=chr.len-Math.ceil(minspan/2)
			}
			start=Math.max(0,center-Math.ceil(minspan/2))
			stop=start+minspan
		}
		return {
			chr:chr.name,
			chrlen:chr.len,
			start:start,
			stop:stop,
			actualposition:actualposition
		}
	}
	return null
}




exports.string2snp=function( genome, str, hostURL, jwt) {
	return fetch( new Request(hostURL+'/snpbyname', {
		method:'POST',
		body:JSON.stringify({ genome:genome, lst:[str], jwt:jwt })
	}))
	.then(data=>{return data.json()})
	.then(data=>{
		if(data.error) throw({message:data.error})
		if(!data.lst || data.lst.length==0) throw({message:str+': not a SNP'})
		/*
		start/stop are ucsc bed format, include start, not stop
		*/
		const r=data.lst[0]
		return {
			chr:r.chrom,
			start:r.chromStart,
			stop:r.chromEnd
		}
	})
}

