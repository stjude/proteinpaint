const common = require('../src/common')
const got = require('got')

/*
GDC graphql API

validate_variant2sample
validate_query_snvindel_byrange
validate_query_snvindel_byisoform
init_projectsize
validate_query_genecnv
getSamples_gdcapi

getheaders
*/

export function validate_variant2sample(a) {
	if (typeof a.filters != 'function') throw '.variant2samples.gdcapi.filters() not a function'
}

export function validate_query_snvindel_byrange(a) {
	if (!a.query) throw '.query missing for byrange.gdcapi'
	if (typeof a.query != 'string') throw '.query not string in byrange.gdcapi'
	if (typeof a.variables != 'function') throw '.byrange.gdcapi.variables() not a function'
	// TODO a.get()
}

export function validate_query_snvindel_byisoform(api, ds) {
	if (!Array.isArray(api.lst)) throw 'api.lst is not array'
	if (api.lst.length != 2) throw 'api.lst is not array of length 2'
	for (const a of api.lst) {
		if (!a.endpoint) throw '.endpoint missing for byisoform.gdcapi'
		if (!a.fields) throw '.fields missing for byisoform.gdcapi'
		if (!a.filters) throw '.filters missing for byisoform.gdcapi'
		if (typeof a.filters != 'function') throw 'byisoform.gdcapi.filters() is not a function'
	}
	api.get = async opts => {
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
				// occurrence count will be overwritten after sample filtering
				occurrence: hit.cases.length
			}
			snvindel_addclass(m, hit.consequence)
			m.samples = []
			for (const c of hit.cases) {
				const sample = { sample_id: c.case_id }
				if (ds.sampleSummaries) {
					// At the snvindel query, each sample obj will only carry a subset of attributes
					// as defined here, for producing sub-labels
					for (const i of ds.sampleSummaries.lst) {
						sample[i.label1] = ds.termdb.getTermById(i.label1).get(c)
						if (i.label2) sample[i.label2] = ds.termdb.getTermById(i.label2).get(c)
					}
				}
				m.samples.push(sample)
			}
			mlst.push(m)
		}
		return mlst
	}
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

export async function init_projectsize(op, ds) {
	if (!op.gdcapi.query) throw '.query missing for onetimequery_projectsize.gdcapi'
	if (!op.gdcapi.variables) throw '.variables missing for onetimequery_projectsize.gdcapi'
	const response = await got.post(ds.apihost, {
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
}

export function validate_query_genecnv(api, ds) {
	if (!api.query) throw '.query missing for byisoform.gdcapi'
	if (typeof api.query != 'string') throw '.query not string for byisoform.gdcapi'
	if (!api.variables) throw '.variables missing for byisoform.gdcapi'
	// validate variables
	api.get = async (opts, name) => {
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

export async function getSamples_gdcapi(q, ds) {
	if (!q.ssm_id_lst) throw 'ssm_id_lst not provided'
	const api = ds.variant2samples.gdcapi
	const response = await got(
		api.endpoint +
			'?size=' +
			api.size +
			'&fields=' +
			(q.get == 'sunburst' ? api.fields_sunburst : api.fields_list).join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.filters(q))),
		{ method: 'GET', headers: getheaders(q) }
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
		for (const id of ds.variant2samples.termidlst) {
			sample[id] = ds.termdb.getTermById(id).get(s.case)
		}
		samples.push(sample)
	}
	return samples
}

export async function get_cohortTotal(api, ds, q) {
	// q is query parameter
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
		throw 'invalid JSON from GDC for onetimequery_projectsize'
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
	return v2count
}
