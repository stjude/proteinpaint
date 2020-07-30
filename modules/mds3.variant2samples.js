const got = require('got')
const { stratinput } = require('../src/tree')

/*
from one or more variants, get list of samples harbording any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config

getsamples:
- use all attributes
- return samples as is

getsunburst:
- use only attributes labeled for sunburst
- return stratified nodes

getsummary:
- use all attributes
- return 
*/

const serverconfig = __non_webpack_require__('./serverconfig.json')

module.exports = async (q, ds) => {
	// this function is independent of query method

	const samples = await get_samples(q, ds)

	if (q.getsamples) {
		return samples
	}

	if (q.getsunburst) {
		const nodes = stratinput(samples, ds.variant2samples.attributes.filter(i => i.sunburst))
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

	if (q.getsummary) {
	}
	throw 'unknown report format'
}

async function get_samples(q, ds) {
	if (ds.variant2samples.gdcapi) {
		return await getSamples_gdcapi(q, ds)
	}
	throw 'unknown query method for variant2samples'
}

async function getSamples_gdcapi(q, ds) {
	if (!q.ssm_id_lst) throw 'ssm_id_lst not provided'

	const attributes = q.getsunburst
		? ds.variant2samples.attributes.filter(i => i.sunburst)
		: ds.variant2samples.attributes

	const query = {
		variables: JSON.parse(JSON.stringify(ds.variant2samples.gdcapi.variables)),
		query: q.getsunburst ? ds.variant2samples.gdcapi.query_sunburst : ds.variant2samples.gdcapi.query_list
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
		throw 'invalid JSON from GDC for varaint2tumors'
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
			const s = {}
			for (const attr of attributes) {
				s[attr.k] = attr.get(sample.node.case)
			}
			samples.push(s)
		}
	}
	return samples
}
