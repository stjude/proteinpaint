const { stratinput } = require('../src/tree')
const { getSamples_gdcapi } = require('./mds3.gdc')
const samplefilter = require('./mds3.samplefilter')

/*
from one or more variants, get list of samples harbording any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config

*/

/*
get types:
- samples
  - use all terms
  - return list of samples, not summary
- sunburst
  - use only terms labeled for sunburst
  - return stratified nodes
- summary
  - use all terms
  - return summary of each attribute
*/

module.exports = async (q, ds) => {
	// each sample obj has keys from .terms[].id
	const samples = await get_samples(q, ds)

	if (q.get == ds.variant2samples.type_samples) return samples
	if (q.get == ds.variant2samples.type_sunburst) return make_sunburst(samples, ds, q)
	if (q.get == ds.variant2samples.type_summary) return make_summary(samples, ds)
	throw 'unknown get type'
}

async function get_samples(q, ds) {
	let samples
	if (ds.variant2samples.gdcapi) {
		samples = await getSamples_gdcapi(q, ds)
	} else {
		throw 'unknown query method for variant2samples'
	}
	if (q.samplefiltertemp) {
		return samplefilter.run(samples, q.samplefiltertemp)
	}
	return samples
}

async function make_sunburst(samples, ds, q) {
	if (!ds.variant2samples.sunburst_ids) throw 'sunburst_ids missing'
	// use only suburst terms

	// XXX it's mixing values from multiple terms! to introduce term id to strat nodes
	// setting string key to lower case so that "adenomas and adenocarcinomas" can equal to "Adenomas and Adenocarcinomas"
	let nodename2total
	if (ds.termdb.termid2totalsize) {
		nodename2total = new Map() // k: node name, v: total
		for (const termid of ds.variant2samples.sunburst_ids) {
			if (!ds.termdb.termid2totalsize[termid]) continue
			const v2c = await ds.termdb.termid2totalsize[termid].get(q)
			for (const [v, c] of v2c) {
				nodename2total.set(v.toLowerCase(), c)
			}
		}
	}

	// to use stratinput, convert each attr to {k} where k is term id
	const nodes = stratinput(
		samples,
		ds.variant2samples.sunburst_ids.map(i => {
			return { k: i }
		})
	)
	for (const node of nodes) {
		delete node.lst
		/********
		CAUTION
		must ensure that node.name is the key
		add "cohortsize" to node
		*/
		if (nodename2total) {
			const k = node.name.toLowerCase()
			if (nodename2total.has(k)) {
				node.cohortsize = nodename2total.get(k)
			}
		}
	}
	return nodes
}

function make_summary(samples, ds) {
	const entries = []
	for (const termid of ds.variant2samples.termidlst) {
		const term = ds.termdb.getTermById(termid)
		if (!term) continue
		// may skip a term
		if (term.type == 'categorical') {
			const cat2count = new Map()
			for (const s of samples) {
				const c = s[term.id]
				if (!c) continue
				cat2count.set(c, 1 + (cat2count.get(c) || 0))
			}
			entries.push({
				name: term.name,
				numbycategory: [...cat2count].sort((i, j) => j[1] - i[1])
			})
		} else if (term.type == 'integer' || term.type == 'float') {
		} else {
			throw 'unknown term type'
		}
	}
	return entries
}
