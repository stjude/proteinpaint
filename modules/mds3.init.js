const app = require('../app')
const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const got = require('got')
const common = require('../src/common')
// TODO create mds3.gdc.js and import here

/*
********************** EXPORTED
init
client_copy
server_updateAttr
********************** INTERNAL
validate_termdbconfig
may_validate_info_fields
may_validate_population
may_init_vcf
may_init_ld
may_init_svcnv
may_sum_samples
*/

const serverconfig = __non_webpack_require__('./serverconfig.json')

export async function init(ds, genome, _servconfig) {
	if (!ds.queries) throw 'ds.queries{} missing'
	validate_variant2samples(ds)
	validate_sampleSummaries(ds)
	validate_query_snvindel(ds)
	await init_onetimequery_projectsize(ds)
}

export function client_copy(ds) {
	/* make client copy of the ds
	to be stored at genome.datasets
*/
	const ds2 = {
		isMds3: true,
		label: ds.label,
		queries: copy_queries(ds)
	}
	if (ds.queries.snvindel) {
		ds2.has_skewer = true
	}
	if (ds.sampleSummaries) {
		ds2.has_samplesummary = true
	}
	if (ds.variant2samples) {
		ds2.variant2samples = {
			variantkey: ds.variant2samples.variantkey,
			levels: ds.variant2samples.levels
		}
	}
	return ds2
}

function validate_variant2samples(ds) {
	const vs = ds.variant2samples
	if (!vs) return
	if (!vs.variantkey) throw '.variantkey missing from variant2samples'
	if (['ssm_id'].indexOf(vs.variantkey) == -1) throw 'invalid value of variantkey'
	if (!vs.levels) throw '.levels[] missing from variant2samples'
	if (!Array.isArray(vs.levels)) throw 'variant2samples.levels[] is not array'
	// to validate levels
	if (vs.gdcapi) {
		if (!vs.gdcapi.query) throw '.query missing from variant2samples.gdcapi'
		if (!vs.gdcapi.variables) throw '.variables missing from variant2samples.gdcapi'
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
			  sampleset: Set of sample_id
		      mclasses: Map
		         k: mclass
			     v: Set of sample id
		      label2: Map
		         k: label2 value
			     v: {}
				    sampleset: Set of sample id
					mclasses: Map
			           k: mclass
				       v: Set of sample_id
		*/
		for (const i of ss.lst) {
			labels.set(i.label1, new Map())
		}
		return labels
	}
	ss.summarize = (mlst, labels, opts) => {
		// summarize mlst into an existing holder "labels"
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
				// todo: add cohortsize
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
		if (!q.byrange.gdcapi.query) throw '.query missing for byrange.gdcapi'
		if (typeof q.byrange.gdcapi.query != 'string') throw '.query not string in byrange.gdcapi'
		if (!q.byrange.gdcapi.variables) throw '.variables missing for byrange.gdcapi'
		// validate .variables
	} else {
		throw 'unknown query method for queries.snvindel.byrange'
	}

	if (!q.byisoform) throw '.byisoform missing for queries.snvindel'
	if (q.byisoform.gdcapi) {
		gdcapi_init_snvindel_byisoform(ds)
	} else {
		throw 'unknown query method for queries.snvindel.byisoform'
	}
}

function gdcapi_init_snvindel_byisoform(ds) {
	const api = ds.queries.snvindel.byisoform.gdcapi
	if (!api.query) throw 'gdcapi.query missing for byisoform.gdcapi'
	if (typeof api.query != 'string') throw '.query not string for byisoform.gdcapi'
	if (!api.variables) throw '.variables missing for byisoform.gdcapi'
	api.get = async opts => {
		const hits = await snvindel_byisoform_gdcapi_run(ds, opts)
		const mlst = [] // parse snv/indels into this list
		for (const hit of hits) {
			if (!hit._source) throw '._source{} missing from one of re.hits[]'
			if (!hit._source.ssm_id) throw 'hit._source.ssm_id missing'
			if (!Number.isInteger(hit._source.start_position)) throw 'hit._source.start_position is not integer'
			const m = {
				ssm_id: hit._source.ssm_id,
				dt: common.dtsnvindel,
				chr: hit._source.chromosome,
				pos: hit._source.start_position - 1,
				ref: hit._source.reference_allele,
				alt: hit._source.tumor_allele,
				isoform: opts.isoform,
				occurrence: hit._score
			}
			gdcapi_snvindel_addclass(m, hit._source.consequence)
			if (hit._source.occurrence) {
				m.samples = []
				for (const acase of hit._source.occurrence) {
					const c = acase.case
					// site/disease/project corresponds to ds.sampleSummaries.lst[].label
					m.samples.push({
						sample_id: c.case_id,
						site: c.primary_site,
						disease: c.disease_type,
						project: c.project ? c.project.project_id : undefined
					})
				}
			}
			mlst.push(m)
		}
		return mlst
	}
}

function gdcapi_snvindel_addclass(m, consequence) {
	if (consequence) {
		// [ { transcript } ]
		const ts = consequence.find(i => i.transcript.transcript_id == m.isoform)
		if (ts && ts.transcript.consequence_type) {
			const [dt, mclass, rank] = common.vepinfo(ts.transcript.consequence_type)
			m.class = mclass
			m.mname = ts.transcript.aa_change // may be null!

			// hardcoded logic: { vep_impact, sift_impact, polyphen_impact, polyphen_score, sift_score}
			if (ts.transcript.annotation) {
				for (const k in ts.transcript.annotation) {
					m[k] = ts.transcript.annotation[k]
				}
			}
		}
	}

	if (!m.mname) {
		m.mname = m.ref + '>' + m.alt
	}

	if (!m.class) {
		if (common.basecolor[m.ref] && common.basecolor[m.alt]) {
			m.class = common.mclasssnv
		} else {
			if (m.ref == '-') {
				m.class = common.mclassinsertion
			} else if (m.alt == '-') {
				m.class = common.mclassdeletion
			} else {
				m.class = common.mclassmnv
			}
		}
	}
}

async function snvindel_byisoform_gdcapi_run(ds, opts) {
	// used in two places
	// query is ds.queries.snvindel
	const variables = JSON.parse(JSON.stringify(ds.queries.snvindel.byisoform.gdcapi.variables))
	variables.filters.content.value = [opts.isoform]
	const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			query: ds.queries.snvindel.byisoform.gdcapi.query,
			variables
		})
	})
	let re
	try {
		const tmp = JSON.parse(response.body)
		if (
			!tmp.data ||
			!tmp.data.analysis ||
			!tmp.data.analysis.protein_mutations ||
			!tmp.data.analysis.protein_mutations.data
		)
			throw 'structure is not .data.analysis.protein_mutations.data'
		re = JSON.parse(tmp.data.analysis.protein_mutations.data)
	} catch (e) {
		throw 'invalid JSON returned by GDC'
	}
	if (!re.hits) throw 'data.analysis.protein_mutations.data.hits missing'
	if (!Array.isArray(re.hits)) throw 'data.analysis.protein_mutations.data.hits[] is not array'
	return re.hits
}

async function init_onetimequery_projectsize(ds) {
	const op = ds.onetimequery_projectsize
	if (!op) return
	op.results = new Map()
	if (op.gdcapi) {
		if (!op.gdcapi.query) throw '.query missing for onetimequery_projectsize.gdcapi'
		if (!op.gdcapi.variables) throw '.variables missing for onetimequery_projectsize.gdcapi'
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(op.gdcapi)
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
		for (const t of re.data.viewer.explore.cases.total.project__project_id.buckets) {
			if (!t.key) throw 'key missing from one bucket'
			if (!Number.isInteger(t.doc_count)) throw '.doc_count not integer for bucket: ' + t.key
			op.results.set(t.key, t.doc_count)
		}
		return
	}
	throw 'unknown query method for onetimequery_projectsize'
}
