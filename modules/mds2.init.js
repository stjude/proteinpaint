const app = require('../app')
const fs = require('fs')
const utils = require('./utils')




/*
********************** EXPORTED
init
client_copy
********************** INTERNAL
init_vcf
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
			format: t0.vcf.format,
			info: t0.vcf.info,
		}
		if(t0.vcf.plot_mafcov) {
			tk.vcf.plot_mafcov = true
		}
	}
	return tk
}




async function init_vcf ( vcftk, genome ) {

	if( vcftk.file ) {

		await utils.init_one_vcf( vcftk, genome )
		console.log(
			vcftk.file+': '
			+ (vcftk.samples ? vcftk.samples.length+' samples, ' : '')
			+ (vcftk.nochr ? 'no chr' : 'has chr')
		)

	} else if( vcftk.chr2file ) {

	} else {
		throw 'vcf has no file or chr2file'
	}

	if( vcftk.numerical_axis ) {
		if(vcftk.numerical_axis.info_keys) {
			if(!Array.isArray(vcftk.numerical_axis.info_keys)) throw 'numerical_axis.info_keys should be an array'
			for(const key of vcftk.numerical_axis.info_keys) {
				const a = vcftk.info[ key ]
				if( !a ) throw 'INFO field "'+key+'" not found for numerical_axis'
				if( a.Type!='Float' && a.Type!='Integer' ) throw 'INFO field "'+key+'" from numerical_axis not of integer or float type'
				if( a.Number!='1' && a.Number!='A' ) throw 'for numerical axis, INFO field "'+key+'" only allows to be Number=1 or Number=A'
			}
		}
		if(vcftk.numerical_axis.use_info_key) {
			if( typeof vcftk.numerical_axis.use_info_key != 'string' ) throw 'numerical_axis.use_info_key value should be string'
			const a = vcftk.info[ vcftk.numerical_axis.use_info_key ]
			if( !a ) throw 'INFO field "'+vcftk.numerical_axis.use_info_key+'" not found for numerical_axis'
			if( a.Type!='Float' && a.Type!='Integer' ) throw 'INFO field "'+vcftk.numerical_axis.use_info_key+'" from numerical_axis not of integer or float type'
		}
		// TODO allow other type of plot e.g. boxplot
	}

	if( vcftk.plot_mafcov ) {
		if(!vcftk.samples) throw '.plot_mafcov enabled but no samples from vcf'
		if(!vcftk.format) throw '.plot_mafcov enabled but no FORMAT fields from vcf'
		if(!vcftk.format.AD) throw '.plot_mafcov enabled but the AD FORMAT field is missing'
		if(vcftk.format.AD.Number!='R') throw 'AD FORMAT field Number=R is not true'
		if(vcftk.format.AD.Type!='Integer') throw 'AD FORMAT field Type=Integer is not true'
	}
}



async function init_svcnv ( sctk, genome ) {
}
