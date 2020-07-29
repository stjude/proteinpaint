const got = require('got')
const { stratinput } = require('../src/tree')

/*
from one or more variants, get list of samples harbording any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config

*/

const type_samples = 'samples'
const type_sunburst = 'sunburst'
const type_summary = 'summary'
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

const serverconfig = __non_webpack_require__('./serverconfig.json')

module.exports = async (q, ds) => {
	// each sample obj has keys from .terms[].id
	const samples = await get_samples(q, ds)

	if (q.get == type_samples) return samples
	if (q.get == type_sunburst) return make_sunburst(samples, ds)
	if (q.get == type_summary) return make_summary(samples, ds)
	throw 'unknown get type'
}

async function get_samples(q, ds) {
	if (ds.variant2samples.gdcapi) {
		return await getSamples_gdcapi(q, ds)
	}
	throw 'unknown query method for variant2samples'
}

async function getSamples_gdcapi(q, ds) {
	if (!q.ssm_id_lst) throw 'ssm_id_lst not provided'

	const query = {
		variables: JSON.parse(JSON.stringify(ds.variant2samples.gdcapi.variables)),
		query: q.get == type_sunburst ? ds.variant2samples.gdcapi.query_sunburst : ds.variant2samples.gdcapi.query_list
	}
	query.variables.filter.content.value = q.ssm_id_lst.split(',')

	const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(query)
	})
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for variant2samples'
	}
	if (
		!re.data ||
		!re.data.explore ||
		!re.data.explore.ssms ||
		!re.data.explore.ssms.hits ||
		!re.data.explore.ssms.hits.edges
	)
		throw 'data structure not data.explore.ssms.hits.edges[]'
	if (!Array.isArray(re.data.explore.ssms.hits.edges)) throw 're.data.explore.ssms.hits.edges is not array'

	const samples = []
	for (const ssm of re.data.explore.ssms.hits.edges) {
		if (!ssm.node || !ssm.node.occurrence || !ssm.node.occurrence.hits || !ssm.node.occurrence.hits.edges)
			throw 'structure of an ssm is not node.occurrence.hits.edges'
		if (!Array.isArray(ssm.node.occurrence.hits.edges)) throw 'ssm.node.occurrence.hits.edges is not array'
		for (const sample of ssm.node.occurrence.hits.edges) {
			if (!sample.node || !sample.node.case) throw 'structure of a case is not .node.case'
			/* samplelist query will retrieve all terms
			but sunburst will only retrieve a few attr
			will simply iterate over all terms and missing ones will have undefined value
			*/
			const s = {}
			for (const attr of ds.variant2samples.terms) {
				s[attr.id] = attr.get(sample.node.case)
			}
			samples.push(s)
		}
	}
	return samples
}

function make_sunburst(samples, ds) {
	if (!ds.variant2samples.sunburst_ids) throw 'sunburst_ids missing'
	// use only suburst terms
	// to use stratinput, convert each attr to {k} where k is term id
	const nodes = stratinput(
		samples,
		ds.variant2samples.terms
			.filter(i => ds.variant2samples.sunburst_ids.has(i.id))
			.map(i => {
				return { k: i.id }
			})
	)
	for (const node of nodes) {
		delete node.lst
		if (ds.onetimequery_projectsize) {
			/********
			CAUTION
			must ensure that node.name is the key
			add "cohortsize" to node
			*/
			if (ds.onetimequery_projectsize.results.has(node.name)) {
				node.cohortsize = ds.onetimequery_projectsize.results.get(node.name)
			}
		}
	}
	return nodes
}

function make_summary(samples, ds) {
	const entries = []
	for (const term of ds.variant2samples.terms) {
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
