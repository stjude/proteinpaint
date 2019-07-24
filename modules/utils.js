const fs = require('fs'),
	path =require('path'),
	spawn = require('child_process').spawn,
	readline = require('readline'),
	common = require('../src/common'),
	vcf = require('../src/vcf'),
	bettersqlite = require('better-sqlite3')


const serverconfig = __non_webpack_require__('./serverconfig.json')
const tabix= serverconfig.tabix || 'tabix'
const samtools = serverconfig.samtools || 'samtools'


/* p4 ready
********************** EXPORTED
init_one_vcf
validate_tabixfile
get_lines_tabix
write_file
read_file
file_not_exist
file_not_readable
get_header_vcf
get_fasta
connect_db
********************** INTERNAL
*/




export async function init_one_vcf ( tk, genome ) {

	let filelocation
	if( tk.file ) {

		tk.file = path.join( serverconfig.tpmasterdir, tk.file )
		filelocation = tk.file
		await validate_tabixfile( tk.file )

	} else if( tk.url ) {

		filelocation = tk.url
		tk.dir = await app.cache_index_promise( tk.indexURL || tk.url+'.tbi' )

	} else {
		throw 'no file or url given for vcf file'
	}

	const [info,format,samples,errors] = await get_header_vcf( filelocation, tk.dir )
	if(errors) {
		console.log(errors.join('\n'))
		throw 'got above errors parsing vcf'
	}
	tk.info = info
	tk.format = format
	tk.samples = samples
	if( await tabix_is_nochr( filelocation, tk.dir, genome ) ) {
		tk.nochr = true
	}
}





export async function validate_tabixfile ( file ) {
	/*
	file is full path
	url not accepted
	*/
	if( !file.endsWith( '.gz' )) throw 'tabix file not ending with .gz'
	if( await file_not_exist(file)) throw '.gz file not exist'
	if( await file_not_readable(file)) throw '.gz file not readable'

	const tbi = file+'.tbi'
	if( await file_not_exist(tbi)) {
		// tbi not found, try csi
		const csi = file+'.csi'
		if(await file_not_exist(csi)) throw 'neither .tbi .csi index file exist'
		if(await file_not_readable(csi)) throw '.csi index file not readable'
	} else {
		// tbi exists
		if(await file_not_readable(tbi)) throw '.tbi index file not readable'
	}
}



async function tabix_is_nochr ( file, dir, genome ) {
	const lines = []
	await get_lines_tabix( [ file, '-l' ], dir,
		(line)=> {
			lines.push( line )
		}
	)
	return common.contigNameNoChr( genome, lines )
}





export function file_not_exist ( file ) {
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.F_OK, err=>{
			if(err) resolve( true )
			resolve( false )
		})
	})
}



export function file_not_readable ( file ) {
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.R_OK, err=>{
			if(err) resolve( true )
			resolve( false )
		})
	})
}


async function get_header_vcf ( file, dir ) {
/* file is full path file or url
*/
	const lines = []
	await get_lines_tabix( [ file, '-H' ], dir,
		(line)=> {
			lines.push( line )
		}
	)

	return vcf.vcfparsemeta( lines )
}





export function get_lines_tabix ( args, dir, callback ) {
	return new Promise((resolve,reject)=>{
		const ps = spawn( tabix, args, {cwd:dir} )
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line=>{
			callback( line )
		})
		ps.on('close',()=>{
			resolve()
		})
	})
}




export function write_file ( file, text ) {
	return new Promise((resolve, reject)=>{
		fs.writeFile( file, text, (err)=>{
			if(err) reject('cannot write')
			resolve()
		})
	})
}



export function read_file ( file ) {
	return new Promise((resolve,reject)=>{
		fs.readFile( file, {encoding:'utf8'}, (err,txt)=>{
			// must use reject in callback, not throw
			if(err) reject('cannot read file')
			resolve(txt)
		})
	})
}




export function get_fasta ( gn, pos ) {
// chr:start-stop, positions are 1-based
	return new Promise((resolve,reject)=>{
		const ps = spawn(samtools, ['faidx', gn.genomefile, pos])
		const out=[]
		ps.stdout.on('data',i=> out.push(i))
		ps.on('close',code=>{
			resolve( out.join('') )
		})
	})
}



export function connect_db (file) {
	return new bettersqlite( path.join(serverconfig.tpmasterdir,file), {readonly:true, fileMustExist:true} )
}


export const genotype_type_set = new Set(["Homozygous reference","Homozygous alternative","Heterozygous"])
export const genotype_types = {
  href: "Homozygous reference",
  halt: "Homozygous alternative",
  het: "Heterozygous"
}


export async function loadfile_ssid ( id ) {
/*
*/
	const text = await read_file( path.join( serverconfig.cachedir, 'ssid', id ) )
	const bySample = Object.create(null)
	// k: sample, v: genotype str
	const genotype2sample = new Map()
	// k: genotype str, v: set of samples
	for(const line of text.split('\n')) {
		if (!line) continue
		const [type, samplesStr] = line.split('\t')
		if (!samplesStr) continue
		const samples = samplesStr.split(",")
		for(const sample of samples) {
			bySample[sample] = type
		}
		if(!genotype_type_set.has(type)) throw 'unknown hardcoded genotype label: '+type
		genotype2sample.set(type, new Set(samples))
	}
	return [bySample, genotype2sample]
}




export function run_fishertest( tmpfile ) {
	const pfile = tmpfile+'.pvalue'
	return new Promise((resolve,reject)=>{
		const sp = spawn('Rscript',['utils/fisher.R',tmpfile,pfile])
		sp.on('close',()=> resolve(pfile))
		sp.on('error',()=> reject(error))
	})
}

