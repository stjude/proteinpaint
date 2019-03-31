const fs = require('fs')
const spawn = require('child_process').spawn
const readline = require('readline')
const vcf = require('../src/vcf')


const serverconfig = __non_webpack_require__('./serverconfig.json')
const tabix= serverconfig.tabix || 'tabix'


/* p4 ready
********************** EXPORTED
validate_tabixfile
get_header_vcf
get_lines_tabix
********************** INTERNAL
*/



exports.validate_tabixfile = async ( file ) => {
	/*
	file is full path, legal
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


exports.get_header_vcf = async(file)=> {
/* file is full path file or url
*/

	const lines = []
	await get_lines_tabix(
		[ file, '-H' ],
		(line)=> {
			lines.push( line )
		}
	)

	return vcf.vcfparsemeta( lines )
}





function get_lines_tabix ( args, callback ) {
	return new Promise((resolve,reject)=>{
		const ps = spawn( tabix, args )
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
