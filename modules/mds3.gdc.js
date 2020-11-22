const common = require('../src/common')
const got = require('got')

/*
GDC graphql API
*/

export function validate_variant2sample(a) {
	if (!a.query_list) throw '.query_list missing from variant2samples.gdcapi'
	if (!a.query_sunburst) throw '.query_sunburst missing from variant2samples.gdcapi'
	if (typeof a.variables != 'function') throw '.variant2samples.gdcapi.variables() not a function'
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
				// site/disease/project corresponds to ds.sampleSummaries.lst[].label
				m.samples.push({
					sample_id: c.case_id,
					site: c.primary_site,
					disease: c.disease_type,
					project: c.project ? c.project.project_id : undefined
				})
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

async function snvindel_byisoform_run(api, opts) {
	// function may be shared
	// query is ds.queries.snvindel
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
	if (opts.token) headers['X-Auth-Token'] = opts.token
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
	const query = {
		variables: ds.variant2samples.gdcapi.variables(q),
		query: q.get == 'sunburst' ? ds.variant2samples.gdcapi.query_sunburst : ds.variant2samples.gdcapi.query_list // NOTE "sunburst" is type_sunburst
	}

	const response = await got.post(ds.apihost, {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(query)
	})
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for variant2samples'
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
			/* samplelist query will retrieve all terms
			but sunburst will only retrieve a few attr
			will simply iterate over all terms and missing ones will have undefined value
			*/
			const s = {}
			for (const attr of ds.variant2samples.terms) {
				s[attr.id] = attr.get(sample.node.case)
			}
			samples.push(s)
		}
	}
	return samples
}
