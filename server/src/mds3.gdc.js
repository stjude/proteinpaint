const common = require('../shared/common')
const got = require('got')
const { get_crosstabCombinations } = require('./mds3.init')

/*
GDC graphql API

validate_variant2sample
validate_query_snvindel_byrange
validate_query_snvindel_byisoform
validate_query_snvindel_byisoform_2
validate_query_genecnv
getSamples_gdcapi
get_cohortTotal
addCrosstabCount_tonodes
validate_m2csq
validate_ssm2canonicalisoform
getheaders
validate_sampleSummaries2_number
validate_sampleSummaries2_mclassdetail
init_dictionary
init_termdb_queries
*/

export async function validate_ssm2canonicalisoform(api) {
	if (!api.endpoint) throw '.endpoint missing from ssm2canonicalisoform'
	if (!api.fields) throw '.fields[] missing from ssm2canonicalisoform'
	api.get = async q => {
		// q is client request object
		if (!q.ssm_id) throw '.ssm_id missing'
		const response = await got(api.endpoint + q.ssm_id + '?fields=' + api.fields.join(','), {
			method: 'GET',
			headers: getheaders(q)
		})
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid json in response'
		}
		if (!re.data || !re.data.consequence) throw 'returned data not .data.consequence'
		if (!Array.isArray(re.data.consequence)) throw '.data.consequence not array'
		const canonical = re.data.consequence.find(i => i.transcript.is_canonical)
		return canonical ? canonical.transcript.transcript_id : re.data.consequence[0].transcript.transcript_id
	}
}

export function validate_variant2sample(a) {
	if (typeof a.filters != 'function') throw '.variant2samples.gdcapi.filters() not a function'
}

export function validate_query_snvindel_byrange(ds) {
	const api = ds.queries.snvindel.byrange.gdcapi
	if (!api.query) throw '.query missing for byrange.gdcapi'
	if (typeof api.query != 'string') throw '.query not string in byrange.gdcapi'
	if (typeof api.variables != 'function') throw '.byrange.gdcapi.variables() not a function'
	ds.queries.snvindel.byrange.get = async opts => {
		const response = await got.post(ds.apihost, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: api.query, variables: api.variables(opts) })
		})
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid JSON from GDC'
		}
		if (
			!re.data ||
			!re.data.explore ||
			!re.data.explore.ssms ||
			!re.data.explore.ssms.hits ||
			!re.data.explore.ssms.hits.edges
		)
			throw 'returned structure not data.explore.ssms.hits.edges'
		if (!Array.isArray(re.data.explore.ssms.hits.edges)) throw 'data.explore.ssms.hits.edges not array'
		const mlst = []
		for (const h of re.data.explore.ssms.hits.edges) {
			const m = {
				dt: common.dtsnvindel,
				ssm_id: h.node.ssm_id,
				chr: h.node.chromosome,
				pos: h.node.start_position - 1,
				ref: h.node.reference_allele,
				alt: h.node.tumor_allele,
				samples: []
			}
			if (h.node.consequence && h.node.consequence.hits && h.node.consequence.hits.edges) {
				m.csqcount = h.node.consequence.hits.edges.length
				let c
				if (opts.isoform) c = h.node.consequence.hits.edges.find(i => i.node.transcript.transcript_id == opts.isoform)
				const c2 = c || h.node.consequence.hits.edges[0]
				// c2: { node: {consequence} }
				snvindel_addclass(m, c2.node)
			}
			if (h.node.occurrence.hits.edges) {
				for (const c of h.node.occurrence.hits.edges) {
					const sample = makeSampleObj(c.node.case, ds)
					sample.sample_id = c.node.case.case_id
					m.samples.push(sample)
				}
			}
			mlst.push(m)
		}
		return mlst
	}
}

// tandem rest api query: 1. variant and csq, 2. cases
// not in use
export function validate_query_snvindel_byisoform(ds) {
	const api = ds.queries.snvindel.byisoform.gdcapi
	if (!Array.isArray(api.lst)) throw 'api.lst is not array'
	if (api.lst.length != 2) throw 'api.lst is not array of length 2'
	for (const a of api.lst) {
		if (!a.endpoint) throw '.endpoint missing for byisoform.gdcapi'
		if (!a.fields) throw '.fields missing for byisoform.gdcapi'
		if (!a.filters) throw '.filters missing for byisoform.gdcapi'
		if (typeof a.filters != 'function') throw 'byisoform.gdcapi.filters() is not a function'
	}
	ds.queries.snvindel.byisoform.get = async opts => {
		const hits = await snvindel_byisoform_run(api, opts)
		const mlst = [] // parse snv/indels into this list
		for (const hit of hits) {
			if (!hit.ssm_id) throw 'hit.ssm_id missing'
			if (!Number.isInteger(hit.start_position)) throw 'hit.start_position is not integer'
			const m = {
				ssm_id: hit.ssm_id,
				dt: common.dtsnvindel,
				chr: hit.chromosome,
				pos: hit.start_position - 1,
				ref: hit.reference_allele,
				alt: hit.tumor_allele,
				isoform: opts.isoform,
				csqcount: hit.csqcount,
				// occurrence count will be overwritten after sample filtering
				occurrence: hit.cases.length
			}
			snvindel_addclass(m, hit.consequence)
			m.samples = []
			for (const c of hit.cases) {
				const sample = makeSampleObj(c, ds)
				sample.sample_id = c.case_id
				m.samples.push(sample)
			}
			mlst.push(m)
		}
		return mlst
	}
}

// protein mutation api, just occurrence and without case info
export function validate_query_snvindel_byisoform_2(ds) {
	const api = ds.queries.snvindel.byisoform.gdcapi
	if (!api.query) throw '.query missing for byisoform.gdcapi'
	if (!api.filters) throw '.filters missing for byisoform.gdcapi'
	if (typeof api.filters != 'function') throw 'byisoform.gdcapi.filters() is not function'
	ds.queries.snvindel.byisoform.get = async opts => {
		const headers = getheaders(opts)
		const response = await got.post(api.apihost, {
			headers,
			body: JSON.stringify({ query: api.query, variables: api.filters(opts) })
		})
		const tmp = JSON.parse(response.body)
		if (
			!tmp.data ||
			!tmp.data.analysis ||
			!tmp.data.analysis.protein_mutations ||
			!tmp.data.analysis.protein_mutations.data
		)
			throw 'data not .data.analysis.protein_mutations.data'
		const re = JSON.parse(tmp.data.analysis.protein_mutations.data)
		if (!re.hits) throw 're.hits missing'
		const mlst = []
		for (const a of re.hits) {
			const b = a._source
			const m = {
				ssm_id: b.ssm_id,
				dt: common.dtsnvindel,
				chr: b.chromosome,
				pos: b.start_position - 1,
				ref: b.reference_allele,
				alt: b.tumor_allele,
				isoform: opts.isoform,
				occurrence: a._score,
				csqcount: b.consequence.length
			}
			snvindel_addclass(m, b.consequence.find(i => i.transcript.transcript_id == opts.isoform))
			mlst.push(m)
		}
		return mlst
	}
}

function makeSampleObj(c, ds) {
	// c: {project:{project_id}} as returned by api call
	const sample = {}
	if (ds.sampleSummaries) {
		// At the snvindel query, each sample obj will only carry a subset of attributes
		// as defined here, for producing sub-labels
		for (const i of ds.sampleSummaries.lst) {
			{
				const t = ds.termdb.getTermById(i.label1)
				if (t) {
					sample[i.label1] = c[t.fields[0]]
					for (let j = 1; j < t.fields.length; j++) {
						if (sample[i.label1]) sample[i.label1] = sample[i.label1][t.fields[j]]
					}
				}
			}
			if (i.label2) {
				const t = ds.termdb.getTermById(i.label2)
				if (t) {
					sample[i.label2] = c[t.fields[0]]
					for (let j = 1; j < t.fields.length; j++) {
						if (sample[i.label2]) sample[i.label2] = sample[i.label2][t.fields[j]]
					}
				}
			}
		}
	} else {
		// alternative methods for building samples
	}
	return sample
}

function snvindel_addclass(m, consequence) {
	if (consequence) {
		// [ { transcript } ]
		if (consequence.transcript.consequence_type) {
			const [dt, mclass, rank] = common.vepinfo(consequence.transcript.consequence_type)
			m.class = mclass
			m.mname = consequence.transcript.aa_change // may be null!

			// hardcoded logic: { vep_impact, sift_impact, polyphen_impact, polyphen_score, sift_score}
			/*
			if (ts.transcript.annotation) {
				for (const k in ts.transcript.annotation) {
					m[k] = ts.transcript.annotation[k]
				}
			}
			*/
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

function getheaders(q) {
	// q is req.query{}
	const h = { 'Content-Type': 'application/json', Accept: 'application/json' }
	if (q.token) h['X-Auth-Token'] = q.token
	return h
}

async function snvindel_byisoform_run(api, opts) {
	// function may be shared
	// query is ds.queries.snvindel
	const headers = getheaders(opts)
	const p1 = got(
		api.lst[0].endpoint +
			'?size=' +
			api.lst[0].size +
			'&fields=' +
			api.lst[0].fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.lst[0].filters(opts))),
		{ method: 'GET', headers }
	)
	const p2 = got(
		api.lst[1].endpoint +
			'?size=' +
			api.lst[1].size +
			'&fields=' +
			api.lst[1].fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.lst[1].filters(opts))),
		{ method: 'GET', headers }
	)
	const [tmp1, tmp2] = await Promise.all([p1, p2])
	let re_ssms, re_cases
	try {
		re_ssms = JSON.parse(tmp1.body)
		re_cases = JSON.parse(tmp2.body)
	} catch (e) {
		throw 'invalid JSON returned by GDC'
	}
	if (!re_ssms.data || !re_ssms.data.hits) throw 'returned data from ssms query not .data.hits'
	if (!re_cases.data || !re_cases.data.hits) throw 'returned data from cases query not .data.hits[]'
	if (!Array.isArray(re_ssms.data.hits) || !Array.isArray(re_cases.data.hits)) throw 're.data.hits[] is not array'
	const id2ssm = new Map()
	// key: ssm_id, value: ssm {}
	for (const h of re_ssms.data.hits) {
		if (!h.ssm_id) throw 'ssm_id missing from a ssms hit'
		if (!h.consequence) throw '.consequence[] missing from a ssm'
		h.csqcount = h.consequence.length
		const consequence = h.consequence.find(i => i.transcript.transcript_id == opts.isoform)
		if (!consequence) {
			// may alert??
		}
		h.consequence = consequence // keep only info for this isoform
		h.cases = []
		id2ssm.set(h.ssm_id, h)
	}
	for (const h of re_cases.data.hits) {
		if (!h.ssm) throw '.ssm{} missing from a case'
		if (!h.ssm.ssm_id) throw '.ssm.ssm_id missing from a case'
		const ssm = id2ssm.get(h.ssm.ssm_id)
		if (!ssm) throw 'ssm_id not found in ssms query'
		if (!h.case) throw '.case{} missing from a case'
		ssm.cases.push(h.case)
	}
	return [...id2ssm.values()]
}

export function validate_query_genecnv(ds) {
	const api = ds.queries.genecnv.byisoform.gdcapi
	if (!api.query) throw '.query missing for byisoform.gdcapi'
	if (typeof api.query != 'string') throw '.query not string for byisoform.gdcapi'
	if (!api.variables) throw '.variables missing for byisoform.gdcapi'
	// validate variables
	ds.queries.genecnv.byisoform.get = async (opts, name) => {
		// following is project-summarized query
		// should be replaced by sample-level queries
		const variables = JSON.parse(JSON.stringify(api.variables))
		variables.caseAggsFilters.content[2].content.value = [name]
		variables.cnvGain.content[2].content.value = [name]
		variables.cnvLoss.content[2].content.value = [name]
		variables.cnvTestedByGene.content[1].content.value = [name]
		variables.cnvAll.content[2].content.value = [name]
		variables.ssmFilters.content[1].content.value = [name]
		const response = await got.post(ds.apihost, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: api.query, variables })
		})
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid JSON from GDC'
		}
		if (!re.data || !re.data.viewer || !re.data.viewer.explore || !re.data.viewer.explore.cases)
			throw 'data structure not data.viewer.explore.cases'
		const project2total = new Map()
		for (const i of re.data.viewer.explore.cases.cnvTotal.project__project_id.buckets) {
			project2total.set(i.key, i.doc_count)
		}
		const projects = new Map()
		if (re.data.viewer.explore.cases.gain) {
			for (const i of re.data.viewer.explore.cases.gain.project__project_id.buckets) {
				projects.set(i.key, { gain: i.doc_count, loss: 0 })
			}
		}
		if (re.data.viewer.explore.cases.loss) {
			for (const i of re.data.viewer.explore.cases.loss.project__project_id.buckets) {
				if (projects.has(i.key)) {
					projects.get(i.key).loss = i.doc_count
				} else {
					projects.set(i.key, { gain: 0, loss: 0 })
				}
			}
		}
		const lst = []
		for (const [k, i] of projects) {
			if (i.gain + i.loss == 0) continue
			i.label = k
			i.total = project2total.get(k)
			lst.push(i)
		}
		lst.sort((i, j) => (j.gain + j.loss) / j.total - (i.gain + i.loss) / i.total)
		return lst
	}
}

// for variant2samples query
export async function getSamples_gdcapi(q, ds) {
	if (!q.ssm_id_lst) throw 'ssm_id_lst not provided'
	const api = ds.variant2samples.gdcapi
	const fields =
		q.get == ds.variant2samples.type_sunburst
			? api.fields_sunburst
			: (q.get == ds.variant2samples.type_summary) || (q.get == ds.variant2samples.type_update_summary)
			? api.fields_summary
			: (q.get == ds.variant2samples.type_samples) || (q.get == ds.variant2samples.type_update_samples)
			? api.fields_samples
			: null
	if (!fields) throw 'invalid get type of q.get'

	const headers = getheaders(q) // will be reused below

	const response = await got(
		api.endpoint +
			'?size=' +
			(q.size || api.size) +
			'&from=' +
			(q.from || 0) +
			'&fields=' +
			fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.filters(q))),
		{ method: 'GET', headers }
	)
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for variant2samples'
	}
	if (!re.data || !re.data.hits) throw 'data structure not data.hits[]'
	if (!Array.isArray(re.data.hits)) throw 're.data.hits is not array'
	// total to display on sample list page
	// for numerical terms, total is not possible before making GDC query
	const total = re.data.pagination.total
	const samples = []
	for (const s of re.data.hits) {
		if (!s.case) throw '.case{} missing from a hit'
		const sample = {}

		// get printable sample id
		if (ds.variant2samples.sample_id_key) {
			sample.sample_id = s.case[ds.variant2samples.sample_id_key] // "sample_id" field in sample is hardcoded
		} else if (ds.variant2samples.sample_id_getter) {
			// must pass request header to getter in case requesting a controlled sample via a user token
			// this is gdc-specific logic and should not impact generic mds3
			sample.sample_id = await ds.variant2samples.sample_id_getter(s.case, headers)
		}

		/* gdc-specific logic
		through tumor_sample_barcode, "TCGA-F4-6805" names are set as .sample_id for display
		however case uuid is still needed to build the url link to a case
		thus the hardcoded logic to provide the case_id as "case_uuid" to client side
		*/
		sample.case_uuid = s.case.case_id

		for (const id of ds.variant2samples.termidlst) {
			const t = ds.termdb.getTermById(id)
			if (t) {
				sample[id] = s.case[t.fields[0]]
				for (let j = 1; j < t.fields.length; j++) {
					if (sample[id] && Array.isArray(sample[id])) sample[id] = sample[id][0][t.fields[j]]
					else if (sample[id]) sample[id] = sample[id][t.fields[j]]
				}
			}
		}
		/////////////////// hardcoded logic to use .observation
		// FIXME apply a generalized mechanism to record read depth (or just use sampledata.read_depth{})
		may_add_readdepth(s.case, sample)
		///////////////////
		samples.push(sample)
	}
	return [samples, total]
}

function may_add_readdepth(acase, sample) {
	if (!acase.observation) return
	// per Zhenyu, the ensemble workflow unifies the depth from all callers, can display just the first
	const dat = acase.observation[0]
	if (!dat) return
	if (!dat.read_depth) return
	sample.ssm_read_depth = {
		altTumor: dat.read_depth.t_alt_count,
		totalTumor: dat.read_depth.t_depth,
		totalNormal: dat.read_depth.n_depth
	}
}

/*
works for ds.termdb.termid2totalsize{}
q is query parameter:
.set_id
.tid2value{}, k: term id, v: category value to be added to filter
._combination
	in the cross-tab computation e.g. Project+Disease, will need to attach _combination to returned data
	so in Promise.all(), the result can be traced back to a project+disease combination
*/
export async function get_cohortTotal(api, ds, q) {
	if (!api.query) throw '.query missing for termid2totalsize'
	if (!api.filters) throw '.filters missing for termid2totalsize'
	if (typeof api.filters != 'function') throw '.filters() not function in termid2totalsize'
	const response = await got.post(ds.apihost, {
		headers: getheaders(q),
		body: JSON.stringify({ query: api.query, variables: api.filters(q) })
	})
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for cohortTotal'
	}
	let h = re[api.keys[0]]
	for (let i = 1; i < api.keys.length; i++) {
		h = h[api.keys[i]]
		if (!h) throw '.' + api.keys[i] + ' missing from data structure of termid2totalsize'
	}
	if (!Array.isArray(h)) throw api.keys.join('.') + ' not array'
	const v2count = new Map()
	for (const t of h) {
		if (!t.key) throw 'key missing from one bucket'
		if (!Number.isInteger(t.doc_count)) throw '.doc_count not integer for bucket: ' + t.key
		v2count.set(t.key, t.doc_count)
	}
	return { v2count, combination: q._combination }
}

export async function addCrosstabCount_tonodes(nodes, combinations) {
	for (const node of nodes) {
		if (!node.id0) continue // root

		if (!node.v0) {
			continue
		}
		const v0 = node.v0.toLowerCase()
		if (!node.id1) {
			const n = combinations.find(i => i.id1 == undefined && i.v0 == v0)
			if (n) node.cohortsize = n.count
			continue
		}

		if (!node.v1) {
			// e.g. {"id":"root...HCMI-CMDC...","parentId":"root...HCMI-CMDC","value":1,"name":"","id0":"project","v0":"HCMI-CMDC","id1":"disease"}
			continue
		}
		const v1 = node.v1.toLowerCase()
		if (!node.id2) {
			// second level, use crosstabL1
			const n = combinations.find(i => i.id2 == undefined && i.v0 == v0 && i.v1 == v1)
			if (n) node.cohortsize = n.count
			continue
		}

		if (!node.v2) {
			continue
		}
		const v2 = node.v2.toLowerCase()
		if (!node.id3) {
			// third level, use crosstabL2
			const n = crosstabL2.find(i => i.v0 == v0 && i.v1 == v1 && i.v2 == v2)
			if (n) node.cohortsize = n.count
		}
	}
}

export function validate_m2csq(ds) {
	const api = ds.queries.snvindel.m2csq.gdcapi
	if (!api.endpoint) throw '.endpoint missing for queries.snvindel.m2csq.gdcapi'
	if (!api.fields) throw '.fields[] missing for queries.snvindel.m2csq.gdcapi'
	ds.queries.snvindel.m2csq.get = async q => {
		// q is client request object
		const response = await got(api.endpoint + q.ssm_id + '?fields=' + api.fields.join(','), {
			method: 'GET',
			headers: getheaders(q)
		})
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid json in response'
		}
		if (!re.data || !re.data.consequence) throw 'returned data not .data.consequence'
		if (!Array.isArray(re.data.consequence)) throw '.data.consequence not array'
		return re.data.consequence.map(i => i.transcript)
	}
}

export function validate_sampleSummaries2_number(api) {
	if (!api.gdcapi.endpoint) throw '.endpoint missing from sampleSummaries2.get_number.gdcapi'
	if (!api.gdcapi.fields) throw '.fields[] missing from sampleSummaries2.get_number.gdcapi'
	api.get = async q => {
		// q is client request object
		const response = await got(
			api.gdcapi.endpoint +
				'?size=100000' +
				'&fields=' +
				api.gdcapi.fields.join(',') +
				'&filters=' +
				encodeURIComponent(JSON.stringify(api.gdcapi.filters(q))),
			{ method: 'GET', headers: getheaders(q) }
		)
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid json in response'
		}
		////////////////// XXX //////////////////
		// hardcoding to project and primary site, rather than programmatically driven by api.gdcapi.fields[]
		// FIXME should fire this query for each of sampleSummaries2.lst[{label1}]
		// see comment in lines 251 of gdc.hg38.js
		// will not fix this and wait for the "xx cases" implementation and menu UI design
		const project_set = new Set()
		const site_set = new Set()
		for (const h of re.data.hits) {
			project_set.add(h.case.project.project_id)
			site_set.add(h.case.primary_site)
		}
		// hardcoded and are from sampleSummaries2.lst[{label1}]
		return [{ label1: 'project', count: project_set.size }, { label1: 'primary_site', count: site_set.size }]
	}
}
export function validate_sampleSummaries2_mclassdetail(api, ds) {
	api.get = async q => {
		const headers = getheaders(q)
		const p1 = got(
			api.gdcapi[0].endpoint +
				'?size=100000' +
				'&fields=' +
				api.gdcapi[0].fields.join(',') +
				'&filters=' +
				encodeURIComponent(JSON.stringify(api.gdcapi[0].filters(q))),
			{ method: 'GET', headers }
		)
		const p2 = got(
			api.gdcapi[1].endpoint +
				'?size=100000' +
				'&fields=' +
				api.gdcapi[1].fields.join(',') +
				'&filters=' +
				encodeURIComponent(JSON.stringify(api.gdcapi[1].filters(q))),
			{ method: 'GET', headers }
		)
		const [tmp1, tmp2] = await Promise.all([p1, p2])
		let re_ssms, re_cases
		try {
			re_ssms = JSON.parse(tmp1.body)
			re_cases = JSON.parse(tmp2.body)
		} catch (e) {
			throw 'invalid JSON returned by GDC'
		}
		if (!re_ssms.data || !re_ssms.data.hits) throw 'returned data from ssms query not .data.hits'
		if (!re_cases.data || !re_cases.data.hits) throw 'returned data from cases query not .data.hits[]'
		if (!Array.isArray(re_ssms.data.hits) || !Array.isArray(re_cases.data.hits)) throw 're.data.hits[] is not array'
		const id2ssm = new Map()
		// key: ssm_id, value: ssm {}
		for (const h of re_ssms.data.hits) {
			if (!h.ssm_id) throw 'ssm_id missing from a ssms hit'
			if (!h.consequence) throw '.consequence[] missing from a ssm'
			const consequence = h.consequence.find(i => i.transcript.transcript_id == q.isoform)
			snvindel_addclass(h, consequence)
			h.samples = []
			id2ssm.set(h.ssm_id, h)
		}
		const { label1, label2 } = JSON.parse(decodeURIComponent(q.samplesummary2_mclassdetail))
		const term1 = ds.termdb.getTermById(label1)
		const term2 = label2 ? ds.termdb.getTermById(label2) : null
		for (const h of re_cases.data.hits) {
			if (!h.ssm) throw '.ssm{} missing from a case'
			if (!h.ssm.ssm_id) throw '.ssm.ssm_id missing from a case'
			const ssm = id2ssm.get(h.ssm.ssm_id)
			if (!ssm) throw 'ssm_id not found in ssms query'
			if (!h.case) throw '.case{} missing from a case'
			const sample = { sample_id: h.case.case_id }
			sample[label1] = h.case[term1.fields[0]]
			for (let j = 1; j < term1.fields.length; j++) {
				if (sample[label1]) sample[label1] = sample[label1][term1.fields[j]]
			}
			if (term2) {
				sample[label2] = h.case[term2.fields[0]]
				for (let j = 1; j < term2.fields.length; j++) {
					if (sample[label2]) sample[label2] = sample[label2][term2.fields[j]]
				}
			}
			ssm.samples.push(sample)
		}

		/////////////////////////////////////
		//////// following are code modified from md3.init.js
		const L1 = new Map()
		/*
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
		for (const m of id2ssm.values()) {
			for (const sample of m.samples) {
				if (sample.sample_id == undefined) continue
				const v1 = sample[label1]
				if (v1 == undefined) continue
				if (!L1.has(v1)) {
					const o = {
						mclasses: new Map(),
						sampleset: new Set()
					}
					if (label2) {
						o.label2 = new Map()
					}
					L1.set(v1, o)
				}
				L1.get(v1).sampleset.add(sample.sample_id)
				if (!L1.get(v1).mclasses.has(m.class)) L1.get(v1).mclasses.set(m.class, new Set())
				L1.get(v1)
					.mclasses.get(m.class)
					.add(sample.sample_id)

				if (label2) {
					const v2 = sample[label2]
					if (v2 == undefined) continue
					if (!L1.get(v1).label2.has(v2)) L1.get(v1).label2.set(v2, { mclasses: new Map(), sampleset: new Set() })
					const L2 = L1.get(v1).label2.get(v2)
					L2.sampleset.add(sample.sample_id)
					if (!L2.mclasses.has(m.class)) L2.mclasses.set(m.class, new Set())
					L2.mclasses.get(m.class).add(sample.sample_id)
				}
			}
		}
		let combinations
		if (ds.termdb.termid2totalsize) {
			const terms = [label1]
			if (label2) terms.push(label2)
			combinations = await get_crosstabCombinations(terms, ds, q)
		}
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
			if (combinations) {
				const k = v1.toLowerCase()
				const n = combinations.find(i => i.id1 == undefined && i.v0 == k)
				if (n) L1o.cohortsize = n.count
			}

			strat.items.push(L1o)
			if (o.label2) {
				L1o.label2 = []
				for (const [v2, oo] of o.label2) {
					const L2o = {
						label: v2,
						samplecount: oo.sampleset.size,
						mclasses: sort_mclass(oo.mclasses)
					}
					if (combinations) {
						const j = v1.toLowerCase()
						const k = v2.toLowerCase()
						const n = combinations.find(i => i.v0 == j && i.v1 == k)
						if (n) L2o.cohortsize = n.count
					}
					L1o.label2.push(L2o)
				}
				L1o.label2.sort((i, j) => j.samplecount - i.samplecount)
			}
		}
		strat.items.sort((i, j) => j.samplecount - i.samplecount)
		return strat
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

export async function init_dictionary(ds) {
	ds.cohort.termdb = {}
	const id2term = (ds.cohort.termdb.id2term = new Map())
	const dictionary = ds.termdb.dictionary
	if (!dictionary.gdcapi.endpoint) throw '.endpoint missing for termdb.dictionary_api'
	const response = await got(dictionary.gdcapi.endpoint, {
		method: 'GET',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
	})
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for variant2samples'
	}
	if (!re._mapping) throw 'returned data does not have ._mapping'
	if (!re.fields) throw 'returned data does not have .fields'
	if (!Array.isArray(re.fields)) throw '.fields not array'
	if (!re.expand) throw 'returned data does not have .expand'
	if (!Array.isArray(re.expand)) throw '.expand not array'
	// store gdc dictionary in memory
	// step 1: add leaf terms
	for (const i in re.fields) {
		const term_path_str = re.fields[i]
		const term_paths = term_path_str.split('.')
		const term_id = term_paths[term_paths.length - 1]
		const term_obj = {
			id: term_id,
			name: term_id[0].toUpperCase() + term_id.slice(1).replace(/_/g, ' '),
			path: term_path_str,
			isleaf: true,
			parent_id: term_paths[term_paths.length - 2]
		}
		// step 2: add type of leaf terms from _mapping:{}
		const t_map = re._mapping[dictionary.gdcapi.mapping_prefix + '.' + term_path_str]
		if (t_map)
			term_obj.type = t_map.type == 'keyword' ? 'categorical' : 'long' ? 'integer' : 'double' ? 'float' : 'unknown'
		else if (t_map == undefined) term_obj.type = 'unknown'
		id2term.set(term_id, term_obj)
	}
	// step 3: add parent  and root terms
	for (const i in re.expand) {
		const term_str = re.expand[i]
		const term_levels = term_str.split('.')
		const term_id = term_levels.length == 1 ? term_str : term_levels[term_levels.length - 1]
		const term_obj = {
			id: term_id,
			name: term_id[0].toUpperCase() + term_id.slice(1).replace(/_/g, ' '),
			path: term_str
		}
		if (term_levels.length > 1) term_obj['parent_id'] = term_levels[term_levels.length - 2]
		id2term.set(term_id, term_obj)
	}
	init_termdb_queries(ds.cohort.termdb)

	//step 4: prune the tree
	const prune_terms = dictionary.gdcapi.prune_terms
	for( const term_id of prune_terms){
		if(id2term.has(term_id)){
			const children = [...id2term.values()].filter(t=>t.path.includes(term_id))
			if(children.length){
				for(const child_t of children){
					id2term.delete(child_t.id)
				} 
			}
			id2term.delete(term_id)
		}
	}
	// console.log('gdc dictionary created with total terms: ', ds.cohort.termdb.id2term.size)
}

function init_termdb_queries(termdb) {
	const q = (termdb.q = {})
	const default_vocab = 'ssm_occurance'

	{
		const cache = new Map()
		q.getRootTerms = (vocab = default_vocab) => {
			const cacheId = vocab
			if (cache.has(cacheId)) return cache.get(cacheId)
			const terms = [...termdb.id2term.values()]
			// find terms without term.parent_id
			const re = terms.filter(t => t.parent_id == undefined)
			cache.set(cacheId, re)
			return re
		}
	}

	{
		const cache = new Map()
		q.getTermChildren = (id, vocab = default_vocab) => {
			const cacheId = id + ';;' + vocab
			if (cache.has(cacheId)) return cache.get(cacheId)
			const terms = [...termdb.id2term.values()]
			// find terms which have term.parent_id as clicked term
			const re = terms.filter(t => t.parent_id == id)
			cache.set(cacheId, re)
			return re
		}
	}

	{
		const cache = new Map()
		q.findTermByName = (searchStr, vocab = default_vocab) => {
			searchStr = searchStr.toLowerCase() // convert to lowercase
			// replace space with _ to match with id of terms
			if (searchStr.includes(' ')) searchStr = searchStr.replace(/\s/g, '_')
			const cacheId = searchStr + ';;' + vocab
			if (cache.has(cacheId)) return cache.get(cacheId)
			const terms = [...termdb.id2term.values()]
			// find terms that have term.id containing search string
			const re = terms.filter(t => t.id.includes(searchStr))
			cache.set(cacheId, re)
			return re
		}
	}

	{
		const cache = new Map()
		q.getAncestorIDs = id => {
			if (cache.has(id)) return cache.get(id)
			const terms = [...termdb.id2term.values()]
			const search_term = terms.find(t => t.id == id)
			// ancestor terms are already defined in term.path seperated by '.'
			let re = search_term.path ? search_term.path.split('.') : ['']
			if (re.length > 1) re.pop()
			cache.set(id, re)
			return re
		}
	}

	{
		q.getTermById = id => {
			const terms = [...termdb.id2term.values()]
			return terms.find(i => i.id == id)
		}
	}
}
