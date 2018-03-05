const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const readline = require('readline')
const vcf = require('../../src/vcf')
const common = require('../../src/common')

/*
may allow sample-less vcf
may allow multiple files for input 
*/

const arg = checkArg( )

/*
arg:
	.genome
	.genefile
	.toheatmap
	.tomatrix
	.excludeclass
	.vcf[ {} ]
		.istext
		.file (text)

		.istrack
		.gzpath
		.indexpath
*/





//// data structures for samplematrix

const gene2mutationcount = new Map()
/*
k: gene
v: {
	chrs: map
		chr : {
			start
			stop
			mutationcount
		}
}
*/

const sample2geneset = new Map()
// k: sample
// v: Set of gene


//// data structures for heatmap

const heatmap_snvindel_lines = []
const heatmap_snvindel_fileheader = 'gene\trefseq\tchromosome\tstart\taachange\tclass\tsample'


const vcftasks = []

for(const thisvcf of arg.vcf) {

	const task = new Promise((resolve, reject)=>{

		let reader


		if( thisvcf.istext ) {
			reader = readline.createInterface({
				input:fs.createReadStream( thisvcf.file, {encoding:'utf8'} )
			})
		} else {
			reader = readline.createInterface({
				input: fs.createReadStream( thisvcf.gzpath ).pipe( zlib.createGunzip() )
			})
		}

		const metalines = []
		const vcfobj = {}

		reader.on('line', line=>{

			if(line[0]=='#') {
				if(line[1]=='C') {
					// sample line
					metalines.push(line)
					const [info, format, samples, err] = vcf.vcfparsemeta( metalines )
					if(err) {
						abort('header error: '+err.join('; '))
					}
					vcfobj.info = info
					vcfobj.format = format
					vcfobj.samples = samples
					return
				}
				metalines.push( line )
				return
			}

			const [badinfo, mlst, altinvald] = vcf.vcfparseline( line, vcfobj )

			if(!mlst || mlst.length==0) return

			for(const m of mlst) {

				// copy over gene annotation from csq or ann
				common.vcfcopymclass( m, {} )
				
				if(!m.gene) {
					// no gene, do not include
					continue
				}

				if(!m.sampledata || m.sampledata.length==0) {
					// no sample
					// may allow sample-less vcf
					continue
				}

				if(arg.excludeclass && arg.excludeclass.has( m.class.toLowerCase() )) {
					continue
				}

				if(arg.tomatrix) {

					count4gene(m)
					count4sample(m)

				} else if(arg.toheatmap) {

					variant2heatmap( m )
				}
			}
		})

		reader.on('close',()=>{
			resolve()
		})
	})

	vcftasks.push( task )
}


Promise.all( vcftasks )
.then( ()=>{

	if(arg.toheatmap) {
		heatmap_outputHtml()
		return
	}

	return adjustGenePosition()

})
.then( ()=>{

	if(arg.toheatmap) return

	const features = topGenes2features()
	const samples = rankSamplesByFeatures( features )
	matrix_outputHtml( features, samples )
})
.catch(err=>{
	console.log(err)
})










function variant2heatmap(m) {
	for(const sm of m.sampledata) {
		// gene\trefseq\tchromosome\tstart\taachange\tclass\tsample
		heatmap_snvindel_lines.push(
			m.gene+'\t'+
			m.isoform+'\t'+
			m.chr+'\t'+
			m.pos+'\t'+
			m.mname+'\t'+
			common.mclass[m.class].label+'\t'+
			sm.sampleobj.name
		)
	}
}

function rankSamplesByFeatures( features ) {
	const featuregenes = new Set()
	for(const f of features) {
		featuregenes.add( f.genename )
	}

	const s2genecount= new Map()
	for(const [sample, thissamplegenes] of sample2geneset) {
		let count=0
		for(const n of thissamplegenes) {
			if(thissamplegenes.has(n)) count++
		}
		if(count) {
			s2genecount.set( sample, count )
		}
	}
	const lst = [ ...s2genecount ]
	lst.sort( (i,j)=> j[1]-i[1] )
	const samples = []
	for(const [sample,count] of lst) {
		samples.push({
			name:sample
		})
	}
	return samples
}



function adjustGenePosition() {
	/*
	adjust start/stop for genes in gene2mutationcount

	read through the entire flat file:
		inefficient
		will not handle alias
	may change to querying pp server?
	*/
	return new Promise((resolve,reject)=>{

		const rl = readline.createInterface({input: fs.createReadStream( genome2genefile[ genomename ], {encoding:'utf8'} )})
		rl.on('line',line=>{
			const l = line.split('\t')
			const j = JSON.parse(l[3])
			if( !gene2mutationcount.has( j.gene ) ) return
			const chr = l[0]

			const o = gene2mutationcount.get(j.gene).chrs.get( chr )
			if(!o) return

			o.start = Math.min( o.start, Number.parseInt(l[1]) )
			o.stop  = Math.max( o.stop,  Number.parseInt(l[2]) )
		})
		rl.on('close',line=>{
			resolve()
		})
	})
}



function topGenes2features() {
	const lst = []
	for(const [genename, o] of gene2mutationcount) {
		for(const [chr, o2] of o.chrs) {
			lst.push({
				isvcfitd:1,
				label: genename + (o.chrs.size>1 ? ' ('+chr+')' : ''),
				genename: genename,
				chr: chr,
				start: o2.start,
				stop: o2.stop,
				_count: o2.mutationcount
			})
		}
	}
	lst.sort( (i,j) => j._count - i._count )

	const features = []
	for(let i=0; i<Math.min( 20, lst.length); i++) {
		const f = lst[i]
		//delete f._count
		features.push( f )
	}
	return features
}



function count4gene( m ) {
	if(!gene2mutationcount.has( m.gene )) {
		gene2mutationcount.set( m.gene, {
			chrs: new Map()
		})
	}

	let o = gene2mutationcount.get(m.gene).chrs.get( m.chr )
	if(!o) {
		o = {
			start: m.pos-1,
			stop: m.pos,
			mutationcount: 0
		}
		gene2mutationcount.get(m.gene).chrs.set( m.chr, o )
	}
	o.start = Math.min(o.start, m.pos)
	o.stop = Math.max(o.stop, m.pos+1)
	o.mutationcount++
}


function count4sample( m ) {
	for(const sm of m.sampledata) {
		if(!sm.sampleobj || !sm.sampleobj.name) {
			// invalid data structure
			continue
		}

		const sample = sm.sampleobj.name

		if(!sample2geneset.has( sample )) {
			sample2geneset.set( sample, new Set() )
		}
		sample2geneset.get( sample ).add( m.gene )
	}
}



function matrix_outputHtml( features, samples ) {
	const matrix = {
		genome: genomename,
		features: features,
		samples: samples,
		vcftracks: vcffiles
	}
}


function heatmap_outputHtml() {

	const text = heatmap_snvindel_fileheader+'\n'+heatmap_snvindel_lines.join('\n')

	fs.writeFileSync( arg.html,
	`<!DOCTYPE html>
<html>
<head>
 <meta charset="utf-8">
</head>
  <body style="margin:30px">
	<script src="https://pecan.stjude.cloud/sjcharts/bin/sjcharts.js" charset="utf-8"></script>	
	<script src="https://proteinpaint.stjude.org/bin/proteinpaint.js" charset="utf-8"></script>
	<div id=aaa></div>
	<script>
	const vcfdata = \`${text}\`
	runproteinpaint({
		host:'https://proteinpaint.stjude.org',
		holder:document.getElementById('aaa'),
		studyview:{
			genome:"${arg.genome}",
			snvindel:vcfdata,
			show_heatmap:1,
		}
	})
	</script>
</body></html>
`)
}






function checkArg() {

	if(process.argv.length < 5) abort('insufficient number of output')

	const arg={}

	// parse -- parameters
	let i=2

	for(; i<process.argv.length; i++) {

		const str = process.argv[i]
		if(!str.startsWith('--')) {
			// a file
			break
		}

		const [a,b]=process.argv[i].split('=')

		if(!b) continue

		const key=a.substr(2)

		if(key=='excludeclass') {

			arg.excludeclass = new Set( [...(b.toLowerCase().trim().split(','))] )

		} else {

			arg[key]=b.trim()
		}
	}

	// output file
	arg.html = process.argv[i++]

	// input files
	arg.vcf = []
	const trackfilename2path = new Map()
	const indexfilename2path = new Map()
	for(; i<process.argv.length; i++) {

		const file = process.argv[i]

		if(file.endsWith('.gz')) {

			trackfilename2path.set( path.basename(file), { gzpath: file } )

		} else if(file.endsWith('.tbi')) {

			indexfilename2path.set( path.basename(file).replace(/\.tbi$/,''), file )

		} else if(file.endsWith('.csi')) {

			indexfilename2path.set( path.basename(file).replace(/\.csi$/,''), file )

		} else {

			arg.vcf.push({
				istext:1,
				file: file
			})
		}
	}

	for(const [track, o] of trackfilename2path) {

		// accept only .gz file for now
		// will require index when moving to samplematrix

		o.istrack = 1
		arg.vcf.push( o )
	}

	if(arg.vcf.length==0) abort('no VCF file')

	if(!arg.genome) abort('missing genome')

	const genefiles = {
		hg19: '/home/xzhou/data/tp/anno/refGene.hg19',
		hg38: '/home/xzhou/data/tp/anno/refGene.hg38',
	}
	arg.genefile = genefiles[ arg.genome ]
	if(!arg.genefile) abort('unknown genome: '+arg.genome)

	// hardcoded for heatmap, may add matrix later

	arg.toheatmap = 1


	function abort( msg ) {
		console.log('Error: '+msg+`
	
$ node vcf2matrix.js --genome=<genome> --excludeclass=<class> <output.html> <input.vcf> <input2.vcf> ...

One or multiple VCF files can be selected for input.
A VCF file can be either .vcf.gz (bgzip-compressed) or .vcf (uncompressed).
If compresed, should provide .tbi or .csi index file.
Output is a html file.

--genome=       reference genome name (hg19/hg38)
--excludeclass= Comma separated list of codes, case-insensitive,
                for excluding mutations by class.
                See below for list of class codes and names.
		M            MISSENSE
		E            Exon of noncoding gene
		F            FRAMESHIFT
		N            NONSENSE
		S            SILENT
		D            PROTEINDEL
		I            PROTEININS
		P            SPLICE_REGION
		L            SPLICE
		Intron       INTRON
		Utr3         3' UTR
		Utr5         5' UTR
		noncoding    Noncoding
		snv          SNV, intergenic
		insertion    Insertion, intergenic
		deletion     Deletion, intergenic
		X            Nonstandard
`)
		process.exit()
	}

	return arg
}
