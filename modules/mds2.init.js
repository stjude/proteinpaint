const app = require('../app')
const fs = require('fs')
const utils = require('./utils')




/*
********************** EXPORTED
init
client_copy
********************** INTERNAL
init_vcf
init_svcnv
may_sum_samples
*/




exports.init = async ( ds, genome ) => {
/* initiate the mds2 track upon launching server
*/

	if( !ds.track ) throw 'no mds2 track; missing ds.track{}'

	const tk = ds.track

	if(!tk.name) tk.name = ds.label

	if(tk.vcf) {
		await init_vcf( tk.vcf, genome, ds )
	}

	if(tk.svcnv) {
		init_svcnv( tk.svcnv, genome, ds )
	}

	may_sum_samples( tk )
	// gets tk.samples[] a list of sample names
}




exports.client_copy = ( ds ) => {
/* make client copy of the track
the client copy stays at .mds.track{}
*/
	const t0 = ds.track
	const tk = {
		name: t0.name,
		info_fields: ds.info_fields,
	}
	if(t0.vcf) {
		tk.vcf = {
			numerical_axis: t0.vcf.numerical_axis,
			format: t0.vcf.format,
			info: t0.vcf.info,
			check_pecanpie: t0.vcf.check_pecanpie,
		}
		if(t0.vcf.plot_mafcov) {
			tk.vcf.plot_mafcov = true
		}
		if(t0.vcf.termdb_bygenotype) {
			tk.vcf.termdb_bygenotype = true
		}
	}
	return tk
}




async function init_vcf ( vcftk, genome, ds ) {

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
				const a = vcftk.info[ key.key ]
				if( !a ) throw 'INFO field "'+key.key+'" not found for numerical_axis'
				if( a.Type!='Float' && a.Type!='Integer' ) throw 'INFO field "'+key.key+'" from numerical_axis not of integer or float type'
				if( a.Number!='1' && a.Number!='A' ) throw 'for numerical axis, INFO field "'+key.key+'" only allows to be Number=1 or Number=A'
			}
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

	if( vcftk.termdb_bygenotype ) {
		if(!vcftk.samples) throw '.termdb_bygenotype enabled but no samples from vcf'
		if(!vcftk.format) throw '.termdb_bygenotype enabled but no FORMAT fields from vcf'
		if(!vcftk.format.GT) throw '.termdb_bygenotype enabled but the GT FORMAT field is missing'
		if(!ds.cohort) throw 'termdb_bygenotype but ds.cohort missing'
		if(!ds.cohort.termdb) throw 'termdb_bygenotype but ds.cohort.termdb missing'
	}
}



async function init_svcnv ( sctk, genome ) {
}




function may_sum_samples ( tk ) {
/* sum up samples from individual track types
*/
	const samples = new Set() // union of sample names
	if( tk.vcf && tk.vcf.samples ) {
		for(const s of tk.vcf.samples) {
			// just keep sample name
			samples.add( s.name )
		}
	}
	if( tk.svcnv ) {
	}
	if( samples.size ) {
		tk.samples = [ ...samples ]
	}
}
