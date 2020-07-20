const app = require('../app')
const path = require('path')
const utils = require('./utils')

/*
 */

const serverconfig = __non_webpack_require__('./serverconfig.json')

module.exports = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			const ds = await get_ds(req.query, genome)

			const result = {}

			await load_driver(req.query, ds, result)
			// what other loaders can be if not in ds.queries?

			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function get_ds(q, genome) {
	if (q.dslabel) {
		if (!genome.datasets) throw '.datasets{} missing from genome'
		const ds = genome.datasets[q.dslabel]
		if (!ds) throw 'invalid dslabel'
		return ds
	}
	// make a custom ds
	throw 'custom ds todo'
	const ds = {}
	return ds
}

async function load_driver(q, ds, result) {
	// various bits of data to be appended as keys to result{}

	if (q.forTrack) {
		// to load things for block track

		if (q.skewer) {
			// get skewer data
			result.skewer = [] // for skewer track
			if (ds.queries.snvindel) {
				result.skewer.push(...(await skewerdata_snvindel(q, ds)))
			}
			if (ds.queries.genecnv) {
				result.skewer.push(...(await skewerdata_genecnv(q, ds)))
			}
			console.log('skewerlength', result.skewer.length)

			if (ds.sampleSummaries) {
				// right now this is only summarized from skewer data
				// only return sample summary, not actual samples for each variant
				result.sampleSummaries = ds.sampleSummaries.get(result.skewer, q)
				for (const i of result.skewer) {
					delete i.samples
				}
			}
		}

		// other types of data e.g. cnvpileup

		return
	}
	// other query type

	throw 'do not know what client wants'
}

// TODO skewer to support multiple datatypes on different queries
async function skewerdata_snvindel(q, ds) {
	if (q.isoform) {
		if (ds.queries.snvindel.byisoform.gdcapi) {
			return await ds.queries.snvindel.byisoform.gdcapi.get(q)
		}
		throw 'unknown query method for snvindel.byisoform'
	}
	// if isoform not provided, must be by range. could be by other things?
	if (ts.byrange.gdcapi) {
		return await ds.queries.snvindel.byrange.gdcapi.get(q)
	}
	throw 'unknown query method for snvindel.byrange'
}
