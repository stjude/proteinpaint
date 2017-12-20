if(process.argv.length!=3) {
	console.log('<config.js file> output to stdout')
	process.exit()
}




const fs=require('fs')
const path=require('path')
const readline=require('readline')
const d3dsv = require('d3-dsv')
const exec=require('child_process').execSync


const configfile = process.argv[2]

const ds = require(configfile)



//////////////////// cutoffs
// max bp length of domain boundary, above which won't consider
const maxlen_domainboundary = 20000
// max overlap length, above which do not consider as neighboring domains
const maxlen_domainoverlap = 500 
// min expression rank to report, 0-100 for lowest-highest
const min_expressionrank = 60
// min actual expression value to report
const min_fpkm = 5
// max percentage of a tad domain to overlap with a cnv segment; if above, won't check genes in this domain
const max_domaincontainedincnv = 0.9 // not used
// max percentage of a gene to overlap with a cnv loss segment; if above, will not look at this gene
const max_geneoverlapwithcnvloss = 0.2
// min percentage of a gene to overlap with a domain; if less, do not consider the gene; commonly the gene should be entirely included in the domain
const min_geneoverlapwithdomain = 0.5 // using 100% instead





///////////////////// validate ds
if(!ds.genetrack) abort('genetrack missing from ds')
if(!ds.cohort) abort('cohort missing from ds')
if(!ds.cohort.samplegroupkeys) abort('cohort.samplegroupkeys missing from ds')
if(!ds.hicTADfiles) abort('hicTADfiles missing from ds')
if(!ds.queries) abort('queries missing from ds')
if(!ds.queries.svcnv) abort('svcnv missing from ds.queries')
if(!ds.queries.svcnv.textfile) abort('textfile missing from ds.queries.svcnv') // this is a text file
if(!ds.queries.genefpkm) abort('genefpkm missing from ds.queries')
if(!ds.queries.genefpkm.file) abort('file missing from ds.queries.genefpkm')




// sample annotation load to here
ds.cohort.annotation = {}


// parse sample annotation to ds.cohort.annotation
for(const file of ds.cohort.files) {
	for(const item of d3dsv.tsvParse( fs.readFileSync(file.file, {encoding:'utf8'}).trim())) {
		ds.cohort.tohash( item, ds )
	}
}




// parse hic TAD, figure out domain boundaries, each separating a pair of neighbouring TAD

for(const file of ds.hicTADfiles) {

	//console.error('parsing TAD: '+file.file)

	file.chr2boundaries = {}

	const chr2domains = new Map()

	for(const line of fs.readFileSync(file.file, {encoding:'utf8'}).trim().split('\n')) {
		const l = line.split('\t')
		const chr=l[0]
		if(!chr2domains.has(chr)) {
			chr2domains.set(chr, [])
		}
		const start=Number.parseInt(l[1])
		const stop=Number.parseInt(l[2])

		chr2domains.get(chr).push( [start, stop] )
	}

	for(const [chr, domains] of chr2domains) {
		file.chr2boundaries[chr]=[]
		for(let i=0; i<domains.length-1; i++) {

			const start1 = domains[i][0]
			const stop1  = domains[i][1]

			for(let j=i+1; j<domains.length; j++) {

				const start2 = domains[j][0]
				const stop2  = domains[j][1]

				if( start2 - stop1 >= maxlen_domainboundary) {
					// too far off
					break
				}

				if(stop1 - start2 <= maxlen_domainoverlap) {
					// within limit of overlap, consider neighbouring
					file.chr2boundaries[chr].push({
						start: Math.min(stop1, start2),
						stop:  Math.max(stop1, start2),
						leftdomain: { start:start1, stop:stop1 },
						rightdomain: {start:start2, stop:stop2 }
					})
				}
			}
		}
	}

	if(0) {
		for(const chr in file.chr2boundaries) {
			for(const b of file.chr2boundaries[chr]) {
				console.log(path.basename(file.file), chr, JSON.stringify(b) )
			}
		}
	}
}




// parse cnv
for(const line of fs.readFileSync(ds.queries.svcnv.textfile,{encoding:'utf8'}).trim().split('\n')) {

	if(line[0]=='#') continue

	const l = line.split('\t')

	const cnv = JSON.parse(l[3])

	if(cnv.value==undefined) {
		// not a cnv
		continue
	}

	if(Math.abs(cnv.value) < ds.queries.svcnv.valueCutoff) continue

	cnv.chr=l[0]
	cnv.start=Number.parseInt(l[1])
	cnv.stop=Number.parseInt(l[2])

	if(cnv.stop-cnv.start >= ds.queries.svcnv.bplengthUpperLimit) continue

	for(const hic of ds.hicTADfiles) {

		if(!hic.chr2boundaries[ cnv.chr ]) continue

		for(const boundary of hic.chr2boundaries[ cnv.chr]) {
			if(cnv.start < boundary.start && cnv.stop > boundary.stop) {
				// a boundary fully contained
				test_boundary( cnv, boundary, hic )
			}
		}
	}
}






function test_boundary( cnv, boundary, hicfile ) {
	/*
	cnv
		.chr
		.start
		.stop
		.sample
		.value
	boundary
		.start
		.stop
		.rightdomain
		.leftdomain
			.start
			.stop
	hicfile
		.name
	*/

	// genes from the left/right domains to be tested for expression
	const leftgenes = findgenefromdomain( cnv.chr, boundary.leftdomain )
	const rightgenes = findgenefromdomain( cnv.chr, boundary.rightdomain )

	const genes0 = [...leftgenes, ...rightgenes]
	const genes = []

	if(cnv.value<0) {
		// copy number loss
		for(const g of genes0) {
			const p1 = Math.max(g.start, cnv.start)
			const p2 = Math.min(g.stop, cnv.stop)
			if(p1 < p2) {
				// gene overlap with cnv
				if( (p2-p1) / (g.stop-g.start) > max_geneoverlapwithcnvloss) {
					// too much of gene in cnv
					continue
				}
			}
			genes.push(g)
		}

	} else {

		// gain
		// use all
		for(const g of genes0) {
			genes.push(g)
		}
	}

	if(genes.length==0) return

	for(const gene of genes) {
		// gene/start/stop/chr

		const [rank, expressionvalue] = test_expressionrank( cnv.sample, gene )


		if(rank==-1) {
			// no valid data
			continue
		}

		if(expressionvalue <= min_fpkm) {
			// expression level too low
			continue
		}


		// may test against rank cutoff after ase/outlier, since oncogenes are not supposed to be expressed
		if(rank <= min_expressionrank) {
			// rank not high enough
			continue
		}

		const out = {
			sample:cnv.sample,
			logratio:cnv.value,
			gene:{
				name:gene.gene,
				fpkm:expressionvalue,
				rank:rank,
			},
			hic:hicfile.name,
			boundary:boundary
		}
		console.log(cnv.chr+'\t'+cnv.start+'\t'+cnv.stop+'\t'+JSON.stringify(out))
	}
}





function test_expressionrank( sample, gene) {
	/*
	gene
		.gene
		.chr/start/stop
	*/


	const str = exec('tabix '+ds.queries.genefpkm.file+' '+gene.chr+':'+gene.start+'-'+gene.stop,{encoding:'utf8'}).trim()
	if(!str) return [-1, -1]

	const thissamplekeyvalues = get_annotation_level(sample)
	const sample2value=new Map() // from the same group
	
	for(const line of str.split('\n')) {
		const l = line.split('\t')
		const j = JSON.parse(l[3])

		if(j.gene!=gene.gene) continue

		if(sampleissamegroup(j.sample, thissamplekeyvalues)) {
			sample2value.set( j.sample, j.value )
		}
	}

	const thisvalue = sample2value.get(sample)

	
	if(thisvalue==undefined) {
		// this sample not found??
		return [-1,-1]
	}

	const lst = [...sample2value.values()].sort((i,j)=>i-j)
	const rank = get_rank_from_sortedarray( thisvalue, lst )

	return [ rank, thisvalue ]
}





function get_rank_from_sortedarray(v, lst) {
	// lst must be sorted ascending [ { value: v } ]
	const i = lst.findIndex(j=> j >= v)
	if(i==-1 || i==lst.length-1) return 100
	if(i==0) return 0
	return Math.ceil( 100 * i / lst.length )
}


function get_annotation_level(sample) {
	const anno = ds.cohort.annotation[sample]
	if(!anno) {
		abort('no annotation for sample: '+sample)
	}

	const keyvalues = []
	for(const key of ds.cohort.samplegroupkeys) {
		keyvalues.push( anno[key] )
	}
	return keyvalues
}



function sampleissamegroup(sample, keyvalues) {
	const kv2 = get_annotation_level(sample)
	for(let i=0; i<kv2.length; i++) {
		if(kv2[i] != keyvalues[i]) {
			return false
		}
	}
	return true
}



function findgenefromdomain( chr, domain ) {
	// find genes fully contained in domain
	const str = exec('tabix '+ds.genetrack+' '+chr+':'+domain.start+'-'+domain.stop,{encoding:'utf8'}).trim()
	if(!str) return []

	// return gene name, collate isoforms

	const genename2range = new Map()

	for(const line of str.split('\n')) {
		const l=line.split('\t')
		const start = Number.parseInt(l[1])
		const stop  = Number.parseInt(l[2])

		// gene must be fully in domain
		if(start>=domain.start && stop<=domain.stop) {
			const g = JSON.parse(l[3])
			if(!genename2range.has(g.name)) {
				genename2range.set(g.name, {start:start, stop:stop})
			}
			genename2range.get(g.name).start = Math.min(genename2range.get(g.name).start, start)
			genename2range.get(g.name).stop = Math.max(genename2range.get(g.name).stop, stop)
		}
	}

	const lst=[]
	for(const [name,range] of genename2range) {
		lst.push({
			gene:name, 
			chr:chr,
			start:range.start,
			stop:range.stop
		})
	}
	return lst
}



function abort(m) {
	console.error('Error: '+m)
	process.exit()
}
