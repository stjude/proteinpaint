if(process.argv.length!=4) {
	console.log('<mds junction text file, past splice event annotation> <gene.gz file> output to stdout')
	process.exit()
}


const infile=process.argv[2]
const genefile=process.argv[3]


const fs=require('fs')
const exec=require('child_process').execSync
const readline=require('readline')
const mapjunctiontoexons=require('../../src/spliceevent.prep').mapjunctiontoexons


const rl=readline.createInterface({input:fs.createReadStream(infile)})

rl.on('line',line=>{
	if(line[0]=='#') {
		console.log(line)
		return
	}

	const l=line.split('\t')

	const chr=l[0]
	const start=Number.parseInt(l[1])
	const stop=Number.parseInt(l[2])
	const strand=l[3]
	const type=l[4]
	const j2=JSON.parse(l[5])

	{
		// left
		const gmlst=getgmlst(chr, start)
		if(gmlst) {
			const j={
				chr:chr,
				start:start,
				stop:stop
			}
			mapjunctiontoexons([j], gmlst)
			if(j.exonleft.length) j2.exonleft = j.exonleft.map( i=> {return{gene:i.gm.name, isoform:i.gm.isoform, strand:i.gm.strand, exonidx:i.exonidx}})
			if(j.exonleftin.length) j2.exonleftin=j.exonleftin.map(i=>{return{gene:i.gm.name,isoform:i.gm.isoform,strand:i.gm.strand, exonidx:i.exonidx}})
			if(j.intronleft.length) j2.intronleft=j.intronleft.map(i=>{return{gene:i.gm.name,isoform:i.gm.isoform,strand:i.gm.strand, intronidx:i.intronidx}})
		}
	}

	{
		// right
		const gmlst=getgmlst(chr, stop)
		if(gmlst) {
			const j={
				chr:chr,
				start:start,
				stop:stop
			}
			mapjunctiontoexons([j],gmlst)
			if(j.exonright.length) j2.exonright = j.exonright.map( i=>{return{gene:i.gm.name,isoform:i.gm.isoform, strand:i.gm.strand, exonidx:i.exonidx}})
			if(j.exonrightin.length) j2.exonrightin=j.exonrightin.map(i=>{return{gene:i.gm.name,isoform:i.gm.isoform,strand:i.gm.strand, exonidx:i.exonidx}})
			if(j.intronright.length) j2.intronright=j.intronright.map(i=>{return{gene:i.gm.name,isoform:i.gm.isoform,strand:i.gm.strand, intronidx:i.intronidx}})
		}
	}

	// detects if it's canonical junction
	if(j2.exonleft && j2.exonright) {
		for(const e1 of j2.exonleft) {
			for(const e2 of j2.exonright) {
				if( e1.isoform==e2.isoform && Math.abs(e1.exonidx-e2.exonidx)==1) {
					j2.canonical=1
					break
				}
			}
			if(j2.canonical) break
		}
	}

	console.log(`${chr}\t${start}\t${stop}\t${strand}\t${type}\t${JSON.stringify(j2)}`)
})



function getgmlst(chr, pos) {
	const str=exec('tabix '+genefile+' '+chr+':'+pos+'-'+pos,{encoding:'utf8'}).trim()
	if(!str) return null
	const lst=[]
	for(const line of str.split('\n')) {
		const l=line.split('\t')
		const g=JSON.parse(l[3])
		g.chr=chr
		g.start=Number.parseInt(l[1])
		g.stop=Number.parseInt(l[2])
		lst.push(g)
	}
	return lst
}
