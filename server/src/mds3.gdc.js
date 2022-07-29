const common = require('#shared/common')
const got = require('got')
const { get_crosstabCombinations } = require('./mds3.variant2samples')
const serverconfig = require('./serverconfig')

/*
GDC API

****************** EXPORTED
validate_variant2sample
validate_query_snvindel_byrange
	makeSampleObj
validate_query_snvindel_byisoform
	snvindel_byisoform
validate_query_snvindel_byisoform_2
validate_query_genecnv
querySamples_gdcapi
	flattenCaseByFields
	may_add_readdepth
	may_add_projectAccess
get_termlst2size
validate_m2csq
validate_ssm2canonicalisoform
getheaders
validate_sampleSummaries2_number
validate_sampleSummaries2_mclassdetail
handle_gdc_ssms

**************** internal
mayMapRefseq2ensembl
*/

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

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

/* tandem rest api query
1. variant and csq
2. cases
*/
export function validate_query_snvindel_byisoform(ds) {
	const api = ds.queries.snvindel.byisoform.gdcapi
	if (!api.query1) throw 'api.query1 is missing'
	if (!api.query1.endpoint) throw 'query1.endpoint missing'
	if (!api.query1.fields) throw 'query1.fields missing'
	if (!api.query1.filters) throw 'query1.filters missing'
	if (typeof api.query1.filters != 'function') throw 'query1.filters() is not a function'
	if (!api.query2) throw 'api.query2 is missing'
	if (!api.query2.endpoint) throw 'query2.endpoint missing'
	if (!Array.isArray(api.query2.fields)) throw 'query2.fields[] not array'
	if (!api.query2.filters) throw 'query2.filters missing'
	if (typeof api.query2.filters != 'function') throw 'query2.filters() is not a function'

	ds.queries.snvindel.byisoform.get = async opts => {
		/* opts{}
		.isoform= str
		TODO .tid2value can be used to filter samples
		*/

		/*
		hardcoded logic!!

		as gdc ssm is based on gencode
		to allow them to also show up on a refseq pp view
		will detect if querying isoform is refseq
		steps:
		1. convert refseq to ensembl
		2. set ensembl to opts.isoform to run query
		3. set refseq to "refseq" holder variable
		4. in resulting ssm, set isoform to refseq so skewer can show
		*/
		const refseq = mayMapRefseq2ensembl(opts, ds)

		const ssmLst = await snvindel_byisoform(api, opts)
		const mlst = [] // parse final ssm into this list
		for (const ssm of ssmLst) {
			const m = {
				ssm_id: ssm.ssm_id,
				dt: common.dtsnvindel,
				chr: ssm.chromosome,
				pos: ssm.start_position - 1,
				ref: ssm.reference_allele,
				alt: ssm.tumor_allele,
				isoform: opts.isoform,
				csqcount: ssm.csqcount
			}
			snvindel_addclass(m, ssm.consequence)
			m.samples = []
			for (const c of ssm.cases) {
				/* make simple sample obj for counting, with sample_id
				only returns total number of unique cases to client
				thus do not convert uuid to sample id for significant time-saving
				*/
				m.samples.push({ sample_id: c.case_id })
			}
			mlst.push(m)
		}

		if (refseq) {
			// replace ensembl back to refseq
			opts.isoform = refseq
			for (const m of mlst) m.isoform = refseq
		}

		return mlst
	}
}

// "protein_mutations" graphql api, just occurrence and without case info
// not in use!!
export function validate_query_snvindel_byisoform_2(ds) {
	const api = ds.queries.snvindel.byisoform.gdcapi
	if (!api.query) throw '.query missing for byisoform.gdcapi'
	if (!api.filters) throw '.filters missing for byisoform.gdcapi'
	if (typeof api.filters != 'function') throw 'byisoform.gdcapi.filters() is not function'
	ds.queries.snvindel.byisoform.get = async opts => {
		const refseq = mayMapRefseq2ensembl(opts, ds)

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

		if (refseq) {
			// replace ensembl back to refseq
			opts.isoform = refseq
			for (const m of mlst) m.isoform = refseq
		}

		return mlst
	}
}

function mayMapRefseq2ensembl(q, ds) {
	/*
	q: { isoform: str }
	if this isoform starts with N, consider it as refseq and try to map to ensembl
	if mapped, assign ensembl to q.isoform, and return the original refseq
	on any failure, return undefined
	*/
	if (!q.isoform) return
	let refseq
	if (q.isoform[0] == 'N' && ds.refseq2ensembl_query) {
		const x = ds.refseq2ensembl_query.get(q.isoform)
		if (x) {
			// converted given refseq to an ensembl
			refseq = q.isoform
			q.isoform = x.ensembl
		}
	}
	return refseq
}

function makeSampleObj(c, ds) {
	// c: {project:{project_id}} as returned by api call
	const sample = {}
	if (ds.sampleSummaries) {
		// At the snvindel query, each sample obj will only carry a subset of attributes
		// as defined here, for producing sub-labels
		for (const i of ds.sampleSummaries.lst) {
			{
				const t = ds.cohort.termdb.q.termjsonByOneid(i.label1)
				if (t) {
					sample[i.label1] = c[t.fields[0]]
					for (let j = 1; j < t.fields.length; j++) {
						if (sample[i.label1]) sample[i.label1] = sample[i.label1][t.fields[j]]
					}
				}
			}
			if (i.label2) {
				const t = ds.cohort.termdb.q.termjsonByOneid(i.label2)
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
	if (q && q.token) h['X-Auth-Token'] = q.token
	return h
}

async function snvindel_byisoform(api, opts) {
	// query is ds.queries.snvindel
	const headers = getheaders(opts)
	const p1 = got(
		apihost +
			api.query1.endpoint +
			'?size=' +
			api.query1.size +
			'&fields=' +
			api.query1.fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.query1.filters(opts))),
		{ method: 'GET', headers }
	)
	const p2 = got(
		apihost +
			api.query2.endpoint +
			'?size=' +
			api.query2.size +
			'&fields=' +
			api.query2.fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(api.query2.filters(opts))),
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
	if (!re_ssms.data || !re_ssms.data.hits) throw 'query1 did not return .data.hits'
	if (!re_cases.data || !re_cases.data.hits) throw 'query2 did not return .data.hits[]'
	if (!Array.isArray(re_ssms.data.hits) || !Array.isArray(re_cases.data.hits)) throw 're.data.hits[] is not array'

	// hash ssm by ssm_id
	const id2ssm = new Map() // key: ssm_id, value: ssm {}
	for (const h of re_ssms.data.hits) {
		if (!h.ssm_id) throw 'ssm_id missing from a ssms hit'
		if (!h.consequence) throw '.consequence[] missing from a ssm'
		if (!Number.isInteger(h.start_position)) throw 'hit.start_position is not integer'
		h.csqcount = h.consequence.length
		const consequence = h.consequence.find(i => i.transcript.transcript_id == opts.isoform)
		if (!consequence) {
			// may alert??
		}
		h.consequence = consequence // keep only info for this isoform
		h.cases = []
		id2ssm.set(h.ssm_id, h)
	}

	// assign case to ssm by ssm_id
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

/*
examples of terms from termdb as below, note the dot-delimited value of term id
{
    id: 'case.disease_type',
    name: 'Disease type',
    isleaf: true,
    type: 'categorical'
}
{
  id: 'case.demographic.race',
  name: 'Race',
  isleaf: true,
  parent_id: 'demographic',
  type: 'categorical'
}
{
  id: 'case.diagnoses.age_at_diagnosis',
  name: 'Age at diagnosis',
  isleaf: true,
  parent_id: 'diagnoses',
  type: 'integer'
}


example of a case returned by api (/ssm_occurrences/ query)

case {
  primary_site: 'Hematopoietic and reticuloendothelial systems',
  disease_type: 'Plasma Cell Tumors',
  observation: [ { sample: [Object] }, { sample: [Object] } ],
  case_id: 'cd91e38c-1d2a-4534-8765-bfb9f0541338',
  project: { project_id: 'MMRF-COMMPASS' },
  diagnoses: [ { age_at_diagnosis: 32171 } ],
  demographic: {
    ethnicity: 'not hispanic or latino',
    gender: 'male',
    race: 'white'
  }
}

the sample-specific values for terms come in 3 formats:

	term1: case.disease_type
	in case{}: disease_type: 'value'

	term2: case.project.project_id
	in case{}: project: { project_id: 'value' }

	term3: case.diagnoses.age_at_diagnosis
	in case{}: diagnoses: [ { age_at_diagnosis: int } ]

this function "flattens" case{} to make the sample obj for easier use later
{
	'case.disease_type': 'value',
	'case.project.project_id': 'value',
	'case.diagnoses.age_at_diagnosis': [ int ]
}

the flattening is done by splitting term id, and some hardcoded logic
*/
function flattenCaseByFields(sample, caseObj, term) {
	const fields = term.id.split('.')

	query(caseObj, 1)
	/* start with caseObj as "current" root
	i=1 as fields[0]='case', and caseObj is already the "case", so start from i=1
	*/

	// done searching; if available, a new value is now assigned to sample[term.id]
	// if value is a Set, convert to array
	// hardcoded to use set to dedup values (e.g. chemo drug from multiple treatments)
	if (sample[term.id] instanceof Set) {
		sample[term.id] = [...sample[term.id]]
	}

	/* query()
	e.g. "case.AA.BB.CC"
	begin with query( case{}, 1 )
		--> found case.AA{}
		query( AA{}, 2 )
			--> found AA.BB{}
			query( BB{}, 3)
				--> found BB.CC, assign BB.CC to sample[case.AA.BB.CC]

	e.g. "case.diagnoses.age_at_diagnosis"
	begin with query( case{}, 1 ):
		--> found case.diagnoses, is array
		for(diagnosis of array) {
			query( diagnosis, 2 )
				--> found diagnosis.age_at_diagnosis=int
					collect int value to sample[case.diagnoses.age_at_diagnosis]
		}

	recursion is used to advance i and when current is array, to loop through it
	*/
	function query(current, i) {
		const field = fields[i]
		if (i == fields.length - 1) {
			// i is at the end of fields[], sample attr key is term.id
			if (sample[term.id]) {
				sample[term.id].add(current[field])
			} else {
				sample[term.id] = current[field]
			}
			return
		}
		// i is not at the end of fields[], advance to next "root"
		const next = current[field]
		if (next == undefined) {
			// no more values, unable to assign term.id value to sample
			return
		}
		if (Array.isArray(next)) {
			// next is array, initiate set to collect values from all array elements
			sample[term.id] = new Set()
			// recurse through each array element
			for (const n of next) {
				query(n, i + 1)
			}
			return
		}
		// advance i and recurse
		query(next, i + 1)
	}
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

/* for variant2samples query
q{}
	.get=str
	.ssm_id_lst=str, comma-delimited
	.isoform=str
	.tid2value={}
termidlst[]
	array of term ids to append to "&fields="
	and to parse out as sample attributes
ds{}
*/
export async function querySamples_gdcapi(q, termidlst, ds) {
	const api = ds.variant2samples.gdcapi

	const termObjs = []
	for (const id of termidlst) {
		const t = ds.cohort.termdb.q.termjsonByOneid(id)
		if (t) termObjs.push(t)
	}

	const param = ['size=10000', 'fields=' + termidlst.join(',')]
	// no longer paginates
	//'&size=' + (q.size || api.size) + '&from=' + (q.from || 0)

	// it may query with isoform
	mayMapRefseq2ensembl(q, ds)

	param.push('filters=' + encodeURIComponent(JSON.stringify(api.filters(q, ds))))

	const headers = getheaders(q) // will be reused below

	const response = await got(apihost + api.endpoint + '?' + param.join('&'), { method: 'GET', headers })
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for variant2samples query'
	}
	if (!re.data || !re.data.hits) throw 'variant2samples data structure not data.hits[]'
	if (!Array.isArray(re.data.hits)) throw 'variant2samples re.data.hits is not array for query'

	const samples = []

	for (const s of re.data.hits) {
		if (!s.case) throw 'variant2samples .case{} missing from a hit'
		const sample = {}
		if (s.ssm) {
			/* ssm{ ssm_id } is available on this case
			this happens when getting the list of samples for a set of variants
			attach ssm id allows client to associate sample to variant
			*/
			sample.ssm_id = s.ssm.ssm_id
		}

		// get printable sample id
		if (ds.variant2samples.sample_id_key) {
			sample.sample_id = s.case[ds.variant2samples.sample_id_key] // "sample_id" field in sample is hardcoded
		} else if (ds.variant2samples.sample_id_getter) {
			// getter do batch process
			// tempcase will be deleted after processing
			sample.tempcase = s.case
		}

		/* gdc-specific logic
		through tumor_sample_barcode, "TCGA-F4-6805" names are set as .sample_id for display
		however case uuid is still needed to build the url link to a case
		thus the hardcoded logic to provide the case_id as "case_uuid" to client side
		*/
		sample.case_uuid = s.case.case_id

		for (const term of termObjs) {
			flattenCaseByFields(sample, s.case, term)
		}

		/////////////////// hardcoded logic to add read depth using .observation
		// FIXME apply a generalized mechanism to record read depth (or just use sampledata.read_depth{})
		may_add_readdepth(s.case, sample)

		/////////////////// hardcoded logic to indicate a case is open/controlled using
		may_add_projectAccess(sample, ds)

		///////////////////
		samples.push(sample)
	}

	if (ds.variant2samples.sample_id_getter) {
		// batch process, fire one graphql query to convert id for all samples
		// must pass request header to getter in case requesting a controlled sample via a user token
		// this is gdc-specific logic and should not impact generic mds3
		await ds.variant2samples.sample_id_getter(samples, headers)
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

/* hardcoded gdc logic! does not rely on any dataset config
 */
function may_add_projectAccess(sample, ds) {
	const projectId = sample['case.project.project_id']
	if (!projectId) return
	sample.caseIsOpenAccess = ds.gdcOpenProjects.has(projectId)
}

/*
for termid2totalsize2

input:
	termidlst=[ termids ]
	q{}
		.tid2value={ termid: v}
		.ssm_id_lst=str
	combination={}
		if provided, return alongside map; needed for sunburst, see get_crosstabCombinations()
	ds
output
	returns a map
	{
		term1id: [ [cat1, total], [cat2, total], ...],
		term2id: [ ... same ],
	}
	if combination is given, returns [ map, combination ] instead
*/
export async function get_termlst2size(termidlst, q, combination, ds) {
	const api = ds.termdb.termid2totalsize2.gdcapi

	// convert each term id to {path}
	// id=case.project.project_id, convert to path=project__project_id, for graphql
	// required for termid2size_query() of gdc.hg38.js
	const termPaths = []
	for (const id of termidlst) {
		const t = ds.cohort.termdb.q.termjsonByOneid(id)
		if (t) {
			termPaths.push({
				id,
				path: id.replace('case.', '').replace(/\./g, '__'),
				type: t.type
			})
		}
	}

	const query = api.query(termPaths)
	const variables = api.filters(q, ds)
	const response = await got.post(ds.apihost, {
		headers: getheaders(q),
		body: JSON.stringify({ query, variables })
	})
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for cohortTotal for query :' + query + ' and filter: ' + filter
	}
	let h = re[api.keys[0]]
	for (let i = 1; i < api.keys.length; i++) {
		h = h[api.keys[i]]
		if (!h)
			throw '.' +
				api.keys[i] +
				' missing from data structure of termid2totalsize2 for query :' +
				query +
				' and filter: ' +
				filter
	}
	for (const term of termPaths) {
		if (term.type == 'categorical' && !Array.isArray(h[term.path]['buckets']))
			throw api.keys.join('.') + ' not array for query :' + query + ' and filter: ' + filter
		if ((term.type == 'integer' || term.type == 'float') && typeof h[term.path]['stats'] != 'object') {
			throw api.keys.join('.') + ' not object for query :' + query + ' and filter: ' + filter
		}
	}
	// return total size here attached to entires
	const tv2counts = new Map()

	for (const term of termPaths) {
		if (term.type == 'categorical') {
			const buckets = h[term.path]['buckets']
			let values = []
			for (const bucket of buckets) {
				values.push([bucket.key.replace('.', '__'), bucket.doc_count])
			}
			tv2counts.set(term.id, values)
		} else if (term.type == 'integer' || term.type == 'float') {
			const count = h[term.path]['stats']['count']
			tv2counts.set(term.id, { total: count })
		}
	}

	if (combination) return [tv2counts, combination]
	return tv2counts
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
		return [{ label1: 'project_id', count: project_set.size }, { label1: 'primary_site', count: site_set.size }]
	}
}

// not in use
export function validate_sampleSummaries2_mclassdetail(api, ds) {
	api.get = async q => {
		// q.isoform is refseq when queried from that; must convert to ensembl, no need to keep refseq
		mayMapRefseq2ensembl(q, ds)

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
			const consequence = h.consequence.find(i => i.transcript.transcript_id == q.isoform) // xxx
			snvindel_addclass(h, consequence)
			h.samples = []
			id2ssm.set(h.ssm_id, h)
		}
		const { label1, label2 } = JSON.parse(decodeURIComponent(q.samplesummary2_mclassdetail))
		const term1 = ds.cohort.termdb.q.termjsonByOneid(label1)
		const term2 = label2 ? ds.cohort.termdb.q.termjsonByOneid(label2) : null
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

/************************************************
for gdc bam slicing UI
it shares some logic with mds3, but does not require a mds3 dataset to function
*/
const ssms_fields = [
	'ssm_id',
	'chromosome',
	'start_position',
	'reference_allele',
	'tumor_allele',
	'consequence.transcript.transcript_id',
	'consequence.transcript.aa_change',
	'consequence.transcript.consequence_type',
	'consequence.transcript.gene.symbol'
]

export function handle_gdc_ssms(genomes) {
	return async (req, res) => {
		/* query{}
		.genome: required
		.case_id: required
		.isoform: optional
		.gene: can add later
		*/
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			if (!req.query.case_id) throw '.case_id missing'
			// make query to genome genedb to get canonical isoform of the gene
			const filters = {
				op: 'and',
				content: [
					{
						op: 'in',
						content: { field: 'cases.case_id', value: [req.query.case_id] }
					}
				]
			}
			if (req.query.isoform) {
				filters.content.push({
					op: '=',
					content: { field: 'consequence.transcript.transcript_id', value: [req.query.isoform] }
				})
			}

			const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
			const response = await got(
				apihost +
					'/ssms' +
					'?size=1000&fields=' +
					ssms_fields.join(',') +
					'&filters=' +
					encodeURIComponent(JSON.stringify(filters)),
				{ method: 'GET', headers }
			)
			const re = JSON.parse(response.body)
			const mlst = []
			for (const hit of re.data.hits) {
				// for each hit, create an element
				// from list of consequences, find one based on isoform info
				let isoform = req.query.isoform
				if (!isoform) {
					// no isoform given, use the canonical isoform of the gene
					// collect gene into a set over all consequences
					const genes = new Set()
					for (const c of hit.consequence) {
						if (c.transcript && c.transcript.gene && c.transcript.gene.symbol) {
							genes.add(c.transcript.gene.symbol)
						}
					}
					if (genes.size == 0) {
						// no gene?
						continue
					}
					// has gene. the case of having multiple genes is not dealt with
					const gene = [...genes][0]
					const data = genome.genedb.get_gene2canonicalisoform.get(gene)
					if (data && data.isoform) isoform = data.isoform
				}
				let c = hit.consequence.find(i => i.transcript.transcript_id == isoform)
				if (!c) {
					// no consequence match with given isoform, just use the first one
					c = hit.consequence[0]
				}
				// no aa change for utr variants
				const aa = c.transcript.aa_change || c.transcript.consequence_type
				mlst.push({
					mname: aa,
					consequence: c.transcript.consequence_type,
					gene: c.transcript.gene.symbol,
					chr: hit.chromosome,
					pos: hit.start_position,
					ref: hit.reference_allele,
					alt: hit.tumor_allele
				})
			}
			res.send({ mlst })
		} catch (e) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}
