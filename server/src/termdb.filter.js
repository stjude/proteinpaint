import { getBin, dictionaryNumericTypes, dtTermTypes, isNonDictionaryType } from '#shared/terms.js'
import { TermTypes } from '#types'
import { validateTermCollectionTvs, getTvsDenominators } from '#shared/filter.js'
import { getSnpData, getData, shouldMapParent2Children, getSampleTypesSqlList } from './termdb.matrix.js'
import { filterByItem, tvsUsesMafFilter } from './mds3.init.js'
import { sql } from './sql.ts'

/*
ds: required by get_numerical()

CTEname: Provides the prefix of CTEs at this level (filter.lst[])
  Optional, not required for root level.
  Each recursion will append a postfix "_i" to the CTEname

Recursively generates CTE statements based on the nested filter
each run processes one level of filter.lst[]
One CTE is made for each item of filter.lst[], with name "CTEname_<i>"
A superCTE is made to cap this level, with name "CTEname"

returns
{
	filters: sql`` fragment of the CTE cascade, with the values bound as parameters,
		to be used as sql`WITH ${filter.filters} ... FROM ${sql.id(filter.CTEname)}`
	CTEs: [] sql`` fragment of each individual CTE
	CTEname: str
}
*/

// dummy $id for making up tw from tvs ({$id,term:tvs:term}) as required by getters
const $id = 'xx'

export async function getFilterCTEs(filter, ds, mapParent2Children, sampleTypes, CTEname = 'f') {
	if (!filter) return
	if (filter.type != 'tvslst') throw 'filter.type is not "tvslst" but: ' + filter.type
	if (!Array.isArray(filter.lst)) throw 'filter.lst must be an array'
	if (filter.lst.length == 0) {
		// an empty filter.lst[] at the top level is acceptable and equivalent to having a falsy (null, undefined) filter;
		// a nested filter always has a non-default CTEname value as 4th argument and must not have an empty lst[]
		if (CTEname != 'f') console.warn('!!! nested filter.lst[] is zero length, see if is an error !!!')
		return
	}
	if (filter.lst.length == 1) {
		// only one element at this level, disregard "join"
		//if (filter.lst[0].type == 'tvslst') throw 'only one element at a level: type should not be "tvslst"'
	} else {
		// multiple elements at this level
		if (filter.join != 'or' && filter.join != 'and')
			throw 'multiple elements at a level: filter.join must equal either "or" or "and"'
		if (filter.lst.length == 2 && filter.lst[1].type == 'tvslst' && filter.lst[1].lst.length === 0) {
			throw 'empty nested filter, please use getNormalRoot() to normalize the filter shape'
		}
	}
	if (!('in' in filter)) filter.in = true // currently not handled by the client

	// list of CTEnames in filter.lst[]
	const thislevelCTEnames = []
	// cumulative CTE of this level and sub levels, as sql`` fragments that also carry the bound values
	const CTEs = []
	for (const [i, item] of filter.lst.entries()) {
		if (item.tvs?.term?.id && (!item.tvs.term.type || !item.tvs.term.name)) {
			// handle stripped-down dictionary termwrapper
			item.tvs.term = ds.cohort.termdb.q.termjsonByOneid(item.tvs.term.id)
			if (!item.tvs.term) throw `invalid term.id in tvs`
		}

		const CTEname_i = CTEname + '_' + i
		let f
		if (item.type == 'tvslst') {
			if (item.lst.length == 0) continue // do not process blank list

			f = await getFilterCTEs(item, ds, mapParent2Children, sampleTypes, CTEname_i)
			// .filters: the CTE cascade, not used here!
			// .CTEs: [] list of individual CTE fragments
			// .CTEname: str
		} else if (!item.tvs) {
			throw `filter item should have a 'tvs' or 'lst' property`
		} else if (item.tvs.term.type == TermTypes.GENE_EXPRESSION) {
			f = await get_geneExpression(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else if (item.tvs.term.type == TermTypes.ISOFORM_EXPRESSION) {
			f = await get_isoformExpression(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == TermTypes.METABOLITE_INTENSITY) {
			f = await get_metaboliteIntensity(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == TermTypes.PROTEOME_ABUNDANCE) {
			f = await get_proteomeAbundance(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == TermTypes.SSGSEA) {
			f = await get_ssGSEA(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == TermTypes.DNA_METHYLATION) {
			f = await get_dnaMethylation(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == TermTypes.JUNCTION) {
			f = await get_junction(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == TermTypes.PSEUDOBULK) {
			f = await get_pseudobulk(item.tvs, CTEname_i, ds)
		} else if (dtTermTypes.has(item.tvs.term.type)) {
			f = await get_dtTerm(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else if (item.tvs.term.type == 'categorical') {
			f = get_categorical(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
			// .CTEs: []
			// .CTEname
		} else if (item.tvs.term.type == 'survival') {
			f = get_survival(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else if (item.tvs.term.type == 'samplelst') {
			f = get_samplelst(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else if (dictionaryNumericTypes.has(item.tvs.term.type)) {
			f = get_numerical(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else if (item.tvs.term.type == 'condition') {
			f = get_condition(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'geneVariant') {
			f = await get_geneVariant(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else if (item.tvs.term.type == 'termCollection') {
			f = await get_termCollection(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else if (item.tvs.term.type == 'snp') {
			f = await get_snp(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'multivalue') {
			f = get_multivalue(item.tvs, CTEname_i, ds, mapParent2Children, sampleTypes)
		} else {
			throw 'unknown term type'
		}
		thislevelCTEnames.push(f.CTEname)
		CTEs.push(...f.CTEs)
	}
	const JOINOPER = filter.join == 'and' ? sql`\nINTERSECT\n` : sql`\nUNION\n`
	const superCTE = sql.join(
		thislevelCTEnames.map(name => sql`SELECT * FROM ${sql.id(name)}`),
		JOINOPER
	)
	if (filter.in) {
		CTEs.push(toCTE(CTEname, superCTE))
	} else {
		CTEs.push(
			toCTE(
				CTEname,
				sql`SELECT id as sample
					FROM sampleidmap
					WHERE sample NOT IN (
						${superCTE}
					)`
			)
		)
	}
	return {
		filters: sql.join(CTEs, sql`,\n`),
		CTEs,
		CTEname
	}
}

/* a CTE named by CTEname, for a query that returns the sample column */
function toCTE(CTEname, query) {
	return sql`
		${sql.id(CTEname)} AS (
			${query}
		)`
}

/* a query of samples by their ids, an empty list matches no sample */
function sampleIdsQuery(samples) {
	return sql`SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${sql.list(samples, { allowEmpty: true })})`
}

/* a filter result of the samples by their ids, see sampleIdsQuery() */
function sampleIdsResult(CTEname, samples, tvs, ds, mapParent2Children, sampleTypes) {
	let query = sampleIdsQuery(samples)
	if (tvs && shouldMapParent2Children({ term: tvs.term }, ds, mapParent2Children, sampleTypes)) {
		query = getChildren(query, sampleTypes, ds)
	}
	return { CTEs: [toCTE(CTEname, query)], CTEname }
}

// makesql_by_tvsfilter helpers
// put here instead of inside makesql_by_tvsfilter
// to parse function once at server start instead of
// multiple times per server request
function get_categorical(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	let query = sql`SELECT sample
	FROM anno_categorical 
	WHERE term_id = ${tvs.term.id}
	AND value ${tvs.isnot ? sql`NOT` : sql``} IN (${sql.list(
		tvs.values.map(i => i.key),
		{ allowEmpty: true }
	)})`
	if (shouldMapParent2Children({ term: tvs.term }, ds, mapParent2Children, sampleTypes)) {
		query = getChildren(query, sampleTypes, ds)
	}
	return { CTEs: [toCTE(CTEname, query)], CTEname }
}

function get_survival(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	let query = sql`SELECT sample
	FROM survival
	WHERE term_id = ${tvs.term.id}
	${tvs.q?.cutoff ? sql`AND tte >= ${tvs.q.cutoff}` : sql``}
	AND exit_code ${tvs.isnot ? sql`NOT` : sql``} IN (${sql.list(
		tvs.values.map(i => i.key),
		{ allowEmpty: true }
	)})`

	if (shouldMapParent2Children({ term: tvs.term }, ds, mapParent2Children, sampleTypes)) {
		query = getChildren(query, sampleTypes, ds)
	}
	return { CTEs: [toCTE(CTEname, query)], CTEname }
}

function get_samplelst(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	const samples = []
	for (const field in tvs.term.values) {
		const list = tvs.term.values[field].list
		samples.push(...list)
	}
	let query = sql`SELECT id as sample
				FROM sampleidmap
				WHERE id ${tvs.isnot ? sql`NOT IN` : sql`IN`} (${sql.list(
		samples.map(i => i.sampleId || i.sample),
		{ allowEmpty: true }
	)})`
	if (shouldMapParent2Children({ term: tvs.term }, ds, mapParent2Children, sampleTypes)) {
		query = getChildren(query, sampleTypes, ds)
	}
	return { CTEs: [toCTE(CTEname, query)], CTEname }
}

// TODO: may retire get_geneVariant() as geneVariant filtering is now
// performed by get_dtTerm()
async function get_geneVariant(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	const tw = { $id, term: tvs.term, q: {} }
	const data = await ds.mayGetGeneVariantData(tw, { genome: ds.genomename })
	/*
	data here is map of sampleId-mutationData pairs, e.g.
	63 => { sample: 63, TP53: { key: 'TP53', values: [Array], label: 'TP53' } },
	56 => {}, ...
	*/
	const samplenames = []
	for (const [key, value] of data) {
		const sampleValues = value[$id].values
		/*
		sampleVlaues here is an array of results for each available dt for the sampleID. e.g.
		[
			{ dt: 1, class: 'WT', _SAMPLEID_: 21, origin: 'germline' },
			{ dt: 1, class: 'WT', _SAMPLEID_: 21, origin: 'somatic' },
			{ dt: 2, class: 'Blank', _SAMPLEID_: 21 },
			{ dt: 4, class: 'WT', _SAMPLEID_: 21 }
		]
		*/
		let includeSample = true
		for (const tvsValue of tvs.values) {
			/* tvs.values is an array that stores classes (for each available dt) that have/haven't been crossed out by the user at this round of edit-and-apply, e.g.
            [
                {dt: 1, mclassLst: ['WT'], mclassExcludeLst: ['Blank'], origin: 'germline'}
                {dt: 1, mclassLst: ['Blank', 'WT', 'M'], mclassExcludeLst:[], origin:'somatic'},
                {dt: 2, mclassLst: ['Blank', 'WT'], mclassExcludeLst:[]}
                {dt: 4, mclassLst: ['WT', 'CNV_loss'], mclassExcludeLst:[]}
            ]
            */
			const sampleValueLst = sampleValues.filter(
				v => v.dt == tvsValue.dt && (tvsValue.origin ? tvsValue.origin == v.origin : true)
			)
			for (const sampleValue of sampleValueLst) {
				if (tvsValue.mclassExcludeLst.includes(sampleValue?.class)) {
					includeSample = false
					break
				}
			}
		}
		if (includeSample) samplenames.push(key)
	}
	return sampleIdsResult(CTEname, samplenames, tvs, ds, mapParent2Children, sampleTypes)
}

function isInRange(val, range, isnot) {
	let left, right
	if (range.startunbounded) left = true
	else if ('start' in range) left = range.startinclusive ? val >= range.start : val > range.start
	if (range.stopunbounded) right = true
	else if ('stop' in range) right = range.stopinclusive ? val <= range.stop : val < range.stop
	return isnot ? !(left && right) : left && right
}

function emptyFilterResult(CTEname, mapParent2Children, ds, sampleTypes) {
	let query = sql`SELECT id as sample FROM sampleidmap WHERE 0`
	if (shouldMapParent2Children({}, ds, mapParent2Children, sampleTypes)) {
		query = getChildren(query, sampleTypes, ds)
	}
	return { CTEs: [toCTE(CTEname, query)], CTEname }
}

/** FIXME deadcode. revive for categorical collection tvs
 */
async function get_termCollection_custom(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	const memberKey = tvs.values?.[0]?.key
	const range = tvs.ranges?.[0]
	if (!memberKey || !range) return emptyFilterResult(CTEname, mapParent2Children, ds, sampleTypes)

	// Find the member term being filtered on
	const mt = tvs.term.termlst?.find(t => (t.id || t.name) === memberKey)
	if (!mt) return emptyFilterResult(CTEname, mapParent2Children, ds, sampleTypes)

	// Call the existing query handler for this member's dataType
	const dataType = mt.dataType || 'isoformExpression'
	const queryHandler = ds.queries?.[dataType]
	if (!queryHandler) throw `not supported by dataset: ${dataType}`

	const tw = { $id, term: { type: dataType, isoform: mt.isoform, gene: mt.gene, name: mt.name } }
	const data = await queryHandler.get({ terms: [tw] }, ds)
	const values = data.term2sample2value?.get($id)
	if (!values) return emptyFilterResult(CTEname, mapParent2Children, ds, sampleTypes)

	return numericSampleData2tvs(tvs, CTEname, values)
}

/** True when the member terms of a termCollection are non-dictionary terms, e.g.
 *  isoformExpression. Decided by the member term type, the same way getData() routes
 *  a term to a query handler instead of the sqlite db; the client-supplied isCustom
 *  flag is not consulted, it only tells if the collection is termdbConfig-supplied.
 *  All members share one term type, as required by validateTermCollectionTerm().
 *  A term without termlst[] is assumed to be a dictionary collection: only the
 *  termdbConfig-supplied ones are addressable by termIds[] alone. */
function isNonDictMemberType(term) {
	const memberType = term.termlst?.[0]?.type
	return memberType ? isNonDictionaryType(memberType) : false
}

/** Fraction filter for termCollections of non-dictionary member terms, e.g. isoform
 *  expression collections created dynamically. The fraction is on a 0 to 1 scale,
 *  same as the value of a TermCollectionTWFraction tw.
 *
 *  Cannot use getData() here because it requires req.query.__protected__ (auth
 *  context set by Express middleware), which is not available inside the filter
 *  evaluation path. Instead, call the underlying query handlers (e.g.
 *  isoformExpression HDF5 handler) directly for each member term, then compute
 *  the numerator/denominator fraction client-side and filter samples. */
async function get_termCollection_nonDict_fraction(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	// an empty ranges[] applies no range constraint, same as get_numerical(): the sample only
	// needs a value, e.g. when listing the samples of an unbrushed violin plot
	const range = tvs.ranges?.[0]
	// only the fraction is supported here, so numerators[] is required, unlike a dictionary
	// collection tvs that may instead brush on a single member
	if (!tvs.term.numerators) throw new Error('termCollection tvs is missing term.numerators[]')
	validateTermCollectionTvs(tvs.term)
	const termlst = tvs.term.termlst // nonempty, as required to route here
	const numerators = tvs.term.numerators
	const denominators = getTvsDenominators(tvs.term)

	// Fetch values for all member terms via query handlers directly.
	// Group members by data type so each handler is called once with all its
	// terms batched together (avoids sequential HDF5 reads).
	// sampleValues: { sampleId: { memberId: value, ... }, ... }
	const sampleValues = {}
	const byDataType = new Map()
	for (const mt of termlst) {
		// a member's term type is the ds.queries[] key of its handler, e.g. isoformExpression or junction
		const dataType = mt.type
		if (!ds.queries?.[dataType]) {
			throw new Error('unknown dataType')
		}
		if (!byDataType.has(dataType)) byDataType.set(dataType, [])
		const memberId = mt.id || mt.name
		byDataType.get(dataType).push({
			memberId,
			tw: { $id: memberId, term: mt }
		})
	}
	for (const [dataType, members] of byDataType) {
		const queryHandler = ds.queries[dataType]
		try {
			const data = await queryHandler.get({ terms: members.map(m => m.tw) }, ds)
			for (const { memberId } of members) {
				const values = data.term2sample2value?.get(memberId)
				if (!values) continue
				for (const [sid, val] of Object.entries(values)) {
					if (!sampleValues[sid]) sampleValues[sid] = {}
					sampleValues[sid][memberId] = val
				}
			}
		} catch (e) {
			// The handler throws a string like "No data available for the input ..."
			// when no expression data exists for the queried terms. This is expected
			// and safe to skip. Rethrow unexpected errors (e.g. file read failures).
			const msg = typeof e === 'string' ? e : e?.message || ''
			if (!msg.startsWith('No data available')) throw e
		}
	}

	// Calculate the fraction and filter samples
	const samplenames = []
	for (const [sid, memberVals] of Object.entries(sampleValues)) {
		let numeratorSum = 0
		let totalSum = 0
		for (const [mid, val] of Object.entries(memberVals)) {
			if (!denominators.includes(mid)) continue
			totalSum += val
			if (numerators.includes(mid)) numeratorSum += val
		}
		const fraction = totalSum == 0 ? 0 : numeratorSum / totalSum
		if (!range || isInRange(fraction, range, tvs.isnot)) samplenames.push(sid)
	}

	if (!samplenames.length) return emptyFilterResult(CTEname, mapParent2Children, ds, sampleTypes)
	return sampleIdsResult(CTEname, samplenames, tvs, ds, mapParent2Children, sampleTypes)
}

async function get_termCollection(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	if (tvs.term.memberType === 'categorical') {
		throw new Error('termcollection memberType=categorical not supported yet')
	}
	if (tvs.term.memberType !== 'numeric') throw new Error('termcollection memberType not categorical/numeric')
	if (isNonDictMemberType(tvs.term)) {
		// Members are non-dictionary terms, which are not in the sqlite db: their values come
		// from a ds.queries[] handler. Also bypasses the getData() path below because getData()
		// requires __protected__ auth context that is unavailable during filter CTE evaluation.
		return await get_termCollection_nonDict_fraction(tvs, CTEname, ds, mapParent2Children, sampleTypes)
	}
	const denominators = getTvsDenominators(tvs.term)
	// only validate a fraction tvs: a tvs brushed on a single member may not carry term.termlst[]
	if (tvs.term.numerators) validateTermCollectionTvs(tvs.term)
	const tw = { $id, term: tvs.term, q: {} }
	const data = await getData({ terms: [tw] }, ds)
	const samplenames = []
	if (!data.samples) return emptyFilterResult(CTEname, mapParent2Children, ds, sampleTypes)
	for (const [key, value] of Object.entries(data.samples)) {
		const sampleEntry = value[$id]
		if (!sampleEntry) continue
		const sampleValues = sampleEntry.value
		if (!sampleValues || typeof sampleValues !== 'object') continue

		const brushedLabel = tvs.values?.[0]?.key
		if (brushedLabel) {
			// Brush is on a specific member term. tvs.values[0].key may be
			// a display label (e.g. "Cytarabine LC50 (normalized)") or a term ID.
			// Resolve to the term ID used as key in sampleValues.
			const termlst = tvs.term.termlst || []
			const mt = termlst.find(t => t.name === brushedLabel || t.id === brushedLabel)
			const memberId = mt?.id || brushedLabel
			const val = sampleValues[memberId]
			if (val == null || typeof val !== 'number') continue
			// an empty ranges[] applies no range constraint, same as get_numerical()
			const range = tvs.ranges?.[0]
			if (!range || isInRange(val, range, tvs.isnot)) samplenames.push(key)
		} else if (tvs.term.numerators) {
			// No specific member brushed — filter by the numerator/denominator fraction,
			// on a 0 to 1 scale, same as the value of a TermCollectionTWFraction tw
			let numeratorSum = 0
			let totalSum = 0
			for (const [key, value] of Object.entries(sampleValues)) {
				if (!denominators.includes(key)) continue
				totalSum += value
				if (tvs.term.numerators.includes(key)) numeratorSum += value
			}
			const fraction = totalSum == 0 ? 0 : numeratorSum / totalSum
			// an empty ranges[] applies no range constraint, same as get_numerical()
			const range = tvs.ranges?.[0]
			if (!range || isInRange(fraction, range, tvs.isnot)) samplenames.push(key)
		}
	}

	// no matching sample, e.g. none has a computable value: an empty IN () is invalid sql
	if (!samplenames.length) return emptyFilterResult(CTEname, mapParent2Children, ds, sampleTypes)
	return sampleIdsResult(CTEname, samplenames, tvs, ds, mapParent2Children, sampleTypes)
}

async function get_snp(tvs, CTEname, ds) {
	// get sample genotypes for snp
	const sampleGTs = await getSnpData({ term: tvs.term }, { ds })
	// get genotypes of snp in filter
	const filterGTs = tvs.values.map(v => v.key)
	// filter for samples with genotypes in filter
	const samples = sampleGTs.filter(s => filterGTs.includes(s.gt)).map(s => s.sample_id)
	return sampleIdsResult(CTEname, samples)
}

async function get_geneExpression(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	const q = ds.queries?.geneExpression
	if (!q) throw 'not supported' // guard against request to unsupported data. FIXME may improve filterui to gracefully handle such and avoid showing completely broken mass ui when the request comes from handwrite state or url
	const data = await q.get({ terms: [{ $id, term: tvs.term }], mapParent2Children, sampleTypes }, ds)
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}
async function get_isoformExpression(tvs, CTEname, ds) {
	const q = ds.queries?.isoformExpression
	if (!q) throw 'not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term }] }, ds)
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}
async function get_metaboliteIntensity(tvs, CTEname, ds) {
	const q = ds.queries?.metaboliteIntensity
	if (!q) throw 'not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term }] })
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}
async function get_proteomeAbundance(tvs, CTEname, ds) {
	const q = ds.queries?.proteome
	if (!q) throw 'not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term }], dataTypeDetails: tvs.term.dataTypeDetails })
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}
async function get_ssGSEA(tvs, CTEname, ds) {
	const q = ds.queries?.ssGSEA
	if (!q) throw 'ssGSEA not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term }] })
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}
async function get_dnaMethylation(tvs, CTEname, ds) {
	const q = ds.queries?.dnaMethylation
	// q.get exists only when the dataset has a dnaMethylation term getter configured (CpG-level .file
	// or an element-matrix-backed fallback). If missing, the term type is not supported (or the request is stale)
	if (!q?.get) throw 'dnaMethylation not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term }] })
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}
async function get_junction(tvs, CTEname, ds) {
	const q = ds.queries?.junction
	if (!q?.get) throw 'junction not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term, q: tvs.q }] })
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}
async function get_pseudobulk(tvs, CTEname, ds) {
	const q = ds.queries?.singleCell?.pseudobulk
	if (!q?.get) throw 'pseudobulk not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term, q: tvs.q }] }, ds)
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}

/* Shared by every non-dictionary numeric term type (geneExpression, isoformExpression,
metaboliteIntensity, proteomeAbundance, ssGSEA, dnaMethylation, junction, pseudobulk).

tvs.isnot inverts the membership test, exactly as isInRange() does for the paths above. Without
it a negated filter matched the SAME samples as the un-negated one, so an auto-generated
complement group ("Not in X", built by negateFilter() flipping tvs.isnot) came back identical to
the group it was supposed to complement -- surfacing downstream as "N samples appear in both
groups" in the two-group analyses.

A sample with no value for the term is absent from termData and so joins neither the group nor
its complement. That is deliberate: missing data is unknown, not "outside the range". */
function numericSampleData2tvs(tvs, CTEname, termData) {
	const samples = []

	for (const sample in termData) {
		const value = termData[sample]
		// -1 means the value fell in none of tvs.ranges
		const inRanges = getBin(tvs.ranges, value) != -1
		if (tvs.isnot ? !inRanges : inRanges) samples.push(sample)
	}
	return sampleIdsResult(CTEname, samples)
}

async function get_dtTerm(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	const tw = { $id, term: tvs.term.parentTerm, q: { dtLst: [tvs.term.dt] } }
	// the tvs is applied below by filterByItem(), outside of tw, so its maf filter is invisible to
	// mayGetGeneVariantData(); ask for the allele counts it will read (a getter that must fetch them
	// separately, like gdc's, only does so on request)
	const addReadDepth = tvsUsesMafFilter(tvs)
	const data = await ds.mayGetGeneVariantData(tw, {
		genome: ds.genomename,
		mapParent2Children,
		sampleTypes,
		addReadDepth
	})

	const samples = []
	for (const [sample, value] of data) {
		const mlst = value[$id]?.values
		if (!mlst) throw 'mlst is missing'
		const filter = { type: 'tvs', tvs }
		const [pass, tested] = filterByItem(filter, mlst)
		if (pass) samples.push(sample)
	}
	return sampleIdsResult(CTEname, samples)
}

function get_numerical(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	/*
for the case e.g. '0' is for "Not exposed", range.value can be either '0' or 0, string or number
as it cannot be decided what client will provide
so here need to allow both string and number as range.value
*/
	if (!tvs.ranges)
		throw `tvs.ranges{} missing, tvs.ranges = ${tvs.ranges} [server/src/termdb.filter.js get_numerical()]`
	// get term object
	const term = ds.cohort.termdb.q.termjsonByOneid(tvs.term.id)
	const annoTable = `anno_${term.type}`
	if (!dictionaryNumericTypes.has(term.type)) throw `unknown '${annoTable}' table in get_numerical()`

	const rangeclauses = []
	let hasactualrange = false // if true, will exclude special categories

	for (const range of tvs.ranges) {
		if ('value' in range) {
			// special category
			// where value for ? can be number or string, doesn't matter
			const v = '' + range.value
			rangeclauses.push(tvs.isnot ? sql`value != ${v}` : sql`value = ${v}`)
		} else {
			// actual range
			hasactualrange = true
			const lst = []
			if (!range.startunbounded) {
				lst.push(range.startinclusive ? sql`value >= ${range.start}` : sql`value > ${range.start}`)
			}
			if (!range.stopunbounded) {
				lst.push(range.stopinclusive ? sql`value <= ${range.stop}` : sql`value < ${range.stop}`)
			}
			if (lst.length) rangeclauses.push(sql`${tvs.isnot ? sql`NOT ` : sql``}(${sql.join(lst, sql` AND `)})`)
		}
	}

	let excludevalues
	if (hasactualrange && term.values) {
		excludevalues = Object.keys(term.values)
			.filter(key => term.values[key].uncomputable)
			.map(Number)
			.filter(key => tvs.isnot || !tvs.ranges.find(range => 'value' in range && Number(range.value) == key))
	}

	let query = sql`SELECT sample
					FROM ${sql.id(annoTable)}
					WHERE term_id = ${tvs.term.id}
					${rangeclauses.length ? sql`AND (${sql.join(rangeclauses, sql` OR `)})` : sql``}
					${excludevalues?.length ? sql`AND value NOT IN (${sql.list(excludevalues)})` : sql``}`

	if (shouldMapParent2Children({ term: tvs.term }, ds, mapParent2Children, sampleTypes)) {
		query = getChildren(query, sampleTypes, ds)
	}

	return { CTEs: [toCTE(CTEname, query)], CTEname }
}

function get_condition(tvs, CTEname) {
	let value_for
	if (tvs.bar_by_children) value_for = 'child'
	else if (tvs.bar_by_grade) value_for = 'grade'
	else throw 'must set the bar_by_grade or bar_by_children query parameter'

	let restriction
	if (tvs.value_by_max_grade) restriction = 'max_grade'
	else if (tvs.value_by_most_recent) restriction = 'most_recent'
	else if (tvs.value_by_computable_grade) restriction = 'computable_grade'
	else throw 'unknown setting of value_by_?'

	// table and column names are selected from fixed values above, not from request values
	const table = value_for == 'grade' ? sql`precomputed_chc_grade` : sql`precomputed_chc_child`
	const CTEs = []
	if (tvs.values) {
		const query = sql`SELECT sample
				FROM ${table}
				WHERE term_id = ${tvs.term.id}
				AND ${sql.id(restriction)} = 1
				AND value ${tvs.isnot ? sql`NOT` : sql``} IN (${sql.list(
			tvs.values.map(i => '' + i.key),
			{ allowEmpty: true }
		)})`
		CTEs.push(toCTE(CTEname, query))
	} else if (tvs.grade_and_child) {
		//grade_and_child: [{grade, child_id}]
		throw `-- Todo: tvs.grade_and_child`
	} else {
		throw 'unknown condition term filter type: expecting term-value "values" or "grade_and_child" key'
	}
	return {
		CTEs,
		CTEname
	}
}

const validTvsJoin = new Set(['and', 'or'])

function get_multivalue(tvs, CTEname, ds, mapParent2Children, sampleTypes) {
	if (tvs.withinValues) {
		/* fail-closed access-control mode: keep a sample only if it has at least one
		positive membership AND every positive membership is among tvs.values.
		a membership outside the list hides the sample. Used by a dataset
		getAdditionalFilter() to restrict samples to authorized categories */
		if (!tvs.values.every(v => v && v.key !== undefined)) throw 'tvs.values[].key missing for withinValues'
		const query = sql`SELECT sample	
		    FROM anno_multivalue
			WHERE term_id = ${tvs.term.id}
			AND EXISTS (SELECT 1 FROM json_each(anno_multivalue.value) j WHERE j.value > 0)
			AND NOT EXISTS (
				SELECT 1 FROM json_each(anno_multivalue.value) j
				WHERE j.value > 0 AND j.key NOT IN (${sql.list(
					tvs.values.map(v => v.key),
					{ allowEmpty: true }
				)})
			)`
		const mappedQuery = shouldMapParent2Children({ term: tvs.term }, ds, mapParent2Children, sampleTypes)
			? getChildren(query, sampleTypes, ds)
			: query
		return { CTEs: [toCTE(CTEname, mappedQuery)], CTEname }
	}
	// default to join = 'or', more permissive/less likely to break,
	// and also compatible with default join operator for categorical terms
	if (!tvs.join) tvs.join = 'or'
	if (tvs.values.length > 1 && !validTvsJoin.has(tvs.join)) {
		// multivalue term, when used as a filter, must have a valid "join" operator
		throw `invalid tvs.join='${tvs.join}' when tvs.values.length > 1`
	}
	// note that if there is only 1 tvs.values entry,
	// tvs.join will not be needed or used to "join" values
	// each key is tested via json_each with a bound parameter, so keys containing
	// json-path or sql metacharacters (period, quote) are safe
	const membershipTest = sql.join(
		tvs.values.map(
			v => sql`EXISTS (SELECT 1 FROM json_each(anno_multivalue.value) j WHERE j.key = ${v.key} AND j.value > 0)`
		),
		tvs.join == 'and' ? sql` and ` : sql` or `
	)
	// isnot negates the whole membership test over annotated samples,
	// matching the NOT IN semantics of categorical terms
	let query = sql`SELECT sample
	FROM anno_multivalue
	WHERE term_id = ${tvs.term.id} AND ${tvs.isnot ? sql`NOT (${membershipTest})` : sql`(${membershipTest})`}`
	if (shouldMapParent2Children({ term: tvs.term }, ds, mapParent2Children, sampleTypes)) {
		query = getChildren(query, sampleTypes, ds)
	}
	return { CTEs: [toCTE(CTEname, query)], CTEname }
}

function getChildren(query, sampleTypes, ds) {
	const sampleTypeFilter = sampleTypes?.length
		? sql`AND sm.sample_type IN (${getSampleTypesSqlList(sampleTypes, ds)})`
		: sql``
	return sql`SELECT sa.sample_id as sample
	FROM sample_ancestry sa
	JOIN sampleidmap sm ON sa.sample_id = sm.id
	WHERE sa.ancestor_id in (${query})
	${sampleTypeFilter}`
}
