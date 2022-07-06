const { stratinput } = require('#shared/tree')
const { querySamples_gdcapi } = require('./mds3.gdc')
const { get_densityplot } = require('./mds3.densityPlot')
const { ssmIdFieldsSeparator } = require('./mds3.init')
const utils = require('./utils')
const { dtfusionrna, dtsv } = require('#shared/common')

/*
variant2samples_getresult()
	ifUsingBarchartQuery
	queryMutatedSamples
		querySamples_gdcapi
		queryServerFileBySsmid
		queryServerFileByRglst
	make_sunburst
		get_crosstabCombinations()
		addCrosstabCount_tonodes
	make_summary
	summary2barchart


from one or more variants, get list of samples harboring any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config

q{}
.get = "samples", or "sunburst", or "summary"
	Required. Value determines what's returned

.ssm_id_lst=str
	Optional, comma-joined list of ssm_id (snvindel or fusion)
.isoform=str
	Optional, used for query gdc api to get all samples with mutation on an isoform
.rglst=[ {chr,start,stop}, .. ]
	Optional, used for querying bcf/tabix file with range

	either "ssm_id_lst", "isoform", or "rglst" must be supplied, and must be consistent with dataset setup

.termidlst=str
	Optional.
	comma-joined term ids, to retrieve value for each sample,
	resulting sample obj will be like {sample_id:str, term1id:value1, term2id:value2, ...}
	client always provides this, to reflect any user changes
	if get=sunburst, termidlst is an ordered array of terms, for which to build layered sunburst
	otherwise element order is not essential

	should be replaced with barchart parameters with term1_id, term1_q etc
	to enable termsetting (getting bin label for a sample based on bin config)

.term1_id=str
.term2_id=str
	quick fix
	value is dictionary term id
	indicating the set of termdb-barsql parmeters are used, instead of .termidlst
	for now concatenate term1_id and term2_id into termidlst for existing query to work
	as termidlst does not support termsetting, should replace termidl

	for now term1_q and term2_q are ignored
*/
export async function variant2samples_getresult(q, ds) {
	ifUsingBarchartQuery(q)

	// each sample obj has keys from .terms[].id
	const mutatedSamples = await queryMutatedSamples(q, ds)

	if (q.get == ds.variant2samples.type_samples) {
		// return list of samples
		if (ds?.cohort?.termdb?.q?.id2sampleName) {
			mutatedSamples.forEach(i => (i.sample_id = ds.cohort.termdb.q.id2sampleName(i.sample_id)))
		}
		return mutatedSamples
	}

	if (q.get == ds.variant2samples.type_sunburst) {
		return await make_sunburst(mutatedSamples, ds, q)
	}

	if (q.get == ds.variant2samples.type_summary) {
		const summary = await make_summary(mutatedSamples, ds, q)
		if (q.term1_id) {
			// using barchart query, convert data to barchart format
			return summary2barchart(summary, q)
		}
		return summary
	}
	throw 'unknown get type'
}

function ifUsingBarchartQuery(q) {
	if (!q.term1_id) {
		// not using barchart query
		return
	}
	// using barchart query

	if (q.get == ds.variant2samples.type_samples) {
		throw 'using barchart query and q.get=samples (should only be "summary" for now)'
	}

	// temporary: concatenate so existing v2s code can still function
	// term?_q{} are not used for now
	const lst = [q.term1_id]
	if (q.term2_id) lst.push(q.term2_id)
	if (q.term0_id) lst.push(q.term0_id)
	q.termidlst = lst.join(',')
}

/*
input:
	same as main function
output:
	list of mutated samples as basis for further processing
	these samples all harbor mutation of certain specification (see q{})
	depending on q.get=?, the samples may be summarized (to barchart), or returned without summary
*/
async function queryMutatedSamples(q, ds) {
	/*
	!!!tricky!!!

	make temporary term id list that's only used in this function
	and keep q.termidlst=str unchanged
	as when using gdc api, observation.read_depth stuff are not in termidlst but are only added here to pull out that data
	*/
	const tempTermidlst = q.termidlst ? q.termidlst.split(',') : []
	if (q.get == ds.variant2samples.type_samples && ds.variant2samples.extra_termids_samples) {
		// extra term ids to add for get=samples query
		tempTermidlst.push(...ds.variant2samples.extra_termids_samples)
	}

	if (ds.variant2samples.gdcapi) {
		return await querySamples_gdcapi(q, tempTermidlst, ds)
	}

	/* from server-side files
	action depends on details:
	- file type (gz or db perhaps)
	- data type (snv or sv)
	- query by what (ssm id, region, or isoform)
	*/

	if (q.ssm_id_lst) {
		return await queryServerFileBySsmid(q, tempTermidlst, ds)
	}

	if (q.rglst) {
		return await queryServerFileByRglst(q, tempTermidlst, ds)
	}

	throw 'unknown q{} option when querying server side files'
}

/*
q.ssm_id_lst can be multiple data types
the id string must be in format like chr.pos.etc.etc
that contains chromsome position for querying snvindel or svfusion file
thus can extract coordinate from  to query

snvindel id has 4 fields, svfusion id has 6 fields, thus be able to differentiate

TODO no need to collect ssm_id_lst for each sample e.g. doing sunburst
*/
async function queryServerFileBySsmid(q, termidlst, ds) {
	const samples = new Map() // must use sample id in map to dedup samples from multiple variants
	// k: sample_id, v: {ssm_id_lst:[], ...}

	for (const ssmid of q.ssm_id_lst.split(',')) {
		const l = ssmid.split(ssmIdFieldsSeparator)

		if (l.length == 4) {
			if (!ds.queries.snvindel || !ds.queries.snvindel.byrange)
				throw 'queries.snvindel.byrange missing when id has 4 fields'
			const [chr, tmp, ref, alt] = l
			const pos = Number(tmp)
			if (Number.isNaN(pos)) throw 'no integer position for snvindel from ssm id'

			// new param with rglst as the variant position, also inherit q.tid2value if provided
			const param = Object.assign({}, q, { rglst: [{ chr, start: pos, stop: pos }] })

			const mlst = await ds.queries.snvindel.byrange.get(param)
			for (const m of mlst) {
				if (m.pos != pos || m.ref != ref || m.alt != alt) continue
				for (const s of m.samples) {
					if (!samples.has(s.sample_id)) samples.set(s.sample_id, { sample_id: s.sample_id, ssm_id_lst: [] })
					samples.get(s.sample_id).ssm_id_lst.push(ssmid)
				}
			}
			continue
		}

		if (l.length == 6) {
			if (!ds.queries.svfusion || !ds.queries.svfusion.byrange)
				throw 'queries.svfusion.byrange missing when id has 6 fields'
			const [_dt, chr, _pos, strand, _pi, mname] = l
			const dt = Number(_dt)
			if (dt != dtsv && dt != dtfusionrna) throw 'dt not sv/fusion'
			const pos = Number(_pos)
			if (Number.isNaN(pos)) throw 'position not integer'
			const pairlstIdx = Number(_pi)
			if (Number.isNaN(pairlstIdx)) throw 'pairlstIdx not integer'

			// why has to stop=pos+1
			const param = Object.assign({}, q, { rglst: [{ chr, start: pos, stop: pos + 1 }] })
			const mlst = await ds.queries.svfusion.byrange.get(param)

			for (const m of mlst) {
				if (m.dt != dt || m.pos != pos || m.strand != strand || m.pairlstIdx != pairlstIdx || m.mname != mname) {
					// not this fusion event
					continue
				}
				for (const s of m.samples) {
					if (!samples.has(s.sample_id)) samples.set(s.sample_id, { sample_id: s.sample_id, ssm_id_lst: [] })
					samples.get(s.sample_id).ssm_id_lst.push(ssmid)
				}
			}
			continue
		}
		throw 'unknown format of ssm id'
	}

	if (termidlst && termidlst.length) {
		// append term values to each sample
		for (const s of samples.values()) {
			for (const tid of termidlst) {
				const v = ds.cohort.termdb.q.getSample2value(tid, s.sample_id)
				if (v[0]) {
					s[tid] = v[0].value
				}
			}
		}
	}

	return [...samples.values()]
}

/*
get list of samples that harbor any variant in rglst[]
*/
async function queryServerFileByRglst(q, termidlst, ds) {
	const samples = new Map() // same as in previous function

	if (ds.queries.snvindel) {
		const mlst = await ds.queries.snvindel.byrange.get(q)
		for (const m of mlst) {
			for (const s of m.samples) {
				if (!samples.has(s.sample_id)) samples.set(s.sample_id, { sample_id: s.sample_id, ssm_id_lst: [] })
				samples.get(s.sample_id).ssm_id_lst.push(m.ssm_id)
			}
		}
	}
	if (ds.queries.svfusion) {
		const mlst = await ds.queries.svfusion.byrange.get(q)

		for (const m of mlst) {
			for (const s of m.samples) {
				if (!samples.has(s.sample_id)) samples.set(s.sample_id, { sample_id: s.sample_id, ssm_id_lst: [] })
				samples.get(s.sample_id).ssm_id_lst.push(m.ssm_id)
			}
		}
	}

	if (termidlst && termidlst.length) {
		// append term values to each sample
		for (const s of samples.values()) {
			for (const tid of termidlst) {
				const v = ds.cohort.termdb.q.getSample2value(tid, s.sample_id)
				if (v[0]) {
					s[tid] = v[0].value
				}
			}
		}
	}

	return [...samples.values()]
}

async function make_sunburst(mutatedSamples, ds, q) {
	const termidlst = q.termidlst.split(',')

	// to use stratinput, convert each attr to {k} where k is term id
	const nodes = stratinput(
		mutatedSamples,
		termidlst.map(i => {
			return { k: i }
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

	if (ds.termdb && ds.termdb.termid2totalsize2) {
		const combinations = await get_crosstabCombinations(termidlst, ds, q, nodes)
		await addCrosstabCount_tonodes(nodes, combinations, ds)
		// .cohortsize=int is added to applicable elements of nodes[]
	}

	return nodes
}

async function make_summary(mutatedSamples, ds, q) {
	const entries = []
	/* one element for a term
	{
		termid=str
		termname=str
		numbycategory=[ ]
		density_data=[]
	}
	*/
	const termidlst = q.termidlst.split(',')
	for (const termid of termidlst) {
		const term = ds.cohort.termdb.q.termjsonByOneid(termid)
		if (!term) continue
		// may skip a term
		if (term.type == 'categorical') {
			const cat2count = new Map()
			for (const s of mutatedSamples) {
				const c = s[term.id]
				if (!c) continue
				cat2count.set(c, 1 + (cat2count.get(c) || 0))
			}
			entries.push({
				termid: term.id,
				termname: term.name,
				numbycategory: [...cat2count].sort((i, j) => j[1] - i[1])
			})
		} else if (term.type == 'integer' || term.type == 'float') {
			// TODO do binning instead
			const density_data = await get_densityplot(term, mutatedSamples)
			entries.push({
				termid: term.id,
				termname: term.name,
				density_data
			})
		} else {
			throw 'unknown term type'
		}
	}
	if (ds.termdb.termid2totalsize2) {
		const tv2counts = await ds.termdb.termid2totalsize2.get(termidlst, q)
		for (const { termid, numbycategory } of entries) {
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
termidlst[]
	ordered array of term ids
	must always get category list from first term
	as the list cannot be predetermined due to api and token permissions
	currently has up to three levels
ds{}
q{}
nodes[], optional

<output>
combinations[]
	stores all combinations, each element:
	level 1: {count, id0, v0}
	level 2: {count, id0, v0, id1, v1}
	level 3: {count, id0, v0, id1, v1, id2, v2}
*/
export async function get_crosstabCombinations(termidlst, ds, q, nodes) {
	if (termidlst.length == 0) throw 'zero terms for crosstab'
	if (termidlst.length > 3) throw 'crosstab will not work with more than 3 levels'

	const combinations = []

	// temporarily record categories for each term
	// do not register list of categories in ds, as the list could be token-specific
	// k: term id
	// v: set of category labels
	// if term id is not found, it will use all categories retrieved from api queries
	const id2categories = new Map()
	for (const i of termidlst) id2categories.set(i, new Set())

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
				id2categories.get(n.id0).add(ds.termdb.useLower ? n.v0.toLowerCase() : n.v0)
			}
			if (n.id1 && termidlst[1]) {
				if (!n.v1) {
					// see above comments
					continue
				}
				id2categories.get(n.id1).add(ds.termdb.useLower ? n.v1.toLowerCase() : n.v1)
			}
			if (n.id2 && termidlst[2]) {
				if (!n.v2) {
					continue
				}
				id2categories.get(n.id2).add(ds.termdb.useLower ? n.v2.toLowerCase() : n.v2)
			}
		}
	}

	// get term[0] category total, not dependent on other terms
	const id0 = termidlst[0]
	{
		const tv2counts = await ds.termdb.termid2totalsize2.get([id0])
		for (const [v, count] of tv2counts.get(id0)) {
			const v0 = ds.termdb.useLower ? v.toLowerCase() : v
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

	// get term[1] category total, conditional on id0
	const id1 = termidlst[1]
	if (id1) {
		const promises = []
		// for every id0 category, get id1 category/count conditional on it
		for (const v0 of id2categories.get(id0)) {
			promises.push(ds.termdb.termid2totalsize2.get([id1], { tid2value: { [id0]: v0 } }, v0))
		}
		const lst = await Promise.all(promises)
		for (const [tv2counts, v0] of lst) {
			for (const [s, count] of tv2counts.get(id1)) {
				const v1 = ds.termdb.useLower ? s.toLowerCase() : s
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
	const id2 = termidlst[2]
	if (id2) {
		// has query method for this term, query in combination with id0 & id1 categories
		const promises = []
		for (const v0 of id2categories.get(id0)) {
			for (const v1 of id2categories.get(id1)) {
				const q2 = JSON.parse(JSON.stringify(q))
				promises.push(ds.termdb.termid2totalsize2.get([id2], { tid2value: { [id0]: v0, [id1]: v1 } }, { v0, v1 }))
			}
		}
		const lst = await Promise.all(promises)
		for (const [tv2counts, combination] of lst) {
			for (const [s, count] of v2counts.get(id2)) {
				const v2 = ds.termdb.useLower ? s.toLowerCase() : s
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

/* for an ele of nodes[], find matching ele from combinations[]
and assign total as node.cohortsize
*/
async function addCrosstabCount_tonodes(nodes, combinations, ds) {
	for (const node of nodes) {
		if (!node.id0) continue // root

		if (!node.v0) {
			continue
		}
		const v0 = ds.termdb.useLower ? node.v0.toLowerCase() : node.v0
		if (!node.id1) {
			const n = combinations.find(i => i.id1 == undefined && i.v0 == v0)
			if (n) node.cohortsize = n.count
			continue
		}

		if (!node.v1) {
			// e.g. {"id":"root...HCMI-CMDC...","parentId":"root...HCMI-CMDC","value":1,"name":"","id0":"project","v0":"HCMI-CMDC","id1":"disease"}
			continue
		}
		const v1 = ds.termdb.useLower ? node.v1.toLowerCase() : node.v1
		if (!node.id2) {
			// second level, use crosstabL1
			const n = combinations.find(i => i.id2 == undefined && i.v0 == v0 && i.v1 == v1)
			if (n) node.cohortsize = n.count
			continue
		}

		if (!node.v2) {
			continue
		}
		const v2 = ds.termdb.useLower ? node.v2.toLowerCase() : node.v2
		if (!node.id3) {
			// third level, use crosstabL2
			const n = crosstabL2.find(i => i.v0 == v0 && i.v1 == v1 && i.v2 == v2)
			if (n) node.cohortsize = n.count
		}
	}
}

// TODO
function summary2barchart(summary, q) {
	const data = {
		charts: [
			{
				chartId: '',
				serieses: []
			}
		]
	}
	return data
}
