const common = require('../../shared/src/common')
const got = require('got')

/*
GDC graphql API

validate_variant2sample
validate_query_snvindel_byrange
validate_query_snvindel_byisoform
validate_query_genecnv
getSamples_gdcapi
get_cohortTotal
addCrosstabCount_tonodes
validate_m2csq

getheaders
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
			: q.get == ds.variant2samples.type_summary
			? api.fields_summary
			: q.get == ds.variant2samples.type_samples
			? api.fields_samples
			: null
	if (!fields) throw 'invalid get type of q.get'

	const headers = getheaders(q) // will be reused below

	const response = await got(
		api.endpoint +
			'?size=' +
			api.size +
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
					if (sample[id]) sample[id] = sample[id][t.fields[j]]
				}
			}
		}
		/////////////////// hardcoded logic to use .observation
		// FIXME apply a generalized mechanism to record read depth (or just use sampledata.read_depth{})
		may_add_readdepth(s.case, sample)
		///////////////////
		samples.push(sample)
	}
	return samples
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
