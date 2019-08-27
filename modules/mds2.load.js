const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const common = require('../src/common')
const loader_vcf = require('./mds2.load.vcf')
const loader_vcf_mafcov = require('./mds2.load.vcf.plot.mafcovplot')
const loader_ld = require('./mds2.load.ld')
// add loaders for other file types and requests




/*
********************** EXPORTED
handle_request
********************** INTERNAL
*/




exports.handle_request = ( genomes ) => {
// dispatcher of trigger handlers

return async (req,res) => {

	if( app.reqbodyisinvalidjson(req,res) ) return

	const q = req.query

	try {
		const genome = genomes[q.genome]

		const ds = await get_ds( q, genome ) // official or custom


		///////////////// standalone triggers
		if( q.trigger_overlayld ) {
			return await loader_ld.overlay( q, ds, res )
		}


		///////////////// combination triggers
		// multiple triggers may be in one query

		if( q.hidden_mclass ) q.hidden_mclass = new Set(q.hidden_mclass)

		// one place to collect result
		const result = {
			mclass2count: {}, // k: dt or mclass, v: number of variants, to collect all classes
		}

		if( q.info_fields ) {
			result.info_fields = {}
			for(const i of q.info_fields) {
				if( i.iscategorical ) {
					result.info_fields[ i.key ] = {
						value2count:{}
					}
				} else if( i.isnumerical ) {
					result.info_fields[ i.key ] = {
						filteredcount:0
					}
				} else if( i.isflag ) {
					result.info_fields[ i.key ] = {
						count_yes:0,
						count_no:0
					}
				} else {
					throw 'unknown info type'
				}
			}
		}

		// by triggers

		if( q.trigger_mafcovplot ) {
			await loader_vcf_mafcov.plot( q, genome, ds, result )
		}
		if( q.trigger_vcfbyrange ) {
			await loader_vcf.handle_vcfbyrange( q, genome, ds, result )
			if( q.trigger_ld ) {
				// collect variants passing filter for ld, so as not to include those filtered out
				result.__mposset = new Set()
				for(const r of result.vcf.rglst) {
					for(const m of r.variants) {
						result.__mposset.add( m.pos )
					}
				}
			}
		}
		if( q.trigger_ld ) {
			result.ld = {} // to be filled
			for(const tk of q.trigger_ld.tracks) {
				await loader_ld.load_tk( tk, q, genome, ds, result )
			}
			delete result.__mposset
		}
		if( q.trigger_ssid_onevcfm ) {
			await loader_vcf.handle_ssidbyonem( q, genome, ds, result )
		}
		if( q.trigger_getvcfcsq ) {
			await loader_vcf.handle_getcsq( q, genome, ds, result )
		}

		// other vcf triggers
		// svcnv triggers

		
		// done
		res.send(result)

	}catch(e) {
		res.send({error: (e.message || e)})
		if(e.stack) console.log(e.stack)
	}
}
}





async function get_ds ( q, genome ) {
// return ds object, official or custom
	if(!genome) throw 'invalid genome'

	if( q.dslabel ) {
		const ds = genome.datasets[ q.dslabel ]
		if(!ds) throw 'invalid dslabel'
		if(!ds.track) throw 'no mds2 track found for dataset'
		return ds
	}
	// is custom mds2 track, synthesize ds object
	const ds = {
		iscustom: 1,
		track: {}
	}
	if( q.vcf ) {
		ds.track.vcf = q.vcf
		await utils.init_one_vcf( ds.track.vcf, genome )
	}

	// other type of tracks
	return ds
}
