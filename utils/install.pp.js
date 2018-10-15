/*
Run this script under the ProteinPaint root diretory:

$ node utils/install.pp.js

Will install some dependencies, and download support files if not available on your system

Requires:

* Node.js 8 or higher
* npm

Optionally, the script reads a two-column tabular text file
where first column is key, and the optional second column is value
all keys are optional
lines starting with # are ignored

  TP    - full path of the TP directory
  CACHE - full path of the cache directory
  BINPATH - full path to a directory for storing dependent binary files and programs
  URL     - the URL of your PP service
  PORT    - port number for the node server
  PYTHON2 - the "python2" command on your system (not python3)
  GENOMES - prebuilt genomes to be installed on your system, join multiple by comma
            hg19
			hg38
  MAC   - your system is mac, otherwise linux (currently no support for windows)


*/

const fs = require('fs')
const exec = require('child_process').execSync
const spawn = require('child_process').spawnSync
const path = require('path')



// user config
const UC = {}

if( process.argv[2] ) {
	// load installation instructions from external file, optional
	for(const line of fs.readFileSync(process.argv[2],{encoding:'utf8'}).trim().split('\n')) {
		if(!line) continue
		if(line[0]=='#') continue
		const l = line.split('\t')
		if(l.length != 2) continue
		UC[ l[0].trim() ] = ( l[1].trim() || true )
	}
}





if( !UC.TP) UC.TP = '/Users/xzhou1/data/tp/'
mkdir( UC.TP )

if( !UC.CACHE) UC.CACHE = '/Users/xzhou1/data/cache/'
mkdir( UC.CACHE )

if( !UC.BINPATH ) UC.BINPATH = '/Users/xzhou1/data/tools/'
mkdir( UC.BINPATH )


if( !UC.PYTHON2 ) UC.PYTHON2 = 'python2'

if( !UC.GENOMES ) UC.GENOMES = [ 'hg19' ]
if( !Array.isArray( UC.GENOMES )) abort('GENOMES must be array')



const SC = {
	genomes: [],
	tpmasterdir: UC.TP,
	cachedir: UC.CACHE,
	port: (UC.PORT || 3000),
}



// replace url in js bundle
if( UC.URL ) {
	exec("sed 's%__PP_URL__%" + UC.URL + "%' public/bin/template.js > public/bin/proteinpaint.js")
}




// bin/
const path_bigwigsummary = path.join(UC.BINPATH, 'bigWigSummary')
if( !fs.existsSync( path_bigwigsummary) ) {
	if( UC.MAC ) {
		exec('wget http://hgdownload.soe.ucsc.edu/admin/exe/macOSX.x86_64/bigWigSummary -O '+path_bigwigsummary)
	} else {
		exec('wget http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bigWigSummary -O '+path_bigwigsummary)
	}
	exec('chmod +x '+path_bigwigsummary)
}
SC.bigwigsummary = path_bigwigsummary

const path_read_hic_header = path.join( UC.BINPATH, 'read_hic_header.py' )
if( !fs.existsSync( path_read_hic_header )) {
	exec('wget https://pecan.stjude.cloud/static/pp-support/read_hic_header.py -O ' + path_read_hic_header)
}
SC.hicstat = UC.PYTHON2 + ' '+path_read_hic_header

const path_straw = path.join(UC.BINPATH, 'straw')
if( !fs.existsSync( path_straw) ) {
	if( UC.MAC ) {
		exec('wget https://pecan.stjude.cloud/static/pp-support/mac/straw -O '+path_straw)
	} else {
		exec('wget https://pecan.stjude.cloud/static/pp-support/linux/straw -O '+path_straw)
	}
	exec('chmod +x '+path_straw)
}
SC.hicstraw = path_straw




// tp
const path_tpanno = path.join( UC.TP, 'anno/')
mkdir( path_tpanno )
const path_tpannodb = path.join( path_tpanno, 'db/')
mkdir( path_tpannodb )
const path_tpgenome = path.join( UC.TP, 'genomes/' )
mkdir( path_tpgenome )




SC.genomes = []



// hg19
if( UC.GENOMES.indexOf('hg19') != -1 ) add_hg19()
if( UC.GENOMES.indexOf('hg38') != -1 ) add_hg38()
if( UC.GENOMES.indexOf('mm9') != -1 ) add_mm9()
if( UC.GENOMES.indexOf('mm10') != -1 ) add_mm10()
if( UC.GENOMES.indexOf('dm3') != -1 ) add_dm3()
if( UC.GENOMES.indexOf('dm6') != -1 ) add_dm6()
if( UC.GENOMES.indexOf('danRer10') != -1 ) add_danRer10()



// export to serverconfig.json
fs.writeFileSync( 'serverconfig.json', JSON.stringify( SC, null, 2) )







//////////////////// helpers



function add_hg38 () {
	trydownload( path.join(path_tpgenome,'hg38.gz'), 'https://pecan.stjude.cloud/static/hg38/hg38.gz')
	trydownload( path.join(path_tpgenome,'hg38.gz.fai'), 'https://pecan.stjude.cloud/static/hg38/hg38.gz.fai')
	trydownload( path.join(path_tpgenome,'hg38.gz.gzi'), 'https://pecan.stjude.cloud/static/hg38/hg38.gz.gzi')
	trydownload( path.join(path_tpanno,'refGene.hg38.gz'), 'https://pecan.stjude.cloud/static/hg38/refGene.hg38.gz')
	trydownload( path.join(path_tpanno,'refGene.hg38.gz.tbi'), 'https://pecan.stjude.cloud/static/hg38/refGene.hg38.gz.tbi')
	trydownload( path.join(path_tpanno,'gencode.v23.hg38.gz'), 'https://pecan.stjude.cloud/static/hg38/gencode.v23.hg38.gz')
	trydownload( path.join(path_tpanno,'gencode.v23.hg38.gz.tbi'), 'https://pecan.stjude.cloud/static/hg38/gencode.v23.hg38.gz.tbi')
	trydownload( path.join(path_tpanno,'rmsk.hg38.gz'), 'https://pecan.stjude.cloud/static/hg38/rmsk.hg38.gz')
	trydownload( path.join(path_tpanno,'rmsk.hg38.gz.tbi'), 'https://pecan.stjude.cloud/static/hg38/rmsk.hg38.gz.tbi')
	trydownload( path.join(path_tpanno,'genes.hg38.db'), 'https://pecan.stjude.cloud/static/hg38/genes.hg38.db')
	trydownload( path.join(path_tpannodb,'proteindomain.db'), 'https://pecan.stjude.cloud/static/hg19/proteindomain.db')
	trydownload( path.join(path_tpannodb,'snp146.hg38.db'), 'https://pecan.stjude.cloud/static/hg38/snp146.hg38.db')
	// defaults to have clinvar dataset
	{
		const a = path.join(UC.TP,'hg38/')
		trydownload( path.join(a,'clinvar.hg38.vcf.gz'), 'https://pecan.stjude.cloud/static/hg38/clinvar.hg38.vcf.gz')
		trydownload( path.join(a,'clinvar.hg38.vcf.gz.tbi'), 'https://pecan.stjude.cloud/static/hg38/clinvar.hg38.vcf.gz.tbi')
	}
	SC.genomes.push({
		name:'hg38',
		species:'human',
		file:'./genome/hg38.js',
		datasets:[ {name:'ClinVar',jsfile:'./dataset/clinvar.hg38.js'} ]
	})
}





function add_hg19 () {
	trydownload( path.join(path_tpgenome,'hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/hg19.gz')
	trydownload( path.join(path_tpgenome,'hg19.gz.fai'), 'https://pecan.stjude.cloud/static/hg19/hg19.gz.fai')
	trydownload( path.join(path_tpgenome,'hg19.gz.gzi'), 'https://pecan.stjude.cloud/static/hg19/hg19.gz.gzi')
	trydownload( path.join(path_tpanno,'refGene.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/refGene.hg19.gz')
	trydownload( path.join(path_tpanno,'refGene.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/refGene.hg19.gz.tbi')
	trydownload( path.join(path_tpanno,'gencode.v24.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/gencode.v24.hg19.gz')
	trydownload( path.join(path_tpanno,'gencode.v24.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/gencode.v24.hg19.gz.tbi')
	trydownload( path.join(path_tpanno,'rmsk.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/rmsk.hg19.gz')
	trydownload( path.join(path_tpanno,'rmsk.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/rmsk.hg19.gz.tbi')
	trydownload( path.join(path_tpanno,'genes.hg19.db'), 'https://pecan.stjude.cloud/static/hg19/genes.hg19.db')
	trydownload( path.join(path_tpannodb,'proteindomain.db'), 'https://pecan.stjude.cloud/static/hg19/proteindomain.db')
	trydownload( path.join(path_tpannodb,'snp146.hg19.db'), 'https://pecan.stjude.cloud/static/hg19/snp146.hg19.db')

	{
		const a = path.join(path_tpanno,'hicFragment')
		mkdir( a )
		trydownload( path.join(a, 'hic.DpnII.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/hic.DpnII.hg19.gz')
		trydownload( path.join(a, 'hic.DpnII.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/hic.DpnII.hg19.gz.tbi')
		trydownload( path.join(a, 'hic.EcoRI.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/hic.EcoRI.hg19.gz')
		trydownload( path.join(a, 'hic.EcoRI.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/hic.EcoRI.hg19.gz.tbi')
		trydownload( path.join(a, 'hic.HindIII.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/hic.HindIII.hg19.gz')
		trydownload( path.join(a, 'hic.HindIII.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/hic.HindIII.hg19.gz.tbi')
		trydownload( path.join(a, 'hic.MboI.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/hic.MboI.hg19.gz')
		trydownload( path.join(a, 'hic.NcoI.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/hic.NcoI.hg19.gz')
	}
	{
		const a = path.join(path_tpanno,'hicTAD')
		mkdir( a )
		const b = path.join(a,'aiden2014')
		mkdir( b )
		trydownload( path.join(b,'GM12878.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/GM12878.domain.hg19.gz')
		trydownload( path.join(b,'GM12878.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/GM12878.domain.hg19.gz.tbi')
		trydownload( path.join(b,'HeLa.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/HeLa.domain.hg19.gz')
		trydownload( path.join(b,'HeLa.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/HeLa.domain.hg19.gz.tbi')
		trydownload( path.join(b,'HMEC.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/HMEC.domain.hg19.gz')
		trydownload( path.join(b,'HMEC.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/HMEC.domain.hg19.gz.tbi')
		trydownload( path.join(b,'HUVEC.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/HUVEC.domain.hg19.gz')
		trydownload( path.join(b,'HUVEC.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/HUVEC.domain.hg19.gz.tbi')
		trydownload( path.join(b,'IMR90.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/IMR90.domain.hg19.gz')
		trydownload( path.join(b,'IMR90.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/IMR90.domain.hg19.gz.tbi')
		trydownload( path.join(b,'K562.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/K562.domain.hg19.gz')
		trydownload( path.join(b,'K562.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/K562.domain.hg19.gz.tbi')
		trydownload( path.join(b,'KBM7.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/KBM7.domain.hg19.gz')
		trydownload( path.join(b,'KBM7.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/KBM7.domain.hg19.gz.tbi')
		trydownload( path.join(b,'NHEK.domain.hg19.gz'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/NHEK.domain.hg19.gz')
		trydownload( path.join(b,'NHEK.domain.hg19.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/tad-aiden2014/NHEK.domain.hg19.gz.tbi')
	}

	// hg19 defaults to have clinvar dataset
	{
		const a = path.join(UC.TP,'hg19/')
		trydownload( path.join(a,'clinvar.hg19.vcf.gz'), 'https://pecan.stjude.cloud/static/hg19/clinvar.hg19.vcf.gz')
		trydownload( path.join(a,'clinvar.hg19.vcf.gz.tbi'), 'https://pecan.stjude.cloud/static/hg19/clinvar.hg19.vcf.gz.tbi')
	}
	SC.genomes.push({
		name:'hg19',
		species:'human',
		file:'./genome/hg19.js',
		datasets:[ {name:'ClinVar',jsfile:'./dataset/clinvar.hg19.js'} ]
	})
}





function abort ( m ) {
	console.log('ERROR: '+m)
	process.exit()
}


function mkdir ( s ) {
	// try to create a dir, if already exists, check RW access
	if( fs.existsSync( s ) ) {
		// has it
		try {
			fs.accessSync( s, fs.constants.R_OK )
		} catch(e) {
			abort('cannot read directory: '+s)
		}
		try {
			fs.accessSync( s, fs.constants.W_OK )
		} catch(e) {
			abort('cannot write to directory: '+s)
		}
		console.log('Directory exists: '+s)
		return
	}
	try{
		fs.mkdirSync( s )
		console.log('Directory created: '+s)
	} catch(e) {
		abort('unable to create directory: '+s)
	}
}



function trydownload ( file, url ) {
	// if a file does not exist, download from url; else check if is readable
	if( fs.existsSync( file )) {
		try {
			fs.accessSync( file, fs.constants.R_OK )
			console.log('File exists: '+file)

			// compare size
			const thissize = fs.statSync(file).size
			const urlsize = urlfilesize( url )
			if( thissize >= urlsize ) {
				// same size
				return
			}
			console.log('However it is incomplete: Local size='+thissize+', URL size='+urlsize+', redownload.')

		} catch(e) {
			abort('cannot read file: ' + file)
		}
	}

	console.log('Downloading file for '+file+' from '+url)
	exec('wget '+url+' -O '+file)
}



function urlfilesize (url) {
	const s = spawn('wget',['--spider',url],{encoding:'utf8'})
	const lines = s.stderr.split('\n')
	const line = lines[5]
	if(!line) abort('No line number 6 in wget/spider output!')
	const l = line.split(' ')
	if(l[0]!='Length:') abort('Line 6 from wget/spider does not begin with "Length:"')
	return Number.parseInt(l[1])
}
