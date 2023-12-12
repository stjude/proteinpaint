import * as common from '#shared/common'
import { compute_bins } from '#shared/termdb.bins'
import got from 'got'
import path from 'path'
import { combineSamplesById } from './mds3.variant2samples'
import { filter2GDCfilter } from './mds3.gdc.filter'
import { write_tmpfile } from './utils'
import serverconfig from './serverconfig'

// convenient helper to only print log on dev environments, and reduce pollution on prod
// TODO move to utils.js, also fix use of _serverconfig
function mayLog(...args) {
	if (serverconfig.debugmode) console.log(args.join(' '))
}

/*
GDC API

****************** EXPORTED
validate_variant2sample
validate_query_snvindel_byrange
	makeSampleObj
validate_query_snvindel_byisoform
	snvindel_byisoform
	snvindel_addclass
	decideSampleId
gdcValidate_query_singleSampleMutation
	getSingleSampleMutations
		getCnvFusion4oneCase
validate_query_snvindel_byisoform_2 // "protein_mutations" graphql, not in use
validate_query_geneCnv // not in use! replaced by Cnv2
validate_query_geneCnv2
	filter2GDCfilter
validate_query_geneExpression
	gdcGetCasesWithExressionDataFromCohort
gdc_validate_query_singleCell_samples
gdc_validate_query_singleCell_data
querySamples_gdcapi
	flattenCaseByFields
		mayApplyGroupsetting
	may_add_readdepth
	may_add_projectAccess
	mayApplyBinning
		getBin
querySamplesTwlst4hierCluster
get_termlst2size
validate_m2csq
validate_ssm2canonicalisoform
getheaders


**************** internal
mayMapRefseq2ensembl
isoform2ssm_query1_getvariant{}
isoform2ssm_query2_getcase{}

**************** api hosts
for the pp docker instance running in gdc backend, the api host should be defined by environmental variable
otherwise, e.g. in sj prod server it uses the public api https://api.gdc.cancer.gov

for now the api host is not attached to the pp-backend dataset object (as defined by dataset/gdc.hg38.js)
as there are usages not involving the "dataset", e.g. in bam slicing
thus need to define the "apihost" as global variables in multiple places
*/
export const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov' // rest api host
const apihostGraphql = apihost + (apihost.includes('/v0') ? '' : '/v0') + '/graphql'
// may override the geneExpHost for developers without access to qa/portal environments
export const geneExpHost = serverconfig.features?.geneExpHost || apihost

export function convertSampleId_addGetter(tdb, ds) {
	tdb.convertSampleId.get = inputs => {
		const old2new = {}
		for (const old of inputs) {
			old2new[old] = ds.__gdc.map2caseid.get(old) || old
		}
		return old2new
	}
}

export async function validate_ssm2canonicalisoform(api) {
	const fields = ['consequence.transcript.is_canonical', 'consequence.transcript.transcript_id']
	api.get = async q => {
		// q is client request object
		if (!q.ssm_id) throw '.ssm_id missing'
		const response = await got(apihost + '/ssms/' + q.ssm_id + '?fields=' + fields.join(','), {
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
	ds.queries.snvindel.byrange.get = async opts => {
		const response = await got.post(apihostGraphql, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, // xxx
			body: JSON.stringify({ query: query_range2ssm, variables: variables_range2ssm(opts) })
		})
		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid JSON from GDC range2ssm'
		}
		if (!Array.isArray(re?.data?.explore?.ssms?.hits?.edges)) throw 'data.explore.ssms.hits.edges not array'
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
				let c // consequence
				if (opts.isoform) {
					c = h.node.consequence.hits.edges.find(i => i.node.transcript.transcript_id == opts.isoform)
				} else {
					c = h.node.consequence.hits.edges.find(i => i.node.transcript.is_canonical)
				}
				const c2 = c || h.node.consequence.hits.edges[0]
				// c2: { node: {consequence} }
				snvindel_addclass(m, (c || h.node.consequence.hits.edges[0]).node)
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

/*
q{}
.filter0
	optional, gdc hidden filter
.filter
	optional, pp filter
.genes[ {gene} ]
	required. list of genes

compose the gene-by-sample fpkm matrix
genes are given from query parameter, and are double-checked by gene_selection API
samples are determined based on filter/filter0:
	all cases based on current filter are retrieved
	then, up to 1000 of those with exp data are kept
*/
export function validate_query_geneExpression(ds, genome) {
	ds.queries.geneExpression.get = async q => {
		if (!Array.isArray(q.genes)) throw 'q.genes[] not array'

		// getter returns this data structure
		const gene2sample2value = new Map() // k: gene symbol, v: { <case submitter id>: value }

		const t1 = new Date()

		// get all cases from current filter
		const caseLst = await gdcGetCasesWithExressionDataFromCohort(q, ds) // list of case uuid
		if (caseLst.length == 0) return { gene2sample2value, byTermId: {} } // no cases with exp data

		const t2 = new Date()
		mayLog(caseLst.length, 'cases with exp data:', t2 - t1, 'ms')

		const [ensgLst, ensg2symbol] = await geneExpression_getGenes(q.genes, genome, caseLst)

		if (ensgLst.length == 0) return { gene2sample2value, byTermId: {} } // no valid genes

		const t3 = new Date()
		mayLog(ensgLst.length, 'out of', q.genes.length, 'genes selected for exp:', t3 - t2, 'ms')
		const byTermId = {}
		for (const g of ensgLst) {
			const geneSymbol = ensg2symbol.get(g)
			byTermId[geneSymbol] = { gencodeId: g } // store ensemble gene ID in byTermId
			gene2sample2value.set(geneSymbol, new Map())
		}

		const sampleNameMap = await getExpressionData(q, ensgLst, caseLst, ensg2symbol, gene2sample2value, ds)
		/* returns mapping from uuid to submitter id; since uuid is used in gene2sample2value, but need to display submitter id on ui
		 */

		const t4 = new Date()
		mayLog('gene-case matrix built:', t4 - t3, 'ms')

		return { gene2sample2value, byTermId, sampleNameMap }
	}
}

/*
genes: []
	list of gene coming from client query
genome:
	for converting symbol to ensg
case_ids:[]
	required for hitting /gene_selection to screen ensg list before returning
*/
async function geneExpression_getGenes(genes, genome, case_ids) {
	// convert given gene symbols to ENSG for api query
	const ensgLst = []
	// convert ensg back to symbol for using in data structure
	const ensg2symbol = new Map()

	for (const g of genes) {
		const name = g.gene || g.name // TODO should be only g.gene
		if (typeof name != 'string') continue // TODO report skipped ones
		if (name.startsWith('ENSG') && name.length == 15) {
			ensgLst.push(name)
			ensg2symbol.set(name, name)
			continue
		}
		const lst = genome.genedb.getAliasByName.all(name)
		if (Array.isArray(lst)) {
			for (const a of lst) {
				if (a.alias.startsWith('ENSG')) {
					ensgLst.push(a.alias)
					ensg2symbol.set(a.alias, name)
					break
				}
			}
		}
		if (ensgLst.length > 100) break // max 100 genes
	}

	//return [ensgLst, ensg2symbol]

	// per Zhenyu 9/26/23, user-elected genes must be screened so those with 0 value cross all samples will be left out
	// so that valid SD-transformed value can be returned from /values api
	// https://docs.gdc.cancer.gov/Encyclopedia/pages/FPKM-UQ/
	try {
		const response = await got.post(`${geneExpHost}/gene_expression/gene_selection`, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				case_ids,
				gene_ids: ensgLst,
				selection_size: ensgLst.length
			})
		})
		const re = JSON.parse(response.body)
		if (!Array.isArray(re.gene_selection)) throw 're.gene_selection[] not array'
		const ensgLst2 = []
		for (const i of re.gene_selection) {
			if (typeof i.gene_id != 'string') throw '.gene_id missing from one of re.gene_selection[]'
			ensgLst2.push(i.gene_id)
		}
		// some genes from ensgLst may be left out ensgLst2, e.g. HOXA1 from test example;
		// later can comment above code to double-check as /values is able to return data for HOXA1 so why is it left out here?
		//console.log(ensgLst, ensgLst2)
		return [ensgLst2, ensg2symbol]
	} catch (e) {
		throw e
	}
}

// return list of case uuid with gene exp data
export async function gdcGetCasesWithExressionDataFromCohort(q, ds) {
	const f = { op: 'and', content: [] }
	if (q.filter0) {
		f.content.push(q.filter0)
	}
	if (q.filterObj) {
		f.content.push(filter2GDCfilter(q.filterObj))
	}
	const body = { size: 10000, fields: 'case_id' }
	if (f.content.length) body.filters = f

	try {
		const response = await got.post(path.join(apihost, 'cases'), { headers: getheaders(q), body: JSON.stringify(body) })
		const re = JSON.parse(response.body)
		if (!Array.isArray(re.data.hits)) throw 're.data.hits[] not array'
		const lst = []
		for (const h of re.data.hits) {
			if (h.id && ds.__gdc.casesWithExpData.has(h.id)) {
				lst.push(h.id)
				if (lst.length > 1000) {
					// max 1000 samples
					break
				}
			}
		}
		return lst
	} catch (e) {
		if (e.stack) console.log(e.stack)
		throw e
	}
}

async function getExpressionData(q, gene_ids, case_ids, ensg2symbol, gene2sample2value, ds) {
	// when api is on prod, switch to path.join(apihost, 'gene_expression/values')
	const response = await got.post(`${geneExpHost}/gene_expression/values`, {
		headers: getheaders(q),
		body: JSON.stringify({
			case_ids,
			gene_ids,
			format: 'tsv',
			//tsv_units: 'uqfpkm'
			tsv_units: 'median_centered_log2_uqfpkm'
		})
	})
	if (typeof response.body != 'string') throw 'response.body is not tsv text'
	const lines = response.body.trim().split('\n')
	if (lines.length <= 1) throw 'less than 1 line from tsv response.body'

	// header line:
	// gene \t case1 \t case 2 \t ...
	const caseHeader = lines[0].split('\t').slice(1) // order of case uuid in tsv header
	if (caseHeader.length != case_ids.length) throw 'sample column length != case_ids.length'
	//const submitterHeader = [] // convert case ids from header into submitter ids, for including in data structure
	const caseuuid2submitter = {}
	for (const c of caseHeader) {
		const s = ds.__gdc.caseid2submitter.get(c)
		if (!s) throw 'case submitter id unknown for a uuid'
		//submitterHeader.push(s)
		caseuuid2submitter[c] = s
	}

	// each line is data from one gene
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].split('\t')
		if (l.length != caseHeader.length + 1) throw 'number of fields in gene line does not equal header'
		const ensg = l[0]
		if (!ensg) throw 'ensg l[0] missing from a line'
		const symbol = ensg2symbol.get(ensg)
		if (!symbol) throw 'symbol missing for ' + ensg
		for (const [j, sample] of caseHeader.entries()) {
			const v = Number(l[j + 1])
			if (!Number.isFinite(v)) {
				//console.log(ensg, sample, l[j + 1]) continue
				throw 'non-numeric exp value from gdc'
			}
			gene2sample2value.get(symbol)[sample] = v
		}
	}
	return caseuuid2submitter
}

/* tandem rest api query
1. variant and csq
2. cases
*/
export function validate_query_snvindel_byisoform(ds) {
	/*

	getter opts{}

	.isoform:str
		required
	.useCaseid4sample:true
		if true, use case id for sample_id
		otherwise, use sample(aliquot) id
	.hiddenmclass = set
	.filter0
		read-only gdc cohort filter, pass to gdc api as-is
	TODO .tid2value can be used to filter samples
	*/
	ds.queries.snvindel.byisoform.get = async opts => {
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

		const ssmLst = await snvindel_byisoform(opts, ds)
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

			if (opts.hiddenmclass && opts.hiddenmclass.has(m.class)) continue

			m.samples = []
			for (const c of ssm.cases) {
				const s = { sample_id: await decideSampleId(c, ds, opts.useCaseid4sample) }
				if (opts.useCaseid4sample) {
					// when flag is true, this query came from getData() for gdc matrix
					// sample_id is case uuid, the required unique identifier to align columns
					// also create optional attribute __sampleName with submitter_id value, for displaying to user
					s.__sampleName = c.submitter_id
				}

				/* remain to see if okay not to pass this
				if (c.case_id) {
					 when case_id is available, pass it on to returned data as "case.case_id"
					this is used by gdc matrix case selection where case_id (uuid) is needed to build cohort in gdc portal,
					but the submitter_id cannot be used as it will prevent mds3 gdc filter to work, it only works with uuid
					see __matrix_case_id__
					s['case.case_id'] = c.case_id
				}
				*/

				m.samples.push(s)
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
			snvindel_addclass(
				m,
				b.consequence.find(i => i.transcript.transcript_id == opts.isoform)
			)
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

////////////////////////// CNV /////////////////////////////

/* using the "cnvs" endpoint
!!! not in use !!!
due to the trouble of getting samples filtered
and inability to work with filters below:
{"field":"cases.primary_site","value":["pancreas"]}
{"field":"cases.case_id","value":["39710434-3a67-40eb-8ff3-0995df3e155c","b8a1732f-c1cb-4a02-af4f-61b63d3d52df","7d198ee2-d80a-4759-804f-a7ef85971843","2270d09e-a8be-4b7d-9520-a4bb1cd053c0","56c07b06-c6d3-4c03-9e57-7be636e7cc5c","e46b6434-ee88-4630-9fc3-441afc431745"]}
*/
export function validate_query_geneCnv(ds) {
	const defaultFields = [
		'cnv_id',
		'cnv_change',
		'gene_level_cn',
		'occurrence.case.submitter_id',
		'consequence.gene.symbol'
	]

	/*
	opts{}
		.gene=str
	*/
	ds.queries.geneCnv.bygene.get = async opts => {
		const headers = getheaders(opts)
		const tmp = await got.post(path.join(apihost, 'cnvs'), {
			headers,
			body: JSON.stringify({
				size: 100000,
				fields: getFields(opts),
				filters: getFilter(opts)
			})
		})
		const re = JSON.parse(tmp.body)
		if (!Array.isArray(re?.data?.hits)) throw 'geneCnv response body is not {data:hits[]}'

		const cnvevents = [] // collect list of cnv events to return

		for (const hit of re.data.hits) {
			if (!hit.gene_level_cn) throw 'hit.gene_level_cn is not true'
			if (!hit.cnv_id) throw 'hit.cnv_id missing'
			// each hit is one gain/loss event, and is reshaped into m{ samples[] }
			const m = {
				ssm_id: hit.cnv_id, // keep using ssm_id
				dt: common.dtcnv,
				samples: []
			}
			if (hit.cnv_change == 'Gain') m.class = common.mclasscnvgain
			else if (hit.cnv_change == 'Loss') m.class = common.mclasscnvloss
			else {
				// NOTE!!
				console.log('cnv_change not Gain/Loss')
				m.class = hit.cnv_change
			}
			if (!Array.isArray(hit.occurrence)) throw 'hit.occurrence[] not array'
			for (const h of hit.occurrence) {
				if (!h.case) throw 'hit.occurrence[].case{} missing'
				if (!h.case.submitter_id) throw 'hit.occurrence[].case.submitter_id missing'
				const sample = {
					sample_id: h.case.submitter_id
				}

				if (opts.twLst) {
					for (const tw of opts.twLst) {
						flattenCaseByFields(sample, h.case, tw)
					}
				}

				m.samples.push(sample)
			}
			cnvevents.push(m)
		}
		return cnvevents
	}

	function getFields(p) {
		/* p={}
		.twLst=[]
		*/
		const lst = defaultFields.slice()
		if (p.twLst) {
			for (const t of p.twLst) {
				let id = t.term.id
				if (id.startsWith('case.')) id = 'occurrence.' + id
				lst.push(id)
			}
		}
		return lst.join(',')
	}

	function getFilter(p) {
		/* p={}
		.gene=str
			needed for lollipop view, to limit data on one gene
			gene-level cnv query doesn't work for single sample query, as the amount of data is too big, should be segments
		.case_id=str
			optional
			to get 
		.filter0, read-only gdc filter
		.filterObj, pp filter
		*/

		if (!p.gene && typeof p.gene != 'string') throw 'p.gene does not provide non-empty string' // gene is required for now

		const filters = { op: 'and', content: [] }

		if (p.gene) {
			filters.content.push({ op: '=', content: { field: 'consequence.gene.symbol', value: p.gene.split(',') } })
		}

		/* single sample query doesn't work
		if (p.case_id) {
			filters.content.push({ op: 'in', content: { field: 'occurrence.case.case_id', value: [p.case_id] } })
		}
		*/

		if (p.filter0) {
			filters.content.push(cnvsGetFilter0(p.filter0))
		}
		if (p.filterObj) {
			filters.content.push(filter2GDCfilter(typeof p.filterObj == 'string' ? JSON.parse(p.filterObj) : p.filterObj))
		}
		return filters
	}
}
/*
f0 = {"op":"and","content":[{"op":"in","content":{"field":"cases.case_id","value":
*/
function cnvsGetFilter0(f0) {
	const fstr = typeof f0 == 'string' ? f0 : JSON.stringify(f0)
	return JSON.parse(fstr.replace('"cases.case_id"', '"occurrence.case.case_id"'))
}

// using the "cnv_occurrences" endpoint
export function validate_query_geneCnv2(ds) {
	const defaultFields = [
		'cnv.cnv_change',
		'cnv.gene_level_cn',
		'cnv.consequence.gene.symbol',
		'case.submitter_id', // human-readable name, non-unique
		'case.case_id' // unique uuid
	]

	/*
	opts{}
		.gene=str
	*/
	ds.queries.geneCnv.bygene.get = async opts => {
		const headers = getheaders(opts)
		const tmp = await got.post(path.join(apihost, 'cnv_occurrences'), {
			headers,
			body: JSON.stringify({
				size: 100000,
				fields: getFields(opts),
				filters: getFilter(opts)
			})
		})
		const re = JSON.parse(tmp.body)
		if (!Array.isArray(re?.data?.hits)) throw 'geneCnv response body is not {data:hits[]}'

		const gainEvent = {
			ssm_id: 'geneCnvGain',
			dt: common.dtcnv,
			class: common.mclasscnvgain,
			samples: []
		}
		const lossEvent = {
			ssm_id: 'geneCnvLoss',
			dt: common.dtcnv,
			class: common.mclasscnvloss,
			samples: []
		}

		for (const hit of re.data.hits) {
			if (typeof hit.cnv != 'object') throw 'hit.cnv{} not obj'
			if (typeof hit.case != 'object') throw 'hit.case{} not obj'
			if (!hit.cnv.gene_level_cn) throw 'hit.cnv.gene_level_cn is not true'

			let cnv
			if (hit.cnv.cnv_change == 'Gain') {
				cnv = gainEvent
			} else if (hit.cnv.cnv_change == 'Loss') {
				cnv = lossEvent
			} else {
				throw 'hit.cnv.cnv_change is not Gain/Loss'
			}
			// each hit is one gain/loss event in one case, and is reshaped into m{ samples[] }
			const sample = {
				sample_id: hit.case.case_id,
				__sampleName: hit.case.submitter_id
			}

			if (opts.twLst) {
				for (const tw of opts.twLst) {
					flattenCaseByFields(sample, hit.case, tw)
				}
			}

			cnv.samples.push(sample)
		}

		const mlst = []
		if (gainEvent.samples.length) mlst.push(gainEvent)
		if (lossEvent.samples.length) mlst.push(lossEvent)
		return mlst
	}

	function getFields(p) {
		/* p={}
		.twLst=[]
		*/
		const lst = defaultFields.slice()
		if (p.twLst) {
			for (const t of p.twLst) {
				let id = t.term.id
				if (id.startsWith('case.')) id = 'occurrence.' + id // ???
				lst.push(id)
			}
		}
		return lst.join(',')
	}

	function getFilter(p) {
		/* p={}
		.gene=str
			needed for lollipop view, to limit data on one gene
			gene-level cnv query doesn't work for single sample query, as the amount of data is too big, should be segments
		.case_id=str
			optional
			to get 
		.filter0, read-only gdc filter
		.filterObj, pp filter
		*/

		if (!p.gene && typeof p.gene != 'string') throw 'p.gene does not provide non-empty string' // gene is required for now

		const filters = { op: 'and', content: [] }

		if (p.gene) {
			filters.content.push({ op: '=', content: { field: 'cnv.consequence.gene.symbol', value: p.gene.split(',') } })
		}

		if (p.filter0) {
			filters.content.push(p.filter0)
		}
		if (p.filterObj) {
			filters.content.push(filter2GDCfilter(typeof p.filterObj == 'string' ? JSON.parse(p.filterObj) : p.filterObj))
		}
		return filters
	}
}

/*
not in use
get genome-wide gene-level cnv data for one case
opts{}
	.case_id=str
*/
async function getGeneCnv4oneCase(opts) {
	const fields = [
		'cnv.chromosome',
		'cnv.start_position',
		'cnv.end_position',
		'cnv.cnv_change',
		'cnv.gene_level_cn',
		'cnv.consequence.gene.symbol' // turn on later if gene is needed
	]
	const headers = getheaders(opts)
	const tmp = await got.post(path.join(apihost, 'cnv_occurrences'), {
		headers,
		body: JSON.stringify({
			size: 10000,
			fields: fields.join(','),
			filters: getFilter(opts)
		})
	})
	const re = JSON.parse(tmp.body)
	if (!Array.isArray(re.data.hits)) throw 're.data.hits[] not array'
	const cnvs = []
	for (const h of re.data.hits) {
		if (!h.id) throw '.id missing from cnv hit'
		if (typeof h.cnv != 'object') throw 'h.cnv{} not object'
		if (!h.cnv.gene_level_cn) throw 'h.cnv.gene_level_cn not true'
		if (!Number.isInteger(h.cnv.start_position)) throw 'h.cnv.start_position not integer'
		if (!Number.isInteger(h.cnv.end_position)) throw 'h.cnv.end_position not integer'
		if (!h.cnv.chromosome) throw 'h.cnv.chromosome missing'
		const m = {
			dt: common.dtcnv,
			ssm_id: h.id,
			chr: 'chr' + h.cnv.chromosome,
			start: h.cnv.start_position,
			stop: h.cnv.end_position
		}
		if (h.cnv.cnv_change == 'Gain') {
			m.value = 1
			//m.class = common.mclass.mclasscnvgain
		} else if (h.cnv.cnv_change == 'Loss') {
			m.value = -1
			//m.class=common.mclass.mclasscnvloss
		} else {
			throw 'h.cnv.cnv_change value not Gain or Loss'
		}
		if (h.cnv.consequence?.gene?.symbol) m.gene = h.cnv.consequence.gene.symbol
		cnvs.push(m)
	}
	return cnvs

	function getFilter(p) {
		/* p={}
		.case_id=str
		*/
		if (!p.case_id) throw '.case_id missing'
		const filters = { op: 'and', content: [{ op: 'in', content: { field: 'case.case_id', value: [p.case_id] } }] }
		return filters
	}
}

/*
get a text file with genome-wide cnv segment data from one case, and read the file content
opts{}
	.case_id=str
*/
async function getCnvFusion4oneCase(opts) {
	const fields = [
		'cases.samples.sample_type',
		'data_type',
		'file_id',
		'data_format',
		'experimental_strategy',
		'analysis.workflow_type'
	]
	const headers = getheaders(opts)
	const tmp = await got.post(path.join(apihost, 'files'), {
		headers,
		body: JSON.stringify({
			size: 10000,
			fields: fields.join(','),
			filters: getFilter(opts)
		})
	})
	const re = JSON.parse(tmp.body)
	if (!Array.isArray(re.data.hits)) throw 're.data.hits[] not array'

	let snpFile, wgsFile, arribaFile // detect result files from accepted assays

	for (const h of re.data.hits) {
		if (h.data_format == 'BEDPE') {
			if (h.experimental_strategy != 'RNA-Seq') continue
			if (h.analysis?.workflow_type != 'Arriba') continue
			if (h.data_type != 'Transcript Fusion') continue
			arribaFile = h.file_id
			continue
		}

		if (h.data_format == 'TXT') {
			if (h.experimental_strategy == 'Genotyping Array') {
				// is snp array, there're two files for tumor and normal. skip the normal one by sample_tye
				const sample_type = h.cases?.[0].samples?.[0]?.sample_type
				if (!sample_type) continue
				if (sample_type.includes('Normal')) continue
				if (h.data_type != 'Masked Copy Number Segment') continue
				snpFile = h.file_id
				continue
			}
			if (h.experimental_strategy == 'WGS') {
				// is wgs, no need to check sample_type, the file is usable
				if (!h.file_id) continue
				if (h.data_type != 'Copy Number Segment') continue
				wgsFile = h.file_id
				continue
			}
		}
	}

	const events = [] // collect cnv and fusion events into one array

	if (wgsFile) {
		const re = await got(path.join(apihost, 'data') + '/' + wgsFile, { method: 'GET', headers })
		const lines = re.body.split('\n')
		// first line is header
		// GDC_Aliquot	Chromosome	Start	End	Copy_Number	Major_Copy_Number	Minor_Copy_Number
		for (let i = 1; i < lines.length; i++) {
			const l = lines[i].split('\t')
			if (l.length != 7) continue
			const total = Number(l[4]),
				major = Number(l[5]),
				minor = Number(l[6])
			if (Number.isNaN(total) || Number.isNaN(major) || Number.isNaN(minor)) continue
			const cnv = {
				dt: common.dtcnv,
				chr: l[1],
				start: Number(l[2]),
				stop: Number(l[3]),
				value: total
			}
			if (!cnv.chr || Number.isNaN(cnv.start) || Number.isNaN(cnv.stop)) continue
			events.push(cnv)

			if (total > 0) {
				// total copy number is >0, detect loh
				/*
				if (major + minor != total) continue // data err?
				if (major == minor) continue // no loh
				const loh = {
					dt: common.dtloh,
					chr: cnv.chr,
					start: cnv.start,
					stop: cnv.stop,
					segmean: Math.abs(major - minor) / total
				}
				events.push(loh)
				*/

				if (minor == 0 && major > 0) {
					// zhenyu 4/25/23 detect strict one allele loss
					events.push({
						dt: common.dtloh,
						chr: cnv.chr,
						start: cnv.start,
						stop: cnv.stop,
						// hardcode a value for plot to work.
						// may make "segmean" value optional; if missing, indicates quanlitative event and should plot without color shading
						// otherwise, the value quantifies allelic imbalance and is plotted with color shading
						// all loh events in a plot should be uniformlly quanlitative or quantitative
						segmean: 0.5
					})
				}
			}
		}
	} else if (snpFile) {
		// only load available snp file if no wgs cnv

		const re = await got(path.join(apihost, 'data') + '/' + snpFile, { method: 'GET', headers })
		const lines = re.body.split('\n')
		// first line is header
		// GDC_Aliquot	Chromosome	Start	End	Num_Probes	Segment_Mean
		for (let i = 1; i < lines.length; i++) {
			const l = lines[i].split('\t')
			if (l.length != 6) continue
			if (!l[1]) continue
			const cnv = {
				dt: common.dtcnv,
				chr: 'chr' + l[1],
				start: Number(l[2]),
				stop: Number(l[3]),
				value: Number(l[5])
			}
			if (Number.isNaN(cnv.start) || Number.isNaN(cnv.stop) || Number.isNaN(cnv.value)) continue
			events.push(cnv)
		}
	}

	if (arribaFile) {
		try {
			const re = await got(path.join(apihost, 'data') + '/' + arribaFile, { method: 'GET', headers })
			const lines = re.body.split('\n')
			// first line is header
			// #chrom1 start1  end1    chrom2  start2  end2    name    score   strand1 strand2 strand1(gene/fusion)    strand2(gene/fusion)    site1   site2   type    direction1      direction2      split_reads1    split_reads2    discordant_mates        coverage1       coverage2       closest_genomic_breakpoint1     closest_genomic_breakpoint2     filters fusion_transcript       reading_frame   peptide_sequence        read_identifiers
			for (let i = 1; i < lines.length; i++) {
				const l = lines[i].split('\t')
				const f = {
					dt: common.dtfusionrna,
					chrA: l[0],
					posA: Number(l[1]),
					chrB: l[3],
					posB: Number(l[4])
				}
				if (!f.chrA || !f.chrB || Number.isNaN(f.posA) || Number.isNaN(f.posB)) continue
				parseArribaName(f, l[6])
				events.push(f)
			}
		} catch (e) {
			// no permission to fusion file
		}
	}

	return events

	function getFilter(p) {
		/* p={}
		.case_id=str
		*/
		if (!p.case_id) throw '.case_id missing'
		const filters = {
			op: 'and',
			content: [
				{ op: 'in', content: { field: 'cases.case_id', value: [p.case_id] } },
				{
					op: 'in',
					content: {
						field: 'data_type',
						value: [
							'Masked Copy Number Segment', // for snp array we only want this type of file
							'Copy Number Segment', // for wgs we want this type of file
							'Transcript Fusion' // fusion
						]
					}
				}
			]
		}
		return filters
	}
}

function parseArribaName(f, str) {
	if (!str) return
	const lst = str.split(',') // first split by ,
	for (const tmp of lst) {
		const l2 = tmp.split('--')
		if (l2.length == 2) {
			// is A--B name joined
			f.geneA = l2[0].split('(')[0]
			f.geneB = l2[1].split('(')[0]
			return
		}
	}
	// no A--B name; may fix logic later
}

////////////////////////// CNV ends /////////////////////////////

function getheaders(q) {
	// q is req.query{}
	const h = { 'Content-Type': 'application/json', Accept: 'application/json' }
	if (q) {
		if (q.token) h['X-Auth-Token'] = q.token
		if (q.sessionid) h['Cookie'] = 'sessionid=' + q.sessionid
	}
	return h
}

async function snvindel_byisoform(opts, ds) {
	if (!opts.isoform) throw 'snvindel_byisoform: .isoform missing'
	if (typeof opts.isoform != 'string') throw '.isoform value not string'

	const query1 = isoform2ssm_query1_getvariant,
		query2 = isoform2ssm_query2_getcase

	const headers = getheaders(opts)

	// must use POST as filter can be too long for GET
	const p1 = got.post(path.join(apihost, query1.endpoint), {
		headers,
		body: JSON.stringify({
			size: query1.size,
			fields: query1.fields.join(','),
			filters: query1.filters(opts)
		})
	})
	const p2 = got.post(path.join(apihost, query2.endpoint), {
		headers,
		body: JSON.stringify({
			size: query2.size,
			fields: query2.fields.join(','),
			filters: query2.filters(opts, ds)
		})
	})
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


example of a case returned by GDC api (/ssm_occurrences/ query)

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
function flattenCaseByFields(sample, caseObj, tw) {
	const fields = tw.term.id.split('.')

	/* start with caseObj as "current" root
	i=1 as fields[0]='case', and caseObj is already the "case", so start from i=1
	*/
	query(caseObj, 1)

	/* done searching; if available, a new value is now assigned to sample[term.id]
	if value is a Set, convert to array
	hardcoded to use set to dedup values (e.g. chemo drug from multiple treatments)

	*** quick fix!! ***
	downstream mds3 code does not handle array value well.
	return 1st value for those to work; later can change back when array values can be handled
	*/
	if (sample[tw.term.id] instanceof Set) {
		//sample[term.id] = [...sample[term.id]]
		sample[tw.term.id] = [...sample[tw.term.id]][0]
	}

	if (tw.term.id in sample) {
		// a valid value is set, if tw.q defines binning or groupsetting, convert the value
		if (tw.term.type == 'categorical') {
			const v = mayApplyGroupsetting(sample[tw.term.id], tw)
			if (v) sample[tw.term.id] = v
		}

		/*
		reason...

		} else if (tw.term.type == 'integer' || tw.term.type == 'float') {
			*/
	}

	/* helper function query()

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
			if (sample[tw.term.id]) {
				sample[tw.term.id].add(current[field])
			} else {
				sample[tw.term.id] = current[field]
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
			sample[tw.term.id] = new Set()
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

function mayApplyGroupsetting(v, tw) {
	if (tw.q?.type == 'custom-groupset' && Array.isArray(tw.q?.groupsetting?.customset?.groups)) {
		for (const group of tw.q.groupsetting.customset.groups) {
			if (!Array.isArray(group.values)) throw 'group.values[] not array from tw.q.groupsetting.customset.groups'
			if (group.values.findIndex(i => i.key == v) != -1) {
				// value "v" is in this group
				return group.name
			}
		}
		// not matching with a group
	}
	if (
		tw.q?.type == 'predefined-groupset' &&
		Number.isInteger(tw.q.groupsetting?.predefined_groupset_idx) &&
		tw.term.groupsetting?.lst[tw.q.groupsetting.predefined_groupset_idx]
	) {
		for (const group of tw.term.groupsetting.lst[tw.q.groupsetting.predefined_groupset_idx]) {
			if (!Array.isArray(group.values)) throw 'group.values[] not array from tw.term.groupsetting.lst[]'
			if (group.values.findIndex(i => i.key == v) != -1) {
				// value "v" is in this group
				return group.name
			}
		}
	}
}

// returns byTermId{} with computed bin labels
function mayApplyBinning(samples, twLst) {
	const byTermId = {}
	for (const tw of twLst) {
		if (tw.term.type != 'integer' && tw.term.type != 'float') continue
		if (!tw.q?.mode) continue // numeric q.mode missing, this
		if (tw.q.mode == 'discrete' || tw.q.mode == 'binary') {
			// according to q.mode, must compute bin
			// code copied from barchart.data.js
			const summary = {}
			for (const s of samples) {
				const v = s[tw.term.id]
				if (Number.isFinite(v)) {
					if ('min' in summary) {
						summary.min = Math.min(v, summary.min)
						summary.max = Math.max(v, summary.max)
					} else {
						summary.min = v
						summary.max = v
					}
				}
			}
			const bins = compute_bins(tw.q, p => summary, tw.term.valueConversion)

			/* sql CTE returns {name,label}, where compute_bins does not return name
			client seems to use name to sort. when client changes to use label, can delete this
			*/
			for (const b of bins) b.name = b.label

			byTermId[tw.term.id] = { bins }

			// uncomment to allow to see term range and assist hardcoding binconfig in termdb.gdc.js
			//console.log(summary,bins)

			for (const s of samples) {
				const v = s[tw.term.id]
				if (Number.isFinite(v)) {
					s[tw.term.id] = getBin(bins, v)
				}
			}
		} else if (tw.q.mode == 'continuous') {
			// do not compute bin
		} else {
			throw 'mayApplyBinning: unknown numeric q.mode'
		}
	}
	return byTermId
}

function getBin(bins, v) {
	for (const b of bins) {
		if (b.startunbounded) {
			if (v < b.stop) return b.label
			if (b.stopinclusive && v == b.stop) return b.label
		} else if (b.stopunbounded) {
			if (v > b.start) return b.label
			if (b.startinclusive && v == b.start) return b.label
		} else if (
			(v > b.start || (v === b.start && b.startinclusive)) &&
			(v < b.stop || (v === b.stop && b.stopinclusive))
		) {
			return b.label
		}
	}
}

function prepTwLst(lst) {
	// {id} and {term:{id}} are both converted to {id, term:{id}}
	for (const tw of lst) {
		if (tw.id == undefined || tw.id == '') {
			if (!tw?.term?.id) throw 'tw.id and tw.term are both missing'
			tw.id = tw.term.id
		} else if (!tw.term) {
			tw.term = { id: tw.id }
		}
	}
}

/* for variant2samples query
obtain a list of samples, to be used for subsequent purposes (sent to client for table/matrix, summarize etc)

inputs:

q{}
	.genome{}
	.get=str
	.ssm_id_lst=str, comma-delimited
	.isoform=str, one isoform accession
	.tid2value={}
	.hiddenmclass = set
	.rglst[]
	.filterObj
	.filter0

twLst[]
	array of termwrapper objects, for sample-annotating terms (not geneVariant)
	tw.id is appended to "&fields="
	e.g. case.disease_type, case.diagnoses.primary_diagnosis
	and to parse out as sample attributes

ds{}

geneTwLst[]
	optional list of geneVariant tw objects
	if provided, query samples with alterations on these genes
	tw.q{} determines required datatype, e.g. snvindel and cnv

returns:

{
	byTermId{}
		contains computed bin labels to assist client rendering
	samples[]
		list of sample objects:
		sample.sample_id is the unique identifier of a sample
		value is variable, dependens on context
}
*/

export async function querySamples_gdcapi(q, twLst, ds, geneTwLst) {
	if (q.isHierCluster) {
		/*
		running gene exp clustering
		must only restrict to cases with exp data
		but not by mutated cases anymore, thus geneTwLst should not be used (and not supplied)
		*/
		return await querySamplesTwlst4hierCluster(q, twLst, ds)
	}

	prepTwLst(twLst)

	if (geneTwLst) {
		if (!Array.isArray(geneTwLst)) throw 'geneTwLst not array'
		// temporarily create q.isoforms[] to do ssm query
		q.isoforms = []
		for (const tw of geneTwLst) {
			if (!tw?.term?.name) throw 'gene tw missing .term.name'
			if (tw.term.isoform) {
				// may need to convert refseq to gencode
				q.isoforms.push(tw.term.isoform)
			} else {
				// convert
				if (typeof q.genome != 'object')
					throw 'serverside genome obj missing, needed to map gene name to canonical isoform'
				if (!q.genome?.genedb?.get_gene2canonicalisoform) throw 'gene2canonicalisoform not supported on this genome'
				const data = q.genome.genedb.get_gene2canonicalisoform.get(tw.term.name)
				if (!data?.isoform) {
					// no isoform found
					continue
				}
				q.isoforms.push(data.isoform)
			}
		}
	}

	if (q.get == 'samples') {
		// getting list of samples (e.g. for table display)
		// need following fields for table display, add to twLst[] if missing:

		if (q.ssm_id_lst || q.isoform) {
			// querying using list of ssm or single isoform
			// must be from mds3 tk; in such case should return following info

			// need ssm id to associate with ssm (when displaying in sample table?)
			if (!twLst.some(i => i.id == 'ssm.ssm_id')) twLst.push({ term: { id: 'ssm.ssm_id' } })

			// need read depth info
			// TODO should only add when getting list of samples with mutation for a gene
			// TODO not when adding a dict term in matrix?
			if (!twLst.some(i => i.id == 'case.observation.read_depth.t_alt_count'))
				twLst.push({ term: { id: 'case.observation.read_depth.t_alt_count' } })
			if (!twLst.some(i => i.id == 'case.observation.read_depth.t_depth'))
				twLst.push({ term: { id: 'case.observation.read_depth.t_depth' } })
			if (!twLst.some(i => i.id == 'case.observation.read_depth.n_depth'))
				twLst.push({ term: { id: 'case.observation.read_depth.n_depth' } })

			// get aliquot id for converting to sample name from which the mutation is detected
			// TODO no need when
			if (!twLst.some(i => i.id == 'case.observation.sample.tumor_sample_uuid'))
				twLst.push({ term: { id: 'case.observation.sample.tumor_sample_uuid' } })
		}

		// need both case_id and submitter id
		// need case_id to generate url/cases/<ID> link in table display; submitter and aliquot id won't work
		if (!twLst.some(i => i.id == 'case.case_id')) twLst.push({ term: { id: 'case.case_id' } })
		// need submitter id for
		if (!twLst.some(i => i.id == 'case.submitter_id')) twLst.push({ term: { id: 'case.submitter_id' } })
	}

	if (q.get == 'summary' || q.get == 'sunburst') {
		// submitter id is sufficient to count unique number of samples, no need for case_id
		if (!twLst.some(i => i.id == 'case.submitter_id')) twLst.push({ term: { id: 'case.submitter_id' } })
	}

	const dictTwLst = []
	for (const tw of twLst) {
		const t = ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
		if (t) dictTwLst.push({ term: t, q: tw.q })
	}

	const fields = twLst.map(tw => tw.term.id)

	if (q.hiddenmclass) {
		/* to drop mutations by pp class
		add new fields so api returns consequence for the querying isoform for each mutation
		then filter by class
		this has been coded up this way but is inefficient, better method would be for gdc api filter to include transcript and consequence limit
		*/
		fields.push('ssm.consequence.transcript.consequence_type')
		fields.push('ssm.consequence.transcript.transcript_id')
	}

	if (q.rglst) {
		fields.push('ssm.chromosome')
		fields.push('ssm.start_position')
	}

	const param = { size: 10000, fields: fields.join(',') }

	// it may query with isoform
	mayMapRefseq2ensembl(q, ds)

	param.filters = isoform2ssm_query2_getcase.filters(q, ds)

	const headers = getheaders(q) // will be reused below

	const response = await got.post(path.join(apihost, isoform2ssm_query2_getcase.endpoint), {
		headers,
		body: JSON.stringify(param)
	})

	delete q.isoforms

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

		if (q.hiddenmclass) {
			// filtering mutations by mclass
			if (!Array.isArray(s.ssm?.consequence)) continue // lack consequence, skip
			/* each consequence is
			{
				transcript: {
					transcript_id: 'ENST00000649815',
					consequence_type: 'missense_variant'
				}
			}
			*/
			const m = {}
			snvindel_addclass(
				m,
				s.ssm.consequence.find(i => i.transcript.transcript_id == q.isoform)
			)
			if (q.hiddenmclass.has(m.class)) {
				// this variant is dropped
				continue
			}
		}

		if (q.rglst) {
			if (!s.ssm?.chromosome || !s.ssm?.start_position) continue // lack position, skip
			if (
				!q.rglst.find(
					i => i.chr == s.ssm.chromosome && i.start < s.ssm.start_position && i.stop >= s.ssm.start_position
				)
			) {
				continue // out of range
			}
		}

		if (q.variant2samples) {
			// from mds3 client
			// set 3rd arg to false to not set uuid as sample_id, but to use sample submitter id
			sample.sample_id = await decideSampleId(s.case, ds, false)
		} else {
			// from getData(), need below:
			// sample_id=case uuid, __sampleName=case submitter id (not sample submitter!)
			sample.sample_id = s.case.case_id
			sample.__sampleName = s.case.submitter_id
		}

		if (s.case.case_id) {
			// for making url link on a sample
			sample.sample_URLid = s.case.case_id
			if (s.case?.observation?.[0]?.sample?.tumor_sample_uuid) {
				// aliquot id available; append to URLid so when opening the page, the sample is auto highlighted from the tree
				// per uat feedback by bill 1/6/2023
				sample.sample_URLid = sample.sample_URLid + '?bioId=' + s.case.observation[0].sample.tumor_sample_uuid
			}
		}

		for (const tw of dictTwLst) {
			flattenCaseByFields(sample, s.case, tw)
		}

		/////////////////// hardcoded logic to add read depth using .observation
		// FIXME apply a generalized mechanism to record read depth (or just use sampledata.read_depth{})
		may_add_readdepth(s.case, sample)

		/////////////////// hardcoded logic to indicate a case is open/controlled using
		may_add_projectAccess(sample, ds)

		///////////////////
		samples.push(sample)
	}

	const byTermId = mayApplyBinning(samples, dictTwLst)

	if (geneTwLst) {
		const param = {
			gene: geneTwLst.map(i => i.term.name).join(','),
			twLst: dictTwLst
		}
		const cnvdata = await ds.queries.geneCnv.bygene.get(param)
		for (const h of cnvdata) {
			for (const s of h.samples) {
				samples.push(s)
			}
		}
	}

	const id2samples = new Map()
	for (const s of samples) {
		combineSamplesById([s], id2samples, s.ssm_id)
	}

	return { byTermId, samples: [...id2samples.values()] }
}

/*
offshoot of querySamples_gdcapi()!
should make identical return but different, due to the data format returned by mds3.load.js. should look into it further

** this only works for dict terms!! but not geneVariant aiming to load mutations

*/
async function querySamplesTwlst4hierCluster(q, twLst, ds) {
	const filters = {
		op: 'in',
		content: { field: 'case_id', value: [...ds.__gdc.casesWithExpData] } // FIXME too many to add for every query, find alternative approach with UC
	}

	const dictTwLst = [] // get all dictionary terms from twLst, for querying /cases API
	// TODO if there are gene terms to pull mutations??
	for (const tw of twLst) {
		const t = ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
		if (t) dictTwLst.push({ term: t, q: tw.q })
	}

	const fields = ['case_id']
	const field2termid = new Map()
	for (const t of dictTwLst) {
		/* term id is "case.disease_type"
		(can term id ever be "cases.xx"?)
		in /cases, must use "disease_type" as field value
		*/
		const field = t.term.id.replace(/^case\./, '')
		fields.push(field)
		field2termid.set(field, t.term.id)
	}

	const response = await got.post(path.join(apihost, 'cases'), {
		headers: getheaders(q),
		body: JSON.stringify({
			size: 10000,
			fields: fields.join(','),
			filters
		})
	})
	const re = JSON.parse(response.body)
	if (!Array.isArray(re?.data?.hits)) throw 're.data.hits[] not array'

	const samples = []
	for (const h of re.data.hits) {
		/*
		{
			sample_id, // uuid
			__sampleName, // submitter id for display
			sample_URLid // uuid
			<tid>:<v>
		}
		*/
		if (typeof h.case_id != 'string') throw 'h.case_id missing'
		/*
		const sample = {
			__sampleName: ds.__gdc.caseid2submitter.get(h.case_id), // display
			sample_id: h.case_id,
			sample_URLid: h.case_id,
		}
		*/
		// FIXME unable to pass case uuid due to exp data format, solve later
		const sample = {
			sample_id: ds.__gdc.caseid2submitter.get(h.case_id), // display
			__sampleName: ds.__gdc.caseid2submitter.get(h.case_id) // display
			//__sampleName: h.case_id,
			//sample_URLid: h.case_id,
		}

		for (const tw of dictTwLst) {
			flattenCaseByFields(sample, h, tw) // helper to transfer term values to sample{}
		}

		samples.push(sample)
	}

	const byTermId = mayApplyBinning(samples, dictTwLst)

	return { byTermId, samples }
}

/*
c is case{}
decide the value to the generic sample_id attribute
*/
async function decideSampleId(c, ds, useCaseid4sample) {
	if (useCaseid4sample && c.case_id) {
		// asks for case uuid, and the id is present, then return it
		return c.case_id
	}

	if (c?.observation?.[0]?.sample?.tumor_sample_uuid) {
		// hardcoded logic to return sample submitter id when aliquot id is present
		return await ds.__gdc.aliquot2submitter.get(c.observation[0].sample.tumor_sample_uuid)
	}

	return c.case_id || c.submitter_id
}

function may_add_readdepth(acase, sample) {
	if (!acase.observation) return
	// per Zhenyu, the ensemble workflow unifies the depth from all callers, can display just the first
	const dat = acase.observation[0]
	if (!dat) return
	if (!dat.read_depth) return
	sample.formatK2v = {
		TumorAC: dat.read_depth.t_depth - dat.read_depth.t_alt_count + ',' + dat.read_depth.t_alt_count,
		NormalDepth: dat.read_depth.n_depth
	}
}

/* hardcoded gdc logic! does not rely on any dataset config
 */
function may_add_projectAccess(sample, ds) {
	const projectId = sample['case.project.project_id']
	if (!projectId) return
	sample.caseIsOpenAccess = ds.__gdc.gdcOpenProjects?.has(projectId)
}

/*
for termid2totalsize2

input:
	twLst=[ tw, ... ]
	q{}
		.tid2value={ termid: v}
		.ssm_id_lst=str
		.filterObj={}
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
export async function get_termlst2size(twLst, q, combination, ds) {
	prepTwLst(twLst)

	// convert each term id to {path}
	// id=case.project.project_id, convert to path=project__project_id, for graphql
	// required for the graphql query of termid2size_query()
	const termPaths = []
	for (const tw of twLst) {
		if (!tw.term) continue
		if (tw.term.type != 'categorical') continue // only run for categorical terms
		termPaths.push({
			id: tw.id,
			path: tw.id.replace('case.', '').replace(/\./g, '__'),
			type: tw.term.type
		})
	}

	const query = termid2size_query(termPaths)
	const variables = termid2size_filters(q, ds)

	const response = await got.post(apihostGraphql, {
		headers: getheaders(q),
		body: JSON.stringify({ query, variables })
	})

	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC for cohortTotal for query :' + query + ' and filter: ' + filter
	}

	// levels to traverse in api return
	const keys = ['data', 'explore', 'cases', 'aggregations']

	let h = re[keys[0]]
	for (let i = 1; i < keys.length; i++) {
		h = h[keys[i]]
		if (!h)
			throw `.${keys[i]} missing from data structure of termid2totalsize2 for query :${query} and filter: ${filter}`
	}
	for (const term of termPaths) {
		if (term.type == 'categorical' && !Array.isArray(h[term.path].buckets))
			throw keys.join('.') + ' not array for query :' + query + ' and filter: ' + filter
		if ((term.type == 'integer' || term.type == 'float') && typeof h[term.path].stats != 'object') {
			throw keys.join('.') + ' not object for query :' + query + ' and filter: ' + filter
		}
	}
	// return total size here attached to entires
	const tv2counts = new Map()

	for (const term of termPaths) {
		if (term.type == 'categorical') {
			const buckets = h[term.path].buckets
			const values = []
			for (const bucket of buckets) {
				values.push([bucket.key.replace('.', '__'), bucket.doc_count])
			}
			tv2counts.set(term.id, values)
		} else if (term.type == 'integer' || term.type == 'float') {
			const count = h[term.path].stats.count
			tv2counts.set(term.id, { total: count })
		}
	}

	if (combination) return [tv2counts, combination]
	return tv2counts
}

export function validate_m2csq(ds) {
	const fields = [
		'consequence.transcript.transcript_id',
		'consequence.transcript.consequence_type',
		'consequence.transcript.aa_change'
	]
	ds.queries.snvindel.m2csq.get = async q => {
		// q is client request object
		const response = await got(apihost + '/ssms/' + q.ssm_id + '?fields=' + fields.join(','), {
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

/*
argument is array, each element: {type, id}

for term id of 'case.project.project_id', convert to "project__project_id", for graphql
*/
function termid2size_query(termlst) {
	const lst = []
	for (const term of termlst) {
		if (!term.id) continue
		if ((term.type = 'categorical')) {
			lst.push(term.path + ' {buckets { doc_count, key }}')
		} else if (term.type == 'integer' || term.type == 'float') {
			lst.push(term.path + ' {stats { count }}')
		} else {
			throw 'unknown term type'
		}
	}

	// for all terms from termidlst will be added to single query
	const query = `query termislst2total( $filters: FiltersArgument) {
		explore {
			cases {
				aggregations (filters: $filters, aggregations_filter_themselves: true) {
					${lst.join('\n')}
				}
			}
		}
	}`
	return query
}

function termid2size_filters(p, ds) {
	const f = {
		filters: {
			op: 'and',
			content: [{ op: 'in', content: { field: 'cases.available_variation_data', value: ['ssm'] } }]
		}
	}

	if (p && p.tid2value) {
		for (const termid in p.tid2value) {
			const t = ds.cohort.termdb.q.termjsonByOneid(termid)
			if (t) {
				f.filters.content.push({
					op: 'in',
					content: {
						/*********************
						extremely tricky, no explanation
						**********************
						term id all starts with "case.**"
						but in this graphql query, fields must start with "cases.**"
						*/
						field: termid.replace(/^case\./, 'cases.'),
						value: [p.tid2value[termid]]
					}
				})
			}
		}
	}

	if (p && p.ssm_id_lst) {
		f.filters.content.push({
			op: '=',
			content: { field: 'cases.gene.ssm.ssm_id', value: p.ssm_id_lst.split(',') }
		})
	}

	if (p.filterObj) {
		f.filters.content.push(filter2GDCfilter(p.filterObj))
	}
	return f
}

export function gdcValidate_query_singleSampleMutation(ds, genome) {
	ds.queries.singleSampleMutation.get = async q => {
		/*
		q.sample value can be multiple types:
		- sample submitter id from mds3 tk (if cached, if not cached it is aliquot id)
		- case submitter id from matrix
		- case uuid from bam slicing ui

		NOTE q.case_id is assigned! could be problematic or conflict with typing

		this getter will identify if the value is a case uuid, if so, use; otherwise, convert to case uuid
		for now, always query ssm data by case uuid, but not sample (might change later)

		do the conversion here on the fly so that no need for client to manage these extra, arbitrary ids that's specific for gdc
		beyond sample.sample_id for display
		*/
		if (q.sample.startsWith('___')) {
			// is a case uuid. see comments in block.tk.bam.gdc.js
			const id = q.sample.substring(3)
			if (!id) throw 'expecting uuid after prefix but got blank'
			q.case_id = id
		} else if (ds.__gdc.caseid2submitter.has(q.sample)) {
			// given name is case uuid
			q.case_id = q.sample
		} else {
			q.case_id = ds.__gdc.map2caseid.get(q.sample)
			if (!q.case_id) {
				// not mapped to case id
				// this is possible when the server just started and hasn't finished caching. thus must call this method to map
				q.case_id = await convert2caseId(q.sample)
			}
		}
		return await getSingleSampleMutations(q, ds, genome)
	}
}

async function convert2caseId(n) {
	/*
	convert all below to case.case_id
	- case submitter id (TCGA-FR-A44A)
	- aliquot id (d835e9c7-de84-4acd-ba30-516f396cbd84)
	- sample submitter id (TCGA-B5-A1MR-01A)
	*/
	const response = await got.post(
		'https://api.gdc.cancer.gov/cases', //path.join(apihost, 'cases'), TODO chane to apihost
		{
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, //getheaders({}),
			body: JSON.stringify({
				size: 1,
				fields: 'case_id,submitter_id',
				filters: {
					op: 'or',
					content: [
						{ op: '=', content: { field: 'samples.portions.analytes.aliquots.aliquot_id', value: [n] } },
						{ op: '=', content: { field: 'submitter_id', value: [n] } },
						{ op: '=', content: { field: 'samples.submitter_id', value: [n] } }
					]
				}
			})
		}
	)
	const re = JSON.parse(response.body)
	for (const h of re.data.hits) {
		if (h.case_id) return h.case_id
	}
	throw 'cannot convert to case_id (uuid)'
}

export function gdc_validate_query_singleCell_samples(ds, genome) {
	/*
	q{}
		filter0, optional
	this is a sample getter, so it must return samples and files for each sample
	*/
	ds.queries.singleCell.samples.get = async q => {
		const filters = {
			op: 'and',
			content: [
				{ op: '=', content: { field: 'data_format', value: 'tsv' } },
				{ op: '=', content: { field: 'data_type', value: 'Single Cell Analysis' } },
				{ op: '=', content: { field: 'experimental_strategy', value: 'scRNA-Seq' } }
			]
		}

		if (q.filter0) {
			filters.content.push(q.filter0)
		}

		const body = {
			filters,
			size: 100,
			fields: [
				'id',
				'cases.submitter_id',
				'cases.project.project_id', // for display only
				'cases.samples.sample_type',
				'cases.samples.submitter_id',
				'cases.primary_site',
				'cases.disease_type'
			].join(',')
		}

		const response = await got.post(path.join(apihost, 'files'), {
			headers: getheaders(q),
			body: JSON.stringify(body)
		})

		let re
		try {
			re = JSON.parse(response.body)
		} catch (e) {
			throw 'invalid JSON from ' + api.endpoint
		}
		if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total is not int'
		if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'

		// api return is by file, must convert to file by case
		//console.log(JSON.stringify(re.data.hits[0],null,2))

		const case2files = new Map() // k: case submitter id, v: { project, disease, files:[{fileId, sampletype}]}

		for (const h of re.data.hits) {
			/*
			{
  "id": "d9bc1a51-3d27-4b98-b133-7c17067e7cb5",
  "cases": [
    {
      "primary_site": "Kidney",
      "disease_type": "Adenomas and Adenocarcinomas",
      "project": {
        "project_id": "CPTAC-3"
      },
      "samples": [
        {
          "submitter_id": "C3L-00606-01",
          "sample_type": "Primary Tumor"
        }
      ]
    }
  ]
}
			*/

			if (!h.id) throw 'h.id (fileId) missing'
			const fileId = h.id
			const c = h.cases?.[0]
			if (!c) throw 'h.cases[0] missing'
			const caseSubmitterId = c.submitter_id
			if (!case2files.has(caseSubmitterId)) {
				case2files.set(caseSubmitterId, {
					sample: caseSubmitterId, // use "sample" but not case as generic property, which is typed
					primarySite: c.primary_site,
					diseaseType: c.disease_type,
					projectId: c.project?.project_id,
					files: []
				})
			}
			if (!c.samples?.[0]) throw 'h.cases[0].samples[0] missing'
			case2files.get(caseSubmitterId).files.push({
				fileId,
				sampleName: c.samples[0].submitter_id,
				sampleType: c.samples[0].sample_type
			})
		}
		return {
			samples: [...case2files.values()],
			fields: ds.queries.singleCell.samples.fields,
			columnNames: ds.queries.singleCell.samples.columnNames
		}
	}
}

export function gdc_validate_query_singleCell_data(ds, genome) {
	/*
	q{}
		sample: value is the file Id, one that's found by gdc_validate_query_singleCell_samples
	*/
	ds.queries.singleCell.data.get = async q => {
		const re = await got(path.join(apihost, 'data', q.sample), { method: 'GET', headers: getheaders(q) })
		const lines = re.body.trim().split('\n')

		// first line is header
		// cell_barcode	read_count	gene_count	seurat_cluster	UMAP_1	UMAP_2	UMAP3d_1	UMAP3d_2	UMAP3d_3	tSNE_1	tSNE_2	tSNE3d_1	tSNE3d_2	tSNE3d_3	PC_1	PC_2	PC_3	PC_4	PC_5	PC_6	PC_7	PC_8	PC_9	PC_10
		// this tsv file has coord for 3 maps
		const plotUmap = { name: 'UMAP', cells: [] },
			plotTsne = { name: 'TSNE', cells: [] },
			plotPca = { name: 'PCA', cells: [] },
			seuratClusterTerm = { id: 'cluster', name: 'Seurat cluster', type: 'categorical', values: {} },
			tid2cellvalue = { [seuratClusterTerm.id]: {} } // corresponds to above term id

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i]
			const l = line.split('\t')
			const cellId = l[0]
			if (!cellId) throw 'cellId missing from a line: ' + line
			const clusterId = l[3]
			if (!clusterId) throw 'seuratCluster missing from a line'
			seuratClusterTerm.values[clusterId] = { label: 'Cluster ' + clusterId }
			tid2cellvalue[seuratClusterTerm.id][cellId] = `Cluster ${clusterId}`

			const umap1 = Number(l[4]),
				umap2 = Number(l[5]),
				// skip umap 3d
				tsne1 = Number(l[9]),
				tsne2 = Number(l[10]),
				// skip tsne 3d
				pc1 = Number(l[14]),
				pc2 = Number(l[15])
			if (Number.isNaN(umap1)) throw 'umap1 is nan'
			if (Number.isNaN(umap2)) throw 'umap2 is nan'
			if (Number.isNaN(tsne1)) throw 'tsne1 is nan'
			if (Number.isNaN(tsne2)) throw 'tsne2 is nan'
			if (Number.isNaN(pc1)) throw 'pc1 is nan'
			if (Number.isNaN(pc2)) throw 'pc2 is nan'
			plotUmap.cells.push({ cellId, x: umap1, y: umap2 })
			plotTsne.cells.push({ cellId, x: tsne1, y: tsne2 })
			plotPca.cells.push({ cellId, x: pc1, y: pc2 })
		}
		return {
			plots: [plotPca, plotTsne, plotUmap],
			terms: [seuratClusterTerm],
			tid2cellvalue
		}
	}
}

async function getSingleSampleMutations(query, ds, genome) {
	// query = {case_id}

	// object is returned, can add any other attr e.g. total number of events exceeding view limit
	const result = {
		mlst: [], // collect events of all types into one array, identified by dt
		dt2total: [] // for any dt, if total number exceeds view limit, report here
	}

	// ssm
	{
		const response = await got.post(path.join(apihost, isoform2ssm_query1_getvariant.endpoint), {
			headers: getheaders(query),
			body: JSON.stringify({
				size: 10000, // ssm max!
				fields: isoform2ssm_query1_getvariant.fields.join(','),
				filters: isoform2ssm_query1_getvariant.filters(query)
			})
		})
		const re = JSON.parse(response.body)
		if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total not integer'
		if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'

		if (re.data.hits.length < re.data.pagination.total) {
			// total exceeds view limit, let client know
			result.dt2total.push({ dt: 1, total: re.data.pagination.total }) // 1=snvindel
		}

		for (const hit of re.data.hits) {
			// for each hit, create an element
			// from list of consequences, find one from canonical isoform

			let c = hit.consequence.find(i => i.transcript.is_canonical == true)
			if (!c) {
				// no consequence match with given isoform, just use the first one
				c = hit.consequence[0]
			}
			// no aa change for utr variants
			const aa = c.transcript.aa_change || c.transcript.consequence_type
			const [dt, mclass, rank] = common.vepinfo(c.transcript.consequence_type)
			result.mlst.push({
				dt: common.dtsnvindel,
				mname: aa,
				class: mclass,
				gene: c.transcript.gene.symbol,
				chr: hit.chromosome,
				pos: hit.start_position,
				ref: hit.reference_allele,
				alt: hit.tumor_allele
			})
		}
	}

	{
		// cnv TODO total
		const tmp = await getCnvFusion4oneCase(query)
		result.mlst.push(...tmp)
	}

	return result
}

/*
REST: get list of ssm with consequence, no case info and occurrence
isoform2ssm_query1_getvariant and isoform2ssm_query2_getcase are the "tandem REST api"
yields list of ssm, each with .samples[{sample_id}]
can use .samples[] to derive .occurrence for each ssm, and overal number of unique samples

in comparison to "protein_mutations" graphql query
*/
const isoform2ssm_query1_getvariant = {
	endpoint: '/ssms',
	size: 100000,
	fields: [
		'ssm_id',
		'chromosome',
		'start_position',
		'reference_allele',
		'tumor_allele',
		'consequence.transcript.transcript_id',
		'consequence.transcript.consequence_type',
		'consequence.transcript.aa_change',
		// gene symbol is not required for mds3 tk, but is used in gdc bam slicing ui
		'consequence.transcript.gene.symbol',
		'consequence.transcript.is_canonical'
	],

	/*
	p={}
		.isoform
			isoform is provided for mds3 tk loading using isoform,
		.case_id
			case_id is provided for loading ssm from a case in gdc bam slicing ui 
		.set_id, obsolete
		.filter0{}
		.filterObj{}
	*/
	filters: p => {
		const f = {
			op: 'and',
			content: []
		}
		if (p.isoform) {
			if (typeof p.isoform != 'string') throw '.isoform value not string'
			f.content.push({
				op: '=',
				content: {
					field: 'consequence.transcript.transcript_id',
					value: [p.isoform]
				}
			})
		}
		if (p.case_id) {
			if (typeof p.case_id != 'string') throw '.case_id value not string'
			f.content.push({
				op: '=',
				content: {
					field: 'cases.case_id',
					value: [p.case_id]
				}
			})
		}
		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		if (p.filterObj) {
			f.content.push(filter2GDCfilter(p.filterObj))
		}
		return f
	}
}

// REST: get case details for each ssm, no variant-level info
const isoform2ssm_query2_getcase = {
	endpoint: '/ssm_occurrences',
	size: 100000,
	fields: [
		'ssm.ssm_id',

		/* case.case_id is not needed for mds3
		but is needed for matrix sample selection where the columns are case but not sample
		see __matrix_case_id__
		*/
		'case.case_id',

		'case.submitter_id', // can be used to make sample url link
		'case.observation.sample.tumor_sample_uuid' // gives aliquot id and convert to submitter id for display
	],
	filters: (p, ds) => {
		/* p:{}
		.isoform = one isoform accession
		.isoforms=[] array of isoforms
		.ssm_id_lst = comma-joined string ids
		.rglst=[]
		.set_id=str
		.tid2value={}
		.filter0
		.filterObj
		*/
		const f = { op: 'and', content: [] }
		if (p.ssm_id_lst) {
			if (typeof p.ssm_id_lst != 'string') throw 'ssm_id_lst not string'
			f.content.push({
				op: '=',
				content: {
					field: 'ssm.ssm_id',
					value: p.ssm_id_lst.split(',')
				}
			})
		} else if (p.isoform) {
			f.content.push({
				op: '=',
				content: {
					field: 'ssms.consequence.transcript.transcript_id',
					value: [p.isoform]
				}
			})
		} else if (p.isoforms) {
			if (!Array.isArray(p.isoforms)) throw '.isoforms[] not array'
			f.content.push({
				op: 'in',
				content: { field: 'ssms.consequence.transcript.transcript_id', value: p.isoforms }
			})
		} else {
			throw '.ssm_id_lst, .isoform, .isoforms are all missing'
		}

		if (p.rglst) {
			/* to filter out variants that are out of view range (e.g. zoomed in on protein)
			necessary when zooming in

			!!!hardcoded to only one region!!!

			*/
			f.content.push({
				op: '>=',
				content: { field: 'ssms.start_position', value: p.rglst[0].start }
			})
			f.content.push({
				op: '<=',
				content: { field: 'ssms.start_position', value: p.rglst[0].stop }
			})
		}

		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.content.push(p.filter0)
		}
		if (p.filterObj) {
			f.content.push(filter2GDCfilter(p.filterObj))
		}
		if (p.tid2value) {
			for (const termid in p.tid2value) {
				const t = ds.cohort.termdb.q.termjsonByOneid(termid)
				if (!t) continue
				if (t.type == 'categorical') {
					f.content.push({
						op: 'in',
						content: { field: termid, value: [p.tid2value[termid]] }
					})
				} else if (t.type == 'integer') {
					for (const val of p.tid2value[termid]) {
						f.content.push({
							op: val.op,
							content: { field: termid, value: val.range }
						})
					}
				}
			}
		}
		return f
	}
}

/*
GRAPHQL  query ssm by range

TODO if can be done in protein_mutations
query list of variants by genomic range (of a gene/transcript)
does not include info on individual tumors
the "filter" name is hardcoded and used in app.js
*/
const query_range2ssm = `query range2variants($filters: FiltersArgument) {
  explore {
    ssms {
      hits(first: 100000, filters: $filters) {
        total
        edges {
          node {
            ssm_id
            chromosome
            start_position
            end_position
            genomic_dna_change
			reference_allele
            tumor_allele
            occurrence {
              hits {
                total
				edges {
				  node {
				    case {
					  case_id
					}
				  }
				}
              }
            }
			consequence{
              hits{
                total
                edges{
                  node{
                    transcript{
                      transcript_id
					  aa_change
					  consequence_type
					  is_canonical
					  gene{
					  	symbol
					  }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`
function variables_range2ssm(p) {
	// p:{}
	// .rglst[{chr/start/stop}]
	// .set_id
	if (!p.rglst) throw '.rglst missing'
	const r = p.rglst[0]
	if (!r) throw '.rglst[0] missing'
	if (typeof r.chr != 'string') throw '.rglst[0].chr not string'
	if (!Number.isInteger(r.start)) throw '.rglst[0].start not integer'
	if (!Number.isInteger(r.stop)) throw '.rglst[0].stop not integer'
	const f = {
		filters: {
			op: 'and',
			content: [
				{ op: '=', content: { field: 'chromosome', value: [r.chr] } },
				{ op: '>=', content: { field: 'start_position', value: [r.start] } },
				{ op: '<=', content: { field: 'end_position', value: [r.stop] } }
			]
		}
	}
	if (p.set_id) {
		if (typeof p.set_id != 'string') throw '.set_id value not string'
		f.filters.content.push({
			op: 'in',
			content: { field: 'cases.case_id', value: [p.set_id] }
		})
	}
	if (p.filter0) {
		f.filters.content.push(p.filter0)
	}
	if (p.filterObj) {
		f.filters.content.push(filter2GDCfilter(p.filterObj))
	}
	return f
}
