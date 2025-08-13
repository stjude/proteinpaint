import { stratinput } from '#shared/tree.js'
import { querySamples_gdcapi } from './mds3.gdc.js'
import { get_densityplot } from './mds3.densityPlot.js'
import * as utils from './utils.js'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv } from '#shared/common.js'
import * as geneDbSearch from './gene.js'
import { getSampleData_dictionaryTerms_termdb } from './termdb.matrix.js'
import { ssmIdFieldsSeparator } from '#shared/mds3tk.js'

/*
validate_variant2samples()
variant2samples_getresult()
	queryMutatedSamples
		querySamples_gdcapi
		queryServerFileBySsmid
			combineSamplesById
		queryServerFileByRglst
			mayAddSampleAnnotationByTwLst
	make_sunburst
		get_crosstabCombinations()
		addCrosstabCount_tonodes
	make_summary
		make_summary_categorical
*/

export async function validate_variant2samples(ds) {
	const vs = ds.variant2samples
	if (!vs) return
	// throw `!!! fake validate_variant2samples() failure !!!` // uncomment to test

	if (ds.preInit?.getStatus) {
		// should wait for dataset or API to be "healthy" before attempting to validate,
		// otherwise network-based datasets would fail to validate with unhealthy API
		const response = await ds.preInit.getStatus().catch(e => {
			throw e
		})
		if (response.status != 'OK') throw response
	}

	vs.type_samples = 'samples'
	vs.type_sunburst = 'sunburst'
	vs.type_summary = 'summary'
	if (!vs.variantkey) throw '.variantkey missing from variant2samples'
	if (['ssm_id'].indexOf(vs.variantkey) == -1) throw 'invalid value of variantkey'

	if (vs.twLst) {
		if (!Array.isArray(vs.twLst)) throw 'variant2samples.twLst[] is not array'
		if (vs.twLst.length == 0) throw 'variant2samples.twLst[] empty array'
		if (!ds.cohort || !ds.cohort.termdb) throw 'ds.cohort.termdb missing when variant2samples.twLst is in use'
		for (const tw of vs.twLst) {
			if (!tw.id) throw 'tw.id missing from one of variant2samples.twLst[]'
			const term = ds.cohort.termdb.q.termjsonByOneid(tw.id)
			if (!term) throw 'term not found for one of variant2samples.twLst: ' + tw.id
			tw.term = term
			// tw.term is hydrated, no longer need tw.id
			delete tw.id
			// tw.q{} must be set
			if (!tw.q) throw 'tw.q{} missing for one of variant2samples.twLst: ' + tw.term.id
			// validate tw.q by term type?
		}
	}

	if (vs.sunburst_twLst) {
		if (!Array.isArray(vs.sunburst_twLst)) throw '.sunburst_twLst[] not array from variant2samples'
		if (vs.sunburst_twLst.length == 0) throw '.sunburst_twLst[] empty array from variant2samples'
		if (!ds.cohort || !ds.cohort.termdb) throw 'ds.cohort.termdb missing when variant2samples.sunburst_twLst is in use'
		for (const tw of vs.sunburst_twLst) {
			if (!tw.id) throw 'tw.id missing from one of variant2samples.sunburst_twLst[]'
			const term = ds.cohort.termdb.q.termjsonByOneid(tw.id)
			if (!term) throw 'term not found for one of variant2samples.sunburst_twLst: ' + tw.id
			tw.term = term
			// tw.term is hydrated, no longer need tw.id
			delete tw.id
			// tw.q{} must be set
			if (!tw.q) throw 'tw.q{} missing for one of variant2samples.sunburst_twLst: ' + tw.term.id
		}
	}

	if (vs.gdcapi) {
		// only a boolean flag
	} else {
		// look for server-side vcf/bcf/tabix file
		// file header should already been parsed and samples obtain if any
		let hasSamples = false
		if (ds.queries?.snvindel?.byrange?._tk?.samples) {
			// this file has samples
			hasSamples = true
		}
		if (ds.queries?.svfusion?.byrange?.samples) {
			hasSamples = true
		}
		if (!hasSamples) throw 'cannot find a sample source from ds.queries{}'
	}

	vs.get = async q => {
		return await variant2samples_getresult(q, ds)
	}
}

/*
from one or more variants, get list of samples harboring any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config

q{}

.genome{}
	optional
	server-side genome obj

.get = "samples/sunburst/summary"
	Required.
	"samples" - return list of sample objects with annotations for twLst[]
	"summary/sunburst" - return summary on twLst[]

.filter0
	read-only gdc filter
.filterObj
	actual pp filter, from mds3 client side
.filter
	actual pp filter, request does not come from mds3 and maybe getData()

****** mutation/genomic filters; one of below must be provided

.ssm_id_lst=str
	Optional, comma-joined list of ssm_id (snvindel or fusion)
.isoform=str
	Optional, one isoform accession
	used for query gdc api to get all samples with mutation on an isoform
.rglst=[ {chr,start,stop}, .. ]
	Optional, used for querying bcf/tabix file with range
	either "ssm_id_lst", "isoform", or "rglst" must be supplied, and must be consistent with dataset setup
.geneTwLst=[ ]
	optional
	list of tw, each for a gene, to find samples with mutations on any of the genes
.hiddenmclass = set

******* dictionary terms

.twLst=[]
	Optional.
	list of tw objects, to retrieve value for each sample,
	resulting sample obj will be like {sample_id:str, term1id:value1, term2id:value2, ...}
	client always provides this, to reflect any user changes
	if get=sunburst, twLst is an ordered array of terms, for which to build layered sunburst
	otherwise element order is not essential

******* getter() returns
{
	samples[]
		always present
	byTermId{}
		optional, term metadata e.g. bin labels. only gdc does it
}
*/
async function variant2samples_getresult(q, ds) {
	mayAllow2returnFormatValues(q, ds)

	const out = await queryMutatedSamples(q, ds)

	if (q.get == ds.variant2samples.type_samples) {
		// return list of samples
		if (!q.useIntegerSampleId && ds?.cohort?.termdb?.q?.id2sampleName) {
			// dataset can map integer to string sample name, and query does not ask to keep integer id, thus convert to string id
			// this is default behavior for client display
			out.samples.forEach(i => (i.sample_id = ds.cohort.termdb.q.id2sampleName(i.sample_id)))
		}
		return out
	}

	if (q.get == ds.variant2samples.type_sunburst) {
		out.nodes = await make_sunburst(out.samples, ds, q)
		delete out.samples
		return out
	}

	if (q.get == ds.variant2samples.type_summary) {
		out.summary = await make_summary(out.samples, ds, q)
		delete out.samples
		return out
	}

	throw 'unknown get type'
}

function mayAllow2returnFormatValues(q, ds) {
	if (q.get == 'samples') {
		const byrange = ds.queries?.snvindel?.byrange
		if (byrange) {
			if ((byrange.bcffile || byrange._tk?.chr2files) && byrange._tk.format) {
				// byrange query uses bcf file and the files have FORMAT fields,
				// q.get=samples will make sample table display with the variant, return FORMAT for sample-level info on variants
				q.addFormatValues = true
			}
		}
	}
}

/*
input:
	same as main function

output: (output is an object to be easily extendable of adding additional attr, compared to an array)
{
	samples[]
		list of mutated samples as basis for further processing
		these samples all harbor mutation of certain specification (see q{})
		each sample is an object with annotation value for each term of variant2samples.twLst[]
		depending on q.get=?, the samples may be summarized (to barchart), or returned without summary

		** note **
		** original term value per sample is returned, twLst[].q is ignored
		** e.g. for age term, age value is returned, but not age category, even if tw.q is discrete
		** so that density chart can be made using actual numeric values when q.get=summary

	byTermId{}
		only from gdc,
}
*/
async function queryMutatedSamples(q, ds) {
	/*
    !!! tricky !!!

    make copy of twLst[] that's only used in this function
    as new array elements can be added when using gdc api (e.g. case_id and read counts)
    q.twLst must remained unchanged
    in order for summary to work for given dictionary terms in q.twLst[], while the temporarily added terms can break summary code
    */
	const twLst = q.twLst ? q.twLst.slice() : []

	if (ds.variant2samples.gdcapi) {
		return await querySamples_gdcapi(q, twLst, ds, q.geneTwLst)
	}

	/*
    from server-side files
    action depends on details:
    - file type (gz or db perhaps)
    - data type (snv or sv)
    - query by what (ssm id, region, or isoform)
    */

	if (q.ssm_id_lst) return await queryServerFileBySsmid(q, twLst, ds)

	if (q.rglst) return await queryServerFileByRglst(q, twLst, ds)

	if (q.geneTwLst) {
		// convert geneTwLst to rglst[] to query
		if (typeof q.genome != 'object') throw 'serverside genome obj needed'
		q.rglst = []
		for (const tw of q.geneTwLst) {
			if (tw.term.chr && Number.isInteger(tw.term.start) && Number.isInteger(tw.term.stop)) {
				q.rglst.push({ chr: tw.term.chr, start: tw.term.start, stop: tw.term.stop })
			} else {
				const result = geneDbSearch.getResult(q.genome, { deep: 1, input: tw.term.name })
				if (result.gmlst) {
					const g = result.gmlst[0]
					q.rglst.push({ chr: g.chr, start: g.start, stop: g.stop })
				}
			}
		}
		const samples = await queryServerFileByRglst(q, twLst, ds)
		delete q.rglst
		return { samples }
	}

	///////////////////////////////
	// no genomic parameters!
	// this should be from matrix query
	// do sql query to get all annotated samples
	if (!ds?.cohort?.termdb) throw 'unable to do sql query: .cohort.termdb missing for ds'
	const q2 = {
		ds,
		// filterObj does not exist if query is from mass. still added it here in case it may come from mds3...
		filter: q.filter || q.filterObj
	}
	const out = await getSampleData_dictionaryTerms_termdb(q2, q.twLst)
	// quick fix to reshape result data
	const samples = []
	for (const k in out.samples) {
		const s = out.samples[k]
		// s = { sample: <sampleId>, <termId>: {key,value} }
		s.sample_id = s.sample
		delete s.sample

		for (const tw of q.twLst) {
			if (s[tw.term.id]) {
				s[tw.term.id] = s[tw.term.id].key
			}
		}
		samples.push(s)
	}
	return { samples }
}

/*
q.ssm_id_lst can be multiple data types
the id string must be in format like chr.pos.etc.etc
that contains chromsome position for querying snvindel or svfusion file
thus can extract coordinate from  to query

snvindel id has 4 fields, svfusion id has 6 fields, thus be able to differentiate

TODO no need to collect ssm_id_lst for each sample e.g. doing sunburst
*/
async function queryServerFileBySsmid(q, twLst, ds) {
	const samples = new Map() // must use sample id in map to dedup samples from multiple variants
	// k: sample_id, v: {ssm_id_lst:[], ...}

	for (const ssmid of q.ssm_id_lst.split(',')) {
		const _g = guessSsmid(ssmid)

		if (_g.dt == dtsnvindel) {
			if (!ds.queries.snvindel?.byrange) throw 'queries.snvindel.byrange missing'
			const [chr, pos, ref, alt] = _g.l

			// new param with rglst as the variant position
			// pos is 0-based start coordinate, to convert to 0-based
			// region need to set stop coordinate to be pos + 1
			// also inherit q.tid2value if provided
			const param = Object.assign({}, q, {
				rglst: [{ chr, start: pos, stop: pos + 1 }]
			})

			const mlst = await ds.queries.snvindel.byrange.get(param)
			for (const m of mlst) {
				if (m.pos != pos || m.ref != ref || m.alt != alt) continue
				combineSamplesById(m.samples, samples, m.ssm_id)
			}
			continue
		}

		if (_g.dt == dtcnv) {
			if (!ds.queries.cnv) throw 'queries.cnv missing'
			const [chr, start, stop, _class, value, sample] = _g.l
			const param = Object.assign({}, q, { rglst: [{ chr, start, stop: start + 1 }] })
			const cnv = await ds.queries.cnv.get(param)
			if (!Array.isArray(cnv?.cnvs)) throw 'cnv.cnvs[] not array'
			for (const m of cnv.cnvs) {
				if (m.start != start || m.stop != stop) continue
				if (m.class != _class) continue
				if (Number.isFinite(value) && m.value != value) continue
				if (sample && m.samples?.[0].sample_id != sample) continue
				combineSamplesById(m.samples, samples, m.ssm_id)
			}
			continue
		}

		if (_g.dt == dtsv || _g.dt == dtfusionrna) {
			if (!ds.queries.svfusion?.byrange) throw 'queries.svfusion.byrange missing'
			const [dt, chr, pos, strand, pairlstIdx, mname] = _g.l

			// why has to stop=pos+1
			const param = Object.assign({}, q, { rglst: [{ chr, start: pos, stop: pos + 1 }] })
			const mlst = await ds.queries.svfusion.byrange.get(param)

			for (const m of mlst) {
				if (m.dt != dt || m.pos != pos || m.strand != strand || m.pairlstIdx != pairlstIdx || m.mname != mname) {
					// not this fusion event
					continue
				}
				combineSamplesById(m.samples, samples, m.ssm_id)
			}
			continue
		}
		throw 'unknown format of ssm id'
	}

	mayAddSampleAnnotationByTwLst(samples, twLst, ds)

	return { samples: [...samples.values()] }
}

/*
inlst[]
	array of sample objects. each element is a sample with a mutation (all having the same mutation)
	a sample with multiple mutations will be duplicated in inlst
samples{}
	a map, k: sample_id, v: {ssm_id_lst:[], ...}
ssmid: str
	mutation id shared by samples from inlst
*/
export function combineSamplesById(inlst, samples, ssmid) {
	for (const s of inlst) {
		// s = { sample_id, formatK2v:{} }
		if (!samples.has(s.sample_id)) {
			// new sample
			s.ssm_id_lst = []
			if (s.formatK2v) {
				// format values are also returned, they are per-ssm so must introduce a new map
				s.ssmid2format = {}
			}
			samples.set(s.sample_id, s)
		}
		// slot this sample into samples{}
		const s2 = samples.get(s.sample_id)
		s2.ssm_id_lst.push(ssmid)
		if (s2.ssmid2format) {
			s2.ssmid2format[ssmid] = s.formatK2v
		}
	}
}

function mayAddSampleAnnotationByTwLst(samples, twLst, ds) {
	if (!twLst) return
	// for every term, append term values to each sample
	// right now does not observe tw setting
	for (const s of samples.values()) {
		for (const tw of twLst) {
			const v = ds.cohort.termdb.q.getSample2value(tw.term.id, s.sample_id)
			if (v[0]) {
				s[tw.term.id] = v[0].value
			}
		}
	}
}

/*
get list of samples that harbor any variant in rglst[]
*/
async function queryServerFileByRglst(q, twLst, ds) {
	const samples = new Map() // same as in previous function

	if (ds.queries.snvindel && !q.hardcodeCnvOnly) {
		const mlst = await ds.queries.snvindel.byrange.get(q)
		for (const m of mlst) {
			combineSamplesById(m.samples, samples, m.ssm_id)
		}
	}
	if (ds.queries.svfusion && !q.hardcodeCnvOnly) {
		const mlst = await ds.queries.svfusion.byrange.get(q)
		for (const m of mlst) {
			combineSamplesById(m.samples, samples, m.ssm_id)
		}
	}
	if (ds.queries.cnv) {
		const cnv = await ds.queries.cnv.get(q)
		if (!Array.isArray(cnv?.cnvs)) throw 'cnv.cnvs[] not array'
		for (const m of cnv.cnvs) {
			combineSamplesById(m.samples, samples, m.ssm_id)
		}
	}

	mayAddSampleAnnotationByTwLst(samples, twLst, ds)

	return { samples: [...samples.values()] }
}

async function make_sunburst(mutatedSamples, ds, q) {
	// to use stratinput, convert each attr to {k} where k is term id
	const nodes = stratinput(
		mutatedSamples,
		q.twLst.map(tw => {
			return { k: tw.term.id }
		})
	)
	for (const node of nodes) {
		delete node.lst
	}
	/*
    nodes[0] should be root:
    { id: 'root', name: 'root' }

    nodes[1] is a wedge:
    {
        id: 'root...Adenomas and Adenocarcinomas',
        parentId: 'root',
        value: 0,
        name: 'Adenomas and Adenocarcinomas',
        full: undefined,
        id0: 'case.disease_type',
        v0: 'Adenomas and Adenocarcinomas',
        id1: undefined,
        v1: undefined,
        id2: undefined,
        v2: undefined
    }

    nodes[2] can be a smaller wedge on nodes[1]:
    {
        id: 'root...Adenomas and Adenocarcinomas...Colon',
        parentId: 'root...Adenomas and Adenocarcinomas',
        value: 4,
        name: 'Colon',
        full: undefined,
        id0: 'case.disease_type',
        v0: 'Adenomas and Adenocarcinomas',
        id1: 'case.primary_site',
        v1: 'Colon',
        id2: undefined,
        v2: undefined
    }
    */

	if (ds?.cohort?.termdb?.termid2totalsize2) {
		const combinations = await get_crosstabCombinations(q.twLst, ds, q, nodes)
		await addCrosstabCount_tonodes(nodes, combinations, ds)
		// .cohortsize=int is added to applicable elements of nodes[]
	}

	return nodes
}

/*
given a list of cases, summarize over a set of terms
*/
async function make_summary(mutatedSamples, ds, q) {
	if (!q.twLst) throw 'q.twLst[] missing for make_summary()'

	const entries = []
	/* one element for a term
    {
        termid=str
        numbycategory=[ ]
        density_data=[]
    }
    */

	for (const tw of q.twLst) {
		if (!tw.term) continue
		if (tw.term.type == 'categorical') {
			const cat2count = make_summary_categorical(mutatedSamples, tw.term.id)
			// k: category string, v: sample count

			entries.push({
				termid: tw.term.id,
				numbycategory: [...cat2count].sort((i, j) => j[1] - i[1])
			})
		} else if (tw.term.type == 'integer' || tw.term.type == 'float') {
			const density_data = await get_densityplot(tw.term, mutatedSamples)
			entries.push({
				termid: tw.term.id,
				density_data
			})
		} else {
			throw 'unknown term type'
		}
	}
	if (ds.cohort.termdb.termid2totalsize2) {
		const tv2counts = await ds.cohort.termdb.termid2totalsize2.get(q.twLst, q)
		for (const { termid, numbycategory } of entries) {
			if (!numbycategory) continue // should be numeric
			const categories = tv2counts.get(termid)
			// array ele: [category, total]
			if (categories) {
				for (const cat of numbycategory) {
					const vtotal = categories.find(v => v[0].toLowerCase() == cat[0].toLowerCase())
					if (vtotal) cat.push(vtotal[1])
				}
			}
		}
	}
	return entries
}

/*
input:
	samples = []
		an array of sample objects returned by queryMutatedSamples()
		!! NOTE !! a sample carrying multiple mutations can be represented multiple times
		to get correct sample count in category breakdown,
		must count unique samples by sample id

	termid = str
		term id summarize against

output:
	map of unique sample counts per category
*/
function make_summary_categorical(samples, termid) {
	const cat2count = new Map()

	if ('sample_id' in samples[0]) {
		/*
        sample.sample_id is set. this should be present for all non-gdc tracks
        */
		for (const s of samples) {
			const c = s[termid]
			if (!c) continue
			if (!cat2count.has(c)) {
				cat2count.set(c, new Set())
			}
			cat2count.get(c).add(s.sample_id)
		}
		const map = new Map()
		for (const [c, s] of cat2count) {
			map.set(c, s.size)
		}
		return map
	}

	if ('case_uuid' in samples[0]) {
		/*
        for gdc track, instead of "sample_id" it uses "case_uuid" as hardcoded for gdc
        */
		for (const s of samples) {
			const c = s[termid]
			if (!c) continue
			if (!cat2count.has(c)) {
				cat2count.set(c, new Set())
			}
			cat2count.get(c).add(s.case_uuid)
		}
		const map = new Map()
		for (const [c, s] of cat2count) {
			map.set(c, s.size)
		}
		return map
	}

	/*
    neither sample_id or case.case_id is set
    no way to gather unique list of samples
    */
	for (const s of samples) {
		const c = s[term.id]
		if (!c) continue
		cat2count.set(c, 1 + (cat2count.get(c) || 0))
	}
	return cat2count
}

/*
sunburst requires an array of multiple levels [project, disease, ...], with one term at each level
to get disease total sizes per project, issue separate graphql queries on disease total with filter of project=xx for each
essentially cross-tab two terms, for sunburst
may generalize for 3 terms (3 layer sunburst)
the procedural logic of cross-tabing Project+Disease may be specific to GDC, so the code here
steps:
1. given levels of sunburst [project, disease, ..], get size of each project without filtering
2. for disease at level2, get disease size by filtering on each project
3. for level 3 term, get category size by filtering on each project-disease combination
4. apply the combination sizes to each node of sunburst

todo: define input and output

<input>
twLst[]
	ordered array of term ids
	must always get category list from first term
	as the list cannot be predetermined due to api and token permissions
	currently has up to three levels
ds{}
q{}
	.filterObj={}
nodes[], optional

<output>
combinations[]
	stores all combinations, each element:
	level 1: {count, id0, v0}
	level 2: {count, id0, v0, id1, v1}
	level 3: {count, id0, v0, id1, v1, id2, v2}
*/
export async function get_crosstabCombinations(twLst, ds, q, nodes) {
	if (twLst.length == 0) throw 'zero terms for crosstab'
	if (twLst.length > 3) throw 'crosstab will not work with more than 3 levels'

	const combinations = []

	// temporarily record categories for each term
	// do not register list of categories in ds, as the list could be token-specific
	// k: term id
	// v: set of category labels
	// if term id is not found, it will use all categories retrieved from api queries
	const id2categories = new Map()
	for (const tw of twLst) id2categories.set(tw.term.id, new Set())

	const useall = nodes ? false : true // to use all categories returned from api query

	if (nodes) {
		// only use a subset of categories existing in nodes[]
		// at kras g12d, may get a node such as:
		// {"id":"root...HCMI-CMDC...","parentId":"root...HCMI-CMDC","value":1,"name":"","id0":"project","v0":"HCMI-CMDC","id1":"disease"}
		// with v1 missing, unknown reason
		for (const n of nodes) {
			if (n.id0) {
				if (!n.v0) {
					continue
				}
				id2categories.get(n.id0).add(ds.cohort.termdb.useLower ? n.v0.toLowerCase() : n.v0)
			}
			if (n.id1 && twLst[1]) {
				if (!n.v1) {
					// see above comments
					continue
				}
				id2categories.get(n.id1).add(ds.cohort.termdb.useLower ? n.v1.toLowerCase() : n.v1)
			}
			if (n.id2 && twLst[2]) {
				if (!n.v2) {
					continue
				}
				id2categories.get(n.id2).add(ds.cohort.termdb.useLower ? n.v2.toLowerCase() : n.v2)
			}
		}
	}

	// get term[0] category total, not dependent on other terms
	const id0 = twLst[0].term.id
	{
		const tv2counts = await ds.cohort.termdb.termid2totalsize2.get([twLst[0]], dupRequest(q))
		// tv2counts could be an empty Map. must test if id0 exists, to prevent iterating on undefined and crash
		if (tv2counts.has(id0)) {
			for (const [v, count] of tv2counts.get(id0)) {
				const v0 = ds.cohort.termdb.useLower ? v.toLowerCase() : v
				if (useall) {
					id2categories.get(id0).add(v0)
					combinations.push({ count, id0, v0 })
				} else {
					if (id2categories.get(id0).has(v0)) {
						combinations.push({ count, id0, v0 })
					}
				}
			}
		}
	}

	// get term[1] category total, conditional on id0
	const id1 = twLst?.[1]?.term.id
	if (id1) {
		const promises = []
		// for every id0 category, get id1 category/count conditional on it
		for (const v0 of id2categories.get(id0)) {
			// make new q with filters
			const _q = dupRequest(q)
			_q.tid2value = { [id0]: v0 }
			promises.push(ds.cohort.termdb.termid2totalsize2.get([twLst[1]], _q, v0))
		}
		const lst = await Promise.all(promises)
		for (const [tv2counts, v0] of lst) {
			for (const [s, count] of tv2counts.get(id1)) {
				const v1 = ds.cohort.termdb.useLower ? s.toLowerCase() : s
				if (useall) {
					id2categories.get(id1).add(v1)
					combinations.push({ count, id0, v0, id1, v1 })
				} else {
					if (id2categories.get(id1).has(v1)) {
						combinations.push({ count, id0, v0, id1, v1 })
					}
				}
			}
		}
	}

	// get term[2] category total, conditional on term1+term2 combinations
	const id2 = twLst?.[2]?.term.id
	if (id2) {
		// has query method for this term, query in combination with id0 & id1 categories
		const promises = []
		for (const v0 of id2categories.get(id0)) {
			for (const v1 of id2categories.get(id1)) {
				// make new q with filters
				const _q = dupRequest(q)
				_q.tid2value = { [id0]: v0, [id1]: v1 }
				promises.push(ds.cohort.termdb.termid2totalsize2.get([twLst[2]], _q, { v0, v1 }))
			}
		}
		const lst = await Promise.all(promises)
		for (const [tv2counts, combination] of lst) {
			for (const [s, count] of v2counts.get(id2)) {
				const v2 = ds.cohort.termdb.useLower ? s.toLowerCase() : s
				if (useall) {
					id2categories.get(id2).add(v2)
					combinations.push({ count, id0, v0: combination.v0, id1, v1: combination.v1, id2, v2 })
				} else {
					if (id2categories.get(id2).has(v2)) {
						combinations.push({ count, id0, v0: combination.v0, id1, v1: combination.v1, id2, v2 })
					}
				}
			}
		}
	}
	return combinations
}

/*
make new q{} with filters, for termid2totalsize2.get()
must not directly submit q{} to .get([], q), original q{} contains ssm_id_lst etc that will filter to only those mutated samples rather than category total size
this strips away any such properties that will limit to mutated samples
*/
function dupRequest(q) {
	return {
		filterObj: q.filterObj,
		filter0: q.filter0,
		// must include below for controlled data query
		token: q.token,
		sessionid: q.sessionid,
		__protected__: q.__protected__
	}
}

/* for an ele of nodes[], find matching ele from combinations[]
and assign total as node.cohortsize
*/
async function addCrosstabCount_tonodes(nodes, combinations, ds) {
	for (const node of nodes) {
		if (!node.id0) continue // root

		if (!node.v0) {
			continue
		}
		const v0 = ds.cohort.termdb.useLower ? node.v0.toLowerCase() : node.v0
		if (!node.id1) {
			const n = combinations.find(i => i.id1 == undefined && i.v0 == v0)
			if (n) node.cohortsize = n.count
			continue
		}

		if (!node.v1) {
			// e.g. {"id":"root...HCMI-CMDC...","parentId":"root...HCMI-CMDC","value":1,"name":"","id0":"project","v0":"HCMI-CMDC","id1":"disease"}
			continue
		}
		const v1 = ds.cohort.termdb.useLower ? node.v1.toLowerCase() : node.v1
		if (!node.id2) {
			// second level, use crosstabL1
			const n = combinations.find(i => i.id2 == undefined && i.v0 == v0 && i.v1 == v1)
			if (n) node.cohortsize = n.count
			continue
		}

		if (!node.v2) {
			continue
		}
		const v2 = ds.cohort.termdb.useLower ? node.v2.toLowerCase() : node.v2
		if (!node.id3) {
			// third level, use crosstabL2
			const n = crosstabL2.find(i => i.v0 == v0 && i.v1 == v1 && i.v2 == v2)
			if (n) node.cohortsize = n.count
		}
	}
}

/*
input:
summary=[ {} ]
each element:
{
  "termid": "Lineage",
  "numbycategory": [
    [
      "BALL", // category name
      52, // #mutated samples
      1829 // #total
    ],
  ]
}

output:
barchart data as returned by "termdb/barsql" route
*/
function summary2barchart(input, q) {
	// only convert first, as barchart query should only result in input[] array length=1
	const summary = input[0]
	if (!summary.numbycategory) throw 'numbycategory missing on input[0]'
	const data = {
		charts: [
			{
				chartId: '',
				serieses: []
			}
		]
	}
	for (const [category, mutCount, total] of summary.numbycategory) {
		data.charts[0].serieses.push({
			seriesId: category,
			total,
			data: [
				{ dataId: 'Mutated', total: mutCount },
				{ dataId: 'Others', total: total - mutCount }
			]
		})
	}
	return data
}

/*
ssmid is not specific for ssm, it covers all alterations
gdc ssm are identified by a specific uuid, thus the design
*/
export function guessSsmid(ssmid) {
	const l = ssmid.split(ssmIdFieldsSeparator)
	if (l.length == 4) {
		const [chr, tmp, ref, alt] = l
		const pos = Number(tmp)
		if (Number.isNaN(pos)) throw 'ssmid snvindel pos not integer'
		return { dt: dtsnvindel, l: [chr, pos, ref, alt] }
	}
	if (l.length == 5) {
		// cnv. if type=cat, _value is blank string
		const [chr, _start, _stop, _class, _value] = l
		const start = Number(_start),
			stop = Number(_stop),
			value = _value == '' ? null : Number(_value)
		if (Number.isNaN(start) || Number.isNaN(stop)) throw 'ssmid cnv start/stop not integer'
		return { dt: dtcnv, l: [chr, start, stop, _class, value] }
	}
	if (l.length == 6) {
		if (l[3] == '+' || l[3] == '-') {
			// sv/fusion
			const [_dt, chr, _pos, strand, _pi, _mname] = l

			// mname is encoded in case it contains comma (and is same as ssmIdFieldsSeparator)
			const mname = decodeURIComponent(_mname)
			const dt = Number(_dt)
			if (dt != dtsv && dt != dtfusionrna) throw 'ssmid dt not sv/fusion'
			const pos = Number(_pos)
			if (Number.isNaN(pos)) throw 'ssmid svfusion position not integer'
			const pairlstIdx = Number(_pi)
			if (Number.isNaN(pairlstIdx)) throw 'ssmid pairlstIdx not integer'
			return { dt, l: [dt, chr, pos, strand, pairlstIdx, mname] }
		}
		// cnv with sample
		const [chr, _start, _stop, _class, _value, sample] = l
		const start = Number(_start),
			stop = Number(_stop),
			value = _value == '' ? null : Number(_value) // if cnv not using value, must avoid `Number('')=0`
		if (Number.isNaN(start) || Number.isNaN(stop)) throw 'ssmid cnv start/stop not integer'
		return { dt: dtcnv, l: [chr, start, stop, _class, value, sample] }
	}
	throw 'unknown ssmid'
}
