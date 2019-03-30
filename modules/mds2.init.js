const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')

const serverconfig = __non_webpack_require__('./serverconfig.json')

const tabix= serverconfig.tabix || 'tabix'


/* for initiating the mds2 track, can be all synchronized
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

		//const [info, format] = 
		vcftk.file = path.join( serverconfig.tpmasterdir, vcftk.file )
		await utils.validate_tabixfile( vcftk.file )

	} else if( vcftk.chr2file ) {

	} else {
		throw 'vcf has no file or chr2file'
	}

}
