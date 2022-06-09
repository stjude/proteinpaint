const { stratinput } = require('../shared/tree')
const { getSamples_gdcapi } = require('./mds3.gdc')
const { get_densityplot } = require('./mds3.densityPlot')

/*
from one or more variants, get list of samples harboring any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config

q{}
.get=str, samples/sunburst/summary
.ssm_id_lst=str
.termidlst=str
	client always provides this, as the list of terms to query against can be modified
*/
export async function variant2samples_getresult(q, ds) {
	// each sample obj has keys from .terms[].id
	const samples = await get_samples(q, ds)

	if (q.get == ds.variant2samples.type_samples) return samples
	if (q.get == ds.variant2samples.type_sunburst) return make_sunburst(samples, ds, q)
	if (q.get == ds.variant2samples.type_summary) return make_summary(samples, ds, q)
	throw 'unknown get type'
}

async function get_samples(q, ds) {
	const termidlst = q.termidlst.split(',')
	if (q.get == ds.variant2samples.type_samples && ds.variant2samples.termids_samples) {
		// extra term ids to add for get=samples query
		termidlst.push(...ds.variant2samples.termids_samples)
	}
	if (ds.variant2samples.gdcapi) {
		return await getSamples_gdcapi(q, termidlst, ds)
	}
	throw 'unknown query method for variant2samples'
}

function get_termid2fields(termidlst, ds) {
	const fields = []
	for (const termid of termidlst) {
		const term = ds.cohort.termdb.q.termjsonByOneid(termid)
		fields.push(term.path)
	}
	return fields
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

async function make_summary(samples, ds, q) {
	const entries = []
	const termidlst = q.termidlst ? q.termidlst.split(',') : ds.variant2samples.termidlst
	for (const termid of termidlst) {
		const term = ds.cohort.termdb.q.termjsonByOneid(termid)
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
	if (ds.termdb.termid2totalsize2) {
		await ds.termdb.termid2totalsize2.get(termidlst, entries, q)
	}
	return entries
}
