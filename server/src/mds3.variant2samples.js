const { stratinput } = require('../shared/tree')
const gdc = require('./mds3.gdc')
const { get_densityplot } = require('./mds3.densityPlot')
const {ssmIdFieldsSeparator, mayAddSamplesFromVcfLine} =require('./mds3.init')
const utils = require('./utils')


/*
***************** exported
variant2samples_getresult()
get_crosstabCombinations()


from one or more variants, get list of samples harboring any of the variants

always require a ds found at genome.datasets{}
ds type agnostic (legacy/mds/mds2)
only requires ds.variant2samples{}

client instructs if to return sample list or sunburst summary; server may deny that request based on certain config

q{}
.get=str, samples/sunburst/summary
.ssm_id_lst=str, comma-joined
// later can add ssm_dt_lst="1,2" etc to indicate datatype for each of ssm_id_lst
.termidlst=str
	client always provides this, to reflect any user changes
	if get=sunburst, termidlst is an ordered array of terms, for which to build layered sunburst
	otherwise element order is not essential
*/
export async function variant2samples_getresult(q, ds) {
	// query sample details for list of terms in request parameter

	// each sample obj has keys from .terms[].id
	const samples = await get_samples(q, ds)

	if (q.get == ds.variant2samples.type_samples) return samples
	if (q.get == ds.variant2samples.type_sunburst) return await make_sunburst(samples, ds, q)
	if (q.get == ds.variant2samples.type_summary) return await make_summary(samples, ds, q)
	throw 'unknown get type'
}

async function get_samples(q, ds) {
	const termidlst = q.termidlst ? q.termidlst.split(',') : []
	if (q.get == ds.variant2samples.type_samples && ds.variant2samples.extra_termids_samples) {
		// extra term ids to add for get=samples query
		termidlst.push(...ds.variant2samples.extra_termids_samples)
	}
	if (ds.variant2samples.gdcapi) {
		return await gdc.getSamples_gdcapi(q, termidlst, ds)
	}

	/* from server-side files
	action depends on details:
	- file type (gz or db perhaps)
	- data type (snv or sv)
	- query by what (ssm id, region, or isoform)
	*/

	if( q.ssm_id_lst) {
		/* querying server side files based on ssm ids
		the ids must be in chr.pos... format for both snvindel and svfusion
		thus can extract coordinate from a "ssm" to query
		*/
		return await queryServerFileBySsmid(q, termidlst, ds)
	}

	if(q.isoform) { 
		throw 'q.isoform provided when querying server side files, query method not implemented yet'
	}

	throw 'unknown q{} option when querying server side files'
}

async function queryServerFileBySsmid(q, termidlst, ds) {
	/*
	q.ssm_id_lst can be multiple data types
	snvindel id has 4 fields, and svfusion id has 6 fields
	*/
	const samples = []

	for(const ssmid of q.ssm_id_lst.split(',')) {
		const l = ssmid.split(ssmIdFieldsSeparator)
		if(l.length==4) {
			//////// ssm is snv
			const [chr, tmp, ref, alt] = l
			const pos = Number(tmp)
			if(Number.isNaN(pos)) throw 'no integer position for snvindel from ssm id'
			const mlst = await ds.queries.snvindel.byrange.get({rglst:[{chr, start:pos, stop:pos}]})
			for(const m of mlst) {
				if(m.pos != pos || m.ref!=ref && m.alt!=alt) continue
				for(const s of m.samples) {
					s.ssm_id = ssmid
					samples.push(s)
				}
			}
				
		} else if(l.length==6) {
			//////// ssm is svfusion
			// dt, chr, pos, strand, pairlstIdx, partner gene
			const [_dt, chr, _pos, strand, _pi, mname] = l
			const dt = Number(_dt)
			if(dt!=2 && dt!=5) throw 'dt not sv/fusion'
			const pos = Number(_pos)
			if(Number.isNaN(pos)) throw 'position not integer'
			const pairlstIdx = Number(_pi)
			if(Number.isNaN(pairlstIdx)) throw 'pairlstIdx not integer'
			const mlst = await ds.queries.svfusion.byrange.get({rglst:[{chr, start:pos, stop:pos}]})
			for(const m of mlst) {
				if(m.pos!=pos || m.strand!=strand || m.pairlstIdx!=pairlstIdx || m.mname!=mname) continue
				for(const s of m.samples) {
					s.ssm_id = ssmid
					samples.push(s)
				}
			}

		} else {
			throw 'unknown format of ssm id'
		}
	}

	if(termidlst && termidlst.length) {
		// todo: add annotation
	}

	return samples

	/*
	const ssmidByType = {}
	if(ds.queries.snvindel
		&& ds.queries.snvindel.byrange
		&& ds.queries.snvindel.byrange._tk) {
		return await get_samples_vcf_byssmid(q, termidlst, ds.queries.snvindel.byrange._tk)
	}
	*/
}


async function make_sunburst(samples, ds, q) {
	const termidlst = q.termidlst.split(',')

	// to use stratinput, convert each attr to {k} where k is term id
	const nodes = stratinput(
		samples,
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
		await gdc.addCrosstabCount_tonodes(nodes, combinations)
		// .cohortsize=int is added to applicable elements of nodes[]
	}
	return nodes
}

async function make_summary(samples, ds, q) {
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
			for (const s of samples) {
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
			// later replace density with bin breakdown
			const density_data = await get_densityplot(term, samples)
			entries.push({
				termid: term.id,
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
	id2categories.set(termidlst[0], new Set())
	if (termidlst[1]) id2categories.set(termidlst[1], new Set())
	if (termidlst[2]) id2categories.set(termidlst[2], new Set())

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
				id2categories.get(n.id0).add(n.v0.toLowerCase())
			}
			if (n.id1 && termidlst[1]) {
				if (!n.v1) {
					// see above comments
					continue
				}
				id2categories.get(n.id1).add(n.v1.toLowerCase())
			}
			if (n.id2 && termidlst[2]) {
				if (!n.v2) {
					continue
				}
				id2categories.get(n.id2).add(n.v2.toLowerCase())
			}
		}
	}

	// get term[0] category total, not dependent on other terms
	const id0 = termidlst[0]
	{
		const tv2counts = await ds.termdb.termid2totalsize2.get([id0])
		for (const [v, count] of tv2counts.get(id0)) {
			const v0 = v.toLowerCase()
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
		for (const [tv2counts, combination] of lst) {
			for (const [s, count] of tv2counts.get(id1)) {
				const v1 = s.toLowerCase()
				if (useall) {
					id2categories.get(id1).add(v1)
					combinations.push({ count, id0, v0: combination, id1, v1 })
				} else {
					if (id2categories.get(id1).has(v1)) {
						combinations.push({ count, id0, v0: combination, id1, v1 })
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
				const v2 = s.toLowerCase()
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

async function get_samples_vcf_byssmid(q, termidlst, _tk) {
	const samples = []
	for(const ssmId of q.ssm_id_lst.split(',')) {
		// chr.pos.ref.alt
		const ssmFields = ssmId.split(ssmIdFieldsSeparator)
		if(ssmFields.length!=4) throw 'ssmid not 4 fields'
		const pos = Number(ssmFields[1])
		if(Number.isNaN(pos)) throw 'ssmid position not integer'
		await utils.get_lines_bigfile({
			args: [
				_tk.file || _tk.url,
				(_tk.nochr ? ssmFields[0].replace('chr', '') : ssmFields[0]) + ':' + pos + '-' + (pos+1)
			],
			dir: _tk.dir,
			callback: line => {
				const l = line.split('\t')
				if(l[1]!=ssmFields[1] || l[3]!=ssmFields[2] || l[4]!=ssmFields[3]) {
					// not matching with this ssm
					return
				}
				const m = {}
				mayAddSamplesFromVcfLine( {_tk}, m, l, q.get=='samples' )
				if(!m.samples) return
				for(const sample of m.samples) {
					samples.push(sample)
				}
			}
		})
	}
	return samples
}
