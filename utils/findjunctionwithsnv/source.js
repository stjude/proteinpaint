const arg={}
for(let i=2; i<process.argv.length; i++) {
	const [a,b]=process.argv[i].split('=')
	
	const key=a.substr(2)

	if(key=='dnavcf') {
		// allow multiple dna vcf
		if(!arg.dnavcf) {
			arg.dnavcf=[]
		}
		arg.dnavcf.push(b)
	} else {
		arg[key]=b.trim()
	}
}


// load fs first then check arg
const fs=require('fs')
const exec=require('child_process').execSync
const vcfparse=require('../../src/vcf')


checkarg()






const basecompliment={A:'T',T:'A',C:'G',G:'C'}



const junctiontextfile=Math.random().toString()
exec('bgzip -d -c '+arg.junction+' > '+junctiontextfile)


const mapjunctiontoexons = require('../../src/spliceevent.prep').mapjunctiontoexons



const lines=fs.readFileSync(junctiontextfile,'utf8').trim().split('\n')
for(const line of lines) {

	const l=line.split('\t')
	const j={
		chr:l[0],
		start:Number.parseInt(l[1]),
		stop:Number.parseInt(l[2]),
		type:l[4], // debugging
		v:Number.parseInt(l[5]),
	}

	if(j.v<arg.cutoff) {
		continue
	}

	const genestr=exec('tabix '+arg.gene+' '+j.chr+':'+j.start+'-'+j.stop,{encoding:'utf8'}).trim()
	if(genestr=='') {
		// no match to genes, do not look
		continue
	}

	/*
	overlapping genes
	*/
	const genes=[]
	for(const line of genestr.split('\n')) {
		const l=line.split('\t')
		const g=JSON.parse(l[3])
		g.chr=l[0]
		g.start=Number.parseInt(l[1])
		g.stop=Number.parseInt(l[2])
		genes.push(g)
	}

	mapjunctiontoexons( [j], genes )

	if(j.matchisoform.length>0) {
		// two ends of junction all match with known exon boundary for given isoform
		// maybe exon-skipping or not, don't look
		continue
	}

	// one or both of two ends do not match with known exon junction
	// will report this junction

	if(j.exonleft.length==0) {
		// j.start not match with exon boundary
		const [snv, compete] = lefttest2(j)
		j.leftsnv=snv
		j.leftcompete=compete
	}
	if(j.exonright.length==0) {
		const [snv, compete] = righttest2(j)
		j.rightsnv=snv
		j.rightcompete=compete
	}

	if(j.leftsnv || j.rightsnv || (j.leftcompete && j.leftcompete.find(i=>i.snvatcompetesite)) || (j.rightcompete && j.rightcompete.find(i=>i.snvatcompetesite))) {
		outputjunction(j)
	}
}


fs.unlinkSync(junctiontextfile)


/*
junctions.sort((a,b)=>{
	return b.v-a.v
})


let fout
if(arg.output) {

	fout=fs.createWriteStream(arg.output)

	fout.on('finish',()=>{
		const sortedfile=Math.random().toString()
		exec('sort -k1,1 -k2,2n '+arg.output+' > '+sortedfile)
		exec('bgzip -c '+sortedfile+' > '+arg.output+'.gz')
		exec('tabix -p bed '+arg.output+'.gz')
		fs.unlinkSync(sortedfile)
	})
}

for(const j of junctions) {
	outputjunction(j)
}
*/



function outputjunction(j) {
	// the json structure to be logged out
	const out={
		readcount:j.v,
		leftsnv:j.leftsnv,
		rightsnv:j.rightsnv,
		exonskip:j.exonskip
	}

	if(j.leftcompete) {
		out.leftcompete = reportcompete( j.leftcompete )
	}
	if(j.rightcompete) {
		out.rightcompete = reportcompete( j.rightcompete )
	}
	if(j.exonleft.length) {
		out.exonleft = reportexonboundary(j.exonleft)
	}
	if(j.exonright.length) {
		out.exonright = reportexonboundary(j.exonright)
	}
	if(j.exonleftin.length) {
		out.exonleftin = reportInexonintron(j.exonleftin)
	}
	if(j.exonrightin.length) {
		out.exonrightin = reportInexonintron(j.exonrightin)
	}
	if(j.intronleft.length) {
		out.intronleft = reportInexonintron(j.intronleft)
	}
	if(j.intronright.length) {
		out.intronright = reportInexonintron(j.intronright)
	}

	console.log(j.chr+'\t'+j.start+'\t'+j.stop+'\t'+JSON.stringify(out))
	// fout.write(j.chr+'\t'+j.start+'\t'+j.stop+'\t'+JSON.stringify(out)+'\n')
}










//////////////////   helpers   ///////////////////////







function lefttest(j) {

	const leftsnv = []

	if(j.exonleftin.length) {

		// j.start inside coding exon

		const reverse=j.exonleftin[0].gm.strand=='-'

		// find snv on the right of j.start (exon truncating)

		const snvs=findsnv(j.chr, j.start+1+1, j.start+1+2)

		if(snvs) {
			const refnt=getrefnt(j.chr, j.start+1+1, j.start+1+2, reverse)
			for(const snv of snvs) {
				const mutnt=refnt.split('')
				const snvidx = snv.pos - (j.start+1)
				if(reverse) {
					mutnt[snvidx]=basecompliment[snv.alt] // update mutated dna
					const may3site=mutnt.join('')
					if(may3site=='GA') {
						leftsnv.push(snv)
					}
				} else {
					mutnt[snvidx]=snv.alt // update mutated dna
					const may5site=mutnt.join('')
					if(may5site=='GT') {
						leftsnv.push(snv)
					}
				}
			}
		}

	} else if(j.intronleft.length) {

		// j.start in intron

		const reverse=j.intronleft[0].gm.strand=='-'

		if(!reverse) {

			// j.start in intron of forward strand
			// find snv at right of j.start
			const snvs=findsnv(j.chr, j.start+1+1, j.start+1+2)
			if(snvs) {
				const refnt=getrefnt(j.chr, j.start+1+1, j.start+1+2)
				for(const snv of snvs) {
					const mutnt=refnt.split('')
					const snvidx=snv.pos-(j.start+1)
					mutnt[snvidx]=snv.alt // update dna
					const may5site=mutnt.join('')
					if(may5site=='GT') {
						leftsnv.push(snv)
						// snv is outside of extended exon, won't check rnabam
					}
				}
			}
		} else {

			// gene reverse
			// look at RS site
			const snvs=findsnv(j.chr, j.start+1-1, j.start+1+2)
			if(snvs) {
				const refnt=getrefnt(j.chr, j.start+1-1, j.start+1+2, true)
				for(const snv of snvs) {
					const mutnt=refnt.split('')
					const snvidx= snv.pos - (j.start-1)
					mutnt[snvidx]=basecompliment[snv.alt] // update dna
					if(snvidx>=2) {
						// snv at right of j.start
						// will not check rnabam
						const may3site=mutnt[2]+mutnt[3]
						if(may3site=='GA') {
							// snv creates 3' site at j.start, not RS pattern
							leftsnv.push(snv)
							// snv is outside of extended exon, won't check rnabam
						}
					} else {
						if(refnt=='TGGA') {
							// ref seq shows RS site
							// mutation on left of j.start, which is 5' site of RS, should always disrupt the 5' site
							// while 3' site of RS is still intact, so splicing can happen at 3' site but will be stalled due to loss of 5' site
							// TODO novel exon? if any additional junction starts downstream of this RS and ends at compete site
							leftsnv.push(snv)
							// snv at 5' RS is the beginning of extended exon/novel exon
							rnaAllelecount(snv)
						}
					}
				}
			}
		}
	}


	// collect all competing sites from atexon or atintron

	const competesites=[]

	if(j.exonleftin.length) {
		// j.start inside one exon
		// only when j.stop matches with exon boundary, should take one exon's end as compete site

		const exon = j.exonleftin[0]

		if( j.exonright.find( rightexon => rightexon.gm.isoform == exon.gm.isoform ) ) {

			// j.stop match with exon boundary on the same isoform
			// if j.stop-spanning intron is not the same as j.start-intron (exon-skipping) will still report

			competesites.push({
				gm: exon.gm,
				exonidx: exon.exonidx, // competing site falls on the same exon as the left end of the junction
			})
		}
	}

	if(j.intronleft.length) {

		const intron = j.intronleft[0]

		if( j.exonright.find( rightexon => rightexon.gm.isoform == intron.gm.isoform) ) {
			competesites.push({
				gm: intron.gm,
				exonidx: intron.intronidx + (intron.gm.strand=='-' ? 1 : 0) // competing site falls on the exon either up or down stream of the intron depending on strand
			})
		}
	}

	if(competesites.length) {

		for(const compete of competesites) {

			// position of competing site, always end of this exon, no matter j.start at intron/exon, and gene strand

			compete.pos=compete.gm.exon[compete.exonidx][1]-1

			// for this competing site, find snv at 2 nt down of compete site that will break it

			const snvs=findsnv(j.chr, compete.pos+2, compete.pos+2+1)

			if(snvs) {

				// there is snv and it must break the competing site, no matter the strand
				compete.snvatcompetesite = []

				for(const snv of snvs) {
					const reverse = compete.gm.strand=='-'
					const refnt=getrefnt(j.chr, compete.pos+2, compete.pos+2+1, reverse)
					const mutnt=refnt.split('')
					const snvidx=snv.pos-(compete.pos+1)
					mutnt[snvidx] = reverse ? basecompliment[snv.alt] : snv.alt // update mutated dna

					compete.snvatcompetesite.push( snv )

					// check rnabam?
					if(j.exonleftin.length) {
						// exon truncation, compete site won't be covered
						// do not check
					} else {
						// exon extension, compete site is included by extended exon
						rnaAllelecount( snv )
					}
				}
			}

			compete.sitedist = Math.abs(compete.pos-j.start)
			compete.competejunction = findcompetejunction(j.chr, compete.pos, j.stop)
		}
	}

	return [
		leftsnv.length ? leftsnv : undefined,
		competesites.length ? competesites : undefined
		]
}







function righttest(j) {

	const rightsnv=[]

	if(j.exonrightin.length) {

		// j.stop in exon

		const reverse = j.exonrightin[0].gm.strand=='-'

		// find snv at left of j.stop
		const snvs=findsnv(j.chr, j.stop+1-2, j.stop+1-1)

		if(snvs) {
			const refnt=getrefnt(j.chr, j.stop+1-2, j.stop+1-1, reverse)
			for(const snv of snvs) {
				const mutnt=refnt.split('')
				const snvidx=snv.pos-(j.stop-2)
				if(reverse) {
					mutnt[snvidx]=basecompliment[snv.alt] // update mutant dna
					const may5site=mutnt.join('')
					if(may5site=='TG') {
						rightsnv.push( snv )
					}
				} else {
					mutnt[snvidx] = snv.alt // update mutant dna
					const may3site=mutnt[0]+mutnt[1]
					if(may3site=='AG') {
						rightsnv.push( snv )
					}
				}
			}
			if(rightsnv.length) {
				// snv is inside normal exon
				for(const snv of rightsnv) {
					rnaAllelecount(snv)
				}
			}
		}


	} else if(j.intronright.length){

		// j.stop in intron

		const reverse=j.intronright[0].gm.strand=='-'

		if(reverse) {
			// gene reverse
			// look at 2nt left of j.stop for snv that may create 5' site
			const snvs=findsnv(j.chr, j.stop+1-2, j.stop+1-1)
			if(snvs) {
				const refnt=getrefnt(j.chr, j.stop+1-2, j.stop+1-1,true)
				for(const snv of snvs) {
					const mutnt=refnt.split('')
					const snvidx=snv.pos-(j.stop-2)
					mutnt[snvidx]=basecompliment[snv.alt] // mutant dna
					const may5site=mutnt.join('')
					if(may5site=='TG') {
						rightsnv.push(snv)
						// snv outside of extended exon, won't check rnabam
					}
				}
			}
		} else {
			// gene forward
			// look at RS site spanning j.stop
			const snvs=findsnv(j.chr, j.stop+1-2, j.stop+1+1)
			if(snvs) {
				const refnt=getrefnt(j.chr, j.stop+1-2, j.stop+1+1)
				for(const snv of snvs) {
					const mutnt=refnt.split('')
					const snvidx= snv.pos - (j.stop-2)
					mutnt[snvidx]=snv.alt // mutant dna
					if(snvidx <2 ) {
						// snv at 3' site
						const may3site=mutnt[0]+mutnt[1]
						if(may3site=='AG') {
							// snv creates 3' site at left of j.stop
							rightsnv.push( snv )
							// snv outside of extended exon, won't check rnabam
							// TODO novel exon?
						}
					} else {
						// snv past 3' site
						if(refnt=='AGGT') {
							// ref seq shows RS site
							// 3' RS is intact, splicing can still function
							// snv happens on 5' RS, which will cause the junction to stall and create exon extension/novel exon
							rightsnv.push( snv )
							// snv is at beginning of novel exon
							rnaAllelecount( snv )
						}
					}
				}
			} else {
				//console.log(j.type, j.chr, j.start, j.stop)
			}
		}
	}


	// collect competing sites from all atexon or atintron

	const competesites=[]

	if(j.exonrightin.length ) {
		const exon = j.exonrightin[0]
		if( j.exonleft.find( leftexon => leftexon.gm.isoform == exon.gm.isoform ) ) {
			competesites.push({
				gm:exon.gm,
				exonidx:exon.exonidx,
			})
		}
	}
	if(j.intronright.length) {
		const intron = j.intronright[0]
		if( j.exonleft.find( leftexon => leftexon.gm.isoform == intron.gm.isoform ) ) {
			competesites.push({
				gm: intron.gm,
				exonidx: intron.intronidx + ( intron.gm.strand=='-' ? 0 : 1)
			})
		}
	}

	if(competesites.length) {

		for(const compete of competesites) {

			compete.pos=compete.gm.exon[compete.exonidx][0]

			// position of competing site, 1 nt ahead of beginning of this exon

			compete.sitedist = Math.abs(compete.pos - j.stop)

			// find snv that might break competing site
			const snvs=findsnv(j.chr, compete.pos+1-2, compete.pos+1-1)

			if(snvs) {
				compete.snvatcompetesite = []
				const reverse = compete.gm.strand=='-'
				for(const snv of snvs) {
					const refnt=getrefnt(j.chr, compete.pos+1-2, compete.pos+1-1, reverse)
					const mutnt=refnt.split('')
					const snvidx=snv.pos-(compete.pos-2)
					mutnt[snvidx] = reverse ? basecompliment[snv.alt] : snv.alt

					compete.snvatcompetesite.push( snv )

					if(j.exonrightin.length) {
						// exon truncating, compete site snv is outside of normal exon
						// won't check rnabam
					} else {
						// exon extension, compete site snv is in extended exon
						rnaAllelecount( snv )
					}
				}
			}

			compete.competejunction = findcompetejunction(j.chr, compete.pos, j.start)
		}
	}

	return [
		rightsnv.length ? rightsnv : undefined,
		competesites.length ? competesites : undefined
		]
}






function lefttest2(j) {

	const competesites=[]
	let leftsnv

	if(j.exonleftin.length) {
		// j.start inside one exon
		// only when j.stop matches with exon boundary, should take one exon's end as compete site

		const exon = j.exonleftin[0]

		if( j.exonright.find( rightexon => rightexon.gm.isoform == exon.gm.isoform ) ) {

			// j.stop match with exon boundary on the same isoform
			// if j.stop-spanning intron is not the same as j.start-intron (exon-skipping) will still report

			competesites.push({
				gm: exon.gm,
				exonidx: exon.exonidx, // competing site falls on the same exon as the left end of the junction
			})
		}
	}

	if(j.intronleft.length) {

		const intron = j.intronleft[0]

		if( j.exonright.find( rightexon => rightexon.gm.isoform == intron.gm.isoform) ) {
			competesites.push({
				gm: intron.gm,
				exonidx: intron.intronidx + (intron.gm.strand=='-' ? 1 : 0) // competing site falls on the exon either up or down stream of the intron depending on strand
			})
		}
	}

	if(competesites.length) {
		
		// only when there is competing site will look at junction left site
		leftsnv = findsnv(j.chr, j.start+1-arg.exonbp-1, j.start+1+arg.intronbp )

		for(const compete of competesites) {

			// position of competing site, always end of this exon, no matter j.start at intron/exon, and gene strand

			compete.pos=compete.gm.exon[compete.exonidx][1]-1

			const snvs=findsnv(j.chr, compete.pos+1-arg.exonbp-1, compete.pos+1+arg.intronbp)

			if(snvs) {
				compete.snvatcompetesite = snvs
			}

			compete.sitedist = Math.abs(compete.pos-j.start)
			compete.competejunction = findcompetejunction(j.chr, compete.pos, j.stop)
		}
	}

	return [
		leftsnv,
		competesites.length ? competesites : undefined
		]
}



function righttest2(j) {
	const competesites=[]
	let rightsnv

	if(j.exonrightin.length ) {
		const exon = j.exonrightin[0]
		if( j.exonleft.find( leftexon => leftexon.gm.isoform == exon.gm.isoform ) ) {
			competesites.push({
				gm:exon.gm,
				exonidx:exon.exonidx,
			})
		}
	}
	if(j.intronright.length) {
		const intron = j.intronright[0]
		if( j.exonleft.find( leftexon => leftexon.gm.isoform == intron.gm.isoform ) ) {
			competesites.push({
				gm: intron.gm,
				exonidx: intron.intronidx + ( intron.gm.strand=='-' ? 0 : 1)
			})
		}
	}

	if(competesites.length) {
		
		rightsnv = findsnv( j.chr, j.stop+1-arg.intronbp, j.stop+1+arg.exonbp-1)

		for(const compete of competesites) {

			compete.pos=compete.gm.exon[compete.exonidx][0]

			// position of competing site, 1 nt ahead of beginning of this exon

			compete.sitedist = Math.abs(compete.pos - j.stop)

			// find snv that might break competing site
			const snvs=findsnv(j.chr, compete.pos+1-arg.intronbp, compete.pos+1+arg.exonbp-1)

			if(snvs) {
				compete.snvatcompetesite = snvs
			}

			compete.competejunction = findcompetejunction(j.chr, compete.pos, j.start)
		}
	}

	return [
		rightsnv,
		competesites.length ? competesites : undefined
	]
}





function site2exonintron(pos, genes) {
	/*
	pos is j.start or j.stop
	find out if this pos is inside exon or intron
	rather at known exon boundary
	*/
	const exons=[]
	const introns=[]
	for(const gm of genes) {
		/*
		if(!gm.coding) {
			continue
		}
		*/
		for(let i=0; i<gm.exon.length; i++) {
			const e=gm.exon[i]
			/*
			exon coordinate include [0] but exclude [1]
			*/
			if(pos>=e[0] && pos<e[1]) {
				exons.push({
					gm:gm,
					exonidx:i
				})
			}
		}
		if(gm.intron) {
			for(let i=0; i<gm.intron.length; i++) {
				const e=gm.intron[i]
				// same as exon coordinate
				if(pos>=e[0] && pos<e[1]) {
					introns.push({
						gm:gm,
						intronidx:i
					})
				}
			}
		}
	}
	return [
		exons.length ? exons : undefined,
		introns.length ? introns : undefined
		]
}




function findsnv(chr, start, stop) {
	/*
	start/stop is 1-based!!!
	*/
	const snv=[]
	
	if(arg.dnavcf) {

		for(const thisvcf of arg.dnavcf) {
			/*
			.file
			.name
			.nochr
			.info
			.samples
			*/

			const cmd='tabix '+thisvcf.file+' '
				+(thisvcf.nochr ? chr.replace('chr','') : chr)
				+':'+start+'-'+stop
			const str=exec(cmd,{encoding:'utf8'}).trim()
			if(str=='') {
				continue
			}
			for(const line of str.split('\n')) {
				const [vcferror, mlst, altinvalid] = vcfparse.vcfparseline( line, thisvcf )

				if(vcferror) {
					console.error('dnavcf error: '+vcferror+', '+thisvcf.file)
					continue
				}

				for(const m of mlst) {

					/*
					if(!basecompliment[ m.ref ] || !basecompliment[ m.alt ]) {
						// ref/alt allele is not snv
						continue
					}
					*/
					// record this alt allele as snv
					const m2={
						chr:chr,
						pos:m.pos, // 0-based
						ref:m.ref,
						alt:m.alt,
						sampledata:m.sampledata
					}
					if(thisvcf.name) {
						m2.filename=thisvcf.name
					}
					snv.push(m2)
				}
			}
		}
	}
	if(snv.length) {
		return snv
	}
	return undefined
}






function getrefnt(chr,start,stop,revcomp) {
	const str=exec('samtools faidx '+arg.genome+' '+chr+':'+start+'-'+stop,{encoding:'utf8'}).trim()
	if(str=='') {
		return undefined
	}
	const l=str.split('\n')
	if(!l[1]) {
		// no sequence line
		return undefined
	}

	const seq=l[1].toUpperCase()

	if(revcomp) {
		let lst=[]
		for(let i=0; i<seq.length; i++) {
			const a=basecompliment[seq[i]]
			if(a) {
				lst.push(a)
			} else {
				lst.push(seq[i])
			}
		}
		return lst.join('')
	}
	return seq
}




function findcompetejunction(chr, competepos, otherend) {
	/*
	*/
	const tmp=exec('tabix '+arg.junction+' '+chr+':'+competepos+'-'+(competepos+1),{encoding:'utf8'}).trim()
	if(tmp) {
		for(const line of tmp.split('\n')) {
			const l=line.split('\t')
			const j={
				chr:l[0],
				start:Number.parseInt(l[1]),
				stop:Number.parseInt(l[2]),
				v:Number.parseInt(l[5])
			}
			if(j.start==competepos && j.stop ==otherend) return j
			if(j.stop ==competepos && j.start==otherend) return j
		}
	}
	// not found
	return {
		chr:chr,
		start:Math.min(competepos,otherend),
		stop:Math.max(competepos,otherend),
		v:0
	}
}




function rnaAllelecount(snv) {

	if(!arg.rnabam) {
		return
	}
	const tmp=exec('samtools mpileup -uv -t DP -t AD -r '
		+(arg.rnabamnochr ? snv.chr.replace('chr','') : snv.chr)
		+':'+(snv.pos+1)+'-'+(snv.pos+1)
		+' '+arg.rnabam, {encoding:'utf8'}).trim()
	if(tmp=='') {
		snv.rnabam={error:'no returned text'}
		return
	}
	let dataline=null
	for(const line of tmp.split('\n')) {
		if(line[0]=='#') continue
		dataline=line
		break
	}
	if(!dataline) {
		// normal, when this base is not transcribed
		snv.rnabam={nodata:1}
		return
	}

	// parse vcf
	// XXX m is mlst
	const [vcferror, m, altinvalid] = vcfparse.vcfparseline( dataline,
		{samples:['sample']}
		)


	if(vcferror) {
		// should not happen
		snv.rnabam={error:vcferror}
		return
	}

	/*
	vcfparse converts the data in a particular way
	all allele counts are stored in the first sample of the first alt allele
	*/
	if(!m.alleles[0]) {
		snv.rnabam={error:'m.alleles[0] missing'}
		return
	}
	if(!m.alleles[0].sampledata[0]) {
		snv.rnabam={error:'m.alleles[0].sampledata[0] missing'}
		return
	}
	const allele2rc = m.alleles[0].sampledata[0].allele2readcount
	if(!allele2rc) {
		snv.rnabam={error:'m.alelles[0].sampledata[0].allele2readcount missing'}
		return
	}
	snv.rnabam={}
	snv.rnabam[ snv.ref ] = allele2rc[snv.ref]
	snv.rnabam[ snv.mut ] = allele2rc[snv.mut]
}




/**** report ****/



function reportexonboundary(atexon) {
	const lst=[]
	for(const e of atexon) {
		lst.push({
			gm:{
				gene:e.gm.name,
				isoform:e.gm.isoform,
				strand:e.gm.strand,
			},
			exonidx:e.exonidx
		})
	}
	return lst
}



function reportcompete(lst) {
	const lst2=[]

	for(const c of lst) {
		lst2.push({
			snvatcompetesite:c.snvatcompetesite,
			pos:c.pos,
			sitedist : c.sitedist,
			gene:c.gm.name,
			isoform:c.gm.isoform,
			strand:c.gm.strand,
			exonidx:c.exonidx,
			//refsite:c.refsite,
			//mutsite:c.mutsite,
			competejunction:c.competejunction
		})
	}

	return lst2
}







function reportInexonintron(j) {
	const lst=[]
	for(const item of j) {
		const out={
			gm:{
				gene:item.gm.name,
				isoform:item.gm.isoform,
				strand:item.gm.strand,
			}
		}
		if(item.exonidx!=undefined) {
			const e=item.gm.exon[item.exonidx]
			out.exon={
				idx:item.exonidx,
				start:e[0],
				stop:e[1]
			}
		} else {
			const i=item.gm.intron[item.intronidx]
			out.intron={
				idx:item.intronidx,
				start:i[0],
				stop:i[1]
			}
		}
		lst.push(out)
	}
	return lst
}




function checkarg() {

	if(!arg.genome) abort('no genome file')
	if(!arg.genome.endsWith('.gz')) abort('genome file should be compressed by bgzip')
	if(!fs.existsSync(arg.genome+'.fai')) abort('.fai index not found for genome file (by samtools faidx)')
	if(!fs.existsSync(arg.genome+'.gzi')) abort('.gzi index not found for genome file (by samtools faidx)')

	if(!arg.gene) abort('no gene file')
	if(!arg.gene.endsWith('.gz')) abort('gene file should be compressed by bgzip')
	if(!fs.existsSync(arg.gene+'.tbi')) abort('.tbi index not found for gene file (by tabix -p bed)')

	// get chr names from gene track, for checking vcf and rnabam
	const tmp=exec('tabix -l '+arg.gene,{encoding:'utf8'}).trim()
	if(tmp=='') abort('failed to retrieve chromosome names from '+arg.gene)
	const majorchr={}
	for(const str of tmp.split('\n')) {
		majorchr[str]=1
	}

	if(!arg.junction) abort('no junction file')
	if(!arg.junction.endsWith('.gz')) abort('junction file should be compressed by bgzip')
	if(!fs.existsSync(arg.junction+'.tbi')) abort('.tbi index not found for junction (by tabix -p bed)')

	if(arg.maf) {
		if(!arg.maf.endsWith('.gz')) abort('MAF file should be compressed by bgzip')
		if(!fs.existsSync(arg.maf+'.tbi')) abort('.tbi index not found for MAF file (by tabix -p bed)')
		// MAF always is chr-less

	} else if(arg.dnavcf) {

		// allow multiple dna vcf
		const vcflst=[]

		for(const text of arg.dnavcf) {
			
			let file
			let name=undefined
			if(text.indexOf(',')==-1) {
				file=text
			} else {
				const tmp=text.split(',')
				file=tmp[0]
				name=tmp[1]
			}
			const thisvcf={
				file:file,
				name:name,
			}

			if(!file.endsWith('.gz')) abort('VCF file should be compressed by bgzip: '+file)
			if(!fs.existsSync(file+'.tbi')) abort('.tbi index not found for VCF file (by tabix -p vcf): '+file)

			// check dna vcf file to see if chr name has "chr"
			const tmp=exec('tabix -l '+file,{encoding:'utf8'}).trim()
			if(tmp=='') abort('failed to retrieve chromosome names from VCF file: '+file)
			const vcfchrs=tmp.split('\n')
			thisvcf.nochr = vcfparse.vcfcontignochr({majorchr:majorchr}, vcfchrs)

			// check dna vcf header
			const tmp2=exec('tabix -H '+file,{encoding:'utf8'}).trim()
			if(tmp2=='') abort('no VCF header from '+file)
			const [info,format,samples,err] = vcfparse.vcfparsemeta(tmp2.split('\n'))
			if(err) {
				console.log(err.join('\n'))
				abort('VCF meta lines error')
			}
			thisvcf.info=info
			thisvcf.samples=samples

			vcflst.push(thisvcf)
		}

		arg.dnavcf=vcflst

	} else {
		abort('no MAF or VCF file')
	}

/*
	if(arg.rnabam) {
		if(!arg.rnabam.endsWith('.bam')) abort('RNA-seq BAM file not ending with .bam (compressed by samtools)')
		if(!fs.existsSync(arg.rnabam+'.bai')) abort('.bai index not found for RNA BAM file')
		
		// check bam file to see if chr name has "chr"
		const tmp=exec('samtools idxstats '+arg.rnabam, {encoding:'utf8'}).trim()
		if(tmp=='') abort('failed to retrieve chromosome names from '+arg.rnabam)
		const bamchrs=[]
		for(const line of tmp.split('\n')) {
			bamchrs.push(line.split('\t')[0])
		}
		arg.rnabamnochr = vcfparse.vcfcontignochr({majorchr:majorchr}, bamchrs)
	}
	*/

	if(arg.cutoff) {
		const c=Number.parseInt(arg.cutoff)
		if(Number.isNaN(c) || c<0) abort('cutoff must be positive integer')
		arg.cutoff=c
	} else {
		arg.cutoff=0
	}

	if(arg.exonbp) {
		const c=Number.parseInt(arg.exonbp)
		if(Number.isNaN(c) || c<0) abort('exonbp must be positive integer')
		arg.exonbp=c
	} else {
		arg.exonbp=2
	}
	if(arg.intronbp) {
		const c=Number.parseInt(arg.intronbp)
		if(Number.isNaN(c) || c<0) abort('intronbp must be positive integer')
		arg.intronbp=c
	} else {
		arg.intronbp=2
	}


	function abort(msg){
		console.log('Error: '+msg+`

	 --genome=   .gz reference genome seq file, samtools-indexed, with absolute path
	 --gene=     .gz gene model file, tabix-indexed, with absolute path
	 --junction= .gz junction file, 0-based start/stop
	 --dnavcf=   .gz VCF file of DNA variants, tabix-indexed, 1-based pos
	             optionally, append a short name (e.g. "WGS" or "WES") following VCF file path, joined by comma
	             for multiple VCF files, repeat this option:
				 --dnavcf=/path/to/sample.wgs.vcf.gz,WGS --dnavcf=/path/to/sample.wes.vcf.gz,WES
	 --exonbp=   # of exonic basepairs to use for searching mutation, default 2
	 --intronbp= # of intronic basepairs to use for searching mutation, default 2
	 --output=   output file name for read depth-sorted aberrant junctions, print to STDOUT if not provided
	 --cutoff=   minimum junction read count to look at
	`)
		process.exit()
	}
}
