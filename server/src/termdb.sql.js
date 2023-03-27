const app = require('./app')
const binsmodule = require('#shared/termdb.bins')
const getFilterCTEs = require('./termdb.filter').getFilterCTEs
const numericSql = require('./termdb.sql.numeric')
const categoricalSql = require('./termdb.sql.categorical')
const conditionSql = require('./termdb.sql.condition')
const sampleLstSql = require('./termdb.sql.samplelst').sampleLstSql
const connect_db = require('./utils').connect_db
const isUsableTerm = require('#shared/termdb.usecase').isUsableTerm
const serverconfig = require('./serverconfig')

/*

********************** EXPORTED
get_samples
get_samplecount
get_summary
get_summary_numericcategories
get_summary_conditioncategories
get_numericsummary
get_rows
get_rows_by_one_key
get_rows_by_two_keys
server_init_db_queries
listDbTables
********************** INTERNAL
get_term_cte
	makesql_oneterm
			makesql_groupset

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
	
uncomputablegrades_clause
grade_age_select_clause
get_label4key

*/

export async function get_samples(qfilter, ds) {
	/*
must have qfilter[]
as the actual query is embedded in qfilter
return an array of sample names passing through the filter
*/
	const filter = await getFilterCTEs(qfilter, ds) // if qfilter is blank, it returns null

	const sql = ds.cohort.db.connection.prepare(
		filter ? `WITH ${filter.filters} SELECT sample FROM ${filter.CTEname}` : 'SELECT name AS sample FROM sampleidmap'
	)

	let re
	if (filter) re = sql.all(filter.values)
	else re = sql.all()

	return re.map(i => i.sample)
}

export function get_cohortsamplecount(q, ds) {
	/*
must have q.cohortValues string
return an array of sample names for the given cohort
*/
	if (!q.cohortValues) throw `missing q.cohortValues`
	if (q.cohortValues == 'undefined') q.cohortValues = ''
	const cohortKey = ds.cohort.termdb.selectCohort?.term.id || 'subcohort'
	const statement = `SELECT cohort as ${cohortKey}, count as samplecount
		FROM subcohort_terms
		WHERE cohort=? and term_id='$ROOT$'`
	// may cache statement
	return ds.cohort.db.connection.prepare(statement).all(q.cohortValues)
}
export async function get_samplecount(q, ds) {
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

	const filter = await getFilterCTEs(j, ds)
	const statement = `WITH ${filter.filters}
		SELECT 'FILTERED_COHORT' as subcohort, count(*) as samplecount 
		FROM ${filter.CTEname}`
	return ds.cohort.db.connection.prepare(statement).all(filter.values)
}
export async function get_summary_numericcategories(q) {
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
	const filter = await getFilterCTEs(q.filter, q.ds)
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

export async function get_summary_conditioncategories(q) {
	/*
	q{}
		.filter
		.ds
		.term[0,1,2]_id
		.term[0,1,2]_q
	*/

	let result
	if (q.term1_q && q.term1_q.mode == 'cox') {
		// cox regression
		// do not use 'groupby'
		// need to filter sql results before
		// summarizing sample counts
		result = await get_rows(q, {
			withCTEs: true
		})

		const minTimeSinceDx = q.ds.cohort.termdb.minTimeSinceDx
		if (!minTimeSinceDx) throw 'missing min time since dx'

		const keyTosamplecount = new Map()
		for (const row of result.lst) {
			let key1
			// convert event=2 to event=0 because competing
			// risks events should not be treated as a separate
			// event category in cox regression
			// these events should be treated as censored at
			// time of death
			key1 = row.key1 === 2 ? 0 : row.key1

			// flag samples that had events before follow-up
			// these samples are excluded during the analysis
			// so they should be labeled as excluded in the summary
			const { age_dx, age_event } = JSON.parse(row.val1)
			const age_start = age_dx + minTimeSinceDx
			if (age_event - age_start < 0) key1 = -1

			// compute sample counts for each event status
			const samplecount = keyTosamplecount.get(key1)
			samplecount ? keyTosamplecount.set(key1, samplecount + 1) : keyTosamplecount.set(key1, 1)
		}

		const lst = []
		for (const [key1, samplecount] of keyTosamplecount) {
			lst.push({ key1, samplecount })
		}
		result.lst = lst
	} else {
		result = await get_rows(q, {
			withCTEs: true,
			groupby: `key1`
		})
	}

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
	return result
}

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
	const filter = await getFilterCTEs(q.filter, q.ds)
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

export async function get_rows_by_two_keys(q, t1, t2) {
	/*
XXX only works for two numeric terms, not for any other types

get all sample and value by one key
no filter or cte
works for all attributes, including non-termdb ones

q{}
  .ds
  .key
*/
	const filter = await getFilterCTEs(q.filter, q.ds)
	const values = filter ? filter.values.slice() : []
	const CTE0 = await get_term_cte(q, values, 0)
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

export async function get_rows(q, _opts = {}) {
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
	
	.groupby:   default to '',
							or a column to group by, could be 'key', 'sample', 'value' 
							!!! 
								NOTE: after switching to UNION instead of JOIN,
								this deprecated the support for the following never used options
							  - "GROUP BY key1, key2" when aggregating by samplecount
							  - +" ORDER BY ..." + " LIMIT ..."
							!!!
*/

	if (typeof q.filter == 'string') q.filter = JSON.parse(decodeURIComponent(q.filter))

	const default_opts = {
		withCTEs: true,
		columnas: 't1.sample AS sample',
		groupby: ''
	}
	const opts = Object.assign(default_opts, _opts)
	const filter = await getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []

	const CTE0 = await get_term_cte(q, values, 0, filter)
	const CTE1 = await get_term_cte(q, values, 1, filter)
	const CTE2 = await get_term_cte(q, values, 2, filter)
	const CTEunion = [CTE0, CTE1, CTE2]
		.map(
			(c, i) => `
		SELECT sample, key, value, ${i} as termNum
		FROM ${c.tablename}
		${filter ? 'WHERE sample IN ' + filter.CTEname : ''}
	`
		)
		.join('\nUNION ALL\n')

	const sql = `WITH
		${filter ? filter.filters + ',' : ''}
		${CTE0.sql},
		${CTE1.sql},
		${CTE2.sql}
		${CTEunion}`
	//console.log(interpolateSqlValues(sql, values))
	try {
		const rows = q.ds.cohort.db.connection.prepare(sql).all(values)
		const smap = new Map()
		for (const r of rows) {
			if (!smap.has(r.sample)) smap.set(r.sample, { sample: r.sample })
			const s = smap.get(r.sample)
			// NOTE: condition terms may have more than one data row per sample,
			// so must use an array to capture all possible term key-values for each sample
			const k = `key${r.termNum}`
			if (!(k in s)) s[k] = []
			s[k].push(r)
		}
		const lst = []
		const scounts = new Map()
		for (const v of smap.values()) {
			// series term (term1)
			// discard sample if not annotated for term1
			if (!('key1' in v)) continue

			// chart term (term0)
			if (q.term0_q && q.term0_id) {
				// term0 is defined, discard sample if not annotated for term0
				// but only if dictionary term, implied by having a term.id
				if (!('key0' in v)) continue
			} else {
				// term0 is not defined, supply empty string default
				v.key0 = [{ key: '', value: '' }]
			}

			// overlay term (term2)
			if (q.term2_q && (q.term2_id || q.term2.type === 'samplelst')) {
				// term2 is defined, discard sample if not annotated for term2
				// but only if dictionary term, implied by having a term.id
				if (!('key2' in v)) continue
			} else {
				// term2 is not defined, supply empty string default
				v.key2 = [{ key: '', value: '' }]
			}

			v.rows = []
			// create a separate data row for each combination of unique term annotations
			// NOTE: when there is only 1 unique annotated value by term for each sample,
			// then only one row will be created. This will not be the case for condition terms
			// where a sample is annotated by multiple grades or conditions.
			for (const v0 of v.key0) {
				for (const v1 of v.key1) {
					for (const v2 of v.key2) {
						v.rows.push({
							sample: v.sample,
							key0: v0.key,
							val0: v0.value,
							key1: v1.key,
							val1: v1.value,
							key2: v2.key,
							val2: v2.value
						})
					}
				}
			}

			for (const s of v.rows) {
				if (!opts.groupby) {
					lst.push(s)
				} else {
					// assume that the groupby option is used to get samplecounts
					if (!scounts.has(s[opts.groupby])) {
						const item = Object.assign({ samplecount: 0 }, s)
						lst.push(item)
						scounts.set(s[opts.groupby], item)
					}
					const l = scounts.get(s[opts.groupby])
					l.samplecount++
				}
			}
		}
		return !opts.withCTEs ? lst : { lst, CTE0, CTE1, CTE2, filter }
	} catch (e) {
		console.log('error in sql:\n', interpolateSqlValues(sql, values))
		throw e
	}
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
	.term?_is_genotype 		// supported parameters for barchart data
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

termWrapper{}
	.id term.id
	.term
	.q

RETURNS 
{ sql, tablename }
*/
export async function get_term_cte(q, values, index, filter, termWrapper = null) {
	const twterm = (termWrapper && termWrapper.term) || q[`term${index}`]
	const termid = twterm ? twterm.id : q['term' + index + '_id']
	const term_is_genotype = termWrapper && twterm ? termWrapper.term.is_genotype : q['term' + index + '_is_genotype']
	if (!(twterm?.type == 'samplelst')) {
		// legacy code support: index=1 is assumed to be barchart term
		// when there is no termWrapper argument
		if (!termWrapper && index == 1 && !term_is_genotype) {
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
	// index position is dependent on server route
	// TODO: investigate the utility of 'filter' argument (since get_rows() already performs filtering)
	let CTE
	if (term.type == 'categorical') {
		const groupset = get_active_groupset(term, termq)
		CTE = await categoricalSql[groupset ? 'groupset' : 'values'].getCTE(
			tablename,
			term,
			q.ds,
			termq,
			values,
			index,
			groupset
		)
	} else if (term.type == 'integer' || term.type == 'float') {
		const mode = termq.mode == 'spline' ? 'cubicSpline' : termq.mode || 'discrete'
		// the error is coming from this
		CTE = await numericSql[mode].getCTE(tablename, term, q.ds, termq, values, index, filter)
	} else if (term.type == 'condition') {
		const mode = termq.mode == 'cuminc' || termq.mode == 'cox' ? 'time2event' : termq.mode || 'discrete'
		CTE = await conditionSql[mode].getCTE(tablename, term, q.ds, termq, values)
	} else if (term.type == 'survival') {
		CTE = makesql_survival(tablename, term, q, values, filter)
	} else if (term.type == 'samplelst') {
		CTE = await sampleLstSql.getCTE(tablename, termWrapper, values)
	} else {
		throw 'unknown term type'
	}
	if (index != 1) CTE.join_on_clause = `ON t${index}.sample = t1.sample` // will be ignored if no join clause is created by sql constructor
	return CTE
}

export async function get_summary(q) {
	/*
q{}
	.filter
	.ds
	.term[0,1,2]_id
	.term[0,1,2]_q
*/
	const key0 = 'term0_id' in q ? `key0,` : ''
	const key2 = 'term2_id' in q ? `,key2` : ''

	const result = await get_rows(q, {
		withCTEs: true,
		groupby: `key1`
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
	return result
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
		if (q.breaks?.length == 0) {
			if (!(key in term.values)) throw `unknown grade='${key}'`
			return term.values[key].label
		}
		if (q.mode == 'cox') {
			// key is event status from cox sql query (0 = no event; 1 = event; -1 = Event before entry into the cohort)
			// if key is -1, return descriptive label
			// otherwise, use key to get label from q.groupNames
			if (key === -1) return 'Event before entry into the cohort'
			return q.groupNames[key]
		}
		// breaks[] has values, chart is by group and key should be group name
		return key
	}
	if (term.values) {
		return key in term.values ? term.values[key].label : key
	}
	if (term.type == 'integer' || term.type == 'float') throw 'should not work for numeric term'
	throw 'unknown term type'
}

export function getUncomputableClause(term, q, tableAlias = '') {
	if (!term.values || !q.computableValuesOnly) return { values: [], clause: '' }
	const values = Object.keys(term.values).filter(k => term.values[k].uncomputable)
	const aliasValue = tableAlias ? `${tableAlias}.value` : 'value'
	return {
		values,
		clause: values.length ? `AND ${aliasValue} NOT IN (${values.map(() => '?').join(',')})` : ''
	}
}

function makesql_survival(tablename, term, q, values, filter) {
	values.push(term.id)
	return {
		sql: `${tablename} AS (
			SELECT sample, exit_code as key, tte AS value
			FROM survival s
			WHERE s.term_id=?
			${filter ? 'AND s.sample IN ' + filter.CTEname : ''}
		)`,
		tablename
	}
}

function get_active_groupset(term, q) {
	if (!q.groupsetting || q.groupsetting.disabled || !q.groupsetting.inuse) return
	if (Number.isInteger(q.groupsetting.predefined_groupset_idx)) {
		if (q.groupsetting.predefined_groupset_idx < 0) throw 'q.predefined_groupset_idx out of bound'
		if (!term.groupsetting) throw 'term.groupsetting missing when q.predefined_groupset_idx in use'
		if (!term.groupsetting.lst) throw 'term.groupsetting.lst missing when q.predefined_groupset_idx in use'
		const s = term.groupsetting.lst[q.groupsetting.predefined_groupset_idx]
		if (!s) throw 'q.predefined_groupset_idx out of bound'
		return s
	} else if (q.groupsetting.customset) {
		return q.groupsetting.customset
	} else {
		throw 'do not know how to get groupset'
	}
}

/*
	Arguments
	- term{}
	- q{}: must have a groupset
	
	Return
	- a series of "SELECT name, value" statements that are joined by UNION ALL
	- uncomputable values are not included in the CTE results, EXCEPT IF such values are in a group
*/
function makesql_values_groupset(term, q) {
	const s = get_active_groupset(term, q)
	if (!s.groups) throw '.groups[] missing from a group-set'
	const categories = []
	let filter
	for (const [i, g] of s.groups.entries()) {
		const groupname = g.name || 'Group ' + (i + 1)
		if (!Array.isArray(g.values)) throw 'groupset.groups[' + i + '].values[] is not array'
		for (const v of g.values) {
			categories.push(`SELECT '${groupname}' AS name, '${v.key}' AS value`)
		}
	}
	return categories.join('\nUNION ALL\n')
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

export async function get_numericsummary(q, term, ds, withValues = false) {
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
	const filter = await getFilterCTEs(qfilter, ds)
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

	const dbfile = ds.cohort.db.file_fullpath || ds.cohort.db.file
	if (!dbfile) throw 'both file and file_fullpath missing'
	const cn = connect_db(dbfile)
	console.log(`DB connected for ${ds.label}: ${dbfile}`)

	ds.cohort.db.connection = cn

	const tables = listDbTables(cn)

	if (!tables.has('terms')) throw 'terms table missing'
	if (!tables.has('ancestry')) throw 'ancestry table missing'
	if (!tables.has('annotations')) throw 'annotations table missing'
	if (ds.cohort.termdb.selectCohort && !tables.has('subcohort_terms'))
		throw 'subcohort_terms table is missing while termdb.selectCohort is enabled'

	ds.cohort.termdb.q = {}
	const q = ds.cohort.termdb.q

	if (tables.has('buildDate')) {
		q.get_buildDate = cn.prepare('select date from buildDate')
	}

	if (tables.has('term2genes')) {
		/*
		this db has optional table that maps term id to gene set, right now only used for msigdb
		set termMatch2geneSet flag to true for client termdb tree to be aware of it via termdbConfig{}
		add the getter function
		*/
		ds.cohort.termdb.termMatch2geneSet = true
		const s = cn.prepare('SELECT genes FROM term2genes WHERE id=?')
		const cache = new Map()
		q.getGenesetByTermId = id => {
			if (cache.has(id)) return cache.get(id)
			const t = s.get(id)
			if (t && t.genes) {
				const lst = JSON.parse(t.genes)
				cache.set(id, lst)
				return lst
			}
			return undefined
		}
	}

	if (tables.has('sampleidmap')) {
		const i2s = new Map(),
			s2i = new Map()
		const s = cn.prepare('SELECT * FROM sampleidmap')
		for (const { id, name } of s.all()) {
			i2s.set(id, name)
			s2i.set(name, id)
		}
		q.id2sampleName = id => i2s.get(id)
		q.sampleName2id = s => s2i.get(s)
	}

	if (tables.has('category2vcfsample')) {
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
	if (tables.has('alltermsbyorder')) {
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
		const s = cn.prepare('SELECT name, jsondata FROM terms WHERE id=?')
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
				j.name = t.name || j.name
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
		const sql = cn.prepare(
			`SELECT id, name, jsondata, s.included_types, s.child_types
			FROM terms t
			JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=?
			WHERE parent_id is null
			GROUP BY id
			ORDER BY child_order ASC`
		)
		const cache = new Map()
		q.getRootTerms = (cohortStr = '') => {
			const cacheId = cohortStr
			if (cache.has(cacheId)) return cache.get(cacheId)
			const tmp = sql.all(cohortStr)
			const re = tmp.map(i => {
				const t = JSON.parse(i.jsondata)
				t.id = i.id
				t.name = i.name || t.name
				t.included_types = i.included_types ? i.included_types.split(',') : ['TO-DO-PLACEHOLDER']
				t.child_types = i.child_types ? i.child_types.split(',') : []
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
		const sql = cn.prepare(
			`SELECT id, name, type, jsondata, s.included_types, s.child_types 
			FROM terms t
			JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=? 
			WHERE id IN (SELECT id FROM terms WHERE parent_id=?)
			GROUP BY id
			ORDER BY child_order ASC`
		)

		const cache = new Map()
		q.getTermChildren = (id, cohortStr = '') => {
			const cacheId = id + ';;' + cohortStr
			if (cache.has(cacheId)) return cache.get(cacheId)
			const tmp = sql.all([cohortStr, id])
			let re = undefined
			if (tmp) {
				re = tmp.map(i => {
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					j.name = i.name || j.name
					j.included_types = i.included_types ? i.included_types.split(',') : []
					j.child_types = i.child_types ? i.child_types.split(',') : []
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
		const sql = cn.prepare(
			`SELECT id, name, jsondata, s.included_types
			FROM terms t
			JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=?
			WHERE name LIKE ?`
		)
		q.findTermByName = (n, limit = 10, cohortStr = '', treeFilter = null, usecase = null, matches = null) => {
			const vals = []
			const tmp = sql.all([cohortStr, '%' + n + '%'])
			if (tmp) {
				const r = matches || { equals: [], startsWith: [], startsWord: [], includes: [] }
				const lst = []
				for (const i of tmp) {
					const name = i.name.toLowerCase()
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					j.name = i.name || j.name
					j.included_types = i.included_types ? i.included_types.split(',') : []
					if (!usecase || isUsableTerm(j, usecase).has('plot')) {
						if (name === n) r.equals.push(j)
						else if (name.startsWith(n)) r.startsWith.push(j)
						else if (name.includes(' ' + n)) r.startsWord.push(j)
						else r.includes.push(j)
					}
				}
				return [...r.equals, ...r.startsWith, ...r.startsWord, ...r.includes].slice(0, limit)
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
		const s = cn.prepare('SELECT t.name FROM ancestry as a, terms as t WHERE a.term_id=? AND t.id=a.ancestor_id')
		const cache = new Map()
		q.getAncestorNames = id => {
			if (cache.has(id)) return cache.get(id)
			const tmp = s.all(id).map(i => i.name)
			cache.set(id, tmp)
			return tmp
		}
	}
	{
		/* term id is required, sample id is optional
		if sample is missing, select all sample and category by term id
			return [ {sample=str, value=?}, ... ]
		else, return single value by sample and term
		*/
		const s = cn.prepare('SELECT sample,value FROM annotations WHERE term_id=?')
		const s_sampleInt = cn.prepare('SELECT value FROM annotations WHERE term_id=? AND sample=?')
		const s_sampleStr = cn.prepare(
			'SELECT a.value FROM annotations AS a, sampleidmap AS s WHERE a.term_id=? AND a.sample=s.id AND s.name=?'
		)
		q.getSample2value = (id, sample = null) => {
			if (sample) {
				if (typeof sample == 'string') return s_sampleStr.all(id, sample)
				return s_sampleInt.all(id, sample)
			}
			return s.all(id)
		}
	}
	if (tables.has('termhtmldef')) {
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

	/*
	returns list of chart types based on term types from each subcohort combination
	*/
	q.getSupportedChartTypes = embedder => {
		mayComputeTermtypeByCohort(ds)
		// ds.cohort.termdb.termtypeByCohort[] is set

		const cred = serverconfig.dsCredentials?.[ds.label]

		const supportedChartTypes = {}
		const numericTypeCount = {}
		// key: subcohort combinations, comma-joined, alphabetically sorted, as in the subcohort_terms table
		// value: array of chart types allowed by term types

		for (const r of ds.cohort.termdb.termtypeByCohort) {
			if (!r.type) continue // skip ungraphable parent terms

			if (!(r.cohort in supportedChartTypes)) {
				supportedChartTypes[r.cohort] = new Set(['regression', 'summary'])
				if (ds.cohort.scatterplots) supportedChartTypes[r.cohort].add('sampleScatter')
				numericTypeCount[r.cohort] = 0
				if (ds.cohort.allowedChartTypes?.includes('matrix')) supportedChartTypes[r.cohort].add('matrix')
				if (!cred || cred.embedders?.[embedder]) {
					supportedChartTypes[r.cohort].add('dataDownload')
				}
			}
			// why would app.features be missing?
			if (app.features?.draftChartTypes) {
				// TODO: move draft charts out of flag once stable
				supportedChartTypes[r.cohort].add(...app.features.draftChartTypes)
			}
			if (r.type == 'survival' && !supportedChartTypes[r.cohort].has('survival'))
				supportedChartTypes[r.cohort].add('survival')
			if (r.type == 'condition' && !supportedChartTypes[r.cohort].has('cuminc'))
				supportedChartTypes[r.cohort].add('cuminc')
			if (r.type == 'float' || r.type == 'integer') numericTypeCount[r.cohort] += r.samplecount
		}

		/* this logic allows to add chart types generally applicable to all numeric terms
but boxplot and scatter are now child types under "summary" plot. 
		for (const cohort in numericTypeCount) {
			if (numericTypeCount[cohort] > 0) supportedChartTypes[cohort].add('boxplot')
			if (numericTypeCount[cohort] > 1) supportedChartTypes[cohort].add('scatterplot')
		}
		*/

		// convert to array
		for (const cohort in supportedChartTypes) {
			supportedChartTypes[cohort] = [...supportedChartTypes[cohort]]
		}

		// may restrict the visible chart options
		if (ds.cohort.allowedChartTypes) {
			for (const cohort in supportedChartTypes) {
				supportedChartTypes[cohort] = supportedChartTypes[cohort].filter(c => ds.cohort.allowedChartTypes.includes(c))
			}
		}

		if (ds.queries) {
			// has genomic data queries
			if (ds.queries.snvindel || ds.queries.trackLst) {
				// suitable datatypes are present, enable genomeBrowser chart
				for (const cohort in supportedChartTypes) {
					supportedChartTypes[cohort].push('genomeBrowser')
				}
			}
		}

		return supportedChartTypes
	}
}

// helper function to display or log the filled-in, constructed sql statement
// use for debugging only, do not feed directly into better-sqlite3
export function interpolateSqlValues(sql, values) {
	const vals = values.slice() // use a copy
	let prevChar
	return sql
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

export function mayComputeTermtypeByCohort(ds) {
	if (ds.cohort.termdb.termtypeByCohort) {
		if (!Array.isArray(ds.cohort.termdb.termtypeByCohort)) throw 'termtypeByCohort is not array'
		// already set, by one of two methods:
		// 1. db query below
		// 2. gdc dictionary building
		return
	}

	if (!ds.cohort?.db?.connection) throw 'termtypeByCohort[] not set but cohort.db.connection missing'

	/*
	not available; perform db query for the first request, and cache the results

	(as this query may be expensive thus do not want to run it for every request...)

	for dataset with subcohort:
	[
	  { cohort: 'XYZ', type: '', samplecount: 615 },
	  { cohort: 'XYZ', type: 'categorical', samplecount: 393 },
	  { cohort: 'ABC', type: '', samplecount: 636 },
	  { cohort: 'ABC', type: 'categorical', samplecount: 457 },
	  ...
	  { cohort: 'XYZ,ABC', type: '', samplecount: 614 },
	  { cohort: 'XYZ,ABC', type: 'categorical', samplecount: 393 },
	  ...
	]

	for dataset without subcohort:
	[
		  { cohort: '', type: '', samplecount: 11 },
		  { cohort: '', type: 'categorical', samplecount: 65 },
		  { cohort: '', type: 'float', samplecount: 1 },
		  { cohort: '', type: 'survival', samplecount: 2 }
	]

	*/
	ds.cohort.termdb.termtypeByCohort = ds.cohort.db.connection
		.prepare(
			`WITH c AS (
			SELECT cohort, term_id
			FROM subcohort_terms s
			GROUP BY cohort, term_id
		) 
		SELECT cohort, type, count(*) as samplecount
		FROM terms t
		JOIN c ON c.term_id = t.id
		GROUP BY cohort, type`
		)
		.all()
}

export function listDbTables(cn) {
	const rows = cn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
	return new Set(rows.map(i => i.name))
}
