const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const common = require('../src/common')
const loader_vcf = require('./mds2.load.vcf')
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
				track: {
					vcf: q.vcf
					// TODO other 
				}
			}
		}

		if( q.hidden_mclass ) q.hidden_mclass = new Set(q.hidden_mclass)

		// one place to collect result
		const result = {
			mclass2count: {}, // k: dt or mclass, v: number of variants, to collect all classes
		}

		// by triggers

		if( q.trigger_mafcovplot ) {
			await loader_vcf.handle_mafcovplot( q, genome, ds, result )
		}
		if( q.trigger_vcfbyrange ) {
			await loader_vcf.handle_vcfbyrange( q, genome, ds, result )
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




