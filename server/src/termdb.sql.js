const app = require('./app')
const binsmodule = require('../shared/termdb.bins')
const getFilterCTEs = require('./termdb.filter').getFilterCTEs
const connect_db = require('./utils').connect_db

/*

********************** EXPORTED
get_samples
get_summary
get_numericsummary
get_rows
get_rows_by_one_key
get_rows_by_two_keys
server_init_db_queries
********************** INTERNAL
get_term_cte
	makesql_oneterm
		makesql_oneterm_categorical
			makesql_groupset
		makesql_oneterm_condition
		makesql_numericBinCTE
uncomputablegrades_clause
grade_age_select_clause
get_label4key

*/

export function get_samples(qfilter, ds) {
	/*
must have qfilter[]
as the actual query is embedded in qfilter
return an array of sample names passing through the filter
*/
	const filter = getFilterCTEs(qfilter, ds)
	const string = `WITH ${filter.filters}
		SELECT sample FROM ${filter.CTEname}`

	// may cache statement
	const re = ds.cohort.db.connection.prepare(string).all(filter.values)
	return re.map(i => i.sample)
}
export function get_cohortsamplecount(q, ds) {
	/*
must have q.cohortValues string
return an array of sample names for the given cohort
*/
	if (!q.cohortValues) throw `missing q.cohortValues`
	const cohortKey = ds.cohort.termdb.selectCohort.term.id
	const statement = `SELECT cohort as ${cohortKey}, count as samplecount
		FROM subcohort_terms
		WHERE cohort=? and term_id='$ROOT$'`
	// may cache statement
	return ds.cohort.db.connection.prepare(statement).all(q.cohortValues)
}
export function get_samplecount(q, ds) {
	/*
must have q.filter[]
return a sample count of sample names passing through the filter
 */
	q.filter = JSON.parse(decodeURIComponent(q.filter))
	if (!q.filter || !q.filter.lst.length) {
		throw `missing q.filter`
	} else {
		const filter = getFilterCTEs(q.filter, ds)
		const statement = `WITH ${filter.filters}
			SELECT 'FILTERED_COHORT' as subcohort, count(*) as samplecount 
			FROM ${filter.CTEname}`
		// may cache statement
		return ds.cohort.db.connection.prepare(statement).all(filter.values)
	}
}
export function get_summary_numericcategories(q) {
	/*
	q{}
	.term_id
	.ds
	.filter
	*/
	const term = q.ds.cohort.termdb.q.termjsonByOneid(q.term_id)
	if (term.type != 'integer' && term.type != 'float') throw 'term is not numeric'
	if (!term.values) {
		// term does not have special categories
		return []
	}
	const filter = getFilterCTEs(q.filter, q.ds)
	const values = filter ? filter.values.slice() : []
	values.push(q.term_id)
	const keylst = []
	for (const k in term.values) {
		keylst.push(k)
		values.push(k)
	}
	const sql = `
		${filter ? 'WITH ' + filter.filters : ''}
		SELECT count(sample) AS samplecount,value
		FROM annotations
		WHERE term_id=?
		${filter ? 'AND sample IN ' + filter.CTEname : ''}
		AND value IN (${keylst.map(i => '?').join(',')})
		GROUP BY value`
	return q.ds.cohort.db.connection.prepare(sql).all(values)
}

export function get_rows_by_one_key(q) {
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
	const filter = getFilterCTEs(q.filter, q.ds)
	const values = filter ? filter.values.slice() : []
	values.push(q.key)
	const sql = `
		${filter ? 'WITH ' + filter.filters : ''}
		SELECT sample, value
		FROM annotations
		WHERE term_id=?
		${filter ? ' AND sample IN ' + filter.CTEname : ''}`
	return q.ds.cohort.db.connection.prepare(sql).all(values)
}

export function get_rows_by_two_keys(q, t1, t2) {
	/*
XXX only works for two numeric terms, not for any other types

get all sample and value by one key
no filter or cte
works for all attributes, including non-termdb ones

q{}
  .ds
  .key
*/
	const filter = getFilterCTEs(q.filter, q.ds)
	const values = filter ? filter.values.slice() : []
	const CTE0 = get_term_cte(q, values, 0)
	values.push(q.term1_id, q.term2_id)

	const t1excluded = t1.values
		? Object.keys(t1.values)
				.filter(i => t1.values[i].uncomputable)
				.map(Number)
		: []
	const t1unannovals = t1excluded.length ? `AND value NOT IN (${t1excluded.join(',')})` : ''

	const t2excluded = t2.values
		? Object.keys(t2.values)
				.filter(i => t2.values[i].uncomputable)
				.map(Number)
		: []
	const t2unannovals = t2excluded.length ? `AND value NOT IN (${t2excluded.join(',')})` : ''

	const sql = `WITH
    ${filter ? filter.filters + ',' : ''}
    ${CTE0.sql},
    t1 AS (
      SELECT sample, CAST(value AS real) as value
      FROM annotations
      WHERE term_id=? ${t1unannovals}
    ),
    t2 AS (
      SELECT sample, CAST(value AS real) as value
      FROM annotations
      WHERE term_id=? ${t2unannovals}
    )
    SELECT
      t0.value AS val0,
      t1.value AS val1, 
      t2.value AS val2
    FROM t1
    JOIN ${CTE0.tablename} t0 ${CTE0.join_on_clause}
    JOIN t2 ON t2.sample = t1.sample
    ${filter ? 'WHERE t1.sample in ' + filter.CTEname : ''}`

	return q.ds.cohort.db.connection.prepare(sql).all(values)
}

export function get_rows(q, _opts = {}) {
	/*
works for only termdb terms; non-termdb attributes will not work

gets partitioned data for barchart and other plots

returns 
	if opts.withCTEs == false, then return an array of objects 
	[{
		key0, val0, // from term0, used to divide charts, may be set to an empty string="" if not applicable
		key1, val1, // from term1, used as the main series data
		key2, val2, // from term2, used to 'overlay' barchart stacked bars or cuminc serieses
								// key2 and val2 may be set to an empty string="" if not applicable
		sample (default) OR opts.countas (optional aggregation like counts)
	}]

	- if opts.withCTEs == true (default), then return
	{
		lst: [row, row, ...],
		CTE2: { sql, tablename },
		CTE1: { sql, tablename },
		CTE1: { sql, tablename },
		filter: { sql: ..., see getFilterCTEs } 
	}

q{}
	.filter
	.ds
	.term[0,1,2]_id
	.term[0,1,2]_q

opts{} options to tweak the query, see const default_opts = below
	
	.withCTEs		  true: return {lst,CTE0,CTE1,CTE2}, 
							  false: return lst 
	
	.columnas		  default to return all rows when 't1.sample AS sample',
							  or set to "count(distinct t1.sample) as samplecount" to aggregate
	
	.endclause:   default to '',
							  or "GROUP BY key0, key1, key2" when aggregating by samplecount
							  or +" ORDER BY ..." + " LIMIT ..."

*/

	if (typeof q.filter == 'string') q.filter = JSON.parse(decodeURIComponent(q.filter))

	// do not break code that still uses the opts.groupby key-value
	// can take this out once all calling code has been migrated
	if (_opts.groupby) {
		_opts.endclause = _opts.groupby
		delete _opts.groupby
	}
	const default_opts = {
		withCTEs: true,
		columnas: 't1.sample AS sample',
		endclause: ''
	}
	const opts = Object.assign(default_opts, _opts)
	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []

	const CTE0 = get_term_cte(q, values, 0, filter)
	const CTE1 = get_term_cte(q, values, 1, filter)
	const CTE2 = get_term_cte(q, values, 2, filter)

	const statement = `WITH
		${filter ? filter.filters + ',' : ''}
		${CTE0.sql},
		${CTE1.sql},
		${CTE2.sql}
		SELECT
      t0.key AS key0,
      t0.value AS val0,
      t1.key AS key1,
      t1.value AS val1,
      t2.key AS key2,
      t2.value AS val2,
      ${opts.columnas}
		FROM ${CTE1.tablename} t1
		JOIN ${CTE0.tablename} t0 ${CTE0.join_on_clause}
		JOIN ${CTE2.tablename} t2 ${CTE2.join_on_clause}
		${filter ? 'WHERE t1.sample IN ' + filter.CTEname : ''}
		${opts.endclause}`
	// console.log(statement, values)
	const lst = q.ds.cohort.db.connection.prepare(statement).all(values)

	return !opts.withCTEs ? lst : { lst, CTE0, CTE1, CTE2, filter }
}

/*
Generates one or more CTEs by a term

q{}
	.filter
	.ds
	.term[0,1,2]_id
	.term[0,1,2]_q
		the _q{} is managed by termsetting UI
	.term?_is_genotype
		TODO may improve??

values[]
	string/numeric to replace "?" in CTEs

index
	1 for term1, required
	0 for term0, optional
	2 for term2, optional

filter
	{} or null
	returned by getFilterCTEs
	required when making numeric bins and need to compute percentile for first/last bin
*/
function get_term_cte(q, values, index, filter) {
	const termid = q['term' + index + '_id']
	const term_is_genotype = q['term' + index + '_is_genotype']
	if (index == 1 && !term_is_genotype) {
		// only term1 is required
		if (!termid) throw 'missing term id'
	} else if (!termid || term_is_genotype) {
		// term2 and term0 are optional
		// no table to query
		const tablename = 'samplekey_' + index
		return {
			tablename,
			sql: `${tablename} AS (\nSELECT null AS sample, '' as key, '' as value\n)`,
			join_on_clause: ''
		}
	}

	// otherwise, must be a valid term
	const term = q.ds.cohort.termdb.q.termjsonByOneid(termid)
	if (!term) throw 'no term found by id'
	let termq = q['term' + index + '_q'] || {}
	if (typeof termq == 'string') {
		termq = JSON.parse(decodeURIComponent(termq))
	}
	if (index == 1 && q.getcuminc) {
		termq.getcuminc = q.getcuminc
		termq.grade = q.grade
	}
	const CTE = makesql_oneterm(term, q.ds, termq, values, index, filter)
	if (index != 1) {
		CTE.join_on_clause = `ON t${index}.sample = t1.sample`
	}
	return CTE
}

export function get_summary(q) {
	/*
q{}
	.filter
	.ds
	.term[0,1,2]_id
	.term[0,1,2]_q
*/
	const result = get_rows(q, {
		withCTEs: true,
		columnas: 'count(distinct t1.sample) as samplecount',
		endclause: 'GROUP BY key0, key1, key2'
	})

	const nums = [0, 1, 2]
	const labeler = {}
	for (const n of nums) {
		labeler[n] = getlabeler(q, n, result)
	}
	for (const row of result.lst) {
		for (const n of nums) {
			labeler[n](row)
		}
	}
	return result.lst
}

function getlabeler(q, i, result) {
	/*
	Returns a function to (re)label a data object

	q{}
		.filter
		.ds
		.term[0,1,2]_id
		.term[0,1,2]_q
	i       0,1,2 corresponding to term[i]_[id|q]
	result  returned by get_rows(, {withCTEs: 1})
	*/
	const key = 'key' + i
	const value = 'val' + i
	const label = 'label' + i
	const default_labeler = row => {
		delete row[key]
		delete row[value]
	}

	const term_id = q['term' + i + '_id']
	if (!term_id) return default_labeler
	const term = q.ds.cohort.termdb.q.termjsonByOneid(term_id)
	if (!term_id) return default_labeler

	// when there is only term1 and no term0/term2 simplify
	// the property names to just "key" and "label" with no index
	// -- consider keeping key1 terminology consistent later?
	const tkey = i != 1 || q.term0_id || q.term2_id ? key : 'key'
	const tlabel = i != 1 || q.term0_id || q.term2_id ? key : 'label'
	if (term.type == 'integer' || term.type == 'float') {
		const CTE = result['CTE' + i]
		const range = 'range' + (i != 1 || q.term0_id || q.term2_id ? i : '')
		return row => {
			row[range] = CTE.name2bin.get(row[key])
			row[tlabel] = row[key]
			delete row[value]
			// remove key index as needed
			if (tkey !== key) {
				row[tkey] = row[key]
				delete row[key]
			}
		}
	} else {
		const term_q = q['term' + i + '_q']
		return row => {
			row[tlabel] = get_label4key(row[key], term, term_q, q.ds)
			delete row[value]
			// remove key index as needed
			if (tkey !== key) {
				row[tkey] = row[key]
				delete row[key]
			}
		}
	}
}

function get_label4key(key, term, q, ds) {
	// get label for a key based on term type and setting
	if (term.type == 'categorical') {
		return term.values && key in term.values ? term.values[key].label : key
	}
	if (term.type == 'condition') {
		if (!term.values) throw 'missing term.values for condition term'
		if (q.bar_by_grade) {
			if (!(key in term.values)) throw `unknown grade='${key}'`
			return term.values[key].label
		} else {
			return key
		}
	}
	if (term.values) {
		return key in term.values ? term.values[key].label : key
	}
	if (term.type == 'integer' || term.type == 'float') throw 'should not work for numeric term'
	throw 'unknown term type'
}

/*
form the query for one of the table in term0-term1-term2 overlaying
CTE for each term resolves to a table of {sample,key}

term{}
q{}
	managed by termsetting UI on client
	see doc for spec
values[]
	collector of bind parameters

index

filter

returns { sql, tablename }
*/
function makesql_oneterm(term, ds, q, values, index, filter) {
	const tablename = 'samplekey_' + index
	if (term.type == 'categorical') {
		return makesql_oneterm_categorical(tablename, term, q, values)
	}
	if (term.type == 'float' || term.type == 'integer') {
		const bins = makesql_numericBinCTE(term, q, ds, index, filter, values)
		return {
			sql: `${bins.sql},
			${tablename} AS (
				SELECT bname as key, sample, v as value
				FROM ${bins.tablename}
			)`,
			tablename,
			name2bin: bins.name2bin,
			bins: bins.bins
		}
	}
	if (term.type == 'condition') {
		if (index == 1 && q.getcuminc) {
			return makesql_time2event(tablename, term, q, values, filter)
		} else {
			return makesql_oneterm_condition(tablename, term, q, values)
		}
	}
	throw 'unknown term type'
}

function makesql_oneterm_categorical(tablename, term, q, values) {
	values.push(term.id)
	if (!q.groupsetting || q.groupsetting.disabled || !q.groupsetting.inuse) {
		// groupsetting not applied
		return {
			sql: `${tablename} AS (
				SELECT sample,value as key, value as value
				FROM annotations
				WHERE term_id=?
			)`,
			tablename
		}
	}
	// use groupset
	const table2 = tablename + '_groupset'
	return {
		sql: `${table2} AS (
			${makesql_groupset(term, q)}
		),
		${tablename} AS (
			SELECT
				sample,
				${table2}.name AS key,
				${table2}.name AS value
			FROM annotations a
			JOIN
				${table2} ON a.value = ${table2}.value
			WHERE
				term_id=?
		) `,
		tablename
	}
}

function makesql_oneterm_condition(tablename, term, q, values) {
	/*
	return {sql, tablename}
*/
	const value_for = q.bar_by_children ? 'child' : q.bar_by_grade ? 'grade' : ''
	if (!value_for) throw 'must set the bar_by_grade or bar_by_children query parameter'

	const restriction = q.value_by_max_grade
		? 'max_grade'
		: q.value_by_most_recent
		? 'most_recent'
		: q.value_by_computable_grade
		? 'computable_grade'
		: ''
	if (!restriction) throw 'must set a valid value_by_*'
	values.push(term.id, value_for)

	if (!q.groupsetting || q.groupsetting.disabled || !q.groupsetting.inuse) {
		return {
			sql: `${tablename} AS (
				SELECT
					sample,
					${value_for == 'grade' ? 'CAST(value AS integer) as key' : 'value as key'},
					${value_for == 'grade' ? 'CAST(value AS integer) as value' : 'value'}
				FROM
					precomputed
				WHERE
					term_id = ?
					AND value_for = ?
					AND ${restriction} = 1
			)`,
			tablename
		}
	}
	// use groupset
	const table2 = tablename + '_groupset'
	return {
		sql: `${table2} AS (
			${makesql_groupset(term, q)}
		),
		${tablename} AS (
			SELECT
				sample,
				${table2}.name AS key,
				${table2}.name AS value
			FROM precomputed a
			JOIN ${table2} ON ${table2}.value=${q.bar_by_grade ? 'CAST(a.value AS integer)' : 'a.value'}
			WHERE
				term_id=?
				AND value_for=?
				AND ${restriction}=1
		)`,
		tablename
	}
}

function makesql_time2event(tablename, term, q, values, filter) {
	if (!term.isleaf) {
		values.push(...[term.id, q.grade])
	} else {
		values.push(...[q.grade, term.id])
	}

	const termsCTE = term.isleaf
		? ''
		: `parentTerms AS (
SELECT distinct(ancestor_id) 
FROM ancestry
),
eventTerms AS (
SELECT a.term_id 
FROM ancestry a
JOIN terms t ON t.id = a.term_id AND t.id NOT IN parentTerms 
WHERE a.ancestor_id = ?
),`

	const termsClause = term.isleaf ? `term_id = ?` : 'term_id IN eventTerms'

	return {
		sql: `${termsCTE}
		event1 AS (
			SELECT sample, 1 as key, MIN(years_to_event) as value
			FROM chronicevents
			WHERE grade >= ?
			  AND grade <= 5
			  AND ${termsClause}
			  ${filter ? 'AND sample IN ' + filter.CTEname : ''}
			GROUP BY sample
		),
		event1samples AS (
			SELECT sample
			FROM event1
		),
		event0 AS (
			SELECT sample, 0 as key, MAX(years_to_event) as value
			FROM chronicevents
			WHERE grade <= 5 
				AND sample NOT IN event1samples
			  ${filter ? 'AND sample IN ' + filter.CTEname : ''}
			GROUP BY sample
		),
		${tablename} AS (
			SELECT * FROM event1
			UNION ALL
			SELECT * FROM event0
		)`,
		tablename
	}
}

function makesql_groupset(term, q) {
	let s
	if (Number.isInteger(q.groupsetting.predefined_groupset_idx)) {
		if (q.groupsetting.predefined_groupset_idx < 0) throw 'q.predefined_groupset_idx out of bound'
		if (!term.groupsetting) throw 'term.groupsetting missing when q.predefined_groupset_idx in use'
		if (!term.groupsetting.lst) throw 'term.groupsetting.lst missing when q.predefined_groupset_idx in use'
		s = term.groupsetting.lst[q.groupsetting.predefined_groupset_idx]
		if (!s) throw 'q.predefined_groupset_idx out of bound'
	} else if (q.groupsetting.customset) {
		s = q.groupsetting.customset
	} else {
		throw 'do not know how to get groupset'
	}
	if (!s.groups) throw '.groups[] missing from a group-set'
	const categories = []
	for (const [i, g] of s.groups.entries()) {
		const groupname = g.name || 'Group ' + (i + 1)
		if (!Array.isArray(g.values)) throw 'groupset.groups[' + i + '].values[] is not array'
		for (const v of g.values) {
			categories.push(`SELECT '${groupname}' AS name, '${v.key}' AS value`)
		}
	}
	return categories.join(' UNION ALL ')
}

/*
decide bins and produce CTE

q{}
	managed by termsetting

index

filter
	{} or null

returns { sql, tablename, name2bin, bins }
*/
function makesql_numericBinCTE(term, q, ds, index = '', filter, values) {
	values.push(term.id)
	const bins = get_bins(q, term, ds, index, filter)
	//console.log('last2', bins[bins.length - 2], 'last1', bins[bins.length - 1])
	const bin_def_lst = []
	const name2bin = new Map() // k: name str, v: bin{}
	const bin_size = q.bin_size
	let has_percentiles = false
	let binid = 0
	for (const b of bins) {
		if (!('name' in b) && b.label) b.name = b.label
		name2bin.set(b.name, b)
		bin_def_lst.push(
			`SELECT '${b.name}' AS name,
			${b.start == undefined ? 0 : b.start} AS start,
			${b.stop == undefined ? 0 : b.stop} AS stop,
			0 AS unannotated,
			${b.startunbounded ? 1 : 0} AS startunbounded,
			${b.stopunbounded ? 1 : 0} AS stopunbounded,
			${b.startinclusive ? 1 : 0} AS startinclusive,
			${b.stopinclusive ? 1 : 0} AS stopinclusive,
			${binid++} AS binorder`
		)
	}
	const excludevalues = []
	if (term.values) {
		for (const key in term.values) {
			if (!term.values[key].uncomputable) continue
			excludevalues.push(key)
			const v = term.values[key]
			bin_def_lst.push(
				`SELECT '${v.label}' AS name,
        ${key} AS start,
        0 AS stop,
        1 AS unannotated,
        0 AS startunbounded,
        0 AS stopunbounded,
        0 AS startinclusive,
        0 AS stopinclusive,
        ${binid++} AS binorder`
			)
			name2bin.set(v.label, {
				is_unannotated: true,
				value: key,
				label: v.label
			})
		}
	}

	const bin_def_table = 'bin_defs_' + index
	const bin_sample_table = 'bin_sample_' + index

	const sql = `${bin_def_table} AS (
			${bin_def_lst.join(' UNION ALL ')}
		),
		${bin_sample_table} AS (
			SELECT
				sample,
				CAST(value AS ${term.type == 'integer' ? 'INT' : 'REAL'}) AS v,
				CAST(value AS ${term.type == 'integer' ? 'INT' : 'REAL'}) AS value,
				b.name AS bname,
				b.binorder AS binorder
			FROM
				annotations a
			JOIN ${bin_def_table} b ON
				( b.unannotated=1 AND v=b.start )
				OR
				(
					b.unannotated=0 AND
					${excludevalues.length ? 'v NOT IN (' + excludevalues.join(',') + ') AND' : ''}
					(
						b.startunbounded=1
						OR v>b.start
						OR (b.startinclusive=1 AND v=b.start)
					)
					AND
					(
						b.stopunbounded
						OR v<b.stop
						OR (b.stopinclusive=1 AND v=b.stop)
					)
				)
			WHERE
			term_id=?
		)`

	return {
		sql,
		tablename: bin_sample_table,
		name2bin,
		bins
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
	return binsmodule.compute_bins(q, percentiles => get_numericMinMaxPct(ds, term, filter, percentiles))
}

export function get_numericsummary(q, term, ds, withValues = false) {
	/*
to produce the summary table of mean, median, percentiles
at a numeric barchart

*/
	const qfilter = typeof q.filter == 'string' ? JSON.parse(decodeURIComponent(q.filter)) : q.filter

	if (
		(term.type == 'integer' || term.type == 'float') &&
		!filter.lst.find(tv => tv.term.id == term.id && 'ranges' in tv)
	) {
		filter.lst.push({
			type: 'tvs',
			tvs: {
				term,
				ranges: get_bins(q, term, ds)
				// FIXME should tvslst be converted to filter and pass to get_bins()?
			}
		})
	}
	const filter = getFilterCTEs(qfilter, ds)
	const values = []
	if (filter) {
		values.push(...filter.values)
	}
	const excludevalues = term.values ? Object.keys(term.values).filter(key => term.values[key].uncomputable) : []
	const string = `${filter ? 'WITH ' + filter.filters + ' ' : ''}
		SELECT CAST(value AS ${term.type == 'integer' ? 'INT' : 'REAL'}) AS value
		FROM annotations
		WHERE
		${filter ? 'sample IN ' + filter.CTEname + ' AND ' : ''}
		term_id=?
		${excludevalues.length ? 'AND value NOT IN (' + excludevalues.join(',') + ')' : ''}`
	values.push(term.id)

	const s = ds.cohort.db.connection.prepare(string)
	const result = s.all(values)
	if (!result.length) return null
	result.sort((i, j) => i.value - j.value)

	const stat = app.boxplot_getvalue(result)
	stat.mean = result.length ? result.reduce((s, i) => s + i.value, 0) / result.length : 0

	let sd = 0
	for (const i of result) {
		sd += Math.pow(i.value - stat.mean, 2)
	}
	stat.sd = Math.sqrt(sd / (result.length - 1))
	stat.min = result[0].value
	stat.max = result[result.length - 1].value
	if (withValues) stat.values = result.map(i => i.value)
	return stat
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
	const values = []
	if (filter) {
		values.push(...filter.values)
	}
	values.push(term.id)
	const excludevalues = term.values ? Object.keys(term.values).filter(key => term.values[key].uncomputable) : []

	const ctes = []
	const ptablenames = []
	const cols = []
	let tablename
	for (const n of percentiles) {
		tablename = 'pct_' + n
		ctes.push(`
		${tablename} AS (
		  SELECT value
		  FROM vals
		  LIMIT 1
		  OFFSET (
		    SELECT cast ( x as int ) - ( x < cast ( x as int ))
		    FROM (
		      SELECT cast(?*pct as int) as x 
		      FROM p
		    )
		  )
		)`)
		values.push(n)
		ptablenames.push(tablename)
		cols.push(`${tablename}.value AS ${'p' + n}`)
	}

	const sql = `WITH
		${filter ? filter.filters + ', ' : ''} 
		vals AS (
			SELECT CAST(value AS ${term.type == 'integer' ? 'INT' : 'REAL'}) AS value
			FROM annotations
			WHERE
			${filter ? 'sample IN ' + filter.CTEname + ' AND ' : ''}
			term_id=?
			${excludevalues.length ? 'AND value NOT IN (' + excludevalues.join(',') + ')' : ''}
			ORDER BY value ASC
		),
		p AS (
			SELECT count(value)/100 as pct
			FROM vals
		)
		${ctes.length ? ',\n' + ctes.join(',') : ''}
		SELECT 
			min(vals.value) as vmin,
			max(vals.value) as vmax
			${cols.length ? ',\n' + cols.join(',\n') : ''} 
		FROM vals ${ptablenames.length ? ',' + ptablenames.join(',') : ''}`

	const result = ds.cohort.db.connection.prepare(sql).all(values)

	const summary = !result.length ? {} : result[0]
	summary.max = result[0].vmax
	summary.min = result[0].vmin
	return summary
}

export function server_init_db_queries(ds) {
	/*
initiate db queries and produce function wrappers
run only once

as long as the termdb table and logic is universal
probably fine to hardcode such query strings here
and no need to define them in each dataset
thus less things to worry about...
*/
	if (!ds.cohort) throw 'ds.cohort missing'
	if (!ds.cohort.db) throw 'ds.cohort.db missing'
	if (!ds.cohort.termdb) throw 'ds.cohort.termdb missing'

	let cn
	if (ds.cohort.db.file) {
		cn = connect_db(ds.cohort.db.file)
	} else if (ds.cohort.db.file_fullpath) {
		// only on ppr
		cn = connect_db(ds.cohort.db.file_fullpath, true)
	} else {
		throw 'neither .file or .file_fullpath is set on ds.cohort.db'
	}
	console.log(`DB connected for ${ds.label}: ${ds.cohort.db.file || ds.cohort.db.file_fullpath}`)

	ds.cohort.db.connection = cn

	const tables = test_tables(cn)
	if (!tables.terms) throw 'terms table missing'
	if (!tables.ancestry) throw 'ancestry table missing'
	if (!tables.annotations) throw 'annotations table missing'
	if (ds.cohort.termdb.selectCohort && !tables.subcohort_terms)
		throw 'subcohort_terms table is missing while termdb.selectCohort is enabled'

	ds.cohort.termdb.q = {}
	const q = ds.cohort.termdb.q

	if (tables.sampleidmap) {
		const s = cn.prepare('SELECT * FROM sampleidmap')
		let id2name
		// new method added to ds{}, under same name of table
		// the method could be defined indepenent of db
		ds.sampleidmap = {
			get: id => {
				if (!id2name) {
					id2name = new Map()
					// k: sample id, v: sample name
					for (const { id, name } of s.all()) {
						id2name.set(id, name)
					}
				}
				return id2name.get(id) || id
			}
		}
	}

	if (tables.category2vcfsample) {
		const s = cn.prepare('SELECT * FROM category2vcfsample')
		// must be cached as there are lots of json parsing
		let cache
		q.getcategory2vcfsample = () => {
			if (cache) return cache
			cache = s.all()
			for (const i of cache) {
				i.q = JSON.parse(i.q)
				i.categories = JSON.parse(i.categories)
			}
			return cache
		}
	}
	if (tables.alltermsbyorder) {
		const s = cn.prepare('SELECT * FROM alltermsbyorder')
		let cache
		q.getAlltermsbyorder = () => {
			if (cache) return cache
			const tmp = s.all()
			cache = []
			for (const i of tmp) {
				const term = q.termjsonByOneid(i.id)
				if (term) {
					// alltermsbyorder maybe out of sync and some terms may be deleted
					cache.push({
						group_name: i.group_name,
						term
					})
				}
			}
			return cache
		}
	}
	{
		const s = cn.prepare('SELECT jsondata FROM terms WHERE id=?')
		const cache = new Map()
		/* should only cache result for valid term id, not for invalid ids
		as invalid id is arbitrary and indefinite
		an attack using random strings as termid can overwhelm the server memory
		*/
		q.termjsonByOneid = id => {
			if (cache.has(id)) return cache.get(id)
			const t = s.get(id)
			if (t) {
				const j = JSON.parse(t.jsondata)
				j.id = id
				cache.set(id, j)
				return j
			}
			return undefined
		}
	}

	{
		const s = cn.prepare('select id from terms where parent_id=?')
		const cache = new Map()
		q.termIsLeaf = id => {
			if (cache.has(id)) return cache.get(id)
			let re = true
			const t = s.get(id)
			if (t && t.id) re = false
			cache.set(id, re)
			return re
		}
	}

	{
		const getStatement = initCohortJoinFxn(
			`SELECT id,jsondata 
			FROM terms t
			JOINCLAUSE 
			WHERE parent_id is null
			GROUP BY id
			ORDER BY child_order ASC`
		)
		const cache = new Map()
		q.getRootTerms = (cohortStr = '') => {
			const cacheId = cohortStr
			if (cache.has(cacheId)) return cache.get(cacheId)
			const tmp = cohortStr ? getStatement(cohortStr).all(cohortStr) : getStatement(cohortStr).all()
			const re = tmp.map(i => {
				const t = JSON.parse(i.jsondata)
				t.id = i.id
				return t
			})
			cache.set(cacheId, re)
			return re
		}
	}
	{
		const s = cn.prepare('SELECT parent_id FROM terms WHERE id=?')
		{
			const cache = new Map()
			q.termHasParent = id => {
				if (cache.has(id)) return cache.get(id)
				let re = false
				const t = s.get(id)
				if (t && t.parent_id) re = true
				cache.set(id, re)
				return re
			}
		}
		{
			const cache = new Map()
			q.getTermParentId = id => {
				if (cache.has(id)) return cache.get(id)
				let re = undefined
				const t = s.get(id)
				if (t && t.parent_id) re = t.parent_id
				cache.set(id, re)
				return re
			}
		}
		{
			const cache = new Map()
			q.getTermParent = id => {
				if (cache.has(id)) return cache.get(id)
				const pid = q.getTermParentId(id)
				let re = undefined
				if (pid) {
					re = q.termjsonByOneid(pid)
				}
				cache.set(id, re)
				return re
			}
		}
	}

	/*
		template: STR
		- sql statement with a JOINCLAUSE substring to be replaced with cohort value, if applicable, or removed otherwise
	*/
	{
		const getStatement = initCohortJoinFxn(`SELECT id,jsondata 
			FROM terms t
			JOINCLAUSE 
			WHERE id IN (SELECT id FROM terms WHERE parent_id=?)
			GROUP BY id
			ORDER BY child_order ASC`)

		const cache = new Map()
		q.getTermChildren = (id, cohortStr = '') => {
			const cacheId = id + ';;' + cohortStr
			if (cache.has(cacheId)) return cache.get(cacheId)
			//const values = cohortStr ? [...cohortStr.split(','), id] : id
			const values = cohortStr ? [cohortStr, id] : id
			const tmp = getStatement(cohortStr).all(values)
			let re = undefined
			if (tmp) {
				re = tmp.map(i => {
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					return j
				})
			}
			cache.set(cacheId, re)
			return re
		}
	}
	{
		// may not cache result of this one as query string may be indefinite
		// instead, will cache prepared statement by cohort
		const s = {
			'': cn.prepare('SELECT id,jsondata FROM terms WHERE name LIKE ?')
		}
		q.findTermByName = (n, limit, cohortStr = '') => {
			if (!(cohortStr in s)) {
				s[cohortStr] = cn.prepare(
					`SELECT t.id,jsondata FROM terms t JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=? WHERE t.name LIKE ?`
				)
			}
			const vals = []
			if (cohortStr !== '') vals.push(cohortStr)
			vals.push('%' + n + '%')
			const tmp = s[cohortStr].all(vals)
			if (tmp) {
				const lst = []
				for (const i of tmp) {
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					lst.push(j)
					if (lst.length == 10) break
				}
				return lst
			}
			return undefined
		}
	}
	{
		const s1 = cn.prepare('SELECT MAX(CAST(value AS INT))  AS v FROM annotations WHERE term_id=?')
		const s2 = cn.prepare('SELECT MAX(CAST(value AS REAL)) AS v FROM annotations WHERE term_id=?')
		const cache = new Map()
		q.findTermMaxvalue = (id, isint) => {
			if (cache.has(id)) return cache.get(id)
			const tmp = (isint ? s1 : s2).get(id)
			if (tmp) {
				cache.set(id, tmp.v)
				return tmp.v
			}
			return undefined
		}
	}
	{
		const s = cn.prepare('SELECT ancestor_id FROM ancestry WHERE term_id=?')
		const cache = new Map()
		q.getAncestorIDs = id => {
			if (cache.has(id)) return cache.get(id)
			const tmp = s.all(id).map(i => i.ancestor_id)
			cache.set(id, tmp)
			return tmp
		}
	}
	{
		// select sample and category, only for categorical term
		// right now only for category-overlay on maf-cov plot
		const s = cn.prepare('SELECT sample,value FROM annotations WHERE term_id=?')
		q.getSample2value = id => {
			return s.all(id)
		}
	}
	if (tables.termhtmldef) {
		//get term_info for a term
		//rightnow only few conditional terms have grade info
		const s = cn.prepare('SELECT jsonhtml FROM termhtmldef WHERE id=?')
		const cache = new Map()
		q.getTermInfo = id => {
			if (cache.has(id)) return cache.get(id)
			const t = s.get(id)
			if (t) {
				const j = JSON.parse(t.jsonhtml)
				j.id = id
				cache.set(id, j)
				return j
			}
			return undefined
		}
	}

	function initCohortJoinFxn(template) {
		// will hold prepared statements, with object key = one or more comma-separated '?'
		const s_cohort = {
			'': cn.prepare(template.replace('JOINCLAUSE', ''))
		}
		return function getStatement(cohortStr) {
			const questionmarks = cohortStr ? '?' : ''
			if (!(questionmarks in s_cohort)) {
				const statement = template.replace('JOINCLAUSE', `JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=?`)
				s_cohort[questionmarks] = cn.prepare(statement)
			}
			return s_cohort[questionmarks]
		}
	}
}

function test_tables(cn) {
	const s = cn.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name=?')
	return {
		terms: s.get('terms'),
		ancestry: s.get('ancestry'),
		alltermsbyorder: s.get('alltermsbyorder'),
		termhtmldef: s.get('termhtmldef'),
		category2vcfsample: s.get('category2vcfsample'),
		annotations: s.get('annotations'),
		chronicevents: s.get('chronicevents'),
		precomputed: s.get('precomputed'),
		subcohort_terms: s.get('subcohort_terms'),
		sampleidmap: s.get('sampleidmap')
	}
}
