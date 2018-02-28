
if(process.argv.length!=3) {
	console.log('<input bgzipped vcf file> output to "mat">')
	process.exit()
}

/*
may allow sample-less vcf
may allow multiple files for input 
*/




const vcffiles = [ {file:process.argv[2]} ]

const fs = require('fs')
const zlib = require('zlib')
const readline = require('readline')
const vcf = require('../../src/vcf')
const common = require('../../src/common')



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






const vcftasks = []


for(const file of vcffiles) {


	const task = new Promise((resolve, reject)=>{

		const reader = readline.createInterface({
			input: fs.createReadStream( file.file ).pipe( zlib.createGunzip() )
		})

		const metalines=[]
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

			if(mlst.length==0) return

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

				// may filter variants by class

				count4gene( m )

				count4sample( m )
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
	
	const features = topgenes2features()
	console.log(features)

})
.then( ()=>{
	// get gene positions
})
.catch(err=>{
	console.log(err)
})







function topgenes2features() {
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


function abort(err) {
	console.error(err)
	process.exit()
}
