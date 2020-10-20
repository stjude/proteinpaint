const common = require('../src/common')
const got = require('got')

/*
GDC graphql API
*/

export function validate_variant2sample(a) {
	if (!a.query_list) throw '.query_list missing from variant2samples.gdcapi'
	if (!a.query_sunburst) throw '.query_sunburst missing from variant2samples.gdcapi'
	if (!a.variables) throw '.variables missing from variant2samples.gdcapi'
}

export function validate_query_snvindel_byrange(a) {
	if (!a.query) throw '.query missing for byrange.gdcapi'
	if (typeof a.query != 'string') throw '.query not string in byrange.gdcapi'
	if (!a.variables) throw '.variables missing for byrange.gdcapi'
	// validate .variables
}

export function validate_query_snvindel_byisoform(api, ds) {
	if (!api.query) throw '.query missing for byisoform.gdcapi'
	if (typeof api.query != 'string') throw '.query not string for byisoform.gdcapi'
	if (!api.variables) throw '.variables missing for byisoform.gdcapi'
	if (typeof api.variables != 'function') throw 'byisoform.gdcapi.variables() is not a function'
	api.get = async opts => {
		const hits = await snvindel_byisoform_run(ds, opts)
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
				// occurrence count will be overwritten after sample filtering
				occurrence: hit._score
			}
			snvindel_addclass(m, hit._source.consequence)
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

function snvindel_addclass(m, consequence) {
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

async function snvindel_byisoform_run(ds, opts) {
	// used in two places
	// query is ds.queries.snvindel
	const response = await got.post(ds.apihost, {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			query: ds.queries.snvindel.byisoform.gdcapi.query,
			variables: ds.queries.snvindel.byisoform.gdcapi.variables(opts)
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
		variables: JSON.parse(JSON.stringify(ds.variant2samples.gdcapi.variables)),
		query: q.get == 'sunburst' ? ds.variant2samples.gdcapi.query_sunburst : ds.variant2samples.gdcapi.query_list // NOTE "sunburst" is type_sunburst
	}
	query.variables.filter.content.value = q.ssm_id_lst.split(',')

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
