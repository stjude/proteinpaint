const app = require('../app')
const got = require('got')
const { stratinput } = require('../src/tree')

/*
from one or more variants, get list of samples harbording any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config
*/

const serverconfig = __non_webpack_require__('./serverconfig.json')

module.exports = genomes => {
	return async (req, res) => {
		app.log(req)
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'

			if (!req.query.dsname) throw '.dsname missing'
			const ds = genome.datasets[req.query.dsname]
			if (!ds) throw 'invalid dsname: ' + req.query.dsname
			if (!ds.variant2samples) throw 'variant2samples is not enabled on this dataset'

			res.send(await getResult(req.query, ds, genome))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function getResult(q, ds, genome) {
	// this function is independent of query method
	let levels, samples
	if (q.levels) {
		// client provided levels, could be customized when there are optional levels
		levels = JSON.parse(q.levels)
	}

	if (ds.variant2samples.gdcgraphql) {
		samples = await getResult_gdcgraphql(q, levels, ds, genome)
	} else {
		throw 'unknown query method for variant2samples'
	}

	if (q.getsamples) {
		return { samples }
	}

	if (q.getsummary) {
		// here "levels" is required
		const nodes = stratinput(samples, levels)
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
		return { nodes }
	}
	throw 'unknown report format'
}

async function getResult_gdcgraphql(q, levels, ds, genome) {
	if (!q.ssm_id_lst) throw 'ssm_id_lst not provided'
	if (!levels) {
		// when querying list of samples, allow client not to provide levels
		// will return full list of attributes
		levels = ds.variant2samples.levels
	}

	ds.variant2samples.gdcgraphql.variables.filter.content.value = q.ssm_id_lst.split(',')

	const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(ds.variant2samples.gdcgraphql)
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
			for (const level of levels) {
				let c = sample.node.case
				for (const key of level.keys) {
					c = c[key]
				}
				s[level.k] = c
			}
			samples.push(s)
		}
	}
	return samples
}
