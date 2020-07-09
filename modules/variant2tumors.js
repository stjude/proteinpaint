const app = require('../app')
const got = require('got')
const { stratinput } = require('../src/tree')

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

			if (!req.query.dsname) throw '.dsname missing'
			const ds = genome.datasets[req.query.dsname]
			if (!ds) throw 'invalid dsname: ' + req.query.dsname
			if (!ds.variant2tumors) throw 'variant2tumors is not enabled on this dataset'

			// for now, one time project size query is triggered here
			await may_onetimequery_projectsize(ds)

			res.send(await getResult(req.query, ds, genome))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function getResult(q, ds, genome) {
	if (ds.variant2tumors.gdcgraphql) {
		return await getResult_gdcgraphql(q, ds, genome)
	}
	throw 'unknown query method for variant2tumors'
}

async function getResult_gdcgraphql(q, ds, genome) {
	if (!q.ssm_id_lst) throw 'ssm_id_lst not provided'

	ds.variant2tumors.gdcgraphql.variables.filter.content.value = q.ssm_id_lst.split(',')

	const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(ds.variant2tumors.gdcgraphql)
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

	const levels = JSON.parse(q.levels)

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

async function may_onetimequery_projectsize(ds) {
	if (!ds.onetimequery_projectsize) return
	if (ds.onetimequery_projectsize.results) {
		// already got result
		return
	}
	// do the one time query
	if (ds.onetimequery_projectsize.gdcgraphql) {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(ds.onetimequery_projectsize.gdcgraphql)
		})
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid JSON from GDC for onetimequery_projectsize'
		}
		if (
			!re.data ||
			!re.data.viewer ||
			!re.data.viewer.explore ||
			!re.data.viewer.explore.cases ||
			!re.data.viewer.explore.cases.total ||
			!re.data.viewer.explore.cases.total.project__project_id ||
			!re.data.viewer.explore.cases.total.project__project_id.buckets
		)
			throw 'data structure not data.viewer.explore.cases.total.project__project_id.buckets'
		if (!Array.isArray(re.data.viewer.explore.cases.total.project__project_id.buckets))
			throw 'data.viewer.explore.cases.total.project__project_id.buckets not array'

		ds.onetimequery_projectsize.results = new Map()
		for (const t of re.data.viewer.explore.cases.total.project__project_id.buckets) {
			if (!t.key) throw 'key missing from one bucket'
			if (!Number.isInteger(t.doc_count)) throw '.doc_count not integer for bucket: ' + t.key
			ds.onetimequery_projectsize.results.set(t.key, t.doc_count)
		}
		return
	}
	throw 'unknown query method for onetimequery_projectsize'
}
