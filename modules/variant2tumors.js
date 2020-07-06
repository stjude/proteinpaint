const app = require('../app')
const got = require('got')

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
			let result
			if (req.query.legacydsname) {
				result = await query_legacyds(req.query, genome)
			} else {
				throw 'cannot identify data source'
			}
			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function query_legacyds(q, genome) {
	const ds = genome.datasets[q.legacydsname]
	if (!ds) throw 'invalid legacydsname: ' + q.legacydsname
	if (!ds.variant2tumors) throw 'variant2tumors is not enabled on this dataset'
	if (ds.variant2tumors.gdcgraphql) {
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
			throw 'invalid JSON returned by GDC'
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

		// may switch to client-specified levels
		let levels = ds.variant2tumors.levels

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
					s[level.name] = c
				}
				samples.push(s)
			}
		}
		console.log(samples)
	}
}
