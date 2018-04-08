




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

