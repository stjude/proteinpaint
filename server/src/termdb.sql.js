import * as binsmodule from '#shared/termdb.bins.js'
import { getFilterCTEs } from './termdb.filter.js'
import * as numericSql from './termdb.sql.numeric.js'
import * as categoricalSql from './termdb.sql.categorical.js'
import * as conditionSql from './termdb.sql.condition.js'
import { sampleLstSql } from './termdb.sql.samplelst.js'
import { multivalueCTE } from './termdb.sql.multivalue.js'
import { boxplot_getvalue } from './utils.js'
import { DEFAULT_SAMPLE_TYPE, isNumericTerm, annoNumericTypes } from '#shared/terms.js'
import { authApi } from '#src/auth.js'
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
//in the future we may need to pass the sample type when there are more types than root and not root
export async function get_samples(q, ds, canDisplay = false) {
	/*
must have qfilter[]
as the actual query is embedded in q.filter
return an array of sample names passing through the filter
*/
	// NOTE: no need to call authApi.mayAdjustFilter() here since the app.middleware
	// already created/adjusted q.filter; would only need to call here if
	// q.__protected__.ignoreTermIds is modified or if routeTwLst can be supplied at this point

	const filter = await getFilterCTEs(q.filter, ds) // if q.filter is blank, it returns null
	const sql = filter
		? `WITH ${filter.filters} SELECT sample as id, name FROM ${filter.CTEname} join sampleidmap on sample = sampleidmap.id`
		: `SELECT id, name FROM sampleidmap`
	const cmd = ds.cohort.db.connection.prepare(sql)
	let re
	if (filter) re = cmd.all(filter.values)
	else re = cmd.all()
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
	let sql = filter
		? `WITH ${filter.filters} SELECT sample as id, sa.ancestor_id FROM ${filter.CTEname}
			left join sample_ancestry sa on sample = sa.sample_id and sa.distance = 1 union all 
			select id, null as ancestor_id from sample_ancestry sa join root_samples on sa.ancestor_id = id where sample_id in (select sample from ${filter.CTEname})` //Root samples need to be added
		: `SELECT id, sa.ancestor_id FROM sampleidmap left join sample_ancestry sa on id = sa.sample_id and sa.distance = 1`

	const cmd = ds.cohort.db.connection.prepare(sql)
	let re
	if (filter) re = cmd.all(filter.values)
	else re = cmd.all()
	if (canDisplay) return re
	for (const item of re) delete item.name
	return re
}

// we need to pass a type and count by type to differentiate root samples from samples
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
	let statement, row
	let sample_type
	//the filters either return a sample type or none as the samples are converted to the common type.
	// For example, if you have a filter that returns patients, like a gender filter in PNET, and another filter that returns samples, the patients filter will be forced to return samples
	//  if another sample filter is present in order to build a common filter with the samples intersected.
	if (ds.cohort.db.tableColumns['sampleidmap'].includes('sample_type')) {
		statement = `WITH ${filter.filters}
		SELECT count (distinct sample) as count, sample_type
		FROM ${filter.CTEname} join sampleidmap on sample = sampleidmap.id group by sample_type`
		row = ds.cohort.db.connection.prepare(statement).get(filter.values)
		if (!row) return { count: '0 samples' } //no samples found
		sample_type = ds.cohort.termdb.sampleTypes[row.sample_type]
		sample_type = row.count > 1 ? sample_type.plural_name : sample_type.name
	} else {
		statement = `WITH ${filter.filters}
		SELECT count (distinct sample) as count
		FROM ${filter.CTEname} join sampleidmap on sample = sampleidmap.id`
		row = ds.cohort.db.connection.prepare(statement).get(filter.values)
		if (!row) return { count: '0 samples' } //no samples found
		sample_type = row.count > 1 ? 'samples' : 'sample'
	}

	return { count: `${row.count} ${sample_type}` }
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
	if (!annoNumericTypes.has(term.type)) throw `unknown '${annoTable}' table in get_summary_numericcategories()`

	const filter = await getFilterCTEs(q.filter, q.ds)
	const values = filter ? filter.values.slice() : []
	values.push(q.term_id)
	const keylst = []
	for (const k in term.values) {
		keylst.push('?')
		values.push(Number(k))
	}
	const sql = `
		${filter ? 'WITH ' + filter.filters : ''}
		SELECT count(sample) AS samplecount,value
		FROM ${annoTable}
		WHERE term_id=?
		${filter ? 'AND sample IN ' + filter.CTEname : ''}
		AND value IN (${keylst.join(',')})
		GROUP BY value`
	return q.ds.cohort.db.connection.prepare(sql).all(values)
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
	const values = filter ? filter.values.slice() : []

	values.push(q.key)
	const sql = `
		${filter ? 'WITH ' + filter.filters : ''}
		SELECT sample, value
		FROM ${annoTable}
		WHERE term_id=?
		${filter ? ' AND sample IN ' + filter.CTEname : ''}`
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

values[]
	string/numeric to replace "?" in CTEs

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
{ sql, tablename }

DESIGN
*/
export async function get_term_cte(q, values, index, filter, termWrapper = null) {
	const twterm = (termWrapper && termWrapper.term) || q[`term${index}`]
	const termid = twterm ? twterm.id : q['term' + index + '_id']

	if (twterm?.type != 'samplelst') {
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
				sql: `${tablename} AS (\nSELECT null AS sample, '' as key, '' as value\n)`
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
	// TODO: investigate the utility of 'filter' argument (since get_rows() already performs filtering)
	let CTE
	if (term.type == 'categorical') {
		const groupset = get_active_groupset(term, termq)
		CTE = await categoricalSql[groupset ? 'groupset' : 'values'].getCTE(tablename, term, q.ds, termq, values, groupset)
	} else if (isNumericTerm(term)) {
		const mode = termq.mode == 'spline' ? 'cubicSpline' : termq.mode || 'discrete'
		// the error is coming from this
		CTE = await numericSql[mode].getCTE(tablename, term, q.ds, termq, values, index, filter)
	} else if (term.type == 'condition') {
		const mode = termq.mode || 'discrete'
		CTE = await conditionSql[mode].getCTE(tablename, term, q.ds, termq, values)
	} else if (term.type == 'survival') {
		CTE = makesql_survival(tablename, term, q, values, filter)
	} else if (term.type == 'samplelst') {
		CTE = await sampleLstSql.getCTE(q.ds, tablename, termWrapper || { term, q: termq }, values)
	} else if (term.type == 'multivalue') {
		CTE = await multivalueCTE.getCTE(tablename, termWrapper || { term, q: termq }, values)
	} else {
		throw 'unknown term type [get_term_cte() server/src/termdb.sql.js]'
	}
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
	if (!term) return default_labeler

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
		// breaks[] has values, chart is by group and key should be group name
		return key
	}
	if (term.values) {
		return key in term.values ? term.values[key].label : key
	}
	if (term.type == 'integer' || term.type == 'float') throw 'should not work for numeric term'
	throw 'unknown term type [get_label4key() server/src/termdb.sq.js]'
}

export function getUncomputableClause(term, q, tableAlias = '') {
	if (!term.values || !q.computableValuesOnly) {
		// return an empty clause so that uncomputable
		// values will be included
		return { values: [], clause: '' }
	}
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
	const annoTable = `anno_${term.type}`
	if (!annoNumericTypes.has(term.type)) throw `unknown '${annoTable}' table in get_numericsummary()`

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
		SELECT value
		FROM ${annoTable}
		WHERE
		${filter ? 'sample IN ' + filter.CTEname + ' AND ' : ''}
		term_id=?
		${excludevalues.length ? 'AND value NOT IN (' + excludevalues.join(',') + ')' : ''}`
	values.push(term.id)

	const s = ds.cohort.db.connection.prepare(string)
	const result = s.all(values)
	if (!result.length) return null
	result.sort((i, j) => i.value - j.value)

	const stat = boxplot_getvalue(result)
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
	const annoTable = `anno_${term.type}`
	if (!annoNumericTypes.has(term.type)) throw `unknown '${annoTable}' table in get_numericMinMaxPct()`

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
			SELECT value
			FROM ${annoTable}
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

export function get_multivalue_tws(query, ds) {
	const sql = `select id, name, json_extract(jsondata, '$.plotType') as subtype, json_extract(jsondata, '$.domainDetails') as details from terms where type='multivalue' and parent_id=?`
	const items = ds.cohort.db.connection.prepare(sql).all([query.parent_id])
	const terms = []
	for (const item of items) {
		terms.push({
			$id: item.id,
			term: { id: item.id, name: item.name, type: 'multivalue', subtype: item.subtype, details: item.details }
		})
	}
	return terms
}
