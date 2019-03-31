const app = require('../app')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const vcf = require('../src/vcf')




/*
********************** EXPORTED
handle_request
********************** INTERNAL
*/




exports.handle_request = ( genomes ) => {

return async (req,res) => {

	if( app.reqbodyisinvalidjson(req,res) ) return

	const q = req.query

	try {
		const genome = genomes[q.genome]
		if(!genome) throw 'invalid genome'
		const ds = genome.datasets[ q.dslabel ]
		if(!ds) throw 'invalid dslabel'
		if(!ds.track) throw 'no mds2 track found for dataset'

		// conditional data querying

		const result = {}

		if( ds.track.vcf ) {

			await query_vcf_test( q, ds, result )
		}

		
		// done
		res.send(result)

	}catch(e) {
		res.send({error: (e.message || e)})
		if(e.stack) console.log(e.stack)
	}
}
}




async function query_vcf_test ( q, ds, result ) {
/*
*/


	const tk0 = ds.track.vcf

	// temporary vcf tk object, may with altered .samples[]
	const vcftk = {
		info: tk0.info,
		format: tk0.format,
		samples: tk0.samples
	}

	// different modes of query
	let mode_range_variantonly = true
	let mode_range_sample = false
	let mode_singevariant = false

	// if to slice sample columns, define the column indices to keep, and also modify vcftk.samples to keep only wanted samples
	//let slicecolumnindex = null


	// range query
	if(!q.rglst) throw '.rglst[] missing'

	if( mode_range_variantonly ) {
		delete vcftk.samples
	}


	for(const r of q.rglst) {

		r.variants = []
		r.density = null // if too many, convert to density

		const coord = (tk0.nochr ? r.chr.replace('chr','') : r.chr)+':'+r.start+'-'+r.stop

		await utils.get_lines_tabix( [ tk0.file, coord ], tk0.dir, (line)=>{

			if( mode_range_variantonly ) {
				const newline = line.split( '\t', 8 ).join('\t')
				const [e,mlst,e2] = vcf.vcfparseline( newline, vcftk )
				for(const m of mlst) {
					delete m._m
					delete m.vcf_ID
					delete m.sampledata
					r.variants.push(m)
				}
			}
		})
	}

	result.rglst = q.rglst
}
