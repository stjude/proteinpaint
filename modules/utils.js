const fs = require('fs')
const path =require('path')
const spawn = require('child_process').spawn
const readline = require('readline')
const common = require('../src/common')
const vcf = require('../src/vcf')


const serverconfig = __non_webpack_require__('./serverconfig.json')
const tabix= serverconfig.tabix || 'tabix'


/* p4 ready
********************** EXPORTED
init_one_vcf
validate_tabixfile
get_lines_tabix
write_file
********************** INTERNAL
get_header_vcf
*/




exports.init_one_vcf = async ( tk, genome ) => {

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





async function validate_tabixfile ( file ) {
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
exports.validate_tabixfile = validate_tabixfile



async function tabix_is_nochr ( file, dir, genome ) {
	const lines = []
	await get_lines_tabix( [ file, '-l' ], dir,
		(line)=> {
			lines.push( line )
		}
	)
	return common.contigNameNoChr( genome, lines )
}





function file_not_exist ( file ) {
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.F_OK, err=>{
			if(err) resolve( true )
			resolve( false )
		})
	})
}



function file_not_readable ( file ) {
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





function get_lines_tabix ( args, dir, callback ) {
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
exports.get_lines_tabix = get_lines_tabix




function write_file ( file, text ) {
	return new Promise((resolve, reject)=>{
		fs.writeFile( file, text, (err)=>{
			if(err) reject('cannot write')
			resolve()
		})
	})
}
exports.write_file = write_file



function read_file ( file ) {
	return new Promise((resolve,reject)=>{
		fs.readFile( file, {encoding:'utf8'}, (err,txt)=>{
			// must use reject in callback, not throw
			if(err) reject('cannot read file')
			resolve(txt)
		})
	})
}
exports.read_file = read_file
