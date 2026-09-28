import * as binsmodule from '#shared/termdb.bins.js'
import { getFilterCTEs } from './termdb.filter.js'
import * as numericSql from './termdb.sql.numeric.js'
import * as categoricalSql from './termdb.sql.categorical.js'
import * as conditionSql from './termdb.sql.condition.js'
import { sampleLstSql } from './termdb.sql.samplelst.js'
import { multivalueCTE } from './termdb.sql.multivalue.js'
import { termCollectionCategorical, termCollectionNumeric } from './termdb.sql.termCollection.js'
import { isNumericTerm, dictionaryNumericTypes } from '#shared/terms.js'
import { authApi } from '#src/auth.js'
// circular import with termdb.matrix.js (it imports get_samples etc from this file); safe
// because the binding is only dereferenced at runtime, never during module evaluation
import { maySetMapParent2Children } from './termdb.matrix.js'
import { sql } from './sql.ts'

/* a ds with sample ancestry may annotate terms at different levels (e.g. patient vs sample).
CTEs of parent-level filter terms must be mapped down to leaf-level samples, otherwise
intersecting them with child-level CTEs (e.g. a ds access-control filter on a sample-level
term) matches nothing and silently yields an empty result. detect from the filter contents
when the caller did not set q.mapParent2Children */
function mayDetectSampleLevels(q, ds) {
	if (q.mapParent2Children !== undefined) return
	if (!ds.cohort?.termdb?.hasSampleAncestry) return
	if (!q.filter?.lst?.length) return
	try {
		maySetMapParent2Children(q, ds)
	} catch (e) {
		// fall back to no mapping (previous behavior) on filters whose sample types cannot be detected
		console.warn('mayDetectSampleLevels():', e.message || e)
	}
}
/*

********************** EXPORTED
get_samples
get_samplecount
get_summary_numericcategories
get_rows_by_one_key
get_term_cte

	!!!
	NOTE: all constructed sql to get sample-value, regardless of term.type, must return 
	{
		sample,
		key: may be a bin or groupset label, or if none is used, the actual column value
		value: the actual column value in the table
	}

	For example, returning both the bin label and actual value for a numeric term
	would allow the calling app to create compute boxplot inputs, which is not
	possible if only the bin labels are returned. Similar use cases may be supported
	later.  
	!!!

	all constructed sql are sql`` fragments from ./sql.ts, which carry their own bound values,
	so that values are never written into the sql text and do not have to be tracked in a separate array
*/
//in the future we may need to pass the sample type when there are more types than root and not root
/* resolve a client-supplied termdb filter to the set of sample ids passing it.
shared by routes that restrict file-based sample listings (e.g. brain imaging) by a filter.
q: {filter, __protected__}. mayAdjustFilter() merges in any dataset access-control filter,
same as getData() does (idempotent if the app middleware already adjusted the filter).
file-based sample names are leaf-level, so on a ds with sample ancestry always map
parent-level filter results down to leaf samples; without this, a filter of only
parent-level terms would return parent ids that intersect no file name */
export async function getFilterSampleIdSet(q, ds) {
	authApi.mayAdjustFilter(q, ds, undefined)
	if (ds.cohort?.termdb?.hasSampleAncestry) maySetMapParent2Children(q, ds, true)
	return new Set((await get_samples(q, ds)).map(i => i.id))
}

/* restrict a list of file-derived sample names by the client-supplied termdb filter AND
any dataset access-control filter. single owner of the guard for file-based routes
(e.g. brain imaging): access control must also run when the client filter is empty,
since such routes are not necessarily covered by the middleware's filter injection —
skipping it would let an unauthenticated request access restricted samples by name.
returns the input list unchanged when there is nothing to filter by */
export async function filterSampleNamesByAccess(query, ds, sampleNames) {
	if (!query.filter?.lst?.length && !ds.cohort?.termdb?.getAdditionalFilter) return sampleNames
	const fq = { filter: structuredClone(query.filter), __protected__: query.__protected__ }
	const allowedIds = await getFilterSampleIdSet(fq, ds)
	return sampleNames.filter(s => allowedIds.has(ds.cohort.termdb.q.sampleName2id(s)))
}

export async function get_samples(q, ds, canDisplay = false) {
	if (!ds.cohort?.db?.connection?.prepare) {
		// avoid crashing server on clicking "sample view" btn in gdc corr plot
		throw 'this dataset does not support this query'
	}

	/*
	must have q.filter[]
	as the actual query is embedded in q.filter
	return an array of sample names passing through the filter

	NOTE: no need to call authApi.mayAdjustFilter() here since the app.middleware
	already created/adjusted q.filter; would only need to call here if
	q.__protected__.ignoreTermIds is modified or if routeTwLst can be supplied at this point
	*/

	mayDetectSampleLevels(q, ds)
	const filter = await getFilterCTEs(q.filter, ds, q.mapParent2Children, q.sampleTypes) // if q.filter is blank, it returns null
	const query = filter
		? sql`WITH ${filter.filters} SELECT sample as id, name FROM ${sql.id(
				filter.CTEname
		  )} join sampleidmap on sample = sampleidmap.id`
		: sql`SELECT id, name FROM sampleidmap`
	const re = ds.cohort.db.connection.prepare(query).all()
	if (canDisplay) return re
	for (const item of re) delete item.name
	return re
}

export async function get_samples_ancestry(qfilter, ds, canDisplay = false) {
	/*
must have qfilter[]
as the actual query is embedded in qfilter
return an array of sample names passing through the filter
*/
	const filter = await getFilterCTEs(qfilter, ds) // if qfilter is blank, it returns null
	const query = filter
		? sql`WITH ${filter.filters} SELECT sample as id, sa.ancestor_id FROM ${sql.id(filter.CTEname)}
			left join sample_ancestry sa on sample = sa.sample_id and sa.distance = 1 union all 
			select id, null as ancestor_id from sample_ancestry sa join root_samples on sa.ancestor_id = id where sample_id in (select sample from ${sql.id(
				filter.CTEname
			)})` //Root samples need to be added
		: sql`SELECT id, sa.ancestor_id FROM sampleidmap left join sample_ancestry sa on id = sa.sample_id and sa.distance = 1`

	const re = ds.cohort.db.connection.prepare(query).all()
	if (canDisplay) return re
	for (const item of re) delete item.name
	return re
}

// we need to pass a type and count by type to differentiate root samples from samples
export async function get_samplecount(q, ds) {
	if (!ds.cohort.db) {
		/* non-db based ds (gdc, mmrf). a filtered count is obtainable via
		ds.cohort.termdb.filterSamples(), as done by getSampleList() in termdb.js, but it
		ignores geneVariant/geneExpression terms and costs an extra api round trip, thus
		would be silently wrong for such filters. return a placeholder to avoid breaking
		mass nav and the mass groups table, until this can be properly supported.
		same treatment at routes/termdb.cohort.summary.ts */
		return { count: 'n/a' }
	}
	// !!! CRITICAL !!!
	// must always call authApi.mayAdjustFilter(), dataset-specific logic exceptions
	// must be coded inside a ds.cohort.termdb.getAdditionalFilter() option;
	// for the 3rd argument below, we don't include terms to ensure that no additional filter
	// is applied and we count all the samples (the response contains only aggregated data)
	authApi.mayAdjustFilter(q, ds, [])

	/*
	must have q.filter (somehow it can either be str or {})
	as this is for showing number of samples pass a filter in header
	return a sample count of sample names passing through the filter
  */
	if (!q.filter) throw 'filter missing'

	let j
	if (typeof q.filter == 'object') {
		j = q.filter
	} else if (typeof q.filter == 'string') {
		j = JSON.parse(q.filter)
	} else {
		throw 'q.filter not obj or str'
	}

	const fq = { filter: j }
	mayDetectSampleLevels(fq, ds)
	const filter = await getFilterCTEs(j, ds, fq.mapParent2Children, fq.sampleTypes)
	let statement, row
	let sample_type
	//the filters either return a sample type or none as the samples are converted to the common type.
	// For example, if you have a filter that returns patients, like a gender filter in PNET, and another filter that returns samples, the patients filter will be forced to return samples
	//  if another sample filter is present in order to build a common filter with the samples intersected.
	if (ds.cohort.db.tableColumns['sampleidmap'].includes('sample_type')) {
		statement = sql`WITH ${filter.filters}
		SELECT count (distinct sample) as count, sample_type
		FROM ${sql.id(filter.CTEname)} join sampleidmap on sample = sampleidmap.id group by sample_type`
		row = ds.cohort.db.connection.prepare(statement).get()
		if (!row) return { count: '0 samples' } //no samples found
		sample_type = ds.cohort.termdb.sampleTypes[row.sample_type]
		sample_type = row.count > 1 ? sample_type.plural_name : sample_type.name
	} else {
		statement = sql`WITH ${filter.filters}
		SELECT count (distinct sample) as count
		FROM ${sql.id(filter.CTEname)} join sampleidmap on sample = sampleidmap.id`
		row = ds.cohort.db.connection.prepare(statement).get()
		if (!row) return { count: '0 samples' } //no samples found
		sample_type = row.count > 1 ? 'samples' : 'sample'
	}

	return { count: `${row.count} ${sample_type}` }
}

/* for a ds with a patient-sample hierarchy (ds.cohort.termdb.hasSampleAncestry), describe a set of
filtered ids at every level of the hierarchy, e.g. "874 patients and 874 primary samples and 8 PDX samples",
joined like the unfiltered count of getCohortSampleCount() in termdb.server.init.ts.
filtered ids sit at one level (see maySetMapParent2Children()); counted with them are their
ancestors (the patients of matched samples) and their descendants (the samples of matched
patients), each per sample type, in sample type id order. siblings of a matched sample are not
counted: a PDX-only filter reports its patients and PDX samples, not the primary samples that did
not pass it. returns undefined when the ds cannot be described this way, so that a caller falls back
to a flat count: hasSampleAncestry only means the ds declares >1 sample type and does not guarantee a
sample_ancestry table, and the ids may match no row of sampleidmap.
used by the termdb/cohort/summary route, which feeds the mass nav ABOUT tab. */
export function getSampleCountByType(ds, ids) {
	if (!ds.cohort?.termdb?.hasSampleAncestry || !ids?.length) return
	if (!ds.cohort.db.tables?.has('sample_ancestry')) return
	const rows = ds.cohort.db.connection
		.prepare(
			`WITH m AS (SELECT value AS id FROM json_each(?)),
			fam AS (
				SELECT id FROM m
				UNION SELECT ancestor_id FROM sample_ancestry WHERE sample_id IN (SELECT id FROM m)
				UNION SELECT sample_id FROM sample_ancestry WHERE ancestor_id IN (SELECT id FROM m)
			)
			SELECT sm.sample_type, count(*) AS n
			FROM fam JOIN sampleidmap sm ON sm.id = fam.id
			GROUP BY sm.sample_type ORDER BY sm.sample_type`
		)
		.all(JSON.stringify(ids))
	if (!rows.length) return
	return rows
		.map(r => {
			const st = ds.cohort.termdb.sampleTypes[r.sample_type]
			if (!st) throw `unknown sample_type ${r.sample_type}`
			return `${r.n} ${r.n > 1 ? st.plural_name : st.name}`
		})
		.join(' and ')
}

export async function get_summary_numericcategories(q) {
	/*
	q{}
	.term_id
	.ds
	.filter
	*/
	const term = q.ds.cohort.termdb.q.termjsonByOneid(q.term_id)
	if (!isNumericTerm(term)) throw 'term is not numeric'
	if (!term.values) {
		// term does not have special categories
		return []
	}
	if (q.ds.cohort.termdb.q.getSummaryNumericCategories) return q.ds.cohort.termdb.q.getSummaryNumericCategories(term)
	const annoTable = `anno_${term.type}`
	if (!dictionaryNumericTypes.has(term.type)) throw `unknown '${annoTable}' table in get_summary_numericcategories()`

	const filter = await getFilterCTEs(q.filter, q.ds)
	const query = sql`
		${filter ? sql`WITH ${filter.filters}` : sql``}
		SELECT count(sample) AS samplecount,value
		FROM ${sql.id(annoTable)}
		WHERE term_id=${q.term_id}
		${filter ? sql`AND sample IN ${sql.id(filter.CTEname)}` : sql``}
		AND value IN (${sql.list(Object.keys(term.values).map(Number), { allowEmpty: true })})
		GROUP BY value`
	return q.ds.cohort.db.connection.prepare(query).all()
}

// validate for any anno_* named table, not just numeric
const annoTableTypes = new Set(['categorical', 'integer', 'float', 'date', 'multivalue'])

export async function get_rows_by_one_key(q) {
	/*
get all sample and value by one key

q{}
  .filter:
    {} optional nested filter
  .key:
    required term id
  .ds:
    required ds object

works for all attributes, including non-termdb ones
*/
	if (!q.key) throw '.key missing'
	if (!q.ds) throw '.ds{} missing'

	const term = q.ds.cohort.termdb.q.termjsonByOneid(q.key)
	const annoTable = `anno_${term.type}`
	if (!annoTableTypes.has(term.type)) throw `unknown '${annoTable}' table in get_rows_by_one_key()`

	const filter = await getFilterCTEs(q.filter, q.ds)
	const query = sql`
		${filter ? sql`WITH ${filter.filters}` : sql``}
		SELECT sample, value
		FROM ${sql.id(annoTable)}
		WHERE term_id=${q.key}
		${filter ? sql` AND sample IN ${sql.id(filter.CTEname)}` : sql``}`
	return q.ds.cohort.db.connection.prepare(query).all()
}

/*
Generates one or more CTEs by a term

ARGUMENTS
q{}
	.filter
	.ds
	*** the following may be empty if a 'termWrapper{}' argument is supplied ***
	.term[0,1,2]_id 			// supported parameters for barchart data  
	.term[0,1,2]_q 				// supported parameters for barchart data
		the _q{} is managed by termsetting UI

index
	1 for term1, required
	0 for term0, optional
	2 for term2, optional
	index position is dependent on server route
	index is essential for naming numeric cte tables, for now it's not replaceable by termWrapper{}

filter
	{} or null
	returned by getFilterCTEs
	required when making numeric bins and need to compute percentile for first/last bin

termWrapper{}
	.id term.id
	.term{}
	.q{}
	optional tw object
	if not provided, the term and q must be present in q{} addressable by the "index" parameter

RETURNS 
{ sql: sql`` fragment of the CTE, tablename: str, ... }

DESIGN
*/
export async function get_term_cte(q, index, filter, termWrapper = null) {
	const twterm = (termWrapper && termWrapper.term) || q[`term${index}`]
	const termid = twterm ? twterm.id : q['term' + index + '_id']

	if (twterm?.type != 'samplelst' && twterm?.type != 'termCollection') {
		// legacy code support: index=1 is assumed to be barchart term
		// when there is no termWrapper argument
		if (!termWrapper && index == 1) {
			// only term1 is required
			if (!termid) throw 'missing term1 id'
		} else if (!termid) {
			// term2 and term0 are optional
			// no table to query
			const tablename = 'samplekey_' + index
			return {
				tablename,
				sql: sql`${sql.id(tablename)} AS (\nSELECT null AS sample, '' as key, '' as value\n)`
			}
		}
	}

	// otherwise, must be a valid term
	const term = twterm && twterm.type ? twterm : q.ds.cohort.termdb.q.termjsonByOneid(termid)
	if (!term) throw `no term found by id='${termid}'`
	let termq = (termWrapper && termWrapper.q) || q['term' + index + '_q'] || {}
	if (typeof termq == 'string') {
		termq = JSON.parse(decodeURIComponent(termq))
	}

	const tablename = 'samplekey_' + index

	/*
		NOTE: all constructed sql/CTE, regardless of term.type, must return 
		{
			sample,
			key: may be a bin or groupset label, or if none is used, the actual column value
			value: the actual column value in the table
		}

		For example, returning both the bin label and actual value for a numeric term
		would allow the calling app to create compute boxplot inputs, which is not
		possible if only the bin labels are returned. Similar use cases may be supported
		later.  
	*/
	let CTE
	if (term.type == 'categorical') {
		const groupset = get_active_groupset(term, termq)
		CTE = await categoricalSql[groupset ? 'groupset' : 'values'].getCTE(tablename, term, q.ds, termq, groupset)
	} else if (isNumericTerm(term)) {
		const mode = termq.mode == 'spline' ? 'cubicSpline' : termq.mode || 'discrete'
		// the error is coming from this
		CTE = await numericSql[mode].getCTE(tablename, term, q.ds, termq, index, filter)
	} else if (term.type == 'condition') {
		const mode = termq.mode || 'discrete'
		CTE = await conditionSql[mode].getCTE(tablename, term, q.ds, termq)
	} else if (term.type == 'survival') {
		CTE = makesql_survival(tablename, term)
	} else if (term.type == 'samplelst') {
		CTE = await sampleLstSql.getCTE(q.ds, tablename, termWrapper || { term, q: termq })
	} else if (term.type == 'multivalue') {
		CTE = await multivalueCTE.getCTE(tablename, termWrapper || { term, q: termq })
	} else if (term.type == 'termCollection') {
		if (term.memberType == 'categorical') {
			CTE = await termCollectionCategorical.getCTE(tablename, termWrapper || { term, q: termq })
		} else if (term.memberType == 'numeric') {
			CTE = await termCollectionNumeric.getCTE(tablename, termWrapper || { term, q: termq })
		} else {
			throw new Error('invalid termCollection memberType')
		}
	} else {
		throw new Error('unknown term type [get_term_cte() server/src/termdb.sql.js]')
	}
	return CTE
}

/* returns a sql`` fragment that excludes uncomputable values when q.computableValuesOnly is true, or an empty fragment */
export function getUncomputableClause(term, q, tableAlias = '') {
	if (!term.values || !q.computableValuesOnly) {
		// return an empty clause so that uncomputable
		// values will be included
		return sql``
	}
	const values = Object.keys(term.values).filter(k => term.values[k].uncomputable)
	if (!values.length) return sql``
	const aliasValue = tableAlias ? sql`${sql.id(tableAlias)}.value` : sql`value`
	return sql`AND ${aliasValue} NOT IN (${sql.list(values)})`
}

function makesql_survival(tablename, term) {
	return {
		sql: sql`${sql.id(tablename)} AS (
			SELECT sample, exit_code as key, tte AS value
			FROM survival s
			WHERE s.term_id=${term.id}
		)`,
		tablename
	}
}

export function get_active_groupset(term, q) {
	if (!q || !term.groupsetting || term.groupsetting.disabled) return
	if (q.type == 'predefined-groupset') {
		if (!Number.isInteger(q.predefined_groupset_idx)) throw 'q.predefined_groupset_idx is not an integer'
		if (q.predefined_groupset_idx < 0) throw 'q.predefined_groupset_idx out of bound'
		if (!term.groupsetting?.lst?.length) throw 'term.groupsetting.lst is empty when q.predefined_groupset_idx in use'
		const s = term.groupsetting.lst[q.predefined_groupset_idx]
		if (!s) throw 'q.predefined_groupset_idx out of bound'
		return s
	}
	if (q.type == 'custom-groupset') {
		if (!q.customset) throw 'q.customset is missing'
		return q.customset
	}
}

/*
q{}
	termsetting
index

filter

returns bins{}
*/
export function get_bins(q, term, ds, index, filter) {
	if (q.mode == 'continuous' || q.mode == 'spline') return
	return binsmodule.compute_bins(q, percentiles => get_numericMinMaxPct(ds, term, filter, percentiles))
}

export function get_numericMinMaxPct(ds, term, filter, percentiles = []) {
	/* 
	similar arguments to get_numericSummary()
	but min, max, percentilex are calculated by sqlite db
	to lessen the burden on the node server 
	(individual values are not returned in this query)

	percentiles[]
		optional array of desired percentile values [X, Y, ...]

	returns {min, max, pX, pY, ...} 
	where 
		pX is the value at the Xth percentile,
		pY is the value at the Yth percentile,
		and so on ...
*/
	const annoTable = `anno_${term.type}`
	if (!dictionaryNumericTypes.has(term.type)) throw `unknown '${annoTable}' table in get_numericMinMaxPct()`

	const excludevalues = term.values ? Object.keys(term.values).filter(key => term.values[key].uncomputable) : []

	const ctes = []
	const ptablenames = []
	const cols = []
	for (const n of percentiles) {
		// n is used in sql table and column names, which cannot be bound as parameters
		if (!Number.isInteger(n)) throw `invalid percentile='${n}'`
		const tablename = sql.id('pct_' + n)
		ctes.push(sql`
		${tablename} AS (
		  SELECT value
		  FROM vals
		  LIMIT 1
		  OFFSET (
		    SELECT cast ( x as int ) - ( x < cast ( x as int ))
		    FROM (
		      SELECT cast(${n}*pct as int) as x 
		      FROM p
		    )
		  )
		)`)
		ptablenames.push(tablename)
		cols.push(sql`${tablename}.value AS ${sql.id('p' + n)}`)
	}

	const query = sql`WITH
		${filter ? sql`${filter.filters}, ` : sql``} 
		vals AS (
			SELECT value
			FROM ${sql.id(annoTable)}
			WHERE
			${filter ? sql`sample IN ${sql.id(filter.CTEname)} AND ` : sql``}
			term_id=${term.id}
			${excludevalues.length ? sql`AND value NOT IN (${sql.list(excludevalues.map(Number))})` : sql``}
			ORDER BY value ASC
		),
		p AS (
			SELECT count(value)/100 as pct
			FROM vals
		)
		${ctes.length ? sql`,\n${sql.join(ctes, sql`,`)}` : sql``}
		SELECT 
			min(vals.value) as vmin,
			max(vals.value) as vmax
			${cols.length ? sql`,\n${sql.join(cols, sql`,\n`)}` : sql``} 
		FROM vals ${ptablenames.length ? sql`,${sql.join(ptablenames, sql`,`)}` : sql``}`

	const result = ds.cohort.db.connection.prepare(query).all()

	const summary = !result.length ? {} : result[0]
	summary.max = result[0].vmax
	summary.min = result[0].vmin
	return summary
}

// helper function to display or log the filled-in text of a sql`` fragment
// use for debugging only, do not feed directly into better-sqlite3
export function interpolateSqlValues(fragment) {
	const vals = fragment.values.slice() // use a copy
	let prevChar
	return fragment.text
		.split('')
		.map(char => {
			if (char == '?') {
				prevChar = char
				const v = vals.shift()
				return typeof v == 'string' ? `'${v}'` : v
			} else if (char == '\t') {
				// ignore tabs and do not track in case it's in between newlines or spaces
				return ''
			} else if (char == '\n' || char == ' ') {
				if (prevChar === char) return ''
			}
			prevChar = char
			return char
		})
		.join('')
}
