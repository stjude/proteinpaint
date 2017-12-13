const arg={}
for(let i=2; i<process.argv.length; i++) {
	const [a,b]=process.argv[i].split('=')
	const key=a.substr(2)
	arg[key]=b.trim()
}

const fs=require('fs')
const exec=require('child_process').execSync

checkarg()



let usegenes=null
if(arg.genenames) {
	// look at a subset of genes
	usegenes=new Set()
	for(const line of fs.readFileSync(arg.genenames,'utf8').trim().split('\n')) {
		for(const name of line.split(/[\s\t]/)) {
			usegenes.add(name)
		}
	}
	if(usegenes.size==0) {
		console.error('no gene names')
		process.exit()
	}
}


const geneset=new Map()


for(const line of fs.readFileSync(arg.gene,'utf8').trim().split('\n')) {
	const l=line.split('\t')
	const j=JSON.parse(l[3])

	j.chr=l[0]
	j.start=Number.parseInt(l[1])
	j.stop=Number.parseInt(l[2])

	if(usegenes && !usegenes.has(j.name)) {
		continue
	}
	if(!geneset.has(j.name)) {
		geneset.set(j.name, [])
	}
	geneset.get(j.name).push(j)
}

if(!geneset.size) {
	console.error('No genes')
	process.exit()
}


const mapjunctiontoexons=require('../../src/spliceevent.prep').mapjunctiontoexons
const findexonskipping=require('../../src/spliceevent.exonskip').findexonskipping
const spliceeventchangegmexon=require('../../src/common').spliceeventchangegmexon
const fasta2gmframecheck=require('../../src/common').fasta2gmframecheck



for(const [gene, models] of geneset) {
	/*
	for each bunch of gene models sharing the same name
	get a common coordinate
	then look for junctions
	*/
	const chr=models[0].chr
	let start=models[0].start
	let stop=models[0].stop
	for(const m of models) {
		if(m.chr!=chr) {
			// !
			continue
		}
		start=Math.min(m.start, start)
		stop=Math.max(m.stop, stop)
	}
	const tmpstr=exec('tabix '+arg.junction+' '+chr+':'+start+'-'+stop,{encoding:'utf8'}).trim()
	if(!tmpstr) {
		/*
		no junctions at this region
		*/
		continue
	}
	const junctions=[]
	for(const line of tmpstr.split('\n')) {
		const l=line.split('\t')
		if(!l[6-1]) {
			console.error('junction read count expected at column 6: '+line)
			continue
		}
		const v=Number.parseInt(l[6-1])
		if(Number.isNaN(v)) {
			console.error('invalid junction read count: '+l[6-1])
			continue
		}
		if(arg.readcountcutoff && v<arg.readcountcutoff) {
			continue
		}

		const j={
			chr:l[0],
			start:Number.parseInt(l[1]),
			stop:Number.parseInt(l[2]),
			data:[{ v:v }]
		}
		junctions.push(j)
	}
	if(junctions.length==0) {
		continue
	}

	mapjunctiontoexons( junctions, models )

	const exonsets=findexonskipping(null, junctions, models)

	if(exonsets.length==0) {
		continue
	}

	// check frame
	for(const exonset of exonsets) {
		for(const evt of exonset.eventlst) {
			if(!evt.isskipexon || !evt.coding) {
				// do not check frame
				continue
			}
			const gm2=spliceeventchangegmexon( evt.gm, evt )
			const fasta=exec('samtools faidx '+arg.genome+' '+gm2.chr+':'+(gm2.start+1)+'-'+gm2.stop,{encoding:'utf8'}).trim()
			if(!fasta) {
				// no sequence retrieved, error
				continue
			}
			evt.frame=fasta2gmframecheck( gm2, fasta )
		}
	}

	logevent( exonsets, gene )
}




function logevent( exonsets, gene) {
	for(const exonset of exonsets) {
		/*
		events from each exon set have the same junctionB
		*/

		const jB=exonset.eventlst[0].junctionB

		const report={
			events:[],
			junction:{
				chr:jB.chr,
				start:jB.start,
				stop:jB.stop,
				v:jB.data[0].v
			}
		}
		// events from each exon set should all be skipping or altuse
		if(exonset.eventlst[0].isskipexon) {
			report.isskipexon=true
		} else {
			report.isaltexon=true
		}
		for(const evt of exonset.eventlst) {
			const e2={
				skippedexon:evt.skippedexon,
				percentage:evt.percentage,
				coding:evt.coding,
				utr3:evt.utr3,
				utr5:evt.utr5,
				frame:evt.frame
			}
			if(evt.isskipexon) {
				e2.isskipexon=true
				e2.isoform=evt.gm.isoform
			} else {
				e2.isaltexon=true
				e2.isoform=evt.gmB.isoform
				e2.isoformA=evt.gmA.isoform
			}
			report.events.push(e2)
		}
		console.log(gene+'\t'+JSON.stringify(report))
	}
}






function checkarg() {
	if(!arg.genome) abort('missing genome file')
	if(!arg.genome.endsWith('.gz')) abort('genome file should be compressed by bgzip')
	if(!fs.existsSync(arg.genome+'.fai')) abort('.fai index missing for genome file')
	if(!fs.existsSync(arg.genome+'.gzi')) abort('.gzi index missing for genome file')

	if(!arg.gene) abort('missing gene file')

	if(!arg.junction) abort('missing junction file')
	if(!arg.junction.endsWith('.gz')) abort('junction file should be compressed by bgzip')
	if(!fs.existsSync(arg.junction+'.tbi')) abort('.tbi index missing for junction file')

	if(arg.readcountcutoff) {
		const c=Number.parseInt(arg.readcountcutoff)
		if(Number.isNaN(c) || c<=0) abort('invalid read count cutoff')
		arg.readcountcutoff=c
	}


	function abort(msg) {
		console.log('Error: '+msg+`

        splice event finder (single sample)

--genome=          .gz reference genome seq file, samtools-indexed, with absolute path
--gene=            text file of all gene annotations in the genome
--genenames=       optional, text file of gene names to search against, separate by space or new line
                   if not provided, will search against all genes in the gene file
--junction=        .gz junction file, tabix indexed
--readcountcutoff= optional, junctions with read count lower than cutoff will be skipped

output result to STDOUT
`)
		process.exit()
	}
}
