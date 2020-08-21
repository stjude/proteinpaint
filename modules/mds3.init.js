const app = require('../app')
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const gdc = require('./mds3.gdc')

/*
********************** EXPORTED
init
client_copy
********************** INTERNAL
*/

//const serverconfig = __non_webpack_require__('./serverconfig.json')

export async function init(ds, genome, _servconfig) {
	if (!ds.queries) throw 'ds.queries{} missing'
	validate_variant2samples(ds)
	validate_sampleSummaries(ds)
	validate_query_snvindel(ds)
	validate_query_genecnv(ds, genome)
	await init_onetimequery_projectsize(ds)
}

export function client_copy(ds) {
	/* make client copy of the ds
	to be stored at genome.datasets
*/
	const ds2 = {
		isMds3: true,
		label: ds.label,
		sampleSummaries: ds.sampleSummaries ? ds.sampleSummaries.lst : null,
		queries: copy_queries(ds)
	}
	if (ds.queries.snvindel) {
		ds2.has_skewer = true
	}
	if (ds.queries.genecnv) {
		// quick fix, to show separate label of genecnv
		ds2.has_genecnv_quickfix = true
	}
	if (ds.variant2samples) {
		ds2.variant2samples = {
			variantkey: ds.variant2samples.variantkey,
			terms: ds.variant2samples.terms
		}
	}
	return ds2
}

function validate_variant2samples(ds) {
	const vs = ds.variant2samples
	if (!vs) return
	if (!vs.variantkey) throw '.variantkey missing from variant2samples'
	if (['ssm_id'].indexOf(vs.variantkey) == -1) throw 'invalid value of variantkey'
	if (!vs.terms) throw '.terms[] missing from variant2samples'
	if (!Array.isArray(vs.terms)) throw 'variant2samples.terms[] is not array'
	if (vs.terms.length == 0) throw '.terms[] empty array from variant2samples'
	for (const at of vs.terms) {
		// each attr is a term, with a getter function
		if (!at.name) throw '.name missing from an attribute term of variant2samples'
		if (at.id == undefined) throw '.id missing from an attribute term of variant2samples' // allow id to be integer 0
		if (typeof at.get != 'function') throw `.get() missing or not a function in attr "${at.id}" of variant2samples`
	}
	if (!vs.sunburst_ids) throw '.sunburst_ids[] missing from variant2samples'
	if (!Array.isArray(vs.sunburst_ids)) throw '.sunburst_ids[] not array from variant2samples'
	if (vs.sunburst_ids.length == 0) throw '.sunburst_ids[] empty array from variant2samples'
	for (const id of vs.sunburst_ids) {
		if (!vs.terms.find(i => i.id == id)) throw `sunburst id "${id}" not found in variant2samples.terms`
	}
	vs.sunburst_ids = new Set(vs.sunburst_ids)
	if (vs.gdcapi) {
		gdc.validate_variant2sample(vs.gdcapi)
	} else {
		throw 'unknown query method of variant2samples'
	}
}

function copy_queries(ds) {
	const copy = {}
	if (ds.queries.snvindel) {
		copy.snvindel = {
			forTrack: ds.queries.snvindel.forTrack
		}
	}
	if (ds.queries.genecnv) {
		copy.genecnv = {
			gaincolor: ds.queries.genecnv.gaincolor,
			losscolor: ds.queries.genecnv.losscolor
		}
	}
	// new query
	return copy
}

function validate_sampleSummaries(ds) {
	const ss = ds.sampleSummaries
	if (!ss) return
	if (!ss.lst) throw '.lst missing from sampleSummaries'
	if (!Array.isArray(ss.lst)) throw '.lst is not array from sampleSummaries'
	for (const i of ss.lst) {
		if (!i.label1) throw '.label1 from one of sampleSummaries.lst'
	}
	ss.makeholder = opts => {
		const labels = new Map()
		/*
		k: label1 of .lst[]
		v: Map
		   k: label1 value
		   v: {}
			  .sampleset: Set of sample_id
		      .mclasses: Map
		         k: mclass
			     v: Set of sample id
		      .label2: Map
		         k: label2 value
			     v: {}
				    .sampleset: Set of sample id
					.mclasses: Map
			           k: mclass
				       v: Set of sample_id
		*/
		for (const i of ss.lst) {
			labels.set(i.label1, new Map())
		}
		return labels
	}
	ss.summarize = (labels, opts, datalst) => {
		// each element in datalst represent raw result from one of ds.queries{}
		// as there can be variable number of queries, the datalst[] is variable
		for (const mlst of datalst) {
			for (const m of mlst) {
				if (!m.samples) continue
				for (const sample of m.samples) {
					if (sample.sample_id == undefined) continue
					for (const i of ss.lst) {
						const v1 = sample[i.label1]
						if (v1 == undefined) continue
						const L1 = labels.get(i.label1)
						if (!L1.has(v1)) {
							const o = {
								mclasses: new Map(),
								sampleset: new Set()
							}
							if (i.label2) {
								o.label2 = new Map()
							}
							L1.set(v1, o)
						}
						L1.get(v1).sampleset.add(sample.sample_id)
						if (!L1.get(v1).mclasses.has(m.class)) L1.get(v1).mclasses.set(m.class, new Set())
						L1.get(v1)
							.mclasses.get(m.class)
							.add(sample.sample_id)
						if (i.label2) {
							const v2 = sample[i.label2]
							if (v2 == undefined) continue
							if (!L1.get(v1).label2.has(v2)) L1.get(v1).label2.set(v2, { mclasses: new Map(), sampleset: new Set() })
							const L2 = L1.get(v1).label2.get(v2)
							L2.sampleset.add(sample.sample_id)
							if (!L2.mclasses.has(m.class)) L2.mclasses.set(m.class, new Set())
							L2.mclasses.get(m.class).add(sample.sample_id)
						}
					}
				}
			}
		}
	}
	ss.finalize = (labels, opts) => {
		const out = []
		for (const [label1, L1] of labels) {
			const strat = {
				label: label1,
				items: []
			}
			for (const [v1, o] of L1) {
				const L1o = {
					label: v1,
					samplecount: o.sampleset.size,
					mclasses: sort_mclass(o.mclasses)
				}
				// add cohort size, fix it so it can be applied to sub levels
				if (
					ds.onetimequery_projectsize &&
					ds.onetimequery_projectsize.results &&
					ds.onetimequery_projectsize.results.has(v1)
				) {
					L1o.cohortsize = ds.onetimequery_projectsize.results.get(v1)
				}

				strat.items.push(L1o)
				if (o.label2) {
					L1o.label2 = []
					for (const [v2, oo] of o.label2) {
						L1o.label2.push({
							label: v2,
							samplecount: oo.sampleset.size,
							mclasses: sort_mclass(oo.mclasses)
						})
					}
					L1o.label2.sort((i, j) => j.samplecount - i.samplecount)
				}
			}
			strat.items.sort((i, j) => j.samplecount - i.samplecount)
			out.push(strat)
		}
		return out
	}
}

function sort_mclass(set) {
	const lst = []
	for (const [c, s] of set) {
		lst.push([c, s.size])
	}
	lst.sort((i, j) => j[1] - i[1])
	return lst
}

function validate_query_snvindel(ds) {
	const q = ds.queries.snvindel
	if (!q) return
	if (!q.byrange) throw '.byrange missing for queries.snvindel'
	if (q.byrange.gdcapi) {
		gdc.validate_query_snvindel_byrange(q.byrange.gdcapi)
	} else {
		throw 'unknown query method for queries.snvindel.byrange'
	}

	if (!q.byisoform) throw '.byisoform missing for queries.snvindel'
	if (q.byisoform.gdcapi) {
		gdc.validate_query_snvindel_byisoform(q.byisoform.gdcapi, ds)
	} else {
		throw 'unknown query method for queries.snvindel.byisoform'
	}
}

function validate_query_genecnv(ds, genome) {
	const q = ds.queries.genecnv
	if (!q) return
	if (!q.gaincolor) throw '.gaincolor missing for queries.genecnv'
	if (!q.losscolor) throw '.losscolor missing for queries.genecnv'
	if (!q.byisoform) throw '.byisoform missing for queries.genecnv'
	if (q.byisoform.sqlquery_isoform2gene) {
		if (!q.byisoform.sqlquery_isoform2gene.statement) throw '.statement missing from byisoform.sqlquery_isoform2gene'
		q.byisoform.sqlquery_isoform2gene.query = genome.genedb.db.prepare(q.byisoform.sqlquery_isoform2gene.statement)
	}
	if (q.byisoform.gdcapi) {
		gdc.validate_query_genecnv(q.byisoform.gdcapi)
	} else {
		throw 'unknown query method for queries.genecnv.byisoform'
	}
}

async function init_onetimequery_projectsize(ds) {
	const op = ds.onetimequery_projectsize
	if (!op) return
	op.results = new Map()
	if (op.gdcapi) {
		await gdc.init_projectsize(op)
		return
	}
	throw 'unknown query method for onetimequery_projectsize'
}
