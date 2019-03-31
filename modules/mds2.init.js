const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')

const serverconfig = __non_webpack_require__('./serverconfig.json')

const tabix= serverconfig.tabix || 'tabix'


/* for initiating the mds2 track
*/


module.exports = async ( ds ) => {

	if( !ds.track ) throw 'no mds2 track; missing ds.track{}'

	const tk = ds.track

	if(tk.vcf) {
		await initsubtk_vcf( tk.vcf )
	}

	if(tk.svcnv) {
		init_svcnv( tk.svcnv )
	}
}




async function initsubtk_vcf ( vcftk ) {

	if( vcftk.file ) {

		vcftk.file = path.join( serverconfig.tpmasterdir, vcftk.file )
		await utils.validate_tabixfile( vcftk.file )
		const [info,format,samples,errors] = await utils.get_header_vcf( vcftk.file )
		if(errors) {
			console.log(errors.join('\n'))
			throw 'got above errors parsing vcf'
		}
		vcftk.info = info
		vcftk.format = format
		vcftk.samples = samples
		console.log(vcftk.file+': '+vcftk.samples.length+' samples')

	} else if( vcftk.chr2file ) {

	} else {
		throw 'vcf has no file or chr2file'
	}

}
