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

	// may get total cohort size for term categories when termdb.termid2totalsize is provided

	/* total number of samples from the first term, as in variant2samples.sunburst_ids[0]
	map, key: value/category of this term, value: number of samples
	*/
	let t1total

	/* cross tab result for term pairs e.g. sunburst_ids[1] against [0], and [2] against [0,1] etc
	array, ele: {}
	.id0: id of first term
	.v0: value/category of first term
	.id1: id of second term
	.v1: value/category of second term
	.id2, v2: optional, if it is [2] against [0,1]
	.count: number of samples in this combination
	*/
	let crosstabL1, crosstabL2
	if (ds.termdb.termid2totalsize) {
		// temporarily record categories for each term
		// do not register list of categories in ds, as the list could be token-specific
		const id2values = new Map()

		// get total for first term
		{
			const id = ds.variant2samples.sunburst_ids[0]
			const v2c = (await ds.termdb.termid2totalsize[id].get(q)).v2count
			t1total = new Map()
			id2values.set(id, new Set())
			// must convert to lower case due to issue with gdc
			for (const [v, c] of v2c) {
				const s = v.toLowerCase()
				t1total.set(s, c)
				id2values.get(id).add(s)
			}
		}
		crosstabL1 = []
		crosstabL2 = []
		for (let i = 1; i < ds.variant2samples.sunburst_ids.length; i++) {
			// for each term from 2nd of sunburst_ids, compute crosstab with all previous terms
			const thisid = ds.variant2samples.sunburst_ids[i]
			if (!id2values.has(thisid)) id2values.set(thisid, new Set())

			const combinations = get_priorcategories(id2values, ds.variant2samples.sunburst_ids, i)
			const queries = [] // one promise for each combination
			for (const combination of combinations) {
				const q2 = Object.assign({ tid2value: {} }, q)
				q2.tid2value[combination.id0] = combination.v0
				if (combination.id1) q2.tid2value[combination.id1] = combination.v1
				if (combination.id2) q2.tid2value[combination.id2] = combination.v2
				q2._combination = combination
				queries.push(ds.termdb.termid2totalsize[thisid].get(q2))
			}
			const lst = await Promise.all(queries)
			for (const { v2count, combination } of lst) {
				for (const [v, c] of v2count) {
					const s = v.toLowerCase()
					id2values.get(thisid).add(s)
					const comb = Object.assign({}, combination)
					comb.count = c
					if (i == 1) {
						comb.id1 = thisid
						comb.v1 = s
						crosstabL1.push(comb)
						continue
					}
					if (i == 2) {
						comb.id2 = thisid
						comb.v2 = s
						crosstabL2.push(comb)
					}
				}
			}
		}
	}

	// FIXME do stratinput first. gdc-specific logic to go into a function addTotalcount2nodes()
	// the function will be defined either in gdc or init

	// to use stratinput, convert each attr to {k} where k is term id
	const nodes = stratinput(
		samples,
		ds.variant2samples.sunburst_ids.map(i => {
			return { k: i }
		})
	)
	for (const node of nodes) {
		delete node.lst
		if (ds.termdb.termid2totalsize) {
			// assign cohortsize from crosstab results
			if (!node.id0) {
				// root
				continue
			}

			const v0 = node.v0.toLowerCase()
			if (!node.id1) {
				// first level, not cross tab
				node.cohortsize = t1total.get(v0)
				continue
			}
			if (!node.id2) {
				// second level, use crosstabL1
				const v1 = node.v1.toLowerCase()
				const n = crosstabL1.find(i => i.v0 == v0 && i.v1 == v1)
				if (n) node.cohortsize = n.count
				continue
			}
			if (!node.id3) {
				// third level, use crosstabL2
				const v1 = node.v1.toLowerCase()
				const v2 = node.v2.toLowerCase()
				const n = crosstabL2.find(i => i.v0 == v0 && i.v1 == v1 && i.v2 == v2)
				if (n) node.cohortsize = n.count
			}
		}
	}
	return nodes
}

function get_priorcategories(id2values, tidlst, i) {
	const lst = []
	for (const v0 of id2values.get(tidlst[0])) {
		if (i > 1) {
			// use 2nd term
			for (const v1 of id2values.get(tidlst[1])) {
				if (i > 2) {
					// use 3rd term
					for (const v2 of id2values.get(tidlst[2])) {
						lst.push({
							id0: tidlst[0],
							v0,
							id1: tidlst[1],
							v1,
							id2: tidlst[2],
							v2
						})
					}
				} else {
					// use first two terms
					lst.push({
						id0: tidlst[0],
						v0,
						id1: tidlst[1],
						v1
					})
				}
			}
		} else {
			// just 1st term
			lst.push({ id0: tidlst[0], v0 })
		}
	}
	return lst
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
