const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const common = require('../src/common')
const loader_vcf = require('./mds2.load.vcf')
const loader_vcf_mafcov = require('./mds2.load.vcf.plot.mafcovplot')
// add loaders for other file types




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
		if(!genome) throw 'invalid genome'

		let ds // official or custom

		if( q.dslabel ) {
			ds = genome.datasets[ q.dslabel ]
			if(!ds) throw 'invalid dslabel'
			if(!ds.track) throw 'no mds2 track found for dataset'
		} else {
			ds = {
				iscustom: 1,
				track: {}
			}

			if( q.vcf ) {
				ds.track.vcf = q.vcf
				await utils.init_one_vcf( ds.track.vcf, genome )
			}

			// other type of tracks

		}

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
				} else {
					result.info_fields[ i.key ] = {
						filteredcount:0
					}
				}
			}
		}

		// by triggers

		if( q.trigger_mafcovplot ) {
			await loader_vcf_mafcov.handle_mafcovplot( q, genome, ds, result )
		}
		if( q.trigger_vcfbyrange ) {
			await loader_vcf.handle_vcfbyrange( q, genome, ds, result )
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




