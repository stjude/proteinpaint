const app = require('../app')
const fs = require('fs')
const utils = require('./utils')




/*
********************** EXPORTED
init
client_copy
********************** INTERNAL
*/




exports.init = async ( ds, genome ) => {
/* initiate the mds2 track upon launching server
*/

	if( !ds.track ) throw 'no mds2 track; missing ds.track{}'

	const tk = ds.track

	if(!tk.name) tk.name = ds.label

	if(tk.vcf) {
		await init_vcf( tk.vcf, genome )
	}

	if(tk.svcnv) {
		init_svcnv( tk.svcnv )
	}
}




exports.client_copy = ( ds ) => {
/* make client copy of the track
*/
	const t0 = ds.track
	const tk = {
		name: t0.name
	}
	if(t0.vcf) {
		tk.vcf = {
			numerical_axis: t0.vcf.numerical_axis,
			/*
			format: t0.vcf.format,
			info: t0.vcf.info,
			*/
		}
	}
	return tk
}




async function init_vcf ( vcftk, genome ) {

	if( vcftk.file ) {

		await utils.init_one_vcf( vcftk, genome )
		console.log(vcftk.file+': '+vcftk.samples.length+' samples, '+(vcftk.nochr ? 'no chr' : 'has chr'))

	} else if( vcftk.chr2file ) {

	} else {
		throw 'vcf has no file or chr2file'
	}
}



async function init_svcnv ( sctk, genome ) {
}
