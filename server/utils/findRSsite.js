const genefile='/home/xzhou/data/tp/anno/gencode.v24.hg19'
const seqfile='/home/xzhou/data/hg19/hg19.fa.gz'

//const seqfile='/home/xzhou1/gb_customTracks/tp/genomes/hg19.gz'
//const genefile='/home/xzhou1/gb_customTracks/tp/anno/gencode.v24.hg19'


const lookedintron=new Set()

const fs=require('fs')
const exec=require('child_process').execSync


const pentamer=new Set(['GTAAG','GTGAG','GTAGG','GTATG','GTAAA','GTAAT','GTGGG','GTAAC','GTCAG','GTACG','GTACA','GTATT','GTACT','GTGTG','GTGCG','GTACC'])



for(const line of fs.readFileSync(genefile,'utf8').trim().split('\n')) {
	const l=line.split('\t')
	const gene=JSON.parse(l[3])

	if(!gene.coding) {
		continue
	}
	if(!gene.intron) {
		continue
	}

	const chr=l[0]
	const forward=gene.strand=='+'

	for(const intron of gene.intron) {
		if(Math.max(intron[0], gene.codingstart)>Math.min(intron[1],gene.codingstop)) {
			continue
		}

		const ist=chr+'.'+intron[0]+'.'+intron[1]
		if(lookedintron.has(ist)) {
			continue
		}
		lookedintron.add(ist)

		const lines=exec('samtools faidx '+seqfile+' '+chr+':'+(intron[0]+1)+'-'+intron[1],{encoding:'utf8'}).trim().split('\n')
		lines.shift()
		let seq=lines.join('')

		if(!forward) {
			const lst=[]
			const seq2=seq.toLowerCase()
			for(let i=0; i<seq2.length; i++) {
				const n=seq2[i]
				if(n=='a') {
					lst.unshift('T')
				} else if(n=='t') {
					lst.unshift('A')
				} else if(n=='c') {
					lst.unshift('G')
				} else if(n=='g') {
					lst.unshift('C')
				} else {
					lst.unshift(seq[i])
				}
			}
			seq=lst.join('')
		}

		for(let i=22; i<seq.length-5; i++) {
			// i as last of 3' site
			
			// 3' site 

			// Y-A-G
			if(seq[i]!='G') {
				continue
			}
			if(seq[i-1]!='A') {
				continue
			}
			if(seq[i-2]!='C' && seq[i-2]!='T') {
				// not Y
				continue
			}
			// polypyrimidine
			let Ynum=0
			for(let j=i-22; j<i-1; j++) {
				if(seq[j]=='C' || seq[j]=='T') {
					Ynum++
				}
			}
			if(Ynum<=10) {
				continue
			}
			
			// 5' site

			const fiveseq=seq.substr(i+1,5)
			//console.log(seq.substr(i-22,20), seq.substr(i-2,3), fiveseq)

			if(!pentamer.has(fiveseq)) {
				continue
			}

			// report
			if(forward) {
				console.log(chr+'\t'+(intron[0]+i+1)+'\t+')
			} else {
				console.log(chr+'\t'+(intron[1]-i-2)+'\t-')
			}
		}
	}
}
