/*
finds exon skipping  from the gz file of a single sample

*/


const arg={}
for(let i=2; i<process.argv.length; i++) {
	const [a,b]=process.argv[i].split('=')
	const key=a.substr(2)
	arg[key]=b.trim()
}

const fs=require('fs')
const exec=require('child_process').execSync

const err=checkarg()
if(err) {
	console.log('Error: '+err+`

           splice event finder (lite-version)

--genome=          .gz reference genome seq file, samtools-indexed, with absolute path
--gene=            text file of all gene annotations in the genome
--genenames=       optional, text file of gene names to search against, separate by space or new line
                   if not provided, will search against all genes in the gene file
--junctionfile=     .gz of junction file (chr/start/stop/strand/type/readcount), tabix indexed
--readcountcutoff= optional, junctions with read count lower than cutoff will be skipped

output result to STDOUT
`)
	process.exit()
}



function checkarg() {
	if(!arg.genome) return 'missing genome file'
	if(!arg.genome.endsWith('.gz')) return 'genome file should be compressed by bgzip'
	if(!fs.existsSync(arg.genome+'.fai')) return '.fai index missing for genome file'
	if(!fs.existsSync(arg.genome+'.gzi')) return '.gzi index missing for genome file'

	if(!arg.gene) return 'missing gene file'

	if(!arg.junctionfile) return 'missing junction file'
	if(!arg.junctionfile.endsWith('.gz')) return 'junction file should be compressed by bgzip'
	if(!fs.existsSync(arg.junctionfile+'.tbi')) return '.tbi index missing for junction file'

	if(arg.readcountcutoff) {
		const c=Number.parseInt(arg.readcountcutoff)
		if(Number.isNaN(c) || c<=0) return 'invalid read count cutoff'
		arg.readcountcutoff=c
	}
}











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
const findalternativeSSevents = require('../../src/spliceevent.a53ss').findalternativeSSevents
const spliceeventchangegmexon=require('../../src/common').spliceeventchangegmexon
const fasta2gmframecheck=require('../../src/common').fasta2gmframecheck



for(const [gene, models] of geneset) {
	/*
	for each bunch of gene models sharing the same name
	get common regions (isoforms of the same gene can be at different places)
	then look for junctions
	*/
	const regions=[]
	// isoforms of same gene name might be on different chr, or vastly remote regions in same chr
	// must make tabix query of each region separately otherwise will get too big buffer to convert to string
	for(const m of models) {
		let nomatch=true
		for(const r of regions) {
			if(m.chr==r.chr && Math.max(m.start,r.start)<Math.min(m.stop,r.stop)) {
				// same chr, overlap
				r.start=Math.min(m.start, r.start)
				r.stop=Math.max(m.stop, r.stop)
				r.genemodels.push(m)
				nomatch=false
				break
			}
		}
		if(nomatch) {
			regions.push({chr:m.chr, start:m.start, stop:m.stop, genemodels:[m]})
		}
	}

	for(const region of regions) {

		const tmpstr=exec('tabix '+arg.junctionfile+' '+region.chr+':'+region.start+'-'+region.stop,{encoding:'ascii',maxBuffer:1024000000}).trim()
		if(!tmpstr) {
			/*
			no junctions at this region
			*/
			continue
		}

		const sample2junctions=[ [] ]

		for(const line of tmpstr.split('\n')) {
			const l=line.split('\t')
			const start=Number.parseInt(l[1])
			const stop=Number.parseInt(l[2])
			const strand=l[3]
			const type=l[4]

			const v = Number.parseInt(l[5])
			if(!Number.isInteger(v)) continue

			sample2junctions[0].push({
				chr:region.chr,
				start:start,
				stop:stop,
				strand:strand,
				type:type,
				data:[{v:v}]
			})
			/*
			const j=JSON.parse(l[5])

			if(!j.samples) {
				console.error('a junction has no sample')
				continue
			}
			for(const sample of j.samples) {
				if(!Number.isInteger(sample.i)) {
					console.error('a sample has no index')
					continue
				}
				if(!Number.isInteger(sample.readcount)) {
					console.error('a sample has no readcount')
					continue
				}
				if(arg.readcountcutoff && sample.readcount<arg.readcountcutoff) {
					continue
				}

				if(!sample2junctions[sample.i]) {
					sample2junctions[sample.i]=[]
				}
				sample2junctions[sample.i].push({
					chr:region.chr,
					start:start,
					stop:stop,
					strand:strand,
					type:type,
					data:[{v:sample.readcount}]
				})
			}
			*/
		}


		// cache dna sequence for isoforms of this gene
		const cacheSeq4isoform={}
		// k: isoform.chr.pos, v: genomic sequence

		const junction2sample={}
		// k: j.chr+'.'+j.start+'.'+j.stop
		// v: [] index by sampleidx
		// v: 

		for(const [sampleidx,junctions] of sample2junctions.entries()) {
			if(!junctions) continue
			/*
			for each sample, it has a number of junctions in current gene
			find any events from these junctions
			*/

			mapjunctiontoexons( junctions, region.genemodels )

			// register all junctions, mainly the exon/intron annotations for start/stop
			for(const j of junctions) {
				const jkey=j.chr+'.'+j.start+'.'+j.stop
				if(!junction2sample[jkey]) {
					const j2={
						junction:j,
						samples:[],
						events:{}
					}

					junction2sample[jkey]=j2
				}
				// and this sample in this junction
				if(!junction2sample[jkey].samples[sampleidx]) {
					junction2sample[jkey].samples[sampleidx]={
						readcount:j.data[0].v,
						events:{}
					}
				}
			}



			/*************** exon skip/alt ************/
			const skipexonsets=findexonskipping(null, junctions, region.genemodels)

			for(const exonset of skipexonsets) {
				for(const evt of exonset.eventlst) {

					// for each skip/alt event

					if(evt.isskipexon && evt.coding) {
						/* only check event for exon skipping of coding gene
						evt
						.skippedexon[]   gm.exon[] idx
						.junctionB
						.junctionAlst[]
						.isskipexon
							.gm
							.utr3/utr5/coding boolean
						.isaltexon
							.gmA
							.gmB
						*/

						let fasta // get dna seq for checking frame, may have been cached
						const isoformkey = evt.gm.isoform+'.'+evt.gm.chr+'.'+evt.gm.start // to guard against multiple isoforms of same name but on different position
						if(cacheSeq4isoform[isoformkey]) {
							fasta = cacheSeq4isoform[isoformkey]
						} else {
							fasta=exec('samtools faidx '+arg.genome+' '+evt.gm.chr+':'+(evt.gm.start+1)+'-'+evt.gm.stop,{encoding:'ascii',maxBuffer:1024000000}).trim()
							if(!fasta) {
								console.error('no sequence retrieved, error')
								continue
							}
							cacheSeq4isoform[isoformkey]=fasta
						}
						const gm2=spliceeventchangegmexon( evt.gm, evt )
						evt.frame=fasta2gmframecheck( gm2, fasta )
					}

					const jbkey=evt.junctionB.chr+'.'+evt.junctionB.start+'.'+evt.junctionB.stop


					// consistent eventkey, to fully describe a event
					// won't be parsed later but to be used as keys of junction.events and sample.events and link them
					const eventkey=(evt.gm||evt.gmA).isoform+'.'+(evt.isskipexon?'exonskip':'exonalt')+evt.skippedexon.join(',')

					// register event at junction level
					if(!junction2sample[jbkey].events[eventkey]) {
						const _e={
							isoform:(evt.gm||evt.gmA).isoform,
							gene:gene,
							skippedexon:evt.skippedexon,
							junctionAlst:[]
						}
						for(const j of evt.junctionAlst) {
							if(j) {
								_e.junctionAlst.push({start:j.start,stop:j.stop})
							} else {
								_e.junctionAlst.push(null)
							}
						}

						if(evt.up1junction) {
							_e.up1junction = {start:evt.up1junction.start, stop:evt.up1junction.stop}
						}
						if(evt.down1junction) {
							_e.down1junction = {start:evt.down1junction.start, stop:evt.down1junction.stop}
						}
						if(evt.frame!=undefined) {
							_e.frame=evt.frame
						}
						if(evt.isskipexon) {
							_e.attrValue='exonskip'
							_e.isskipexon=true
						} else {
							_e.attrValue='exonaltuse'
							_e.isaltexon=true
						}
						junction2sample[jbkey].events[eventkey]=_e
					} else {
						// this event has already been seen for this junction, _e is the obj
						const _e=junction2sample[jbkey].events[eventkey]
						// however, the previous sample may lack some auxiliary junctions
						for(const [i,j] of evt.junctionAlst.entries()) {
							if(j && !_e.junctionAlst[i]) {
								_e.junctionAlst[i]={start:j.start,stop:j.stop}
							}
						}
						if(evt.up1junction) {
							_e.up1junction = {start:evt.up1junction.start, stop:evt.up1junction.stop}
						}
						if(evt.down1junction) {
							_e.down1junction = {start:evt.down1junction.start, stop:evt.down1junction.stop}
						}
					}

					// register event at sample level
					const _e={
						percentage:evt.percentage,
					}
					junction2sample[jbkey].samples[sampleidx].events[eventkey]=_e
				}
			}



			/************ a5ss, a3ss ***********/

			const aSSevents=findalternativeSSevents(junctions)

			for(const evt of aSSevents) {

				if(evt.gm.coding) {
					let fasta // get dna seq for checking frame, may have been cached
					const isoformkey = evt.gm.isoform+'.'+evt.gm.chr+'.'+evt.gm.start // to guard against multiple isoforms of same name but on different position
					if(cacheSeq4isoform[isoformkey]) {
						fasta = cacheSeq4isoform[isoformkey]
					} else {
						fasta=exec('samtools faidx '+arg.genome+' '+evt.gm.chr+':'+(evt.gm.start+1)+'-'+evt.gm.stop,{encoding:'ascii',maxBuffer:1024000000}).trim()
						if(!fasta) {
							console.error('no sequence retrieved, error')
							continue
						}
						cacheSeq4isoform[isoformkey]=fasta
					}
					const gm2=spliceeventchangegmexon( evt.gm, evt )
					evt.frame=fasta2gmframecheck( gm2, fasta )
				}

				// register this event by junctionB
				const jbkey=evt.junctionB.chr+'.'+evt.junctionB.start+'.'+evt.junctionB.stop



				// consistent eventkey, to fully describe a event
				// won't be parsed later but to be used as keys of junction.events and sample.events and link them
				const eventkey=evt.gm.isoform+'.'+(evt.a5ss?'a5ss':'a3ss')+evt.exon5idx+(evt.altinexon ? 'exon':'intron')

				// register event at junction level
				if(!junction2sample[jbkey].events[eventkey]) {
					const _e={
						isoform:evt.gm.isoform,
						gene:evt.gm.name,
						strand:evt.gm.strand,
						exon5idx:evt.exon5idx,
						sitedist:evt.sitedist,
					}

					if(evt.a5ss) {
						_e.a5ss=true
						_e.attrValue='a5ss'
					} else {
						_e.a3ss=true
						_e.attrValue='a3ss'
					}
					if(evt.altinexon) {
						_e.altinexon=true
					} else {
						_e.altinintron=true
					}
					if(evt.junctionA) {
						_e.junctionA={start:evt.junctionA.start,stop:evt.junctionA.stop}
					}
					if(evt.frame!=undefined) {
						_e.frame=evt.frame
					}
					junction2sample[jbkey].events[eventkey]=_e
				} else {
					// this event has already been seen for this junction, _e is the obj
					const _e=junction2sample[jbkey].events[eventkey]
					// however, the previous sample may lack some auxiliary junctions
					if(!_e.junctionA && evt.junctionA) {
						_e.junctionA={start:evt.junctionA.start,stop:evt.junctionA.stop}
					}
				}
				// register event at sample level
				const _e={
					percentage:evt.percentage,
				}
				junction2sample[jbkey].samples[sampleidx].events[eventkey]=_e
			}



			/**** done this sample ***/
		}



		// output
		for(const k in junction2sample) {

			// one junction

			const jd=junction2sample[k]

			let evtcount=0
			for(const ek in jd.events) evtcount++

			if(evtcount==0) {
				// no events for this junction, do not output
				continue
			}

			// this junction has events

			const samples=[]
			for(const [sampleidx,sample] of jd.samples.entries()) {
				if(!sample) continue
				let evtcount=0
				for(const ek in sample.events) evtcount++
				if(evtcount==0) {
					samples.push({
						i:sampleidx,
						readcount:sample.readcount,
					})
				} else {
					samples.push({
						i:sampleidx,
						readcount:sample.readcount,
						events:sample.events
					})
				}
			}
			// convert lengthy eventkey to numerals
			const str2id={}
			let i=0
			const o={}
			for(const str in jd.events) {
				str2id[str]=i
				o[i]=jd.events[str]
				i++
			}

			jd.events=o

			for(const sample of samples) {
				if(!sample.events) continue
				const o={}
				for(const str in sample.events) {
					o[ str2id[str] ]=sample.events[str]
				}
				sample.events=o
			}
			console.log(jd.junction.chr+'\t'+jd.junction.start+'\t'+jd.junction.stop+'\t'+jd.junction.strand+'\t'+jd.junction.type+'\t'+JSON.stringify({
				events:jd.events,
				samples:samples
			}))
		}
	}
}
