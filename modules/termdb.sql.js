const app = require('../app')
const binsmod = require('./termdb.bins')

/*

********************** EXPORTED
get_samples
get_summary
get_numericsummary
get_rows
get_rows_by_one_key
server_init_db_queries
********************** INTERNAL
makesql_by_tvsfilter
	add_categorical
	add_numerical
	add_condition
makesql_oneterm
	makesql_oneterm_condition
makesql_numericBinCTE
get_term_cte
uncomputablegrades_clause
grade_age_select_clause
get_label4key

*/






function makesql_by_tvsfilter ( tvslst, ds) {
/*
.tvslst[{}]
	optional
	each element is a term-value setting object
	must have already been validated by src/mds.termdb.termvaluesetting.js/validate_termvaluesetting()

_opts{}
	options for minor tweaks to the generated statement to serve other purposes,
	such as to help with getting min, max, percentiles for numeric terms 
	.columnas    "", or set t ", value" to get values
	.endclause   "GROUP BY sample",
							 or "ORDER BY value ASC" if columnas == ", value" and getting min, max, percentile


returns:
	.filters:
		one string of all filter statement intersects, with question marks
	.values[]:
		array of *bind parameters*
	.CTEname:
		the name of CTE, to be used in task-specific runner
*/
	if( !tvslst || !tvslst.length) return null
	const filters = []
	const values = []

	for(const tvs of tvslst) {
		//let samplein_clause = sampleset_id > 0 ? `sample IN sampleset_${sampleset_id} AND` : ''
		if(tvs.term.iscategorical) {
			add_categorical( tvs )
		} else if(tvs.term.isinteger || tvs.term.isfloat) {
			add_numerical( tvs )
		} else if(tvs.term.iscondition) {
			add_condition( tvs )
		} else {
			throw 'unknown term type'
		}
	}

	const CTEname = 'filtered'
	return {
		filters: `${CTEname} AS (\n ${filters.join('\nINTERSECT\n')})\n`,
		values,
		CTEname
	}

	// helpers
	function add_categorical ( tvs ) {
		filters.push(
			`SELECT sample
			FROM annotations
			WHERE term_id = ?
			AND value IN (${tvs.values.map(i=>'?').join(', ')})`
		)
		values.push( tvs.term.id, ...tvs.values.map(i=>i.key) )
	}

	function add_numerical ( tvs ) {
		if(!tvs.ranges) throw '.ranges{} missing'
		values.push( tvs.term.id )
		const range2clause = []
		const cast = 'CAST(value AS '+(tvs.term.isinteger?'INT':'REAL')+')'
		for(const range of tvs.ranges) {
			if( range.value != undefined ) {
				// special category
				range2clause.push(cast+'=?')
				values.push( range.value )
			} else {
				// regular bin
				const lst = []
				if( !range.startunbounded ) {
					if( range.startinclusive ) {
						lst.push(cast+' >= ?')
					} else {
						lst.push(cast+' > ? ')
					}
					values.push( range.start )
				}
				if( !range.stopunbounded ) {
					if( range.stopinclusive ) {
						lst.push(cast+' <= ?')
					} else {
						lst.push(cast+' < ? ')
					}
					values.push( range.stop )
				}
				range2clause.push( '('+lst.join(' AND ')+')' )
			}
		}
		filters.push(
			`SELECT sample
			FROM annotations
			WHERE term_id = ?
			AND ( ${range2clause.join(' OR ')} )`
		)
	}

	function add_condition ( tvs ) {
		const value_for = tvs.bar_by_children ? 'child' 
			: tvs.bar_by_grade ? 'grade'
			: ''
		if (!value_for) throw 'must set the bar_by_grade or bar_by_children query parameter'

		const restriction = tvs.value_by_max_grade ? 'max_grade'
				: tvs.value_by_most_recent ? 'most_recent'
				: 'computable_grade'
		values.push(tvs.term.id, value_for, restriction)
		
		filters.push(`
			SELECT 
				sample
			FROM precomputed
			WHERE term_id = ? 
				AND value_for = ? 
				AND restriction = ?
				AND value IN (${tvs.values.map(i=>'?').join(', ')})`)
		values.push(...tvs.values.map(i=>''+i.key))
	}
}







export function get_samples ( tvslst, ds ) {
/*
must have tvslst[]
as the actual query is embedded in tvslst
return an array of sample names passing through the filter
*/
	const filter = makesql_by_tvsfilter( tvslst, ds )
	const string =
		`WITH ${filter.filters}
		SELECT sample FROM ${filter.CTEname}`

	// may cache statement
	const re = ds.cohort.db.connection.prepare( string )
		.all( filter.values )
	return re.map(i=>i.sample)
}




export function get_rows_by_one_key ( q ) {
/*
get all sample and value by one key
no filter or cte
works for all attributes, including non-termdb ones

q{}
	.ds
	.key
*/
	const sql = 'SELECT sample,value FROM annotations WHERE term_id=?'
	return q.ds.cohort.db.connection.prepare( sql )
		.all( q.key )
}




export function get_rows ( q, _opts={}) {
/*
works for only termdb terms; non-termdb attributes will not work

gets data for barchart but not summarized by counts;
returns all relevant rows of 
	{
		sample, key[0,1,2], val[0,1,2], count AS opts.countas
		CTE[0,1,2]} if opts.withCTEs == true
	}

q{}
	.tvslst
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
	if (typeof q.tvslst == 'string') q.tvslst = JSON.parse(decodeURIComponent(q.tvslst))
	
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
	const filter = makesql_by_tvsfilter( q.tvslst, q.ds )
	const values = filter ? filter.values.slice() : []
	const CTE0 = get_term_cte(q, filter, values, 0)
	const CTE1 = get_term_cte(q, filter, values, 1)
	const CTE2 = get_term_cte(q, filter, values, 2)

	const statement =
		`WITH
		${filter ? filter.filters +',' : ''}
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
		${filter ? "WHERE t1.sample in "+filter.CTEname : ""}
		${opts.endclause}`
	//console.log(statement, values)
	const lst = q.ds.cohort.db.connection.prepare(statement)
		.all( values )

	return !opts.withCTEs ? lst : {lst, CTE0, CTE1, CTE2, filter}
}

function get_term_cte(q, filter, values, index) {
/*
Generates one or more CTEs by term

q{}
	.tvslst
	.ds
	.term[0,1,2]_id
	.term[0,1,2]_q
filter   returned by makesql_by_tvsfilter
values[] string/numeric to replace ? in CTEs
index    0 for term0, 1 for term1, 2 for term2
*/
	const term_is_genotype = 'term' + index + '_is_genotype'
	const termnum_id = 'term' + index + '_id'
	const termid = q[termnum_id]
	let term = termid ? q.ds.cohort.termdb.q.termjsonByOneid( termid ) : null;
	if (termid && !term && !q[term_is_genotype]) throw `unknown ${termnum_id}: ${termid}`

	const termnum_q = 'term' + index + '_q'
	const termq = q[termnum_q]
	if(termq && typeof termq == 'string' ) q[termnum_q] = JSON.parse(decodeURIComponent(termq))	
	if (!termq) q[termnum_q] = {}
	if (index == 2) q[termnum_q].isterm2 = true
	if (index == 0) q[termnum_q].isterm0 = true

	const tablename = 'samplekey_' + index

	const CTE = term ?
		makesql_oneterm( term, filter, q.ds, q[termnum_q], values, "_" + index)
		: {
			sql: `${tablename} AS (\nSELECT null AS sample, '' as key, '' as value\n)`,
			tablename,
			join_on_clause: '' //`ON t${index}.sample IS NULL`
		}

	if (index!=1 && !('join_on_clause' in CTE)) {
		CTE.join_on_clause = `ON t${index}.sample = t1.sample`
	}
	
	return CTE
}


export function get_summary ( q ) {
/*
q{}
	.tvslst
	.ds
	.term[0,1,2]_id
	.term[0,1,2]_q
*/
	const result = get_rows(q, {
		withCTEs: true,
		columnas: 'count(distinct t1.sample) as samplecount',
		endclause: 'GROUP BY key0, key1, key2'
	})

	const nums = [0,1,2]
	const labeler = {}
	for(const n of nums) {
		labeler[n] = getlabeler(q, n, result)
	}
	for(const row of result.lst) {
		for(const n of nums) {
			labeler[n](row)
		}
	}
	return result.lst
}



function getlabeler(q, i, result) {
/*
Returns a function to (re)label a data object

q{}
	.tvslst
	.ds
	.term[0,1,2]_id
	.term[0,1,2]_q
i       0,1,2 corresponding to term[i]_[id|q]
result  returned by get_rows(, {withCTEs: 1})
*/
	const key = 'key' + i
	const value = 'val' + i
	const label = "label" + i
	const default_labeler = (row) => {
		delete row[key]
		delete row[value]
	}
	
	const term_id = q['term'+ i + '_id']
	if (!term_id) return default_labeler
	const term = q.ds.cohort.termdb.q.termjsonByOneid( term_id )
	if (!term_id) return default_labeler 
	
	// when there is only term1 and no term0/term2 simplify 
	// the property names to just "key" and "label" with no index
	// -- consider keeping key1 terminology consistent later?
	const tkey = i != 1 || q.term0_id || q.term2_id ? key : 'key'
	const tlabel = i != 1 || q.term0_id || q.term2_id ? key : 'label'
	if( term.isinteger || term.isfloat ) {
		const CTE = result['CTE' + i]
		const range = 'range' + (i != 1 || q.term0_id || q.term2_id ? i : '')
		return (row) => {
			row[range] = CTE.name2bin.get( row[key] )
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
		return (row) => {
			row[tlabel] = get_label4key( row[key], term, term_q, q.ds )
			delete row[value]
			// remove key index as needed
			if (tkey !== key) {
				row[tkey] = row[key]
				delete row[key]
			}
		}
	}
}



function get_label4key ( key, term, q, ds ) {
	// get label for a key based on term type and setting
	if(term.iscategorical) {
		let label
		if( term.values && term.values[key] ) label = term.values[key].label
		return label || key
	}
	if(term.iscondition) {
		if(term.isleaf || q.bar_by_grade) {
			const g = ds.cohort.termdb.patient_condition.grade_labels.find(i=>i.grade==key)
			if(!g) return key+': unknown_grade'
			return g.label
		}
		// no special label for subconditions; may use .name from subcondition term
		return key
	}
	if(term.isinteger || term.isfloat) throw 'should not work for numeric term'
	throw 'unknown term type'
}




function makesql_oneterm ( term, filter, ds, q, values, termindex ) {
/*
form the query for one of the table in term0-term1-term2 overlaying

CTE for each term resolves to a table of {sample,key}

term{}
filter{}: returned by makesql_by_tvsfilter
q{}
	.custom_bins[]
	.value_by_?
	.bar_by_?
values[]: collector of bind parameters

returns { sql, tablename }
*/
	const tablename = 'samplekey' + termindex
	if( term.iscategorical ) {
		values.push( term.id )
		return {
			sql: `${tablename} AS (
				SELECT sample,value as key, value as value
				FROM annotations
				WHERE term_id=?
			)`,
			tablename
		}
	}
	if( term.isfloat || term.isinteger ) {
		values.push( term.id )
		const bins = makesql_numericBinCTE( term, q, filter, ds, termindex )
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
	if( term.iscondition ) {
		return makesql_oneterm_condition( term, q, ds, filter, values, termindex )
	}
	throw 'unknown term type'
}


function makesql_oneterm_condition ( term, q, ds, filter, values, termindex='' ) {
/*
	return {sql, tablename}
*/
	const grade_table = 'grade_table' + termindex
	const term_table = 'term_table' + termindex
	const out_table = 'out_table' + termindex
	const value_for = q.bar_by_children ? 'child' 
		: q.bar_by_grade ? 'grade'
		: ''
	if (!value_for) throw 'must set the bar_by_grade or bar_by_children query parameter'

	const restriction = q.value_by_max_grade ? 'max_grade'
			: q.value_by_most_recent ? 'most_recent'
			: 'computable_grade'
	values.push(term.id, value_for, restriction)
	
	return {
		sql: `${out_table} AS (
			SELECT 
				sample, 
				${value_for == 'grade' ? 'CAST(value AS integer) as key' : 'value as key'}, 
				${value_for == 'grade' ? 'CAST(value AS integer) as value' : 'value'}
			FROM precomputed
			WHERE term_id = ? 
				AND value_for = ? 
				AND restriction = ?
		)`,
		tablename: out_table
	}
}





function makesql_numericBinCTE ( term, q, filter, ds, termindex='' ) {
/*
decide bins and produce CTE

q{}
	.custom_bins[]: list of custom bins
	.isterm2: true
filter as is returned by makesql_by_tvsfilter
returns { sql, tablename, name2bin }
*/
	const [bins, bin_size] = get_bins(q, term, ds, termindex)
	const bin_def_lst = []
	const name2bin = new Map() // k: name str, v: bin{}
	let has_percentiles = false
	let binid = 0
	for(const b of bins) {
		if (!('name' in b) && b.label) b.name = b.label
		if(!b.name) {
			if( Number.isInteger( bin_size ) ) {
        // bin size is integer, make nicer label
        if( bin_size == 1 ) {
          // bin size is 1; use just start value as label, not a range
          b.name = b.start
        } else {
          // bin size bigger than 1, reduce right bound by 1, in label only!
          b.name = b.start + ' to ' + (b.stop-1)
        }
      } else {
        // bin size is not an integer
        if( b.startunbounded ) {
          b.name = (b.stopinclusive ? '<=' : '<')+' '+b.stop
        } else if( b.stopunbounded ) {
          b.name = (b.startinclusive ? '>=' : '>')+' '+b.start
        } else {
          b.name = `${b.start} <${b.startinclusive?'=':''} x <${b.stopinclusive?'=':''} ${b.stop}`
        }
      }
		}
		name2bin.set( b.name, b )
		bin_def_lst.push(
			`SELECT '${b.name}' AS name,
			${b.start==undefined?0:b.start} AS start,
			${b.stop==undefined?0:b.stop} AS stop,
			0 AS unannotated,
			${b.startunbounded?1:0} AS startunbounded,
			${b.stopunbounded?1:0} AS stopunbounded,
			${b.startinclusive?1:0} AS startinclusive,
			${b.stopinclusive?1:0} AS stopinclusive,
			${binid++} AS binorder`
		)
	}
	let excludevalues
	if(term.graph && term.graph.barchart && term.graph.barchart.numeric_bin && term.graph.barchart.numeric_bin.unannotated) {
		excludevalues = []
		const u = term.graph.barchart.numeric_bin.unannotated
		if(u.value!=undefined) {
			excludevalues.push( u.value )
			bin_def_lst.push(
				`SELECT '${u.label}' AS name,
				${u.value} AS start,
				0 AS stop,
				1 AS unannotated,
				0 AS startunbounded,
				0 AS stopunbounded,
				0 AS startinclusive,
				0 AS stopinclusive,
				${binid++} AS binorder`
			)
			name2bin.set( u.label, {
				is_unannotated: true,
				value: u.value,
				label: u.label
			})
		}
		if(u.value_positive!=undefined) {
			excludevalues.push( u.value_positive )
			bin_def_lst.push(
				`SELECT '${u.label_positive}' AS name,
				${u.value_positive} AS start,
				0 AS stop,
				1 AS unannotated,
				0 AS startunbounded,
				0 AS stopunbounded,
				0 AS startinclusive,
				0 AS stopinclusive,
				${binid++} AS binorder`
			)
			name2bin.set( u.label_positive, {
				is_unannotated: true,
				value: u.value_positive,
				label: u.label_positive
			})
		}
		if(u.value_negative!=undefined) {
			excludevalues.push( u.value_negative )
			bin_def_lst.push(
				`SELECT '${u.label_negative}' AS name,
				${u.value_negative} AS start,
				0 AS stop,
				1 AS unannotated,
				0 AS startunbounded,
				0 AS stopunbounded,
				0 AS startinclusive,
				0 AS stopinclusive,
				${binid++} AS binorder`
			)
			name2bin.set( u.label_negative, {
				is_unannotated:true,
				value: u.value_negative,
				label: u.label_negative
			})
		}
	}

	const bin_def_table = 'bin_defs' + termindex
	const bin_sample_table = 'bin_sample' + termindex

	const sql = 
		`${bin_def_table} AS (
			${bin_def_lst.join(' UNION ALL ')}
		),
		${bin_sample_table} AS (
			SELECT
				sample,
				CAST(value AS ${term.isinteger?'INT':'REAL'}) AS v,
				CAST(value AS ${term.isinteger?'INT':'REAL'}) AS value,
				b.name AS bname,
				b.binorder AS binorder
			FROM
				annotations a
			JOIN ${bin_def_table} b ON
				( b.unannotated=1 AND v=b.start )
				OR
				(
					${excludevalues ? 'v NOT IN ('+excludevalues.join(',')+') AND' : ''}
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
			${filter ? 'sample IN '+filter.CTEname+' AND':''}
			term_id=?
		)`
	return {
		sql,
		tablename: bin_sample_table,
		name2bin,
		bins
	}
}


export function get_bins(q, term, ds) {
	const nb = term.graph && term.graph.barchart && term.graph.barchart.numeric_bin
	const binconfig = q.custom_bins ? q.custom_bins 
		: nb.bins_less && (q.isterm2 || q.isterm0) ? nb.bins_less
		: nb.bins;
	if (!binconfig) throw 'unable to determine binning scheme'
  const bins = binsmod.get_bins(binconfig, (percentiles) => get_numericMinMaxPct(ds, term, q.tvslst, percentiles))
	if( nb.unannotated ) {
    // in case of using this numeric term as term2 in crosstab, 
    // this object can also work as a bin, to be put into the bins array
    binconfig.unannotated = {
      _values: [nb.unannotated.value],
      _labels: {[nb.unannotated.value]: nb.unannotated.label},
      label: nb.unannotated.label,
      label_annotated: nb.unannotated.label_annotated
    }

    if (nb.unannotated.value_positive) {
      binconfig.unannotated.value_positive = 0
      binconfig.unannotated._values.push(nb.unannotated.value_positive)
      binconfig.unannotated._labels[nb.unannotated.value_positive] = nb.unannotated.label_positive
    }
    if (nb.unannotated.value_negative) {
      binconfig.unannotated.value_negative = 0
      binconfig.unannotated._values.push(nb.unannotated.value_negative)
      binconfig.unannotated._labels[nb.unannotated.value_negative] = nb.unannotated.label_negative
    }
  }
  return [bins, binconfig]
}



export function get_numericsummary (q, term, ds, _tvslst = [], withValues = false ) {
/*
to produce the summary table of mean, median, percentiles
at a numeric barchart
*/
	const tvslst = typeof _tvslst == 'string'
		? JSON.parse(decodeURIComponent(_tvslst))
		: _tvslst

	if ((term.isinteger || term.isfloat ) && !(tvslst.find(tv=>tv.term.id == term.id && 'ranges' in tv))) {
		const [bins, bin_size] = get_bins(q, term, ds)
		tvslst.push({term, ranges: bins})
	}
	const filter = makesql_by_tvsfilter( tvslst, ds )
	const values = []
	if(filter) {
		values.push(...filter.values)
	}
	let excludevalues
	if(term.graph && term.graph.barchart && term.graph.barchart.numeric_bin) {
		if (term.graph.barchart.numeric_bin.unannotated) {
			excludevalues = []
			const u = term.graph.barchart.numeric_bin.unannotated
			if(u.value!=undefined) excludevalues.push(u.value)
			if(u.value_positive!=undefined) excludevalues.push(u.value_positive)
			if(u.value_negative!=undefined) excludevalues.push(u.value_negative)
		}
	}
	const string =
		`${filter ? 'WITH '+filter.filters+' ' : ''}
		SELECT CAST(value AS ${term.isinteger ? 'INT' : 'REAL'}) AS value
		FROM annotations
		WHERE
		${filter ? 'sample IN '+filter.CTEname+' AND ' : ''}
		term_id=?
		${excludevalues ? 'AND value NOT IN ('+excludevalues.join(',')+')' : ''}`
	values.push( term.id )

	const s = ds.cohort.db.connection.prepare(string)
	const result = s.all( values )
	if (!result.length) return null
	result.sort((i,j)=> i.value - j.value )

	const stat = app.boxplot_getvalue( result )
	stat.mean = result.length ?
		result.reduce((s,i)=>s+i.value, 0) / result.length
		: 0

	let sd = 0
  for(const i of result) {
    sd += Math.pow( i.value - stat.mean, 2 )
  }
  stat.sd = Math.sqrt( sd / (result.length-1) )
  stat.min = result[0].value
  stat.max = result[result.length - 1].value
  if (withValues) stat.values = result.map(i => i.value)
	return stat
}


export function get_numericMinMaxPct (ds, term, tvslst = [], percentiles = []) {
/* 
	similar arguments to get_numericSummary()
	but min, max, percentile is calculated by sqlite db
	to lessen the burden on node server
*/
	const filter = makesql_by_tvsfilter( tvslst, ds )
	const values = []
	if(filter) {
		values.push(...filter.values)
	}
	let excludevalues
	if(term.graph && term.graph.barchart && term.graph.barchart.numeric_bin) {
		if (term.graph.barchart.numeric_bin.unannotated) {
			excludevalues = []
			const u = term.graph.barchart.numeric_bin.unannotated
			if(u.value!=undefined) excludevalues.push(u.value)
			if(u.value_positive!=undefined) excludevalues.push(u.value_positive)
			if(u.value_negative!=undefined) excludevalues.push(u.value_negative)
		}
	}

	const ctes = []
	const cols = []
	let tablename, i=0
	for(const n of percentiles) {
		tablename = 'pct_' + n
		ctes.push(`${tablename} AS (
			nth1 AS (
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
			) 
		)`)
		values.push(n)
		const pname = 'p' + i
		cols.push(`${tablename}.value AS ${pname}`)
	} 

	const string = `WITH
		${filter ? filter.filters+', ' : ''} 
		vals AS (
			SELECT CAST(value AS ${term.isinteger ? 'INT' : 'REAL'}) AS value
			FROM annotations
			WHERE
			${filter ? 'sample IN '+filter.CTEname+' AND ' : ''}
			term_id=?
			${excludevalues ? 'AND value NOT IN ('+excludevalues.join(',')+')' : ''}
			ORDER BY value ASC
		),
		p AS (
			SELECT count(value)/100 as pct
			FROM vals
		)
		${ ctes.length ? ',\n' + ctes.join(",") : '' }
		SELECT 
			min(value) as vmin,
			max(value) as vmax
			${ cols.length ? ',\n' + cols.join(",") : '' } 
		FROM vals`

	values.push( term.id )

	const s = ds.cohort.db.connection.prepare(string)
	const result = s.all( values );
	
	const summary = !result.length ? {} : result[0]
	summary.max = result[0].vmax
	summary.min = result[0].vmin
	return summary
}










export function server_init_db_queries ( ds ) {
/*
initiate db queries and produce function wrappers
run only once

as long as the termdb table and logic is universal
probably fine to hardcode such query strings here
and no need to define them in each dataset
thus less things to worry about...
*/
	if(!ds.cohort) throw 'ds.cohort missing'
	if(!ds.cohort.db) throw 'ds.cohort.db missing'
	if(!ds.cohort.db.connection) throw 'ds.cohort.db.connection missing'
	ds.cohort.termdb.q = {}
	const q = ds.cohort.termdb.q

	{
		const s = ds.cohort.db.connection.prepare('SELECT * FROM terms')
		q.getallterms = ()=>{
			return s.all()
		}
	}

	{
		const s = ds.cohort.db.connection.prepare('select jsondata from terms where id=?')
		q.termjsonByOneid = (id)=>{
			const t = s.get( id )
			if(t) {
				const j = JSON.parse(t.jsondata)
				j.id = id
				return j
			}
			return undefined
		}
	}

	{
		const s = ds.cohort.db.connection.prepare('select id from terms where parent_id=?')
		q.termIsLeaf = (id)=>{
			const t = s.get(id)
			if(t && t.id) return false
			return true
		}
	}

	{
		const s = ds.cohort.db.connection.prepare('SELECT id,jsondata FROM terms WHERE parent_id is null')
		q.getRootTerms = ()=>{
			return s.all().map(i=>{
				const t = JSON.parse(i.jsondata)
				t.id = i.id
				return t
			})
		}
	}
	{
		const s = ds.cohort.db.connection.prepare('SELECT parent_id FROM terms WHERE id=?')
		q.termHasParent = (id)=>{
			const t = s.get(id)
			if(t && t.parent_id) return true
			return false
		}
		q.getTermParentId = (id)=>{
			const t = s.get(id)
			if(t && t.parent_id) return t.parent_id
			return undefined
		}
		q.getTermParent = (id)=>{
			const c = q.getTermParentId(id)
			if(!c) return undefined
			return q.termjsonByOneid( c )
		}
	}
	{
		const s = ds.cohort.db.connection.prepare('SELECT id,jsondata FROM terms WHERE id IN (SELECT id FROM terms WHERE parent_id=?)')
		q.getTermChildren = (id)=>{
			const tmp = s.all(id)
			if(tmp) return tmp.map( i=> {
				const j = JSON.parse(i.jsondata)
				j.id = i.id
				return j
			})
			return undefined
		}
	}
	{
		const s = ds.cohort.db.connection.prepare('SELECT id,jsondata FROM terms WHERE name LIKE ?')
		q.findTermByName = (n, limit)=>{
			const tmp = s.all('%'+n+'%')
			if(tmp) {
				const lst = []
				for(const i of tmp) {
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					lst.push( j )
					if(lst.length==10) break
				}
				return lst
			}
			return undefined
		}
	}
	{
		const s1 = ds.cohort.db.connection.prepare('SELECT MAX(CAST(value AS INT))  AS v FROM annotations WHERE term_id=?')
		const s2 = ds.cohort.db.connection.prepare('SELECT MAX(CAST(value AS REAL)) AS v FROM annotations WHERE term_id=?')
		const cache = new Map()
		q.findTermMaxvalue = (id, isint) =>{
			if( cache.has(id) ) return cache.get(id)
			const tmp = (isint ? s1 : s2).get(id)
			if( tmp ) {
				cache.set( id, tmp.v )
				return tmp.v
			}
			return undefined
		}
	}
	{
		// select sample and category, only for categorical term
		// right now only for category-overlay on maf-cov plot
		const s = ds.cohort.db.connection.prepare('SELECT sample,value FROM annotations WHERE term_id=?')
		q.getSample2value = (id) => {
			return s.all(id)
		}
	}
}
