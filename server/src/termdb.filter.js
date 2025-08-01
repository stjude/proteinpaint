import { isDictionaryType, TermTypes, getBin } from '#shared/terms.js'
import { getParentType, getSampleType, dtTermTypes } from '#shared/terms.js'
import { getSnpData } from './termdb.matrix.js'
import { filterByItem } from './mds3.init.js'
import { annoNumericTypes } from '#shared/terms.js'
import { authApi } from './auth.js'

/*
nested filter documented at:
https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit?pli=1#heading=h.eeqtb17pxcp0

ds: required by get_numerical()

CTEname: Provides the prefix of CTEs at this level (filter.lst[])
  Optional, not required for root level.
  Each recursion will append a postfix "_i" to the CTEname

Recursively generates CTE statements based on the nested filter
each run processes one level of filter.lst[]
One CTE is made for each item of filter.lst[], with name "CTEname_<i>"
A superCTE is made to cap this level, with name "CTEname"

*/
export async function getFilterCTEs(filter, ds, sampleTypes = new Set(), CTEname = 'f', _rootFilter = null) {
	if (!filter) return
	console.log(25, 'getFilterCTEs()', filter, _rootFilter)
	//
	const rootFilter = _rootFilter || filter
	authApi.verifyFilter(ds, filter, rootFilter)

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

			f = await getFilterCTEs(item, ds, sampleTypes, CTEname_i, rootFilter)
			// .filters: str, the CTE cascade, not used here!
			// .CTEs: [] list of individual CTE string
			// .values: []
			// .CTEname: str
		} else if (!item.tvs) {
			throw `filter item should have a 'tvs' or 'lst' property`
		} else if (item.tvs.term.type == TermTypes.GENE_EXPRESSION) {
			f = await get_geneExpression(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == TermTypes.METABOLITE_INTENSITY) {
			f = await get_metaboliteIntensity(item.tvs, CTEname_i, ds)
		} else if (dtTermTypes.has(item.tvs.term.type)) {
			f = await get_dtTerm(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'categorical') {
			f = get_categorical(item.tvs, CTEname_i, ds, onlyChildren)
			// .CTEs: []
			// .values:[]
			// .CTEname
		} else if (item.tvs.term.type == 'survival') {
			f = get_survival(item.tvs, CTEname_i, onlyChildren)
		} else if (item.tvs.term.type == 'samplelst') {
			f = get_samplelst(item.tvs, CTEname_i, ds, sample_type, onlyChildren)
		} else if (annoNumericTypes.has(item.tvs.term.type)) {
			f = get_numerical(item.tvs, CTEname_i, ds, onlyChildren)
		} else if (item.tvs.term.type == 'condition') {
			f = get_condition(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'geneVariant') {
			f = await get_geneVariant(item.tvs, CTEname_i, ds, onlyChildren)
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

function get_survival(tvs, CTEname, onlyChildren) {
	let query = `SELECT sample
	FROM survival
	WHERE term_id = ?
	${tvs.q?.cutoff ? 'AND tte >= ' + tvs.q?.cutoff : ''}
	AND exit_code ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})`

	if (onlyChildren && ds.cohort.termdb.hasSampleAncestry)
		query = ` select sa.sample_id as sample from sample_ancestry sa where sa.ancestor_id in (${query}) `

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
	const tw = { $id: Math.random().toString(), term: tvs.term, q: {} }
	const data = await ds.mayGetGeneVariantData(tw, { genome: ds.genomename })
	/*
	data here is map of sampleId-mutationData pairs, e.g.
	63 => { sample: 63, TP53: { key: 'TP53', values: [Array], label: 'TP53' } },
	56 => {}, ...
	*/
	const samplenames = []
	for (const [key, value] of data) {
		const sampleValues = value[tw.$id].values
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
	const data = await ds.queries.geneExpression.get({ terms: [{ gene: tvs.term.gene }] })
	const samples = []
	for (const sampleId in data.term2sample2value.get(tvs.term.gene)) {
		const values = data.term2sample2value.get(tvs.term.gene)
		const value = Number(values[sampleId])
		const filterBin = getBin(tvs.ranges, value)
		if (filterBin != -1) samples.push(sampleId)
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

async function get_metaboliteIntensity(tvs, CTEname, ds) {
	const args = {
		genome: ds.genome,
		dslabel: ds.label,
		terms: [tvs.term]
	}
	const data = await ds.queries.metaboliteIntensity.get(args)
	const termData = data.term2sample2value.get(tvs.term.name)
	const samples = []

	for (const sample in termData) {
		const value = termData[sample]
		const filterBin = getBin(tvs.ranges, value)
		if (filterBin != -1) samples.push(sample)
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

async function get_dtTerm(tvs, CTEname, ds) {
	const tw = { $id: Math.random().toString(), term: tvs.term.parentTerm, q: {} }
	const data = await ds.mayGetGeneVariantData(tw, { genome: ds.genomename })

	const samples = []
	for (const [sample, value] of data) {
		const mlst = value[tw.$id]?.values
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
