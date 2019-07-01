/*

********************** EXPORTED
get_samples
get_samplesummary_by_term
********************** INTERNAL
makesql_by_tvsfilter
makesql_overlay_oneterm
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
	.CTEcascade:
		one string of all CTEs, with question marks
	.values[]:
		array of *bind parameters*
	.lastCTEname:
		the name of last CTE, to be used in task-specific runner
*/
	if( !tvslst ) return null

	let sampleset_id = 0 // increment this id before creating a CTE
	const CTEs = []
	const values = []

	for(const tvs of tvslst) {

		let and_clause = sampleset_id > 0 ? `sample IN sampleset_${sampleset_id} AND ` : ''

		if(tvs.term.iscategorical) {
			add_categorical( tvs, and_clause )
		} else if(tvs.term.isinteger || tvs.term.isfloat) {
			add_numerical( tvs, and_clause )
		} else if(tvs.term.iscondition) {
			add_condition( tvs, and_clause )
		} else {
			throw 'unknown term type'
		}
	}

	return {
		CTEcascade: CTEs.join(', '),
		values,
		lastCTEname: 'sampleset_'+sampleset_id
	}

	// helpers
	function add_categorical ( tvs, and_clause ) {
		const questionmarks = tvs.values.map(i=>'?').join(' ')
		CTEs.push(
			`sampleset_${++sampleset_id} AS (
				SELECT sample
				FROM annotations
				WHERE
				${and_clause}
				term_id = ?
				AND value IN (${tvs.values.map(i=>'?').join(', ')})
			)`
		)
		values.push( tvs.term.id, ...tvs.values.map(i=>i.key) )
	}

	function add_numerical ( tvs, and_clause ) {
		values.push( tvs.term.id )
		const clauses = []
		if( !tvs.range.startunbounded ) {
			if( tvs.range.startinclusive ) {
				clauses.push('value >= ?')
			} else {
				clauses.push('value > ? ')
			}
			values.push( tvs.range.start )
		}
		if( !tvs.range.stopunbounded ) {
			if( tvs.range.stopinclusive ) {
				clauses.push('value <= ?')
			} else {
				clauses.push('value < ? ')
			}
			values.push( tvs.range.stop )
		}
		CTEs.push(
			`sampleset_${++sampleset_id} AS (
				SELECT sample
				FROM annotations
				WHERE
				${and_clause}
				term_id = ?
				AND ${clauses.join(' AND ')}
			)`
		)
	}

	function add_condition ( tvs, and_clause ) {
		if( ds.cohort.termdb.q.termIsLeaf( tvs.term.id ) ) {
			// is leaf
			CTEs.push(
				`sampleset_${++sampleset_id} AS (
					${grade_age_select_clause(tvs)}
					FROM chronicevents
					WHERE
					${and_clause}
					term_id = ?
					${uncomputablegrades_clause( ds )}
					GROUP BY sample
				),
				sampleset_${++sampleset_id} AS (
					SELECT sample
					FROM sampleset_${sampleset_id-1}
					WHERE
					grade IN ${tvs.values.map(i=>'?').join(', ')}
				)`
			)
			values.push( tvs.term.id, ...tvs.values.map(i=>i.key) )
			return
		}


		// not leaf
		if( tvs.grade_and_child ) {
			CTEs.push(
				`sampleset_${++sampleset_id} AS (
					SELECT term_id
					FROM ancestry
					WHERE
					ancestor_id=? OR term_id=?
				),
				sampleset_${++sampleset_id} AS (
					${grade_age_select_clause(tvs)}
					FROM chronicevents
					WHERE
					${and_clause}
					term_id IN sampleset_${sampleset_id-1}
					${uncomputablegrades_clause( ds )}
					GROUP BY sample
				),
				sampleset_${++sampleset_id} AS (
					SELECT sample
					FROM sampleset_${sampleset_id-1}
					WHERE grade = ?
				)`
			)
			values.push(
				tvs.grade_and_child[0].child_id,
				tvs.grade_and_child[0].child_id,
				tvs.grade_and_child[0].grade
			)
			return
		}



		if( tvs.bar_by_grade ) {
			CTEs.push(
				`sampleset_${++sampleset_id} AS (
					SELECT term_id
					FROM ancestry
					WHERE
					ancestor_id=? OR term_id=?
				),
				sampleset_${++sampleset_id} AS (
					${grade_age_select_clause(tvs)}
					FROM chronicevents
					WHERE
					${and_clause}
					term_id IN sampleset_${sampleset_id-1}
					${uncomputablegrades_clause( ds )}
					GROUP BY sample
				),
				sampleset_${++sampleset_id} AS (
					SELECT sample
					FROM sampleset_${sampleset_id-1}
					WHERE
					grade IN (${tvs.values.map(i=>'?').join(', ')})
				)`
			)
			values.push(
				tvs.term.id,
				tvs.term.id,
				...tvs.values.map(i=>i.key)
			)
			return
		}


		if( tvs.bar_by_children ) {
			CTEs.push(
				`sampleset_${++sampleset_id} AS (
					SELECT term_id
					FROM ancestry
					WHERE
					${tvs.values.map(i=>'ancestor_id=? OR term_id=?').join(' OR ')}
				),
				sampleset_${++sampleset_id} AS (
					SELECT distinct(sample)
					FROM chronicevents
					WHERE
					${and_clause}
					term_id IN sampleset_${sampleset_id-1}
					${uncomputablegrades_clause( ds )}
				)`
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
		`WITH ${filter.CTEcascade}
		SELECT sample FROM ${filter.lastCTEname}`
	console.log('SQL: ',string)
	console.log('PARAM: ',filter.values)

	// may cache statement
	const re = ds.cohort.db.connection.prepare( string )
		.all( filter.values )
	return re.map(i=>i.sample)
}










export function get_samplesummary_by_term ( q ) {
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
	const filter =  q.tvslst ? makesql_by_tvsfilter( q.tvslst, q.ds ) : undefined
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
		const CTE_term1 = makesql_overlay_oneterm( term1, filter, q.ds, q.term1_q, values )
		const CTE_term2 = makesql_overlay_oneterm( term2, filter, q.ds, q.term2_q, values )
		const string =
			`WITH
			${filter ? filter.CTEcascade+', ' : ''}
			${CTE_term1.sql},
			${CTE_term2.sql}
			SELECT a.key AS key1, b.key AS key2, COUNT(DISTINCT b.sample) AS samplecount
			FROM
				${CTE_term1.tablename} a,
				${CTE_term2.tablename} b
			WHERE a.sample=b.sample
			GROUP BY key1,key2`
		console.log(string)
		const lst = q.ds.cohort.db.connection.prepare(string)
			.all( values )
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
		const string =
			`${filter ? 'WITH '+filter.CTEcascade+' ' : ''}
			SELECT value AS key,count(sample) AS samplecount
			FROM annotations
			WHERE
			${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
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
		const bins = makesql_numericBinCTE( term1, q.term1_bins, filter, q.ds )
		const string =
			`WITH
			${filter ? filter.CTEcascade+', ' : ''}
			${bins.sql}
			SELECT bname AS key, COUNT(sample) AS samplecount
			FROM ${bins.tablename}
			GROUP BY bname
			ORDER BY binorder`
			console.log(string)
		const lst = q.ds.cohort.db.connection.prepare(string)
			.all( term1.id )
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
			string = 
				`WITH
				${filter ? filter.CTEcascade+', ' : ''}
				tmp_grade_table AS (
					${grade_age_select_clause( q.term1_q )}
					FROM chronicevents
					WHERE
					${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
					term_id = ?
					${uncomputablegrades_clause( q.ds )}
					GROUP BY sample
				)
				SELECT grade as key,count(sample) as samplecount
				FROM tmp_grade_table
				GROUP BY grade`
			thisvalues.push( q.term1_id )
		} else {
			// non-leaf

			if( q.term1_q.grade_child_overlay ) {
				string =
					`WITH
					${filter ? filter.CTEcascade+', ' : ''}
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
						${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
						d.term_id = a.term_id
						${uncomputablegrades_clause( q.ds )}
						GROUP BY d.child, sample
					)
					SELECT
						${q.term1_q.bar_by_grade ? 'grade AS key1,child AS key2,' : 'child AS key1,grade AS key2,'}
						count(sample) AS samplecount
					FROM tmp_events_table
					GROUP BY grade, child`
				thisvalues.push( q.term1_id )

			} else if( q.term1_q.bar_by_grade ) {
				string = 
					`WITH
					${filter ? filter.CTEcascade+', ' : ''}
					tmp_term_table AS (
						SELECT term_id
						FROM ancestry
						WHERE ancestor_id=?
						OR term_id=?
					),
					tmp_grade_table AS (
						${grade_age_select_clause( q.term1_q )}
						FROM chronicevents
						WHERE
						${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
						term_id IN tmp_term_table
						${uncomputablegrades_clause( q.ds )}
						GROUP BY sample
					)
					SELECT grade AS key,count(sample) as samplecount
					FROM tmp_grade_table
					GROUP BY key`
				thisvalues.push( q.term1_id, q.term1_id )
			} else if( q.term1_q.bar_by_children ) {
				string =
					`WITH
					${filter ? filter.CTEcascade+', ' : ''}
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
						SELECT sample, d.child as child
						FROM chronicevents a, tmp_grandchildren_table d
						WHERE
						${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
						d.term_id = a.term_id
						${uncomputablegrades_clause( q.ds )}
						GROUP BY d.child, sample
					)
					SELECT
						child AS key,
						count(sample) AS samplecount
					FROM tmp_events_table
					GROUP BY child`
				thisvalues.push( q.term1_id )
			} else {
				throw 'unknown bar_by_? for a non-leaf term'
			}
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
function grade_age_select_clause ( tvs ) {
// work for grade as bars
	if( tvs.value_by_max_grade ) return 'SELECT sample,MAX(grade) AS grade '
	if( tvs.value_by_most_recent ) return 'SELECT sample,MAX(age_graded),grade '
	throw 'unknown value_by_? for condition term by grade'
}




function makesql_overlay_oneterm ( term, filter, ds, q, values ) {
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
	const tablename = 'CTEtemp'+term.id
	if( term.iscategorical ) {
		values.push( term.id )
		return {
			sql: `${tablename} AS (
				SELECT sample,value as key
				FROM annotations
				WHERE term_id=?
			)`,
			tablename
		}
	}
	if( term.isfloat || term.isinteger ) {
		values.push( term.id )
		const bins = makesql_numericBinCTE( term, q.custom_bins, filter, ds )
		return {
			sql: `${bins.sql},
			${tablename} AS (
				SELECT bname as key, sample
				FROM ${bins.tablename}
				)`,
			tablename,
			name2bin: bins.name2bin
		}
	}
	if( term.iscondition ) {
		const tmp = makesql_overlay_oneterm_condition( term, q, ds, filter, values )
		return {
			sql: `${tmp.sql},
			${tablename} AS (
				SELECT grade as key, sample
				FROM ${tmp.tablename}
			)`,
			tablename
		}
	}
	throw 'unknown term type'
}





function makesql_overlay_oneterm_condition ( term, q, ds, filter, values ) {
/*
return {sql, tablename}
*/
	const tmp_grade_table = 'tmpgradetable_'+term.id
	const tmp_term_table = 'tmptermtable_'+term.id
	console.log(q)

	let string
	if( term.isleaf ) {
		values.push(term.id)
		return {
			sql: `${tmp_grade_table} AS (
				${grade_age_select_clause(q)}
				FROM chronicevents
				WHERE
				${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
				term_id = ?
				${uncomputablegrades_clause( ds )}
				GROUP BY sample
			)`,
			tablename: tmp_grade_table
		}
	}
	if( q.bar_by_grade ) {
		values.push(term.id, term.id)
		return {
			sql: `${tmp_term_table} AS (
				SELECT term_id
				FROM ancestry
				WHERE ancestor_id=?
				OR term_id=?
			),
			${tmp_grade_table} AS (
				${grade_age_select_clause(q)}
				FROM chronicevents
				WHERE
				${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
				term_id IN ${tmp_term_table}
				${uncomputablegrades_clause( ds )}
				GROUP BY sample
			)`,
			tablename: tmp_grade_table
		}
	}
	if( q.bar_by_children ) {
		values.push( term.id )
		const tmp_children_table = 'tmpchildtable_'+term.id
		const tmp_grandchildren_table = 'tmpgrandchildrentable_'+term.id
		return {
			sql: `${tmp_children_table} AS (
				SELECT id AS child
				FROM terms
				WHERE parent_id=?
			),
			${tmp_grandchildren_table} AS (
				SELECT term_id, c.child AS child
				FROM ancestry a, ${tmp_children_table} c
				WHERE c.child=a.ancestor_id OR c.child=a.term_id
				ORDER BY term_id ASC
			),
			${tmp_grade_table} AS (
				SELECT sample, d.child as key
				FROM chronicevents a, ${tmp_grandchildren_table} d
				WHERE
				${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
				d.term_id = a.term_id
				${uncomputablegrades_clause( ds )}
				GROUP BY key, sample
			)`,
			tablename: tmp_grade_table
		}
	}
	throw 'unknown bar_by_? for a non-leaf term'
}





function makesql_numericBinCTE ( term, bins, filter, ds ) {
/*
bins: list of custom bins, or undefined
filter as is returned by makesql_by_tvsfilter
returns { sql, tablename, name2bin }
*/
	if(!bins) {
		if(term.graph && term.graph.barchart && term.graph.barchart.numeric_bin && term.graph.barchart.numeric_bin.auto_bins) {
			const max = ds.cohort.termdb.q.findTermMaxvalue(term.id, term.isinteger)
			let v = term.graph.barchart.numeric_bin.auto_bins.start_value
			const bin_size = term.graph.barchart.numeric_bin.auto_bins.bin_size
			bins = []
			while( v < max ) {
				bins.push({
					start: v,
					stop: Math.min( v+bin_size, max ),
					startinclusive:true
				})
				v+=bin_size
			}
		}
	}
	if(!bins) throw 'no bins to work on'
	const name2bin = new Map()
	// k: name str, v: bin{}
	const binstr = bins.map( (b,i)=>{
		if(!b.name) {
			if( b.startunbounded ) {
				b.name = (b.stopinclusive ? '<=' : '<')+' '+b.stop
			} else if( b.stopunbounded ) {
				b.name = (b.startinclusive ? '>=' : '>')+' '+b.start
			} else {
				b.name = `${b.start} <${b.startinclusive?'=':''} x <${b.stopinclusive?'=':''} ${b.stop}`
			}
		}
		name2bin.set( b.name, b )
		return `SELECT '${b.name}' AS name,
		${b.start==undefined?0:b.start} AS start,
		${b.stop==undefined?0:b.stop} AS stop,
		${b.startunbounded?1:0} AS startunbounded,
		${b.stopunbounded?1:0} AS stopunbounded,
		${b.startinclusive?1:0} AS startinclusive,
		${b.stopinclusive?1:0} AS stopinclusive,
		${i} AS binorder`
	}).join(' UNION ALL ')

	const bin_def_table = 'tmpbindef_'+term.id
	const bin_sample_table = 'tmpbinsample_'+term.id
	const sql = 
		`${bin_def_table} AS (
			${binstr}
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
				(b.startunbounded=1 OR
					(v>b.start OR
						(b.startinclusive=1 AND v=b.start)))
				AND
				(b.stopunbounded OR
					(v<b.stop OR
						(b.stopinclusive=1 AND v=b.stop)))
			WHERE
			${filter ? 'sample IN '+filter.lastCTEname+' AND ':''}
			term_id=?
		)`
	return {
		sql,
		tablename: bin_sample_table,
		name2bin
	}
}
