import {
	isDictionaryType,
	TermTypes,
	getBin,
	annoNumericTypes,
	getParentType,
	getSampleType,
	dtTermTypes
} from '#shared/terms.js'
import { validateTermCollectionTvs } from '#shared/filter.js'
import { getSnpData, getData } from './termdb.matrix.js'
import { filterByItem } from './mds3.init.js'

/*
ds: required by get_numerical()

CTEname: Provides the prefix of CTEs at this level (filter.lst[])
  Optional, not required for root level.
  Each recursion will append a postfix "_i" to the CTEname

Recursively generates CTE statements based on the nested filter
each run processes one level of filter.lst[]
One CTE is made for each item of filter.lst[], with name "CTEname_<i>"
A superCTE is made to cap this level, with name "CTEname"
*/

// dummy $id for making up tw from tvs ({$id,term:tvs:term}) as required by getters
const $id = 'xx'

export async function getFilterCTEs(filter, ds, sampleTypes = new Set(), CTEname = 'f') {
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
	// cumulative CTE of this level and sub levels
	const CTEs = []
	// cumulative values
	const values = []
	sampleTypes = getFilterSampleTypes(filter, ds, sampleTypes) //add filter types to sampleTypes
	for (const [i, item] of filter.lst.entries()) {
		const sample_type = getSampleType(item.tvs?.term, ds)
		const parentType = getParentType(sampleTypes, ds)
		const onlyChildren = sampleTypes.size > 1 && sample_type == parentType

		if (item.tvs?.term?.id && (!item.tvs.term.type || !item.tvs.term.name)) {
			// handle stripped-down dictionary termwrapper
			item.tvs.term = ds.cohort.termdb.q.termjsonByOneid(item.tvs.term.id)
			if (!item.tvs.term) throw `invalid term.id in tvs`
		}

		const CTEname_i = CTEname + '_' + i
		let f
		if (item.type == 'tvslst') {
			if (item.lst.length == 0) continue // do not process blank list

			f = await getFilterCTEs(item, ds, sampleTypes, CTEname_i)
			// .filters: str, the CTE cascade, not used here!
			// .CTEs: [] list of individual CTE string
			// .values: []
			// .CTEname: str
		} else if (!item.tvs) {
			throw `filter item should have a 'tvs' or 'lst' property`
		} else if (item.tvs.term.type == TermTypes.GENE_EXPRESSION) {
			f = await get_geneExpression(item.tvs, CTEname_i, ds)
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
		} else if (dtTermTypes.has(item.tvs.term.type)) {
			f = await get_dtTerm(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'categorical') {
			f = get_categorical(item.tvs, CTEname_i, ds, onlyChildren)
			// .CTEs: []
			// .values:[]
			// .CTEname
		} else if (item.tvs.term.type == 'survival') {
			f = get_survival(item.tvs, CTEname_i, ds, onlyChildren)
		} else if (item.tvs.term.type == 'samplelst') {
			f = get_samplelst(item.tvs, CTEname_i, ds, sample_type, onlyChildren)
		} else if (annoNumericTypes.has(item.tvs.term.type)) {
			f = get_numerical(item.tvs, CTEname_i, ds, onlyChildren)
		} else if (item.tvs.term.type == 'condition') {
			f = get_condition(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'geneVariant') {
			f = await get_geneVariant(item.tvs, CTEname_i, ds, onlyChildren)
		} else if (item.tvs.term.type == 'termCollection') {
			f = await get_termCollection(item.tvs, CTEname_i, ds, onlyChildren)
		} else if (item.tvs.term.type == 'snp') {
			f = await get_snp(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'multivalue') {
			f = await get_multivalue(item.tvs, CTEname_i, ds)
		} else {
			throw 'unknown term type'
		}
		thislevelCTEnames.push(f.CTEname)
		CTEs.push(...f.CTEs)
		values.push(...f.values)
	}
	const JOINOPER = filter.join == 'and' ? 'INTERSECT' : 'UNION'
	const superCTE = thislevelCTEnames.map(name => 'SELECT * FROM ' + name).join('\n' + JOINOPER + '\n')
	if (filter.in) {
		CTEs.push(`
				${CTEname} AS (
					${superCTE}
				)
			`)
	} else {
		CTEs.push(`
				${CTEname} AS (
					SELECT id as sample
					FROM sampleidmap
					WHERE sample NOT IN (
						${superCTE}
					)
				)
			`)
	}
	return {
		filters: CTEs.join(',\n'),
		CTEs,
		values,
		CTEname,
		sampleTypes
	}
}

// makesql_by_tvsfilter helpers
// put here instead of inside makesql_by_tvsfilter
// to parse function once at server start instead of
// multiple times per server request
function get_categorical(tvs, CTEname, ds, onlyChildren) {
	let query = `SELECT sample
	FROM anno_categorical 
	WHERE term_id = ?
	AND value ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})`
	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)
	return {
		CTEs: [` ${CTEname} AS (${query})`],
		values: [tvs.term.id, ...tvs.values.map(i => i.key)],
		CTEname
	}
}

function get_survival(tvs, CTEname, ds, onlyChildren) {
	let query = `SELECT sample
	FROM survival
	WHERE term_id = ?
	${tvs.q?.cutoff ? 'AND tte >= ' + tvs.q?.cutoff : ''}
	AND exit_code ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})`

	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)
	return {
		CTEs: [
			`
		  ${CTEname} AS (
			${query}
			)`
		],
		values: [tvs.term.id, ...tvs.values.map(i => i.key)],
		CTEname
	}
}

function get_samplelst(tvs, CTEname, ds, sample_type, onlyChildren) {
	const samples = []
	for (const field in tvs.term.values) {
		const list = tvs.term.values[field].list
		samples.push(...list)
	}
	const values = []
	const samplesString = Array(samples.length).fill('?').join(',')
	let query = `	SELECT id as sample
				FROM sampleidmap
				WHERE id ${tvs.isnot ? 'NOT IN' : 'IN'} (${samplesString}) `

	values.push(...samples.map(i => i.sampleId || i.sample))
	if (ds.cohort.db.tableColumns['sampleidmap'].includes('sample_type')) {
		if (!sample_type) throw 'sample_type is missing'
		query += `and sample_type = ?` //later on need to cleanup the list handling in samplelst
		values.push(sample_type)
	}
	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)
	return {
		CTEs: [
			`
		  ${CTEname} AS (
			${query}
			)`
		],
		values,
		CTEname
	}
}

// TODO: may retire get_geneVariant() as geneVariant filtering is now
// performed by get_dtTerm()
async function get_geneVariant(tvs, CTEname, ds, onlyChildren) {
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

	let query = `SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${samplenames.map(i => '?').join(', ')})`
	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)

	return {
		CTEs: [
			`
		  ${CTEname} AS (
				${query}
			)`
		],
		values: [...samplenames],
		CTEname
	}
}

function isInRange(val, range, isnot) {
	let left, right
	if (range.startunbounded) left = true
	else if ('start' in range) left = range.startinclusive ? val >= range.start : val > range.start
	if (range.stopunbounded) right = true
	else if ('stop' in range) right = range.stopinclusive ? val <= range.stop : val < range.stop
	return isnot ? !(left && right) : left && right
}

function emptyFilterResult(CTEname, onlyChildren, ds) {
	let query = `SELECT id as sample FROM sampleidmap WHERE 0`
	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)
	return { CTEs: [`${CTEname} AS (${query})`], values: [], CTEname }
}

/** Custom termCollection filter: call query handlers directly for each member term,
 *  then filter samples by value range on the selected member. */
async function get_termCollection_custom(tvs, CTEname, ds, onlyChildren) {
	const memberKey = tvs.values?.[0]?.key
	const range = tvs.ranges?.[0]
	if (!memberKey || !range) return emptyFilterResult(CTEname, onlyChildren, ds)

	// Find the member term being filtered on
	const mt = tvs.term.termlst?.find(t => (t.id || t.name) === memberKey)
	if (!mt) return emptyFilterResult(CTEname, onlyChildren, ds)

	// Call the existing query handler for this member's dataType
	const dataType = mt.dataType || 'isoformExpression'
	const queryHandler = ds.queries?.[dataType]
	if (!queryHandler) throw `not supported by dataset: ${dataType}`

	const tw = { $id, term: { type: dataType, isoform: mt.isoform, gene: mt.gene, name: mt.name } }
	const data = await queryHandler.get({ terms: [tw] }, ds)
	const values = data.term2sample2value?.get($id)
	if (!values) return emptyFilterResult(CTEname, onlyChildren, ds)

	return numericSampleData2tvs(tvs, CTEname, values)
}

/** Percentage filter for custom (non-dictionary) termCollections, e.g. isoform
 *  expression collections created dynamically.
 *
 *  Cannot use getData() here because it requires req.query.__protected__ (auth
 *  context set by Express middleware), which is not available inside the filter
 *  evaluation path. Instead, call the underlying query handlers (e.g.
 *  isoformExpression HDF5 handler) directly for each member term, then compute
 *  the numerator/denominator percentage client-side and filter samples. */
async function get_termCollection_custom_percentage(tvs, CTEname, ds, onlyChildren) {
	const range = tvs.ranges?.[0]
	if (!range) return emptyFilterResult(CTEname, onlyChildren, ds)
	const termlst = tvs.term.termlst || []
	const numerators = tvs.term.numerators || []
	if (!termlst.length) return emptyFilterResult(CTEname, onlyChildren, ds)
	if (numerators.length) {
		validateTermCollectionTvs(
			numerators,
			termlst.map(i => i.id)
		)
	}

	// Fetch values for all member terms via query handlers directly.
	// Group members by data type so each handler is called once with all its
	// terms batched together (avoids sequential HDF5 reads).
	// sampleValues: { sampleId: { memberId: value, ... }, ... }
	const sampleValues = {}
	const byDataType = new Map()
	for (const mt of termlst) {
		const dataType = mt.dataType || mt.type || 'isoformExpression'
		if (!ds.queries?.[dataType]) continue
		if (!byDataType.has(dataType)) byDataType.set(dataType, [])
		const memberId = mt.id || mt.name
		byDataType.get(dataType).push({
			memberId,
			tw: { $id: memberId, term: { type: dataType, isoform: mt.isoform, gene: mt.gene, name: mt.name } }
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

	// Calculate percentage and filter samples
	const samplenames = []
	for (const [sid, memberVals] of Object.entries(sampleValues)) {
		let numeratorSum = 0
		let totalSum = 0
		for (const [mid, val] of Object.entries(memberVals)) {
			totalSum += val
			if (numerators.includes(mid)) numeratorSum += val
		}
		const percentage = totalSum == 0 ? 0 : (numeratorSum / totalSum) * 100
		if (isInRange(percentage, range, tvs.isnot)) samplenames.push(sid)
	}

	if (!samplenames.length) return emptyFilterResult(CTEname, onlyChildren, ds)

	let query = `SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${samplenames.map(() => '?').join(', ')})`
	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)

	return {
		CTEs: [`${CTEname} AS (${query})`],
		values: [...samplenames],
		CTEname
	}
}

async function get_termCollection(tvs, CTEname, ds, onlyChildren) {
	if (tvs.term.memberType === 'categorical') {
		throw new Error('termcollection memberType=categorical not supported yet')
	}
	if (tvs.term.memberType !== 'numeric') throw new Error('termcollection memberType not categorical/numeric')
	if (tvs.term.isCustom) {
		// Custom collections bypass the getData() path below because getData()
		// requires __protected__ auth context that is unavailable during filter
		// CTE evaluation. Use direct query handler calls instead.
		return await get_termCollection_custom_percentage(tvs, CTEname, ds, onlyChildren)
	}
	if (tvs.term.numerators) {
		validateTermCollectionTvs(
			tvs.term.numerators,
			tvs.term.termlst?.map(i => i.id)
		)
	}
	const tw = { $id, term: tvs.term, q: {} }
	const data = await getData({ terms: [tw] }, ds)
	const samplenames = []
	if (!data.samples) return emptyFilterResult(CTEname, onlyChildren, ds)
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
			const range = tvs.ranges[0]
			if (isInRange(val, range, tvs.isnot)) samplenames.push(key)
		} else if (tvs.term.numerators) {
			// No specific member brushed — filter by numerator/denominator ratio
			let numeratorSum = 0
			let totalSum = 0
			for (const [key, value] of Object.entries(sampleValues)) {
				totalSum += value
				if (tvs.term.numerators.includes(key)) numeratorSum += value
			}
			const percentage = totalSum == 0 ? 0 : (numeratorSum / totalSum) * 100
			const range = tvs.ranges[0]
			if (isInRange(percentage, range, tvs.isnot)) samplenames.push(key)
		}
	}

	let query = `SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${samplenames.map(i => '?').join(', ')})`
	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)

	return {
		CTEs: [
			`
		  ${CTEname} AS (
				${query}
			)`
		],
		values: [...samplenames],
		CTEname
	}
}

async function get_snp(tvs, CTEname, ds) {
	// get sample genotypes for snp
	const sampleGTs = await getSnpData({ term: tvs.term }, { ds })
	// get genotypes of snp in filter
	const filterGTs = tvs.values.map(v => v.key)
	// filter for samples with genotypes in filter
	const samples = sampleGTs.filter(s => filterGTs.includes(s.gt)).map(s => s.sample_id)
	// build CTE

	let query = `SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${samples.map(i => '?').join(', ')})`

	const result = {
		CTEs: [
			`
		  ${CTEname} AS (
				${query}
			)`
		],
		values: [...samples],
		CTEname
	}
	return result
}

async function get_geneExpression(tvs, CTEname, ds) {
	const q = ds.queries?.geneExpression
	if (!q) throw 'not supported' // guard against request to unsupported data. FIXME may improve filterui to gracefully handle such and avoid showing completely broken mass ui when the request comes from handwrite state or url
	const data = await q.get({ terms: [{ $id, term: tvs.term }] }, ds)
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
	const data = await q.get({ terms: [{ $id, term: tvs.term }], proteomeDetails: tvs.term.proteomeDetails })
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
	if (!q) throw 'dnaMethylation not supported'
	const data = await q.get({ terms: [{ $id, term: tvs.term }] })
	return numericSampleData2tvs(tvs, CTEname, data.term2sample2value.get($id))
}

function numericSampleData2tvs(tvs, CTEname, termData) {
	const samples = []

	for (const sample in termData) {
		const value = termData[sample]
		const filterBin = getBin(tvs.ranges, value)
		if (filterBin != -1) samples.push(sample)
	}

	const query = `SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${samples.map(i => '?').join(', ')})`

	const result = {
		CTEs: [
			`
		  ${CTEname} AS (
				${query}
			)`
		],
		values: [...samples],
		CTEname
	}
	return result
}

async function get_dtTerm(tvs, CTEname, ds) {
	const tw = { $id, term: tvs.term.parentTerm, q: { dtLst: [tvs.term.dt] } }
	const data = await ds.mayGetGeneVariantData(tw, { genome: ds.genomename })

	const samples = []
	for (const [sample, value] of data) {
		const mlst = value[$id]?.values
		if (!mlst) throw 'mlst is missing'
		const filter = { type: 'tvs', tvs }
		const [pass, tested] = filterByItem(filter, mlst)
		if (pass) samples.push(sample)
	}

	let query = `SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${samples.map(i => '?').join(', ')})`

	const result = {
		CTEs: [
			`
		  ${CTEname} AS (
				${query}
			)`
		],
		values: [...samples],
		CTEname
	}
	return result
}

function get_numerical(tvs, CTEname, ds, onlyChildren) {
	/*
for the case e.g. '0' is for "Not exposed", range.value can be either '0' or 0, string or number
as it cannot be decided what client will provide
so here need to allow both string and number as range.value
*/
	if (!tvs.ranges)
		throw `tvs.ranges{} missing, tvs.ranges = ${tvs.ranges} [server/src/termdb.filter.js get_numerical()]`
	const values = [tvs.term.id]
	// get term object
	const term = ds.cohort.termdb.q.termjsonByOneid(tvs.term.id)
	const annoTable = `anno_${term.type}`
	if (!annoNumericTypes.has(term.type)) throw `unknown '${annoTable}' table in get_numerical()`

	const rangeclauses = []
	let hasactualrange = false // if true, will exclude special categories

	for (const range of tvs.ranges) {
		if ('value' in range) {
			// special category
			// where value for ? can be number or string, doesn't matter
			const negator = tvs.isnot ? '!' : ''
			rangeclauses.push(`value ${negator}= ?`)
			values.push('' + range.value)
		} else {
			// actual range
			hasactualrange = true
			const lst = []
			if (!range.startunbounded) {
				if (range.startinclusive) {
					lst.push('value >= ?')
				} else {
					lst.push('value > ? ')
				}
				values.push(range.start)
			}
			if (!range.stopunbounded) {
				if (range.stopinclusive) {
					lst.push('value <= ?')
				} else {
					lst.push('value < ? ')
				}
				values.push(range.stop)
			}
			const negator = tvs.isnot ? 'NOT ' : ''
			if (lst.length) rangeclauses.push(negator + '(' + lst.join(' AND ') + ')')
		}
	}

	let excludevalues
	if (hasactualrange && term.values) {
		excludevalues = Object.keys(term.values)
			.filter(key => term.values[key].uncomputable)
			.map(Number)
			.filter(key => tvs.isnot || !tvs.ranges.find(range => 'value' in range && Number(range.value) == key))
		if (excludevalues.length) values.push(...excludevalues)
	}
	const combinedClauses = rangeclauses.join(' OR ')

	let query = `SELECT sample
					FROM ${annoTable}
					WHERE term_id = ?
					${combinedClauses ? 'AND (' + combinedClauses + ')' : ''}
					${excludevalues && excludevalues.length ? `AND value NOT IN (${excludevalues.map(d => '?').join(',')}) ` : ''}`

	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)

	return {
		CTEs: [
			`
		    ${CTEname} AS (
			${query}
			)`
		],
		values,
		CTEname
	}
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

	const CTEs = []
	const values = []
	if (tvs.values) {
		values.push(tvs.term.id, ...tvs.values.map(i => '' + i.key))

		let query = `	SELECT sample
				FROM ${value_for == 'grade' ? 'precomputed_chc_grade' : 'precomputed_chc_child'}
				WHERE term_id = ? 
				AND ${restriction} = 1
				AND value ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})`

		CTEs.push(`
			${CTEname} AS (
				${query}
			)`)
	} else if (tvs.grade_and_child) {
		throw `-- Todo: tvs.grade_and_child`
		//grade_and_child: [{grade, child_id}]
		for (const gc of tvs.grade_and_child) {
			values.push(tvs.term.id, '' + gc.grade)
			CTEs.push(`
				SELECT sample
				FROM precomputed
				WHERE term_id = ? 
				AND value_for = 'grade'
				AND ${restriction} = 1
				AND value ${tvs.isnot ? 'NOT' : ''} IN (?)`)

			values.push(tvs.term.id, gc.child_id)
			CTEs.push(`
				SELECT sample
				FROM precomputed
				WHERE term_id = ? 
				AND value_for = 'child'
				AND ${restriction} = 1
				AND value ${tvs.isnot ? 'NOT' : ''} IN (?)`)
		}
	} else {
		throw 'unknown condition term filter type: expecting term-value "values" or "grade_and_child" key'
	}
	return {
		CTEs,
		values,
		CTEname
	}
}

const validTvsJoin = new Set(['and', 'or'])

function get_multivalue(tvs, CTEname, ds, onlyChildren) {
	// default to join = 'or', more permissive/less likely to break,
	// and also compatible with default join operator for categorical terms
	if (!tvs.join) tvs.join = 'or'
	if (tvs.values.length > 1 && !validTvsJoin.has(tvs.join)) {
		// multivalue term, when used as a filter, must have a valid "join" operator
		throw `invalid tvs.join='${tvs.join}' when tvs.values.length > 1`
	}
	// note that if there is only 1 tvs.values entry,
	// tvs.join will not be needed or used to "join" values
	const expectedValues = tvs.values
		.map(v => `value->>'$.${v.key}' ${tvs.isnot ? 'IS NULL' : '> 0'}`)
		.join(` ${tvs.join} `)

	let query = `SELECT sample
	FROM anno_multivalue
	WHERE term_id = ? AND ${expectedValues}`
	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry) query = getChildren(query)
	return {
		CTEs: [` ${CTEname} AS (${query})`],
		values: [tvs.term.id],
		CTEname
	}
}

function getFilterSampleTypes(filter, ds, sampleTypes) {
	for (const [i, item] of filter.lst.entries()) {
		if (!item.tvs || item.tvs.term.id == 'subcohort') continue

		const term_id = item.tvs.term
		const sample_type = getSampleType(term_id, ds)
		if (sample_type != null) sampleTypes.add(sample_type)
	}
	return sampleTypes
}

function getChildren(query) {
	return ` select sa.sample_id as sample from sample_ancestry sa where sa.ancestor_id in (${query}) `
}
