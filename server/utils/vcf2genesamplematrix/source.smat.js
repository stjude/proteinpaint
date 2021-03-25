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
	.excludeclass
	.vcf[ {} ]
		.gzpath
		.indexpath   actually it's not using the index path
*/





//// data structures for samplematrix

const gene2mutationcount = new Map()
/*
k: gene name
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

for(const thisvcf of arg.vcf) {

	const task = new Promise((resolve, reject)=>{


		const reader = readline.createInterface({
			input: fs.createReadStream( thisvcf.gzpath ).pipe( zlib.createGunzip() )
		})

		const metalines = []
		const vcfobj = {}

		reader.on('line', line=>{

			if(line[0]=='#') {
				if(line[1]=='C') {
					// sample line
					metalines.push(line)
					const [info, format, samples, err] = vcf.vcfparsemeta( metalines )
					if(err) {
						throw('header error: '+err.join('; '))
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

				count4gene(m)
				count4sample(m)
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

	return adjustGenePosition()

})
.then( ()=>{

	const features = topGenes2features()
	const samples = rankSamplesByFeatures( features )
	//matrix_outputHtml( features, samples )
	make_output( features, samples )
})
.catch(err=>{
	console.error( typeof(err)=='string' ? 'Error: '+err : err.message )
})









function make_output( features, samples ) {

	const featurejson = JSON.stringify(features)

	console.log(`<!DOCTYPE html>

<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sample-by-attribute matrix using ProteinPaint</title>
	<script src='https://platform.dnanexus.com/javascript/file-viewer-1.1.min.js'></script>
	<script src='https://proteinpaint.stjude.org/bin/proteinpaint.js'></script>
    <style type="text/css">
  
	body {
		margin: 0;
		padding: 0;
	}
	
	.omnibar {
		  width: 100%;
		  background: #1381B3;
		  min-height: 64px;
		  font-family: 'Open Sans', "Helvetica Neue", Helvetica, Arial, sans-serif
	}
  

	.logo {
		display: block;
		float: left;
		margin: 0 auto;
		width: 50px;
		height: 50px;
		color: #fff;
		text-decoration: none;
		padding: 8px 10px;
	}
	
	.logo img {
		border: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}
	
	.site-title {
		font-weight: 300;
		font-size: 22px;
		padding: 0;
		margin: 0;
		color: #A1CDE1;
		padding: 14px;
	}
	
	.site-title a {
		color: #fff;
		text-decoration: none;
		font-weight: 600;
	}
	
	
	.nav {
		float: right;
		margin: 0;
		padding: 20px 30px 20px 0;
	}
	
	.nav li {
		display: inline;
		margin: 0;
		padding: 0;
		margin-left: 40px;
		font-weight: 600;
		font-size: 14px;
	}
	
	.nav li a {
		text-decoration: none;
		color: #fff;
		text-transform: uppercase;
	}
	
  
  </style>


  </head>





  <body>


    <div class="omnibar">
        <ul class="nav">
			<li><a href="https://platform.stjude.cloud/requests/data_by_disease">Data</a></li>
			<li><a href="https://platform.stjude.cloud/tools">Tools</a></li>
			<li><a href="https://platform.stjude.cloud/visualizations/cohort">Visualizations</a></li>
        </ul>
        <a href="index.html" class="logo"><img src="https://pecan.stjude.org/static/stjude-logo-child.png" alt="St. Jude Cloud" title="St. Jude Cloud" /></a>
        <h1 class="site-title"><a href="index.html">St. Jude Cloud</a> ProteinPaint</h1>   
    </div>



    <div class="container-fluid" id="proteinpaintdiv"></div>

    <script type="text/javascript">
      getOptions(function(options) {

        function getPath(file) {
          return file.folder + "/" + file.name;
        }

        var pathToURL = {};
        for (var i = 0; i < options.files.length; ++i) {
          pathToURL[getPath(options.files[i])] = options.files[i].url;
        }

		let vcftrack

		for(var path in pathToURL) {
			var filename = path.split('/').pop();
			if(path.endsWith('.vcf.gz')) {
				var indexfile = pathToURL[path+'.csi'] || pathToURL[path+'.tbi']
				if(indexfile) {
					vcftrack = {
						url: pathToURL[path],
						indexURL: indexfile,
					}
				} else {
					window.alert("You chose a VCF.GZ file (" + filename + ") but no associated index file (.tbi or .csi)");
				}
			}
		}

		if(!vcftrack) window.alert('No VCF track provided')

		var proteinpaintConfig={
			//host:'https://proteinpaint.stjude.org',
			host:'http://localhost:3000',
			holder:document.getElementById('proteinpaintdiv'),
			noheader:true,
			samplematrix:{
				genome: "${arg.genome}",
				querykey2tracks: {
					vcf: vcftrack
				},
				features: ${featurejson}
			}
		}

		runproteinpaint(proteinpaintConfig)
	});
    </script>
  </body>
</html>
`)
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

		const rl = readline.createInterface({input: fs.createReadStream( arg.genefile, {encoding:'utf8'} )})
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
				isvcf:1,
				querykey:'vcf',
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

	// input files
	arg.vcf = []
	const trackfilename2path = new Map()
	const indexfilename2path = new Map()
	for(; i<process.argv.length; i++) {

		const file = process.argv[i]

		if(file.endsWith('.gz')) {

			trackfilename2path.set( path.basename(file), file  )

		} else if(file.endsWith('.tbi')) {

			indexfilename2path.set( path.basename(file).replace(/\.tbi$/,''), file )

		} else if(file.endsWith('.csi')) {

			indexfilename2path.set( path.basename(file).replace(/\.csi$/,''), file )

		} else {

			// do not process text file
		}
	}

	for(const [name, gzpath] of trackfilename2path) {

		const indexpath = indexfilename2path.get( name )

		if(!indexpath) abort('index file missing for .gz file '+name)

		arg.vcf.push( {
			name: name,
			gzpath: gzpath,
			indexpath: indexpath
		})
	}

	if(arg.vcf.length==0) abort('no VCF file')

	if(!arg.genome) abort('missing genome')

	// FIXME don't know where to put support files

	const genefiles = {
		hg19: '/usr/bin/refGene.hg19',
	}

	arg.genefile = genefiles[ arg.genome ]
	if(!arg.genefile) abort('unknown genome: '+arg.genome)

	// hardcoded for heatmap, may add matrix later

	arg.toheatmap = 1


	function abort( msg ) {
		console.error('Error: '+msg+`
	
$ node getgene.js --genome=<genome> --excludeclass=<class> <input.vcf.gz> <input.vcf.gz.tbi>

Output a JSON obj to stdout, with:
	.filename
	.genes
	.samples

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
