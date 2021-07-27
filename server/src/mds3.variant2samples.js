const { stratinput } = require('../shared/tree')
const { getSamples_gdcapi } = require('./mds3.gdc')
const samplefilter = require('./mds3.samplefilter')
const { get_densityplot } = require('./mds3.densityPlot')
const { client_copy } = require('./mds3.init')

/*
from one or more variants, get list of samples harboring any of the variants

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
	const [ samples, total ] = await get_samples(q, ds)

	if (q.get == ds.variant2samples.type_samples) return [ samples, total ]
	if (q.get == ds.variant2samples.type_sunburst) return make_sunburst(samples, ds, q)
	if (q.get == ds.variant2samples.type_summary) return make_summary(samples, ds)
	if (q.get == ds.variant2samples.type_update_summary) return update_summary(q, ds)
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

	// to use stratinput, convert each attr to {k} where k is term id
	const nodes = stratinput(
		samples,
		ds.variant2samples.sunburst_ids.map(i => {
			return { k: i }
		})
	)
	for (const node of nodes) {
		delete node.lst
	}
	if (ds.variant2samples.addCrosstabCount) {
		await ds.variant2samples.addCrosstabCount(nodes, q)
	}
	return nodes
}

async function make_summary(samples, ds) {
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
			// add numeric term summary here
			const density_data = await get_densityplot(term, samples)
			entries.push({
				name: term.name,
				density_data
			})
		} else {
			throw 'unknown term type'
		}
	}
	return entries
}

async function update_summary(q, ds) {
		// check in gdc dictionary
		const termid = q.add_term
		const term_ = ds.cohort.termdb.q.getTermById(termid)
		const term = {
			name: term_.name,
			id: term_.id,
			type: term_.type
		}
		term.fields = term_.path.split('.').slice(1)
		ds.termdb.terms.push(term)
		ds.variant2samples.termidlst.push(termid)
		ds.variant2samples.gdcapi.fields_summary.push(term_.path)
		ds.variant2samples.gdcapi.fields_samples.push(term_.path)
		const [ samples, total ] = await get_samples(q, ds)
		const entires = make_summary(samples, ds)
		return entires
}
