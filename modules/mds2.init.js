const app = require('../app')
const fs = require('fs')
const utils = require('./utils')




/*
********************** EXPORTED
init
client_copy
********************** INTERNAL
*/




exports.init = async function ( ds, genome ) {
/* initiate the mds2 track upon launching server
*/

	if( !ds.track ) throw 'no mds2 track; missing ds.track{}'

	const tk = ds.track

	if(!tk.name) tk.name = ds.label

	if(tk.vcf) {
		await initsubtk_vcf( tk.vcf, genome )
	}

	if(tk.svcnv) {
		init_svcnv( tk.svcnv )
	}
}


exports.client_copy = function ( ds ) {
/* make client copy of the track
*/
	const tk = {
		name: ds.track.name
	}

	return tk
}




async function initsubtk_vcf ( vcftk, genome ) {

	if( vcftk.file ) {

		await utils.init_one_vcf( vcftk, genome )
		console.log(vcftk.file+': '+vcftk.samples.length+' samples, '+(vcftk.nochr ? 'no chr' : 'has chr'))

	} else if( vcftk.chr2file ) {

	} else {
		throw 'vcf has no file or chr2file'
	}
}
