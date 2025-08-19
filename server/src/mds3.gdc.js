import * as common from '#shared/common.js'
import { joinUrl, memFetch } from '#shared/index.js'
import { compute_bins } from '#shared/termdb.bins.js'
import { getBin } from '#shared/terms.js'
import ky from 'ky'
import nodeFetch from 'node-fetch'
import { combineSamplesById, guessSsmid } from './mds3.variant2samples.js'
import { filter2GDCfilter } from './mds3.gdc.filter.js'
import { write_tmpfile } from './utils.js'
import { mayLog } from './helpers'
import serverconfig from './serverconfig.js'

const maxCase4geneExpCluster = 1000 // max number of cases allowed for gene exp clustering app; okay just to hardcode in code and not to define in ds
const maxGene4geneExpCluster = 2000 // max #genes allowed for gene exp cluster

/*
GDC API

****************** EXPORTED
validate_variant2sample
validate_query_snvindel_byrange
validate_query_snvindel_byisoform
	snvindel_byisoform
	snvindel_addclass
gdcValidate_query_singleSampleMutation
	getSingleSampleMutations
		getCnvFusion4oneCase
validate_query_geneCnv // not in use! replaced by Cnv2
validate_query_geneCnv2
	filter2GDCfilter
gdc_validate_query_geneExpression
	geneExpression_getGenes
	getExpressionData
		getCases4expclustering
gdc_validate_query_singleCell_data
gdc_validate_query_singleCell_DEgenes
	getSinglecellDEfile
	getSinglecellDEgenes
querySamples_gdcapi
	querySamplesWithCnv
	querySamplesTwlstForGeneexpclustering
	querySamplesTwlstNotForGeneexpclustering
		querySamplesTwlstNotForGeneexpclustering_withGenomicFilter
		querySamplesTwlstNotForGeneexpclustering_noGenomicFilter
	querySamplesSurvival
		addSsmIsoformRegion4filter
	flattenCaseByFields
		mayApplyGroupsetting
	may_add_readdepth
	may_add_projectAccess
	mayApplyBinning
get_termlst2size
validate_m2csq
validate_ssm2canonicalisoform


**************** internal
mayMapRefseq2ensembl
isoform2ssm_query1_getvariant{}
isoform2ssm_query2_getcase{}
*/

/*
	!!! NOTE on ky usage: !!!
	- the default is 10 seconds before a timeout error gets generated
	
	- must set `timeout: false` in order to let the GDC API trigger the timeout error, instead
	  of hardcoding the 10 second default or another timeout value
	
	- the timeout issues are encountered more frequently when the server is busy or
	  where the server is slower, such as in qa-int
*/

export function convertSampleId_addGetter(tdb, ds) {
	tdb.convertSampleId.get = inputs => {
		const old2new = {}
		for (const old of inputs) {
			old2new[old] = ds.__gdc.map2caseid.get(old) || old
		}
		return old2new
	}
}

export async function validate_ssm2canonicalisoform(api, getHostHeaders) {
	const fields = ['consequence.transcript.is_canonical', 'consequence.transcript.transcript_id']
	api.get = async q => {
		// q is client request object
		if (!q.ssm_id) throw '.ssm_id missing'
		const { host, headers } = getHostHeaders(q)
		const re = await ky(
			joinUrl(
				joinUrl(host.rest, 'ssms'),
				q.ssm_id + '?fields=consequence.transcript.is_canonical,consequence.transcript.transcript_id'
			),
			{ timeout: false, headers }
		).json()
		if (!Array.isArray(re?.data?.consequence)) throw '.data.consequence not array'
		const canonical = re.data.consequence.find(i => i.transcript.is_canonical)
		return canonical ? canonical.transcript.transcript_id : re.data.consequence[0].transcript.transcript_id
	}
}

export function validate_variant2sample(a) {
	if (typeof a.filters != 'function') throw '.variant2samples.gdcapi.filters() not a function'
}

export function validate_query_snvindel_byrange(ds) {
	ds.queries.snvindel.byrange.get = async q => {
		// no longer uses graphql query; byisoform.get() now works to pull ssm by rglst[]
		return await ds.queries.snvindel.byisoform.get(q)
	}
}

/*
q{}
.filter0
	optional, gdc hidden filter
.filter
	optional, pp filter
.terms[ {gene} ]
	required. list of genes
.forClusteringAnalysis:true
	optional. see explanation in routes/termdb.cluster.ts

compose the gene-by-sample fpkm matrix
genes are given from query parameter, and are double-checked by gene_selection API
samples are determined based on filter/filter0:
	all cases based on current filter are retrieved
	then, up to 1000 of those with exp data are kept
*/
export function gdc_validate_query_geneExpression(ds, genome) {
	ds.queries.geneExpression.get = async q => {
		mayLog('Start gdc gene exp query...')

		if (!Array.isArray(q.terms)) throw 'q.terms[] not array'

		// getter returns this data structure
		const term2sample2value = new Map() // k: gene symbol, v: { <case submitter id>: value }

		let t2 = new Date()

		let cases4clustering
		if (q.forClusteringAnalysis) {
			cases4clustering = await getCases4expclustering(q, ds)
			const t = new Date()
			mayLog(cases4clustering.length, 'cases with exp data 4 clustering:', t - t2, 'ms')
			t2 = t
		}

		// 3/25/2025 gdc backend doesn't index gene exp for sex chr genes. thus prevent these genes from showing up in app
		const skippedSexChrGenes = [],
			acceptedGenes = []
		for (const t of q.terms) {
			if (!t.gene) throw '.gene missing'
			const tmp = genome.genedb.getjsonbyname.all(t.gene)
			let isSex = false
			for (const i of tmp) {
				const g = JSON.parse(i.genemodel)
				if (g.chr == 'chrX' || g.chr == 'chrY') {
					skippedSexChrGenes.push(t.gene)
					isSex = true
					break
				}
			}
			if (!isSex) acceptedGenes.push(t)
		}
		//console.log(skippedSexChrGenes, new Date()-t2)
		// db query and json parse for every gene seems to be fast, at 400ms for 1000 genes. if is performance concern, should add chr column to genes table

		const [ensgLst, ensg2symbol] = await geneExpression_getGenes(acceptedGenes, cases4clustering, genome, ds, q)

		if (ensgLst.length == 0) return { term2sample2value, byTermId: {} } // no valid genes

		const t3 = new Date()
		mayLog(ensgLst.length, 'out of', q.terms.length, 'genes selected for exp:', t3 - t2, 'ms')

		const byTermId = {}
		for (const g of ensgLst) {
			const geneSymbol = ensg2symbol.get(g)
			byTermId[geneSymbol] = { gencodeId: g } // store ensemble gene ID in byTermId
			term2sample2value.set(geneSymbol, new Map())
		}

		const bySampleId = await getExpressionData(q, ensgLst, cases4clustering, ensg2symbol, term2sample2value, ds)
		// returns mapping from uuid to submitter id; since uuid is used in term2sample2value, but need to display submitter id on ui

		const t4 = new Date()
		mayLog('gene-case matrix built,', Object.keys(bySampleId).length, 'cases,', t4 - t3, 'ms')

		return { term2sample2value, byTermId, bySampleId, skippedSexChrGenes }
	}
}

/*
genes: []
	list of gene coming from client query
genome:
	for converting symbol to ensg
*/
async function geneExpression_getGenes(genes, cases4clustering, genome, ds, q) {
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
		if (ensgLst.length > maxGene4geneExpCluster) break // do not allow to exceed max genes
	}

	// TODO: detect when the list has already been screened per Zhenyu's instructions below
	return [ensgLst, ensg2symbol]

	if (!q.forClusteringAnalysis) {
		// the request is not for clustering analysis. do not perform gene selection step to speed up and use given genes as-is
		return [ensgLst, ensg2symbol]
	}

	// per Zhenyu 9/26/23, user-elected genes must be screened so those with 0 value cross all samples will be left out
	// so that valid SD-transformed value can be returned from /values api
	// https://docs.gdc.cancer.gov/Encyclopedia/pages/FPKM-UQ/
	try {
		const { host, headers } = ds.getHostHeaders(q)

		// test code to use native fetch
		// const _re = await fetch(`${host.rest}/gene_expression/gene_selection`, {
		// 		headers,
		// 		method: 'POST',
		// 		//timeout: false, // instead of 10 second default
		// 		body: JSON.stringify({
		// 			case_ids: cases4clustering,
		// 			gene_ids: ensgLst,
		// 			selection_size: ensgLst.length,
		// 			min_median_log2_uqfpkm: 0.01
		// 		})
		// 	}).then(r => r.json()).catch(e => {throw e})

		const re = await nodeFetch(`${host.rest}/gene_expression/gene_selection`, {
			method: 'POST',
			headers,
			timeout: false, // instead of 10 second default
			body: JSON.stringify({
				case_ids: cases4clustering,
				gene_ids: ensgLst,
				selection_size: ensgLst.length,
				min_median_log2_uqfpkm: 0.01
			})
		}).then(r => r.json())

		if (!Array.isArray(re.gene_selection)) throw 're.gene_selection[] not array'
		const ensgLst2 = []
		for (const i of re.gene_selection) {
			if (typeof i.gene_id != 'string') throw '.gene_id missing from one of re.gene_selection[]'
			ensgLst2.push(i.gene_id)
		}
		// some genes from ensgLst may be left out ensgLst2, e.g. HOXA1 from test example;
		// later can comment above code to double-check as /values is able to return data for HOXA1 so why is it left out here?
		return [ensgLst2, ensg2symbol]
	} catch (e) {
		console.log(252, e)
		throw e
	}
}

// make a gdc filter based on pp client request arguments
export function makeFilter(q) {
	const f = { op: 'and', content: [] }
	if (q.filter0) {
		f.content.push(q.filter0)
	}
	if (q.filterObj) {
		const g = filter2GDCfilter(q.filterObj)
		if (g) f.content.push(g)
	}
	if (q.filter) {
		const g = filter2GDCfilter(q.filter)
		if (g) f.content.push(g)
	}
	return f
}

async function getExpressionData(q, gene_ids, cases4clustering, ensg2symbol, term2sample2value, ds) {
	const arg = {
		gene_ids,
		format: 'tsv',
		tsv_units: 'uqfpkm'
		//tsv_units: 'median_centered_log2_uqfpkm'
	}

	if (q.forClusteringAnalysis) {
		/* is for clustering analysis. must retrieve list of cases passing filter and with exp data, and limit by max
		otherwise the app will overload
		*/
		arg.case_ids = cases4clustering
	} else {
		// not for clustering analysis. do not limit by cases, so that e.g. a gene exp row will show all values in oncomatrix
		const f = makeCasesFilter(q)
		if (f) arg.case_filters = { op: 'and', content: f }
	}

	const { host, headers } = ds.getHostHeaders(q)

	// NOTES:
	// - For now, will use nodeFetch where simultaneous long-running requests can cause terminated or socket hangup errors.
	// - In Node 20, it looks like undici (which is used by experimental native fetch in Node 20) may not be performing garbage cleanup
	// and freeing-up resources like sockets. This issue seems to be fixed in Node 22, which will be active in October 2024.
	// - In the meantime, replacing ky with node-fetch may be a good enough fix for edge cases of very large, long-running requests.
	//
	// --- keeping previous request code below for reference ---
	//
	// const re = await ky.post(`${host.rest}/gene_expression/values`, { timeout: false, headers, json: arg }).text()
	// const lines = re.trim().split('\n')
	//
	// const response = await got.post(`${host.rest}/gene_expression/values`, {
	// 	headers,
	// 	body: JSON.stringify(arg)
	// })
	// if (typeof response.body != 'string') throw 'response.body is not tsv text'
	// const lines = response.body.trim().split('\n')
	//

	const re = await nodeFetch(`${host.rest}/gene_expression/values`, {
		method: 'POST',
		timeout: false,
		headers,
		body: JSON.stringify(arg)
	}).then(r => r.text())
	if (typeof re != 'string') throw 'response.body is not tsv text'
	const lines = re.trim().split('\n')

	if (lines.length <= 1) throw 'less than 1 line from tsv response.body'

	// header line:
	// gene \t case1 \t case 2 \t ...
	const caseHeader = lines[0].split('\t').slice(1) // order of case uuid in tsv header

	const bySampleId = {}
	for (const c of caseHeader) {
		const s = ds.__gdc.caseid2submitter.get(c)
		if (!s) throw 'case submitter id unknown for a uuid'
		bySampleId[c] = { label: s }
	}

	let geneExprFilter
	if (q.filter) {
		geneExprFilter = structuredClone(q.filter)
		geneExprFilter.lst = q.filter.lst.filter(item => item.tvs.term.type == 'geneExpression')
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
			const pass = mayFilterByExpression(geneExprFilter, v)
			if (pass) term2sample2value.get(symbol)[sample] = v
		}
	}
	return bySampleId
}

// determine if gene expression value passes gene expression filter
function mayFilterByExpression(filter, value) {
	if (!filter?.lst.length) return true
	const pass =
		filter.join == 'and' ? filter.lst.every(item => inItem(item, value)) : filter.lst.some(item => inItem(item, value))
	return pass
	function inItem(item, value) {
		if (item.type == 'tvslst') return mayFilterByExpression(item, value)
		const tvs = item.tvs
		if (tvs.term.type != 'geneExpression') throw 'unexpected term.type'
		const filterBin = getBin(tvs.ranges, value)
		const inRange = filterBin != -1
		const inItem = tvs.isnot ? !inRange : inRange
		return inItem
	}
}

// should only use for gene exp clustering
async function getCases4expclustering(q, ds) {
	const json = {
		fields: 'case_id',
		case_filters: makeFilter(q),
		// hiercluster app will limit max number of allowed cases by hardcoded value. times 10 is a generous guess to allow for cases without gene exp data, as is from current cohort
		size: maxCase4geneExpCluster * 10
	}
	try {
		const { host, headers } = ds.getHostHeaders(q)
		const re = await ky.post(joinUrl(host.rest, 'cases'), { timeout: false, headers, json }).json()
		if (!Array.isArray(re.data.hits)) throw 're.data.hits[] not array'
		const lst = []
		for (const h of re.data.hits) {
			if (h.id && ds.__gdc.casesWithExpData.has(h.id)) {
				lst.push(h.id)
				if (lst.length == maxCase4geneExpCluster) {
					// to not to overload clustering app, stop collecting when max number of cases is reached
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

/* tandem rest api query
1. variant and csq
2. cases
*/
export function validate_query_snvindel_byisoform(ds) {
	/*

	getter opts{}

	.isoform:str
		required

	.gdcUseCaseuuid:true
		(gdc specific parameter)
		determines what kind of value is "sample_id" property of every sample:
		if true, is case uuid, to count data points by cases for getData()
		else, is aliquot uuid, to count data by samples

	.hiddenmclass = set
	.filter0
		read-only gdc cohort filter, pass to gdc api as-is
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
				const s = {}
				if (opts.gdcUseCaseuuid) {
					s.sample_id = c.case_id // case uuid
					if (!s.sample_id) throw 'gdcUseCaseuuid=true but c.case_id undefined'
				} else {
					s.sample_id = c.observation?.[0]?.sample?.tumor_sample_uuid
					if (!s.sample_id) throw 'gdcUseCaseuuid=false but c.observation?.[0]?.sample?.tumor_sample_uuid undefined'
				}
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
		const { host, headers } = ds.getHostHeaders(opts)
		const re = await ky
			.post(joinUrl(host.rest, 'cnvs'), {
				timeout: false,
				headers,
				json: {
					size: 100000,
					fields: getFields(opts),
					filters: getFilter(opts)
				}
			})
			.json()
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
			const g = filter2GDCfilter(typeof p.filterObj == 'string' ? JSON.parse(p.filterObj) : p.filterObj)
			if (g) filters.content.push(g)
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

/*
get a text file with genome-wide cnv segment data from one case, and read the file content
opts{}
	.case_id=str
*/
async function getCnvFusion4oneCase(opts, ds) {
	const fields = [
		'cases.samples.tissue_type', // may not be needed
		'data_type',
		'file_id',
		'file_name',
		'data_format',
		'experimental_strategy',
		'analysis.workflow_type'
	]
	const { host, headers } = ds.getHostHeaders(opts)
	const re = await ky
		.post(joinUrl(host.rest, 'files'), {
			timeout: false,
			headers,
			json: {
				size: 10000,
				fields: fields.join(','),
				filters: getFilter(opts)
			}
		})
		.json()
	if (!Array.isArray(re.data.hits)) throw 're.data.hits[] not array'

	// collect usable cnv/fusion files, each: {fid, name, mlst[]}, will be returned to client as-is
	// this supports multiple files for the same data type
	const cnvfiles = [],
		fusionfiles = []

	for (const h of re.data.hits) {
		if (h.data_format == 'BEDPE') {
			if (h.experimental_strategy != 'RNA-Seq') continue
			if (h.analysis?.workflow_type != 'Arriba') continue
			if (h.data_type != 'Transcript Fusion') continue
			try {
				fusionfiles.push({
					nameHtml: `<a href=https://portal.gdc.cancer.gov/files/${h.file_id} target=_blank>${h.file_name}</a>`,
					mlst: await loadArribaFile(host, headers, h.file_id)
				})
			} catch (e) {
				// no permission to fusion file
			}
			continue
		}

		if (h.data_format == 'TXT') {
			if (h.experimental_strategy == 'Genotyping Array') {
				if (h.data_type == 'Masked Copy Number Segment' || h.data_type == 'Allele-specific Copy Number Segment') {
					cnvfiles.push({
						nameHtml: `<a href=https://portal.gdc.cancer.gov/files/${h.file_id} target=_blank>${h.file_name}</a>`,
						mlst: await loadCnvFile(host, h.file_id)
					})
				}
				continue
			}
			if (h.experimental_strategy == 'WGS') {
				// is wgs, no need to check tissue_type, the file is usable
				if (!h.file_id) continue
				if (h.data_type != 'Allele-specific Copy Number Segment') continue
				cnvfiles.push({
					nameHtml: `<a href=https://portal.gdc.cancer.gov/files/${h.file_id} target=_blank>${h.file_name}</a>`,
					wgsTempFlag: true,
					mlst: await loadCnvFile(host, h.file_id)
				})
				continue
			}
		}
	}
	const dt2files = {}
	if (fusionfiles.length) dt2files[common.dtfusionrna] = fusionfiles
	if (cnvfiles.length) dt2files[common.dtcnv] = cnvfiles
	return dt2files

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
							'Allele-specific Copy Number Segment', // for wgs we want this type of file
							'Transcript Fusion' // fusion
						]
					}
				}
			]
		}
		return filters
	}
}

/*
cnv files come in different formats. detect by header line
*/
async function loadCnvFile(host, fid) {
	const re = await ky(joinUrl(host.rest, 'data', fid), { timeout: false }).text()
	const lines = re.trim().split('\n')
	const mlst = []
	switch (lines[0]) {
		case 'GDC_Aliquot_ID\tChromosome\tStart\tEnd\tNum_Probes\tSegment_Mean':
		case 'GDC_Aliquot\tChromosome\tStart\tEnd\tNum_Probes\tSegment_Mean':
			for (let i = 1; i < lines.length; i++) {
				const l = lines[i].split('\t')
				if (l.length != 6) throw 'cnv file line not 6 columns: ' + l
				if (!l[1]) throw 'cnv file line missing chr: ' + l
				let chr = l[1]
				if (!l[1].startsWith('chr')) chr = 'chr' + l[1] // snp file chr doesn't start with "chr"
				const cnv = {
					dt: common.dtcnv,
					chr,
					start: Number(l[2]),
					stop: Number(l[3]),
					value: Number(l[5])
				}
				if (Number.isNaN(cnv.start) || Number.isNaN(cnv.stop) || Number.isNaN(cnv.value))
					throw 'start/stop/value not a number in cnv file: ' + l
				mlst.push(cnv)
			}
			break
		case 'GDC_Aliquot\tChromosome\tStart\tEnd\tCopy_Number\tMajor_Copy_Number\tMinor_Copy_Number':
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
				mlst.push(cnv)

				if (total > 0) {
					// total copy number is >0, detect loh
					if (minor == 0 && major > 0) {
						// zhenyu 4/25/23 detect strict one allele loss
						mlst.push({
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
			break
		default:
			throw 'unknown CNV file header line: ' + lines[0]
	}
	return mlst
}

// must use headers to access controlled fusion file
async function loadArribaFile(host, headers, fid) {
	const re = await ky(joinUrl(host.rest, 'data', fid), { headers, timeout: false }).text()
	const lines = re.split('\n')
	// first line is header
	// #chrom1 start1  end1    chrom2  start2  end2    name    score   strand1 strand2 strand1(gene/fusion)    strand2(gene/fusion)    site1   site2   type    direction1      direction2      split_reads1    split_reads2    discordant_mates        coverage1       coverage2       closest_genomic_breakpoint1     closest_genomic_breakpoint2     filters fusion_transcript       reading_frame   peptide_sequence        read_identifiers
	const mlst = []
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
		mlst.push(f)
	}
	return mlst
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

async function snvindel_byisoform(opts, ds) {
	// query ssm by either isoform or rglst
	const query1 = isoform2ssm_query1_getvariant,
		query2 = isoform2ssm_query2_getcase

	const { host, headers } = ds.getHostHeaders(opts)

	// must use POST as filter can be too long for GET
	const p1 = ky
		.post(joinUrl(host.rest, query1.endpoint), {
			timeout: false,
			headers,
			json: Object.assign({ size: query1.size, fields: query1.fields.join(',') }, query1.filters(opts))
		})
		.json()
	const p2 = ky
		.post(joinUrl(host.rest, query2.endpoint), {
			timeout: false,
			headers,
			json: Object.assign({ size: query2.size, fields: query2.fields.join(',') }, query2.filters(opts, ds))
		})
		.json()

	const starttime = Date.now()

	const [re_ssms, re_cases] = await Promise.all([p1, p2])

	mayLog('gdc snvindel tandem queries', Date.now() - starttime)

	if (!Array.isArray(re_ssms?.data?.hits) || !Array.isArray(re_cases?.data?.hits))
		throw 'ssm tandem query not returning data.hits[]'

	// hash ssm by ssm_id
	const id2ssm = new Map() // key: ssm_id, value: ssm {}
	for (const h of re_ssms.data.hits) {
		if (!h.ssm_id) throw 'ssm_id missing from a ssms hit'
		if (!h.consequence) throw '.consequence[] missing from a ssm'
		if (!Number.isInteger(h.start_position)) throw 'hit.start_position is not integer'
		h.csqcount = h.consequence.length

		let c
		if (opts.isoform) {
			c = h.consequence.find(i => i.transcript.transcript_id == opts.isoform)
		} else {
			c = h.consequence.find(i => i.transcript.is_canonical)
		}
		h.consequence = c || h.consequence[0]
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
  id: 'case.project.project_id',
  name: 'Project id',
  groupsetting: { inuse: false },
  isleaf: true,
  type: 'categorical',
  parent_id: 'case.project',
  included_types: [ 'categorical' ],
  child_types: []
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

args:
- sample: object to assign new pp term id key-value pairs to
- caseObj: object returned by gdc api
- tw: {term:{id}}
- startIdx:
	start with caseObj as "current" root
	default is 1 as fields[0]='case', and caseObj is already the "case", so start from i=1
	if caseObj data is returned by /cases/, use 0

todo unit test
*/
function flattenCaseByFields(sample, caseObj, tw, startIdx = 1) {
	const fields = tw.term.id.split('.')

	query(caseObj, startIdx)

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
	if (tw.q?.type == 'custom-groupset') {
		if (!Array.isArray(tw.q?.customset?.groups)) throw 'q.customset.groups is not array'
		for (const group of tw.q.customset.groups) {
			if (!Array.isArray(group.values)) throw 'group.values[] not array from tw.q.customset.groups'
			if (group.values.findIndex(i => i.key == v) != -1) {
				// value "v" is in this group
				return group.name
			}
		}
	}
	if (tw.q?.type == 'predefined-groupset') {
		if (!Number.isInteger(tw.q.predefined_groupset_idx)) throw 'q.predefined_groupset_idx is not an integer'
		if (!tw.term.groupsetting?.lst?.length) throw 'term.groupsetting.lst is empty'
		for (const group of tw.term.groupsetting.lst[tw.q.predefined_groupset_idx]) {
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
					const binIdx = getBin(bins, v)
					const bin = bins[binIdx]
					if (!bin?.label) throw 'bin.label not defined'
					s[tw.term.id] = { key: bin.label, value: v }
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
	.gdcUseCaseuuid = true, see byisoform.get()

twLst[]
	array of termwrapper objects, for sample-annotating terms (not geneVariant)
	tw.term.id is appended to "&fields="
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
		with additional key-value pairs for tw.term.id and annotation value
}
*/

export async function querySamples_gdcapi(q, twLst, ds, geneTwLst) {
	// step 1: separate survival vs non-survival terms
	// survival terms requires different querying method. separate it from other dictionary terms

	const survivalTwLst = [], // survival terms
		dictTwLst = [] // non-survival dict terms
	for (const tw of twLst) {
		if (tw.term.type == 'survival') {
			survivalTwLst.push(tw)
		} else {
			const t = ds.cohort.termdb.q.termjsonByOneid(tw.term.id)
			if (t) dictTwLst.push({ term: t, q: tw.q })
		}
	}

	let byTermId = {},
		samples = [] // returned data structures. both survival and other dict term data will be combined for return

	// step 2: querying dict term data

	if (dictTwLst.length) {
		if (q.hardcodeCnvOnly) {
			// user interactions from cnv tool will have this flag in request;
			// this allows accessing sample details for cases with cnv
			;[byTermId, samples] = await querySamplesWithCnv(q, dictTwLst, ds)
		} else if (q.isHierCluster) {
			// running gene exp clustering, must only restrict to cases with exp data,
			// but not by mutated cases anymore, thus geneTwLst should not be used (and not supplied)
			;[byTermId, samples] = await querySamplesTwlstForGeneexpclustering(q, dictTwLst, ds)
		} else {
			// not in gene exp clustering mode
			;[byTermId, samples] = await querySamplesTwlstNotForGeneexpclustering(q, dictTwLst, ds, geneTwLst)
		}
	}

	// step 3: querying survival data

	if (survivalTwLst.length) {
		await querySamplesSurvival(q, survivalTwLst, ds, samples, geneTwLst)
	}

	return { byTermId, samples }
}

async function querySamplesWithCnv(q, dictTwLst, ds) {
	// create q2 that's submitted to cnv getter
	const q2 = {
		dictTwLst,
		cnvMaxLength: q.cnvMaxLength,
		hiddenmclass: q.hiddenmclass
	}
	if (q.rglst) {
		// is from sample summary via leftlabel
		q2.rglst = q.rglst
	} else if (q.ssm_id_lst) {
		// is from clicking a cnv seg. ssm_id_lst value must be a single id of a cnv
		const t = guessSsmid(q.ssm_id_lst)
		q2.rglst = [
			{
				chr: t.l[0],
				start: t.l[1],
				stop: t.l[2]
			}
		]
	}
	const re = await ds.queries.cnv.get(q2)
	if (!Array.isArray(re?.cnvs)) throw 're.cnvs[] not array'

	if (q.ssm_id_lst) {
		// filter cnvs[] to get sample of this cnv seg!
		const t = guessSsmid(q.ssm_id_lst)
		for (const c of re.cnvs) {
			if (c.start == t.l[1] && c.stop == t.l[2] && c.class == t.l[3] && c.samples?.[0]?.sample_id == t.l[5]) {
				return [{}, [c.samples[0]]]
			}
		}
		throw 'cnv not found by queried segment'
	}
	// collect all samples
	const samples = re.cnvs.map(c => c.samples[0])
	const byTermId = mayApplyBinning(samples, dictTwLst)

	const id2samples = new Map()
	for (const c of re.cnvs) {
		combineSamplesById(c.samples, id2samples, c.ssm_id)
	}

	return [byTermId, [...id2samples.values()]]
}

async function querySamplesSurvival(q, survivalTwLst, ds, samples, geneTwLst) {
	// build survival api filter
	const filter = { op: 'and', content: [] }
	if (q.filter0) {
		filter.content.push(q.filter0)
	}

	if (geneTwLst) q.isoforms = mapGenes2isoforms(geneTwLst, ds.genomeObj)

	addSsmIsoformRegion4filter(filter.content, q, 'survival')

	delete q.isoforms

	if (q.set_id) {
		if (typeof q.set_id != 'string') throw '.set_id value not string'
		filter.content.push({
			op: 'in',
			content: {
				field: 'cases.case_id',
				value: [q.set_id]
			}
		})
	}
	if (q.filterObj) {
		const g = filter2GDCfilter(q.filterObj)
		if (g) filter.content.push(g)
	}
	addTid2value_to_filter(q.tid2value, filter.content, ds)

	// the survival term itself is not used in api query, since there's just one type of survival data from gdc and no need to distinguish
	const { host, headers } = ds.getHostHeaders(q)
	const re = await ky
		.post(joinUrl(host.rest, 'analysis/survival'), {
			timeout: false,
			headers,
			json: { filters: [filter] }
		})
		.json()
	if (!Array.isArray(re.results?.[0].donors)) throw 're.results[0].donors[] not array'
	for (const d of re.results[0].donors) {
		/* each d:
		{
          "time": 2.0, // time to event in #days
          "censored": true,
          "survivalEstimate": 1, // percentage in 0-1 range, may be for km plot. no use here
          "id": "e117fcf4-2c01-4b4d-8faf-5de7d0e839f1", // case uuid
          "submitter_id": "TCGA-HT-A5R9",
          "project_id": "TCGA-LGG"
        },
		*/
		if (!d.id) throw 'd.id (case uuid) missing'
		if (typeof d.censored != 'boolean') throw 'd.censored is not boolean'
		if (!Number.isFinite(d.time)) throw 'd.time not number'
		let s = samples.find(i => i.sample_id == d.id) // find existing sample
		if (!s) {
			// may create new and insert to samples[]
			if (q.isHierCluster && !ds.__gdc.casesWithExpData.has(d.id)) {
				// case does not have gene exp data; only cases with exp data are allowed
				continue
			}
			s = { sample_id: d.id }
			samples.push(s)
		}
		// assign survival data for this sample
		s[survivalTwLst[0].term.id] = {
			key: d.censored ? 0 : 1,
			value: Number((d.time / 365).toFixed(2)) // convert to years
		}
	}
}

function mapGenes2isoforms(geneTwLst, genome) {
	if (!Array.isArray(geneTwLst)) throw 'geneTwLst not array'
	const isoforms = []
	for (const tw of geneTwLst) {
		if (!tw?.term?.name) throw 'gene tw missing .term.name'
		if (tw.term.isoform) {
			// may need to convert refseq to gencode
			isoforms.push(tw.term.isoform)
		} else {
			// convert
			if (typeof genome != 'object') throw 'serverside genome obj missing, needed to map gene name to canonical isoform'
			if (!genome?.genedb?.get_gene2canonicalisoform) throw 'gene2canonicalisoform not supported on this genome'
			const data = genome.genedb.get_gene2canonicalisoform.get(tw.term.name)
			if (!data?.isoform) {
				// no isoform found
				continue
			}
			isoforms.push(data.isoform)
		}
	}
	return isoforms
}

async function querySamplesTwlstNotForGeneexpclustering(q, dictTwLst, ds, geneTwLst) {
	// not for gene exp clustering

	if (geneTwLst) {
		// temporarily create q.isoforms[] to filter for cases with ssm on these genes; will be deleted after query completes
		q.isoforms = mapGenes2isoforms(geneTwLst, ds.genomeObj)
	}

	if (q.isoforms || q.isoform || q.ssm_id_lst || q.rglst) {
		// using genomic filters
		return await querySamplesTwlstNotForGeneexpclustering_withGenomicFilter(q, dictTwLst, ds, geneTwLst)
	}
	// no genomic filter
	return await querySamplesTwlstNotForGeneexpclustering_noGenomicFilter(q, dictTwLst, ds)
}

// using genomic filter; assuming it's filtering for mutated cases, query ssm_occurrences endpoint
async function querySamplesTwlstNotForGeneexpclustering_withGenomicFilter(q, dictTwLst, ds, geneTwLst) {
	const fieldset = new Set(dictTwLst.map(tw => tw.term.id)) // set of fields to request from ssm_occurrences api. tolerate insertion of duplicating fields

	/* this function can identify sample either by case uuid, or sample submitter id
	for simplicity, always request these two different values
	*/
	fieldset.add('case.observation.sample.tumor_sample_uuid')
	fieldset.add('case.case_id')

	if (q.get == 'samples') {
		// getting list of samples (e.g. for table display)
		// need following fields for table display, add to fields[] if missing:

		if (q.ssm_id_lst || q.isoform) {
			// querying using list of ssm or single isoform
			// must be from mds3 tk; in such case should return following info

			// need ssm id to associate with ssm (when displaying in sample table?)
			fieldset.add('ssm.ssm_id')

			// need read depth info
			// TODO should only add when getting list of samples with mutation for a gene
			// TODO not when adding a dict term in matrix?
			fieldset.add('case.observation.read_depth.t_alt_count')
			fieldset.add('case.observation.read_depth.t_depth')
			fieldset.add('case.observation.read_depth.n_depth')
		}
	}

	if (q.hiddenmclass) {
		/* to drop mutations by pp class
		add new fields so api returns consequence for the querying isoform for each mutation
		then filter by class
		this has been coded up this way but is inefficient, better method would be for gdc api filter to include transcript and consequence limit
		*/
		fieldset.add('ssm.consequence.transcript.consequence_type')
		fieldset.add('ssm.consequence.transcript.transcript_id')
		fieldset.add('ssm.consequence.transcript.is_canonical')
	}

	if (q.rglst) {
		fieldset.add('ssm.chromosome')
		fieldset.add('ssm.start_position')
	}

	const param = { size: isoform2ssm_query2_getcase.size, fields: [...fieldset].join(',') }

	// it may query with isoform
	mayMapRefseq2ensembl(q, ds)

	Object.assign(param, isoform2ssm_query2_getcase.filters(q, ds))

	const { host, headers } = ds.getHostHeaders(q) // will be reused below

	const re = await ky
		.post(joinUrl(host.rest, isoform2ssm_query2_getcase.endpoint), { timeout: false, headers, json: param })
		.json()

	delete q.isoforms

	if (!Array.isArray(re?.data?.hits)) throw 'variant2samples re.data.hits is not array for query'

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
			let c
			if (q.isoform) {
				c = s.ssm.consequence.find(i => i.transcript.transcript_id == q.isoform)
			} else {
				c = s.ssm.consequence.find(i => i.transcript.is_canonical)
			}
			const m = {}
			snvindel_addclass(m, c || s.ssm.consequence[0])
			if (q.hiddenmclass.has(m.class)) {
				// this variant is dropped
				continue
			}
		}

		if (q.gdcUseCaseuuid) {
			/* identify sample with case uuid, but no need to convert to case submitter id
			as this should be for getData() query, which will fill in bySampleId{} with submitter id;
			url link will be just by sample_id and no need to generate separate property for it
			*/
			sample.sample_id = s.case.case_id
			if (!sample.sample_id) throw 'querySamples_gdcapi: case.case_id missing'
		} else {
			/* identify sample as sample submitter id
			sample url link is complex and must be specifically generated
			*/
			const aliquot_id = s.case?.observation?.[0]?.sample?.tumor_sample_uuid
			if (!aliquot_id) throw 'querySamples_gdcapi: aliquot_id missing'
			sample.sample_id = await ds.__gdc.aliquot2submitter.get(aliquot_id)
			// append aliquot_id to case url so when opening the page, the sample is auto highlighted from the tree
			// per uat feedback by bill 1/6/2023
			sample.sample_URLid = s.case.case_id + '?bioId=' + aliquot_id
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

	return [byTermId, [...id2samples.values()]]
}

/*
query samples without genomic filter, must use /cases/ endpoint but not ssm_occurrences,
/cases returns up to 40K entries but /ssm_occurrences has 3M, too much

this will only be used for oncomatrix (without gene mutation rows), and summary chart, and identify samples by case uuid rather than sample/aliquot

this won't work for lollipop which uses ssm filters and identify samples by sample uuid

dictionary term ids starting with "case." must be trimmed before using as /cases/ fields

case_filter variable names can still be "cases.xx"
*/
export async function querySamplesTwlstNotForGeneexpclustering_noGenomicFilter(q, dictTwLst, ds) {
	const fieldset = new Set()
	const updatedTwLst = [] // copy of dictTwLst by trimming "case."
	const termIdMap = new Map() // map of new term id lacking "case." to original term id
	for (const tw of dictTwLst) {
		if (!tw.term.id) throw 'tw.term.id missing'
		let t2 = tw
		if (tw.term.id.startsWith('case.') || tw.term.id.startsWith('cases.')) {
			t2 = JSON.parse(JSON.stringify(tw))
			const l = tw.term.id.split('.')
			t2.term.id = l.slice(1).join('.')
			termIdMap.set(t2.term.id, tw.term.id)
		}
		updatedTwLst.push(t2)
		fieldset.add(t2.term.id)
	}

	const param = {
		size: ds.__gdc.caseid2submitter.size,
		fields: [...fieldset].join(',')
	}

	const f = makeCasesFilter(q)
	if (f) param.case_filters = { op: 'and', content: f }

	const { host, headers } = ds.getHostHeaders(q) // will be reused below

	const t1 = Date.now()

	const re = await memFetch(
		joinUrl(host.rest, 'cases'),
		{ method: 'POST', headers, body: JSON.stringify(param) } //,
		//{ q } // this q does not seem to be a request object reference that is shared across all genes, cannot use as a cache key
	)

	mayLog('gdc /cases queries', Date.now() - t1)

	if (!Array.isArray(re?.data?.hits)) throw 're.data.hits is not array for query'

	const samples = []

	for (const s of re.data.hits) {
		if (!s.id) throw '.id case uuid missing from a hit'
		const sample = {
			sample_id: s.id
		}

		for (const tw of updatedTwLst) {
			flattenCaseByFields(sample, s, tw, 0)
		}
		for (const [k1, k2] of termIdMap) {
			if (k1 in sample) {
				sample[k2] = sample[k1]
				delete sample[k1]
			}
		}

		samples.push(sample)
	}

	const byTermId = mayApplyBinning(samples, dictTwLst)

	return [byTermId, samples]
}

/*
 ** this only works for dict terms!! but not geneVariant aiming to load mutations
 */
async function querySamplesTwlstForGeneexpclustering(q, twLst, ds) {
	const filters = { op: 'and', content: [] }
	/*
	do not pass entire list of cases with expression data as filter! too slow
		//content: { field: 'case_id', value: [...ds.__gdc.casesWithExpData] } 
	*/
	if (q.filter0) {
		filters.content.push(q.filter0)
	}
	if (q.filterObj) {
		const g = filter2GDCfilter(q.filterObj)
		if (g) filters.content.push(g)
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

	const { host, headers } = ds.getHostHeaders(q)

	// NOTE: not using ky, until the issue with undici intermittent timeout/socket hangup is
	// fully resolved, and which hapens only for long-running requests where possibly
	// garbage collection is not being performed on http socket resources
	const re = await memFetch(
		joinUrl(host.rest, 'cases'),
		{
			method: 'POST',
			timeout: false,
			headers,
			body: JSON.stringify({
				size: ds.__gdc.casesWithExpData.size,
				fields: fields.join(','),
				case_filters: filters.content.length ? filters : undefined
			})
		} //,
		//{ q } // this q does not seem to be a request object reference that is shared across all genes, cannot use as a cache key
	)

	if (!Array.isArray(re?.data?.hits)) throw 're.data.hits[] not array'

	const samples = []
	for (const h of re.data.hits) {
		if (typeof h.case_id != 'string') throw 'h.case_id missing'

		if (!ds.__gdc.casesWithExpData.has(h.case_id)) {
			// possible as "filters" does not limit to cases with gene expression. thus it can pull out cases without exp data and will skip those
			continue
		}
		const sample = { sample_id: h.case_id }

		for (const tw of dictTwLst) {
			flattenCaseByFields(sample, h, tw) // helper to transfer term values to sample{}
		}

		samples.push(sample)
	}

	const byTermId = mayApplyBinning(samples, dictTwLst)

	return [byTermId, samples]
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
		.filter0
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
	// convert each term id to {path}
	// id=case.project.project_id, convert to path=project__project_id, for graphql
	// required for the graphql query of termid2size_query()
	const termPaths = []
	for (const tw of twLst) {
		if (!tw.term) continue
		if (tw.term.type != 'categorical') continue // only run for categorical terms
		termPaths.push({
			id: tw.term.id,
			path: tw.term.id.replace('case.', '').replace(/\./g, '__'),
			type: tw.term.type
		})
	}

	const query = termid2size_query(termPaths)
	const variables = termid2size_filters(q, ds)
	const { host, headers } = ds.getHostHeaders(q)
	const re = await ky.post(host.graphql, { timeout: false, headers, json: { query, variables } }).json()

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
		const { host, headers } = ds.getHostHeaders(q)
		const re = await ky(host.rest + '/ssms/' + q.ssm_id + '?fields=' + fields.join(','), {
			timeout: false,
			headers
		}).json()
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
	// here case_filters will always be non-empty so it will always be used
	const query = `query termislst2total( $filters: FiltersArgument) {
		explore {
			cases {
				aggregations (case_filters: $filters, aggregations_filter_themselves: true) {
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

	addTid2value_to_filter(p?.tid2value, f.filters.content, ds)

	if (p && p.ssm_id_lst) {
		f.filters.content.push({
			op: '=',
			content: { field: 'cases.gene.ssm.ssm_id', value: p.ssm_id_lst.split(',') }
		})
	}

	if (p.filter0) {
		f.filters.content.push(p.filter0)
	}
	if (p.filterObj) {
		const g = filter2GDCfilter(p.filterObj)
		if (g) f.filters.content.push(g)
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
				q.case_id = await convert2caseId(q, ds)
			}
		}
		return await getSingleSampleMutations(q, ds, genome)
	}
}

async function convert2caseId(q, ds) {
	/*
	q={sample:str}

	q.sample could be anything below. convert it to case.case_id
	- case submitter id (TCGA-FR-A44A)
	- aliquot id (d835e9c7-de84-4acd-ba30-516f396cbd84)
	- sample submitter id (TCGA-B5-A1MR-01A)
	*/
	const { host, headers } = ds.getHostHeaders(q)
	const re = await ky
		.post(joinUrl(host.rest, 'cases'), {
			timeout: false,
			headers,
			json: {
				size: 1,
				fields: 'case_id,submitter_id',
				filters: {
					op: 'or',
					content: [
						{ op: '=', content: { field: 'samples.portions.analytes.aliquots.aliquot_id', value: q.sample } },
						{ op: '=', content: { field: 'submitter_id', value: q.sample } },
						{ op: '=', content: { field: 'samples.submitter_id', value: q.sample } }
					]
				}
			}
		})
		.json()

	for (const h of re.data.hits) {
		if (h.case_id) return h.case_id
	}
	throw 'cannot convert to case_id (uuid)'
}

export function gdc_validate_query_singleCell_DEgenes(ds) {
	/*
	q{} TermdbSinglecellDEgenesRequest
	*/
	ds.queries.singleCell.DEgenes.get = async q => {
		const caseuuid = await getCaseidByFileid(q, q.sample, ds)

		const degFileId = await getSinglecellDEfile(caseuuid, q, ds)

		const genes = await getSinglecellDEgenes(q, degFileId, ds)
		return { genes }
	}
}

// given a file uuid, find out the case uuid this file belongs to
async function getCaseidByFileid(q, fileId, ds) {
	const json = {
		size: 1,
		fields: 'cases.case_id'
	}
	const { host, headers } = ds.getHostHeaders(q)
	const re = await ky.post(joinUrl(host.rest, 'files', fileId), { timeout: false, headers, json }).json()
	if (!re.data?.cases?.[0].case_id) throw 'structure not re.data.cases[].case_id'
	return re.data?.cases[0].case_id
}

async function getSinglecellDEfile(caseuuid, q, ds) {
	// find the seurat.deg.tsv file for the requested experient, and return file id. many cases have multiple sc experiments. to identify the correct experiment, use q.sample which is seurat.analysis.tsv file id. find the matching deg.tsv

	const json = {
		filters: {
			op: 'and',
			content: [
				{ op: '=', content: { field: 'data_format', value: 'mex' } },
				{ op: '=', content: { field: 'data_type', value: 'Gene Expression Quantification' } },
				{ op: '=', content: { field: 'experimental_strategy', value: 'scRNA-Seq' } }
			]
		},
		size: 100,
		case_filters: { op: '=', content: { field: 'cases.case_id', value: caseuuid } },
		fields: ['downstream_analyses.output_files.file_id', 'downstream_analyses.output_files.file_name'].join(',')
	}

	const { host, headers } = ds.getHostHeaders(q)
	const re = await ky.post(joinUrl(host.rest, 'files'), { timeout: false, headers, json }).json()
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'
	/* can have multiple hits. a hit looks like:
	{
    "id": "03845ba9-15a3-4216-b484-0489eb0fef90",
    "downstream_analyses": [
      {
        "output_files": [
          {
            "file_name": "ea35f03e-2102-458a-849c-2ab2013545ca.seurat.1000x1000.loom",
            "file_id": "0fa50788-e27c-4f9c-a1a8-be2e8686c000"
          },
          {
            "file_name": "seurat.deg.tsv",
            "file_id": "76ecc49d-60b7-4f43-a005-7a31be92bbfe"
          },
          {
            "file_name": "seurat.analysis.tsv",
            "file_id": "d9bc1a51-3d27-4b98-b133-7c17067e7cb5"
          }
        ]
      }
    ]
  }

	a hit is the MEX file of one singlecell experiment, from which the deg.tsv and analysis.tsv files are derived.
	given the analysis.tsv file id (q.sample), find the deg.tsv file from the same experiment
  */
	for (const hit of re.data.hits) {
		if (!hit.downstream_analyses) continue // some hits lack this
		if (!Array.isArray(hit.downstream_analyses[0]?.output_files)) throw 'downstream_analyses[0].output_files[] missing'

		// from output files of this experiment, find if the output_files[] array contains the requested analysis.tsv file
		if (hit.downstream_analyses[0].output_files.find(f => f.file_id == q.sample)) {
			// now find the deg.tsv file from output_files[] array
			const f = hit.downstream_analyses[0].output_files.find(f => f.file_name == 'seurat.deg.tsv')
			if (!f) throw 'a MEX downstream files has analysis.tsv but no deg.tsv'
			return f.file_id
		}
	}
	throw 'no matching seurat.deg.tsv file is found'
}

async function getSinglecellDEgenes(q, degFileId, ds) {
	// with seurat.deg.tsv file id, read file content and find DE genes belonging to given cluster
	const { host } = ds.getHostHeaders(q)
	// do not use headers here that has accept: 'application/json'
	const re = await ky(joinUrl(host.rest, 'data', degFileId), { timeout: false }).text()
	const lines = re.trim().split('\n')
	/*
        this tsv file first line is header:
        gene    gene_names      cluster avg_log2FC      p_val   p_val_adj       prop_in_cluster prop_out_cluster        avg_logFC

        each line is a gene belonging to a cluster
        */
	const genes = []
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		const l = line.split('\t')
		if (l[2] == q.categoryName) {
			// gene is for required cluster
			const name = l[1]
			if (!name) throw 'gene_names blank for a line: ' + line
			const avg_log2FC = Number(l[3])
			if (Number.isNaN(avg_log2FC)) throw 'avg_log2FC not number for a line ' + line
			const p_val_adj = Number(l[5])
			if (Number.isNaN(p_val_adj)) throw 'p_val_adj not number for a line ' + line
			genes.push({ name, avg_log2FC, p_val_adj })
		}
	}
	return genes
}

export function gdc_validate_query_singleCell_data(ds, genome) {
	// q{} TermdbSinglecellDataRequest
	ds.queries.singleCell.data.get = async q => {
		const { host } = ds.getHostHeaders(q)
		// do not use headers here that has accept: 'application/json'
		const re = await ky(joinUrl(host.rest, 'data', q.sample.eID || q.sample.sID), { timeout: false }).text()
		const lines = re.trim().split('\n')
		const datasetPlots = ds.queries.singleCell.data.plots
		/*
		this tsv file has coord for 3 maps
		first line is header:

		0     cell_barcode
		1     read_count
		2     gene_count
		3     seurat_cluster
		4-8   UMAP_1	UMAP_2	UMAP3d_1	UMAP3d_2	UMAP3d_3	
		9-13  tSNE_1	tSNE_2	tSNE3d_1	tSNE3d_2	tSNE3d_3
		14-23 PC_1	PC_2	PC_3	PC_4	PC_5	PC_6	PC_7	PC_8	PC_9	PC_10

		!! important !! file column index must match with x/y values of each plot in dataset/gdc.hg38.ts 
		*/
		const seuratClusterTerm = { id: 'cluster', name: 'Seurat cluster', type: 'categorical', values: {} }
		const plots = q.plots.map(p => ({ expCells: [], noExpCells: [], name: p }))

		let geneExpMap
		if (ds.queries.singleCell.geneExpression && q.gene) {
			geneExpMap = await ds.queries.singleCell.geneExpression.get({ sample: q.sample, gene: q.gene })
			if (geneExpMap.error) {
				return { error: geneExpMap.error }
			}
		}
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i]
			const l = line.split('\t')
			const cellId = l[0]
			if (!cellId) throw 'cellId missing from a line: ' + line
			const clusterId = l[3]
			if (!clusterId) throw 'seuratCluster missing from a line'
			seuratClusterTerm.values[clusterId] = { label: 'Cluster ' + clusterId }
			for (const plot of plots) {
				const datasetPlot = datasetPlots.find(p => p.name == plot.name)
				const colorColumn =
					datasetPlot.colorColumns.find(c => c.name == q.colorBy?.[plot.name]) || datasetPlot.colorColumns[0]
				plot.colorBy = colorColumn.name
				plot.colorColumns = datasetPlot.colorColumns.map(c => c.name)

				const xpos = datasetPlot.coordsColumns.x
				const ypos = datasetPlot.coordsColumns.y
				const x = Number(l[xpos])
				const y = Number(l[ypos])
				if (Number.isNaN(x)) throw 'x is nan in plot ' + plot.name
				if (Number.isNaN(y)) throw 'x is nan in plot ' + plot.name
				const category = `Cluster ${clusterId}`
				const cell = { cellId, x, y, category }
				if (geneExpMap) {
					if (geneExpMap[cellId] !== undefined) {
						cell.geneExp = geneExpMap[cellId]
						plot.expCells.push(cell)
					} else plot.noExpCells.push(cell)
				} else plot.noExpCells.push(cell)
			}
		}
		return { plots }
	}
}

async function getSingleSampleMutations(query, ds, genome) {
	// query = {case_id}
	// on localhost to simulate access to controlled fusion data, add query.token=''

	// object is returned, can add any other attr e.g. total number of events exceeding view limit
	const result = {
		mlst: [], // collect events of all types into one array, identified by dt
		dt2total: [] // for any dt, if total number exceeds view limit, report here
	}

	// ssm
	{
		const { host, headers } = ds.getHostHeaders(query)

		const re = await ky
			.post(joinUrl(host.rest, isoform2ssm_query1_getvariant.endpoint), {
				timeout: false,
				headers,
				json: {
					size: 10000, // ssm max!
					fields: isoform2ssm_query1_getvariant.fields.join(','),
					filters: isoform2ssm_query1_getvariant.filters(query).filters
				}
			})
			.json()

		if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total not integer'
		if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'

		if (re.data.hits.length < re.data.pagination.total) {
			// total exceeds view limit, let client know
			result.dt2total.push({ dt: common.dtsnvindel, total: re.data.pagination.total })
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

	// cnv and fusion are loaded from per-sample text files
	const dt2files = await getCnvFusion4oneCase(query, ds)
	const cfs = dt2files[common.dtcnv]
	if (cfs) {
		// select a default set of cnvs to insert to mlst so it shows on disco;
		const usefile = cfs.find(f => f.wgsTempFlag) || cfs[0]
		result.mlst.push(...usefile.mlst)
		if (cfs.length == 1) {
			// just one. data from this file is already added to result.mlst so no need to include this
			delete dt2files[common.dtcnv]
		} else {
			// more than 1 cnv file, send all to client but delete the temporary flag
			for (const f of cfs) delete f.wgsTempFlag
			usefile.inuse = true
		}
	}
	const ffs = dt2files[common.dtfusionrna]
	if (ffs) {
		// just use the first set of fusion data
		result.mlst.push(...ffs[0].mlst)
		if (ffs.length == 1) {
			// just one
			delete dt2files[common.dtfusionrna]
		} else {
			// more than 1. include
			ffs[0].inuse = true
		}
	}
	if (Object.keys(dt2files).length) {
		result.alternativeDataByDt = dt2files
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
			optional, isoform is provided for mds3 tk loading using isoform,
		.rglst[]
			optional, and hardcoded to use only 1 region:
			when .isoform is provided, rglst should be zoomed in on isoform and used to limit ssm
			when .isoform is not provided, rglst comes from genomic query
			when both .isform and .rglst are missing, case_id should be required to limit to ssm from a case
		.case_id
			case_id is provided for loading ssm from a case in gdc bam slicing ui 
		.set_id, obsolete
		.filter0{}
		.filterObj{}
	*/
	filters: p => {
		const f = {
			filters: { op: 'and', content: [] },
			case_filters: { op: 'and', content: [] }
		}

		let r
		if (p.rglst) {
			r = p.rglst[0]
			validateRegion(r)
		}

		if (p.isoform) {
			if (typeof p.isoform != 'string') throw '.isoform value not string'
			f.filters.content.push({
				op: '=',
				content: {
					field: 'consequence.transcript.transcript_id',
					value: [p.isoform]
				}
			})
			if (r) {
				// limit ssm to zoom in region
				f.filters.content.push({
					op: '>=',
					content: { field: 'start_position', value: r.start }
				})
				f.filters.content.push({
					op: '<=',
					content: { field: 'start_position', value: r.stop }
				})
			}
		} else if (r) {
			// no isoform but rglst is provided
			f.filters.content.push({
				op: '=',
				content: { field: 'chromosome', value: r.chr }
			})
			f.filters.content.push({
				op: '>=',
				content: { field: 'start_position', value: r.start }
			})
			f.filters.content.push({
				op: '<=',
				content: { field: 'start_position', value: r.stop }
			})
		} else if (p.case_id) {
			if (typeof p.case_id != 'string') throw '.case_id value not string'
			f.filters.content.push({
				op: '=',
				content: {
					field: 'cases.case_id',
					value: [p.case_id]
				}
			})
		} else {
			throw '.isoform, .rglst, and .case_id are all missing'
		}

		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.case_filters.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.case_filters.content.push(p.filter0)
		}
		if (p.filterObj) {
			const g = filter2GDCfilter(p.filterObj)
			if (g) f.case_filters.content.push(g)
		}
		if (!f.case_filters.content.length) delete f.case_filters // allow to speed up
		return f
	}
}

function validateRegion(r) {
	if (typeof r != 'object') throw 'p.rglst[0] not object'
	if (typeof r.chr != 'string' || !r.chr || !Number.isInteger(r.start) || !Number.isInteger(r.stop))
		throw 'p.rglst[0] not valid {chr,start,stop}'
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
		const f = {
			filters: { op: 'and', content: [] },
			case_filters: { op: 'and', content: [] }
		}

		addSsmIsoformRegion4filter(f.filters.content, p, 'ssm_occurrences')

		if (p.set_id) {
			if (typeof p.set_id != 'string') throw '.set_id value not string'
			f.case_filters.content.push({
				op: 'in',
				content: {
					field: 'cases.case_id',
					value: [p.set_id]
				}
			})
		}
		if (p.filter0) {
			f.case_filters.content.push(p.filter0)
		}
		if (p.filterObj) {
			const g = filter2GDCfilter(p.filterObj)
			if (g) f.case_filters.content.push(g)
		}
		addTid2value_to_filter(p.tid2value, f.case_filters.content, ds)
		if (!f.case_filters.content.length) delete f.case_filters // do not use empty case_filters to speed up query (Jason Stiles 3/28/24)
		return f
	}
}

// create case_filters[] for /cases endpoint. check fields at https://api.gdc.cancer.gov/cases/_mapping
function makeCasesFilter(p) {
	const lst = []
	if (p.set_id) {
		if (typeof p.set_id != 'string') throw '.set_id value not string'
		lst.push({
			op: 'in',
			content: {
				field: 'case_id',
				value: [p.set_id]
			}
		})
	}
	if (p.filter0) {
		lst.push(p.filter0)
	}
	if (p.filterObj) {
		const g = filter2GDCfilter(p.filterObj)
		if (g) lst.push(g)
	}
	if (p.filter) {
		const g = filter2GDCfilter(p.filter)
		if (g) lst.push(g)
	}
	return lst.length ? lst : null
}

const endpoint2fields = {
	ssm_occurrences: {
		ssmid: 'ssm.ssm_id',
		transcriptid: 'ssms.consequence.transcript.transcript_id',
		start: 'ssms.start_position',
		chr: 'ssms.chromosome'
	},
	survival: {
		// Phil 7/8/24: survival endpoint case filtering are done through fields of https://api.gdc.cancer.gov/case_ssms/_mapping
		ssmid: 'gene.ssm.ssm_id',
		transcriptid: 'gene.ssm.consequence.transcript.annotation.transcript_id',
		start: 'gene.ssm.start_position',
		chr: 'gene.ssm.chromosome'
	}
}

/*
contentLst[]
	- to which clauses of ssm/isoform/region filters will be added
p{}
	request param
endpoint
	the function is reusable for two endpoints: ssm_occurrences, survival. however each uses different field values

*/
function addSsmIsoformRegion4filter(contentLst, p, endpoint) {
	const fields = endpoint2fields[endpoint]
	if (!fields) throw 'unknown endpoint for looking up fields'

	/* if query provides isoform, rglst[] can be used alongside isoform to restrict ssm to part of isoform (when zoomed in)
		if no ssm or isoform, rglst[] must be provided (querying from genomic mode)
		*/
	let hasSsmOrIsoform = false

	if (p.ssm_id_lst) {
		if (typeof p.ssm_id_lst != 'string') throw 'ssm_id_lst not string'
		contentLst.push({
			op: '=',
			content: {
				field: fields.ssmid,
				value: p.ssm_id_lst.split(',')
			}
		})
		hasSsmOrIsoform = true
	} else if (p.isoform) {
		contentLst.push({
			op: '=',
			content: {
				field: fields.transcriptid,
				value: [p.isoform]
			}
		})
		hasSsmOrIsoform = true
	} else if (p.isoforms) {
		if (!Array.isArray(p.isoforms)) throw '.isoforms[] not array'
		contentLst.push({
			op: 'in',
			content: { field: fields.transcriptid, value: p.isoforms }
		})
		hasSsmOrIsoform = true
	}

	let r
	if (p.rglst) {
		// !!!hardcoded to only one region!!!
		r = p.rglst[0]
		validateRegion(r)
	}
	if (hasSsmOrIsoform) {
		if (r) {
			// rglst[] is optional in this case; to filter out variants that are out of view range (e.g. zoomed in on protein) necessary when zooming in
			contentLst.push({
				op: '>=',
				content: { field: fields.start, value: r.start }
			})
			contentLst.push({
				op: '<=',
				content: { field: fields.start, value: r.stop }
			})
		}
	} else {
		if (endpoint == 'survival') {
			// using survival endpoint, meaning it's querying data for a survival term, allow all gene/ssm/region param to be missing, so the survival term can be added to a hiercluster map
		} else if (endpoint == 'ssm_occurrences') {
			// rglst is required now
			// ssm_occurrences endpoint requires genomic filters (ssm/isoform/rglst), since without them, this endpoint returns 3 million records which is hugely inefficient for retrieving case data without genomic filters. if need to retrieve case data without genomic filter, should use /cases/ endpoint instead
			if (!r) throw '.ssm_id_lst, .isoform, .isoforms, .rglst[] are all missing'
			contentLst.push({
				op: '=',
				content: { field: fields.chr, value: r.chr }
			})
			contentLst.push({
				op: '>=',
				content: { field: fields.start, value: r.start }
			})
			contentLst.push({
				op: '<=',
				content: { field: fields.start, value: r.stop }
			})
		}
	}
}

/*
generated by clicking a slice in mds3 sunburst

Arguments:

	tid2value: {}
		key: termid, in the form of case.xx
		value: category name

		currently sunburst only support categorical term. terms are not yet termsetting thus no groupsetting and no numericbin
		if it's nested sunburst, two term-value combo will be supplied

	content[]
		into which the filter clause is inserted

	ds

No return.
*/
function addTid2value_to_filter(tid2value, content, ds) {
	if (!tid2value) return
	for (const termid in tid2value) {
		const t = ds.cohort.termdb.q.termjsonByOneid(termid)
		if (!t) continue
		const newTermid = termid.replace(/^case\./, 'cases.') // MUST replace "case." with "cases." to use as field (why!?)
		if (t.type == 'categorical') {
			content.push({
				op: 'in',
				content: { field: newTermid, value: [tid2value[termid]] }
			})
		} else if (t.type == 'integer') {
			for (const val of tid2value[termid]) {
				content.push({
					op: val.op,
					content: { field: newTermid, value: val.range }
				})
			}
		}
	}
}
