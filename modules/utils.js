const fs = require('fs')


// p4 ready



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
