const app = require('../app')



/*

********************** EXPORTED
get_samples
get_summary
get_numericsummary
get_rows
server_init_db_queries
********************** INTERNAL
makesql_by_tvsfilter
	add_categorical
	add_numerical
	add_condition
makesql_overlay_oneterm
	makesql_overlay_oneterm_condition
makesql_numericBinCTE
uncomputablegrades_clause
grade_age_select_clause
get_label4key
*/






function makesql_by_tvsfilter ( tvslst, ds ) {
/*
.tvslst[{}]
	optional
	each element is a term-value setting object
	must have already been validated by src/mds.termdb.termvaluesetting.js/validate_termvaluesetting()
returns:
	.filters:
		one string of all filter statement intersects, with question marks
	.values[]:
		array of *bind parameters*
	.CTEname:
		the name of CTE, to be used in task-specific runner
*/
	if( !tvslst ) return null

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
		if( ds.cohort.termdb.q.termIsLeaf( tvs.term.id ) ) {
			// is leaf
			filters.push(
				`
				SELECT sample
				FROM (
					${grade_age_selection(tvs.term.id, values, tvs, ds)}
				) 
				WHERE grade IN (${tvs.values.map(i=>'?').join(', ')})`
			)
			values.push( ...tvs.values.map(i=>i.key) )
			return
		}

		const termtable = `(
			SELECT term_id
			FROM ancestry
			WHERE (ancestor_id=? OR term_id=?)
		)`

		// not leaf
		if( tvs.grade_and_child ) {
			filters.push(
				`SELECT sample
				FROM (
					${grade_age_selection(tvs.term.id, values, tvs, ds, null, termtable)}
				)
				WHERE grade = ?`
			)
			values.push(
				tvs.grade_and_child[0].child_id,
				tvs.grade_and_child[0].child_id,
				tvs.grade_and_child[0].grade
			)
			return
		}

		if( tvs.bar_by_grade ) {
			filters.push(
				`SELECT sample
				FROM (
					${grade_age_selection(tvs.term.id, values, tvs, ds, null, termtable)}
				)
				WHERE
				grade IN (${tvs.values.map(i=>'?').join(', ')})`
			)
			values.push(...tvs.values.map(i=>i.key))
			return
		}


		if( tvs.bar_by_children ) {
			filters.push(
				`SELECT distinct(sample)
				FROM chronicevents
				WHERE
					term_id IN (
						SELECT term_id
						FROM ancestry
						WHERE
						${tvs.values.map(i=>'ancestor_id=? OR term_id=?').join(' OR ')}
					)
					${uncomputablegrades_clause( ds )}`
			)
			for(const i of tvs.values) {
				values.push(i.key, i.key)
			}
			return
		}
		throw 'unknown mode for non-leaf condition term'
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
	console.log('SQL: ',string)
	console.log('PARAM: ',filter.values)

	// may cache statement
	const re = ds.cohort.db.connection.prepare( string )
		.all( filter.values )
	return re.map(i=>i.sample)
}



/* 
	 
*/
export function get_rows ( q ) {
/*
get data for barchart but not summarized by counts;
return all relevant rows of {sample, annotation key, value}

q{}
	.tvslst
	.ds
	.term1_id
	.term2_id
	.term1_q{}
	.term2_q{}
*/
	
	const filter = q.tvslst 
		? makesql_by_tvsfilter( q.tvslst, q.ds )
		: {
				filters: 'filtered AS (\nSELECT sample FROM annotations GROUP BY sample\n)', // faster than DISTINCT?
				values: [],
				CTEname: 'filtered'
			}

	const values = filter.values ? filter.values.slice() : []
	const CTE0 = get_term_cte(q, filter, values, 0)
	const CTE1 = get_term_cte(q, filter, values, 1)
	const CTE2 = get_term_cte(q, filter, values, 2)

	const statement =
		`WITH
		${filter.filters},
		${CTE0.sql},
		${CTE1.sql},
		${CTE2.sql}
		SELECT
			t0.sample as sample,
      t0.key AS key0,
      t0.value AS val0,
      t1.key AS key1,
      t1.value AS val1,
      t2.key AS key2,
      t2.value AS val2
		FROM ${CTE1.tablename} t1
		JOIN ${CTE0.tablename} t0 ${CTE0.join_on_clause}
		JOIN ${CTE2.tablename} t2 ${CTE2.join_on_clause}`
	//console.log(statement, values)
	const lst = q.ds.cohort.db.connection.prepare(statement)
		.all( filter ? filter.values.concat(values) : values )

	return lst
}

function get_term_cte(q, filter, values, index) {
/*
Generate a CTE by term

q{}
	.tvslst
	.ds
	.term1_id
	.term2_id
	.term1_q{}
	.term2_q{}

filter 
	.filters
	.values
	.CTEname

values 
  [] string/numeric to replace ? in CTEs

index
	term-index: 0 for term0, 1 for term1, 2 for term2
*/
	const termnum_id = 'term' + index + '_id'
	const termid = q[termnum_id]
	const term = termid ? q.ds.cohort.termdb.q.termjsonByOneid( termid ) : null; //console.log('term'+ index, term)
	if (termid && !term) throw `unknown term${index}: ${termid}`
	const termnum_q = 'term' + index + '_q'
	const termq = q[termnum_q]
	if(termq && typeof termq == 'string' ) q[termnum_q] = JSON.parse(decodeURIComponent(termq))	
	if (!termq) q[termnum_q] = {}
	if (index == 2) q[termnum_q].isterm2 = true

	const tablename = 'samplekey_' + index
	const CTE = term
		? makesql_overlay_oneterm( term, filter, q.ds, q.term0_q, values, "_" + index)
		: {
				sql: `${tablename} AS (\nSELECT null AS sample, '' as key, '' as value\n)`,
				tablename,
				join_on_clause: '' //`ON t${index}.sample IS NULL`
			}
	
	if (!('join_on_clause' in CTE)) {
		CTE.join_on_clause = `ON t${index}.sample = t1.sample`
	}
	
	return CTE
}


export function get_summary ( q ) {
/*
getting data for barchart and more

q{}
	.tvslst
	.ds
	.term1_id
	.term2_id
	.term1_q{}
	.term2_q{}
*/
	let filter
	if( q.tvslst ) {
		if( typeof q.tvslst == 'string' ) q.tvslst = JSON.parse(decodeURIComponent(q.tvslst))
		filter = makesql_by_tvsfilter( q.tvslst, q.ds )
	}
	if(!q.term1_id) throw '.term1_id is required but missing'
	const term1 = q.ds.cohort.termdb.q.termjsonByOneid( q.term1_id )
	if(!term1) throw 'unknown term1_id: '+q.term1_id
	if(!q.term1_q) q.term1_q = {} // settings of term1
	if( typeof q.term1_q == 'string' ) q.term1_q = JSON.parse(decodeURIComponent(q.term1_q))

	if( q.term2_id ) {
		///////////// has term2, do overlay
		const term2 = q.ds.cohort.termdb.q.termjsonByOneid( q.term2_id )
		if( !term2 ) throw 'unknown term2_id: '+q.term2_id
		if(!q.term2_q) q.term2_q = {} // settings of term2
		if( typeof q.term2_q == 'string' ) q.term2_q = JSON.parse(decodeURIComponent(q.term2_q))
		const values = []
		const CTE_term1 = makesql_overlay_oneterm( term1, filter, q.ds, q.term1_q, values, "_1")
		// in case of using auto binning of numeric term, tell is term2
		q.term2_q.isterm2 = true
		const CTE_term2 = makesql_overlay_oneterm( term2, filter, q.ds, q.term2_q, values, "_2")
		const string =
			`WITH
			${filter ? filter.filters+', ' : ''}
			${CTE_term1.sql},
			${CTE_term2.sql}
			SELECT a.key AS key1, b.key AS key2, COUNT(DISTINCT b.sample) AS samplecount
			FROM
				${CTE_term1.tablename} a,
				${CTE_term2.tablename} b
			WHERE a.sample=b.sample
			GROUP BY key1,key2`
		const lst = q.ds.cohort.db.connection.prepare(string)
			.all( filter ? filter.values.concat(values) : values )
		// add label or range if numeric
		for(const i of lst) {
			if( term1.isinteger || term1.isfloat ) {
				i.label1 = i.key1
				i.range1 = CTE_term1.name2bin.get( i.key1 )
			} else {
				i.label1 = get_label4key( i.key1, term1, q.term1_q, q.ds )
			}
			if( term2.isinteger || term2.isfloat ) {
				i.label2 = i.key2
				i.range2 = CTE_term2.name2bin.get( i.key2 )
			} else {
				i.label2 = get_label4key( i.key2, term2, q.term2_q, q.ds )
			}
		}
		return lst
	}

	///////////////// just term1

	if( term1.iscategorical ) {
		//////////// summary for categorical
		const string =
			`${filter ? 'WITH '+filter.filters+' ' : ''}
			SELECT value AS key,count(sample) AS samplecount
			FROM annotations
			WHERE
			${filter ? 'sample IN '+filter.CTEname+' AND ' : ''}
			term_id=?
			GROUP BY value`
		const lst = q.ds.cohort.db.connection.prepare( string )
			.all([ ...(filter?filter.values:[]), q.term1_id ])
		if(!lst) return undefined
		// add label
		for(const i of lst) {
			i.label = get_label4key( i.key, term1 )
			const label = term1.values ? term1.values[i.key] : i.key
			i.label = label || i.key
		}
		return lst
	}

	if( term1.isinteger || term1.isfloat ) {
		//////////// summary for bins
		const bins = makesql_numericBinCTE( term1, q.term1_q, filter, q.ds )
		const string =
			`WITH
			${filter ? filter.filters+', ' : ''}
			${bins.sql}
			SELECT bname AS key, COUNT(sample) AS samplecount
			FROM ${bins.tablename}
			GROUP BY bname
			ORDER BY binorder`
		const lst = q.ds.cohort.db.connection.prepare(string)
			.all([ ...(filter?filter.values:[]), term1.id ]);
		for(const i of lst) {
			i.label = i.key
			i.range = bins.name2bin.get( i.key )
		}
		return lst
	}

	if( term1.iscondition ) {
		let string
		const thisvalues = []
		let overlay = false
		if( term1.isleaf ) {
			///////////// summary, leaf
			string = 
				`WITH
				${filter ? filter.filters+', ' : ''}
				tmp_grade_table AS (
					${grade_age_selection(q.term1_id, thisvalues, q.term1_q, q.ds, filter )}
				)
				SELECT grade as key,count(sample) as samplecount
				FROM tmp_grade_table
				GROUP BY grade`
		} else if( q.term1_q.grade_child_overlay ) {
			/////////// summary, grade-child overlay, one term
			string =
				`WITH
				${filter ? filter.filters+', ' : ''}
				tmp_children_table AS (
					SELECT id AS child
					FROM terms
					WHERE parent_id=?
				),
				tmp_grandchildren_table AS (
					SELECT term_id, c.child AS child
					FROM ancestry a, tmp_children_table c
					WHERE c.child=a.ancestor_id OR c.child=a.term_id
					ORDER BY term_id ASC
				),
				tmp_events_table AS (
					SELECT sample, d.child as child,
						${q.term1_q.value_by_max_grade ? 'MAX(grade) AS grade' : 'grade, MAX(age_graded)'}
					FROM chronicevents a, tmp_grandchildren_table d
					WHERE
					${filter ? 'sample IN '+filter.CTEname+' AND ' : ''}
					d.term_id = a.term_id
					${uncomputablegrades_clause( q.ds )}
					GROUP BY d.child, sample
				)
				SELECT
					${q.term1_q.bar_by_grade ? 'grade AS key1,child AS key2,' : 'child AS key1,grade AS key2,'}
					count(sample) AS samplecount
				FROM tmp_events_table
				GROUP BY grade, child`

		} else if( q.term1_q.bar_by_grade ) {
			//////////// summary, bar by grade
			thisvalues.push(q.term1_id, q.term1_id)
			const termtable = 'tmp_term_table'
			string = // NOTE: `tmp_term_table is relied upon by grade_age_selection`
			`WITH
			${filter ? filter.filters+', ' : ''}
			${termtable} AS (
				SELECT term_id
				FROM ancestry
				WHERE ancestor_id=?
				OR term_id=?
			),
			tmp_grade_table AS (
				${grade_age_selection(q.term1_id, thisvalues, q.term1_q, q.ds, filter, termtable )}
			)
			SELECT grade AS key,count(distinct sample) as samplecount
			FROM tmp_grade_table
			GROUP BY key`
		} else if( q.term1_q.bar_by_children ) {
			/////////// summary, bar by children
			thisvalues.push(q.term1_id)
			string =
				`WITH
				${filter ? filter.filters+',' : ''}
				tmp_subcondition_table AS (
					SELECT id
					FROM terms
					WHERE parent_id=?
				),
				tmp_descendant_table AS (
					SELECT term_id, s.id AS subcondition
					FROM ancestry a, tmp_subcondition_table s
					WHERE s.id=a.ancestor_id OR s.id=a.term_id
					ORDER BY term_id ASC
				),
				tmp_events_table AS (
					SELECT
						sample, d.subcondition as key
					FROM chronicevents a, tmp_descendant_table d
					WHERE
					${filter ? 'sample IN '+filter.CTEname+' AND' : ''}
					d.term_id = a.term_id
					${uncomputablegrades_clause( q.ds )}
					GROUP BY key, sample
				)
				SELECT
					key,
					count(sample) AS samplecount
				FROM tmp_events_table
				GROUP BY key`
		} else {
			throw 'unknown setting for a non-leaf term'
		}
		const lst = q.ds.cohort.db.connection.prepare( string )
			.all([ ...(filter?filter.values:[]), ...thisvalues ])
		for(const i of lst) {
			if( q.term1_q.grade_child_overlay ) {
				if(q.term1_q.bar_by_grade) {
					i.label1 = get_label4key( i.key1, term1, q.term1_q, q.ds )
					i.label2 = i.key2
				} else {
					i.label1 = i.key1
					i.label2 = get_label4key( i.key2, term1, q.term1_q, q.ds )
				}
			} else {
				i.label = get_label4key( i.key, term1, q.term1_q, q.ds )
			}
		}
		return lst
	}
	throw 'unknown type of term1'
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



function uncomputablegrades_clause ( ds ) {
	const u = ds.cohort.termdb.patient_condition.uncomputable_grades
	if( u ) {
		const lst = []
		for(const k in u) lst.push(k)
		return ` AND grade NOT IN (${lst.join(',')}) `
	}
	return ''
}
function grade_age_selection (term_id, values, tvs, ds, filter, termtable=null ) {
	// work for grade as bars 
	if( tvs.value_by_max_grade ) {
		if (!termtable) values.push(term_id)
		else if (termtable.includes('?')) {
			values.push(term_id,term_id)
		}

		return `SELECT sample,MAX(grade) AS grade 
		FROM chronicevents
		WHERE
		${filter ? 'sample IN '+filter.CTEname+' AND ' : ''}
		term_id IN ${termtable ? termtable : '(?)'}
		${uncomputablegrades_clause( ds )}
		GROUP BY sample`
	}

	if( tvs.value_by_most_recent ) {
		if (termtable) {
			if (termtable.includes('?')) {
				values.push(term_id,term_id,term_id,term_id)
			}
			return `
			SELECT c.sample as sample, c.grade AS grade
			FROM (
				SELECT sample, MAX(age_graded) AS age_graded 
				FROM chronicevents
				WHERE
				${filter ? 'sample IN '+filter.CTEname+' AND ' : ''}
				term_id IN ${termtable}
				${uncomputablegrades_clause( ds )}
				GROUP BY sample
			) t
			JOIN chronicevents c ON 
			  c.term_id IN ${termtable}
			  AND c.sample = t.sample 
			  AND c.age_graded = t.age_graded
			  ${uncomputablegrades_clause( ds )}
			`
		} else {
			values.push(term_id, term_id)

			return `
			SELECT c.sample as sample, c.grade AS grade
			FROM (
				SELECT sample, MAX(age_graded) AS age_graded 
				FROM chronicevents
				WHERE
				${filter ? 'sample IN '+filter.CTEname+' AND ' : ''}
				term_id = ?
				${uncomputablegrades_clause( ds )}
				GROUP BY sample
			) t
			JOIN chronicevents c ON 
			  c.term_id = ? 
			  AND c.sample = t.sample 
			  AND c.age_graded = t.age_graded
			  ${uncomputablegrades_clause( ds )}
			`
		}
	}

	throw 'unknown value_by_? for condition term by grade'
}

function makesql_overlay_oneterm ( term, filter, ds, q, values, termindex ) {
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
			name2bin: bins.name2bin
		}
	}
	if( term.iscondition ) {
		return makesql_overlay_oneterm_condition( term, q, ds, filter, values, termindex )
	}
	throw 'unknown term type'
}


function makesql_overlay_oneterm_condition ( term, q, ds, filter, values, termindex='' ) {
/*
return {sql, tablename}
*/
	const grade_table = 'grade_table' + termindex
	const term_table = 'term_table' + termindex
	const out_table = 'out_table' + termindex

	let string
	if( term.isleaf ) {
		return {
			sql:
			`${grade_table} AS (
				${grade_age_selection(term.id, values, q, ds, filter)}
			),
			${out_table} AS (
				SELECT grade AS key, sample, grade as value
				FROM ${grade_table}
			)`,
			tablename: out_table
		}
	}
	if( q.bar_by_grade ) {
		values.push(term.id, term.id)
		return {
			sql:
			`${term_table} AS (
				SELECT term_id
				FROM ancestry
				WHERE ancestor_id=?
				OR term_id=?
			),
			${grade_table} AS (
				${grade_age_selection(term.id, values, q, ds, filter, term_table)}
			),
			${out_table} AS (
				SELECT grade AS key, sample
				FROM ${grade_table}
			)`,
			tablename: out_table
		}
	}
	if( q.bar_by_children ) {
		values.push( term.id )
		const subconditions = 'subconditions' + termindex
		const descendants = 'descendants' + termindex
		return {
			sql: `${subconditions} AS (
				SELECT id
				FROM terms
				WHERE parent_id=?
			),
			${descendants} AS (
				SELECT term_id, s.id AS subcondition
				FROM ancestry a, ${subconditions} s
				WHERE s.id=a.ancestor_id OR s.id=a.term_id
				ORDER BY term_id ASC
			),
			${grade_table} AS (
				SELECT
					sample, d.subcondition as key
				FROM
					chronicevents a,
					${descendants} d
				WHERE
				${filter ? 'sample IN '+filter.CTEname+' AND' : ''}
				a.term_id = d.term_id
				${uncomputablegrades_clause( ds )}
				GROUP BY key, sample
			)`,
			tablename: grade_table
		}
	}
	throw 'unknown bar_by_? for a non-leaf term'
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
	const [bins, bin_size] = get_bins(q, term, ds)
	const bin_def_lst = []
	const name2bin = new Map() // k: name str, v: bin{}
	let binid = 0
	for(const b of bins) {
		if (!b.name && b.label) b.name = b.label
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
		name2bin
	}
}

function get_bins(q, term, ds) {
	let bin_size
	let bins = []
	if( q.custom_bins ) {
		bins = q.custom_bins
	} else {
		// use automatic bins
		if(term.graph && term.graph.barchart && term.graph.barchart.numeric_bin) {
			if( q.isterm2 && term.graph.barchart.numeric_bin.crosstab_fixed_bins ) {
				bins = JSON.parse(JSON.stringify(term.graph.barchart.numeric_bin.crosstab_fixed_bins))
			} else if ( term.graph.barchart.numeric_bin.fixed_bins ) {
				bins = JSON.parse(JSON.stringify(term.graph.barchart.numeric_bin.fixed_bins))
			} else if( term.graph.barchart.numeric_bin.auto_bins ) {
				const max = ds.cohort.termdb.q.findTermMaxvalue(term.id, term.isinteger)
				let v = term.graph.barchart.numeric_bin.auto_bins.start_value
				bin_size = term.graph.barchart.numeric_bin.auto_bins.bin_size
				while( v < max ) {
					bins.push({
						start: v,
						stop: Math.min( v+bin_size, max ),
						startinclusive:true
					})
					v+=bin_size
				}
				bins[bins.length-1].stopinclusive = true
			} else {
				throw 'no predefined binning scheme'
			}
		}
	}
	return [bins, bin_size]
}


export function get_numericsummary (q, term, ds, _tvslst = [] ) {
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

	return stat
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
