/*
the termdb query synthesizer

parameter {}

.ds{}
	the ds object
	.cohort.db{}
		.k{}



additional attributes defining the query


*/






export function makesql_by_tvsfilter ( tvslst, ds ) {
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










export function get_samplesummary_by_term ( arg ) {
/*
getting data for barchart and more

arg{}
	.tvslst
	.ds
	.term1_id
	.term2_id
	.value_by_?
	.bar_by_?
*/
	const filter =  arg.tvslst ? makesql_by_tvsfilter( arg.tvslst, arg.ds ) : undefined
	if(!arg.term1_id) throw '.term1_id is required but missing'
	const term1 = arg.ds.cohort.termdb.q.termjsonByOneid( arg.term1_id )
	if(!term1) throw 'unknown term1_id: '+arg.term1_id
	let term2
	if( arg.term2_id ) {
		term2 = arg.ds.cohort.termdb.q.termjsonByOneid( arg.term2_id )
		if( !term2 ) throw 'unknown term2_id: '+arg.term2_id
	}

	if( term1.iscategorical ) {
		
		if( !term2 ) {
			const string =
				`${filter ? 'WITH '+filter.CTEcascade+' ' : ''}
				SELECT value AS key,count(sample) AS samplecount
				FROM annotations
				WHERE
				${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
				term_id=?
				GROUP BY value`
			const lst = arg.ds.cohort.db.connection.prepare( string )
				.all([ ...(filter?filter.values:[]), arg.term1_id ])
			if(!lst) return undefined
			// add label
			for(const i of lst) {
				const label = term1.values ? term1.values[i.key] : i.key
				i.label = label || i.key
			}
			return lst
		}
		// overlay
	}

	if( term1.isinteger || term1.isfloat ) {
		// todo
		return
	}
	if( term1.iscondition ) {
		if(!term2) {
			let string
			let keyisgrade=false // for applying label after 
			const thisvalues = []
			if( term1.isleaf ) {
				string = 
					`WITH
					${filter ? filter.CTEcascade+', ' : ''}
					tmp_grade_table AS (
						${grade_age_select_clause(arg)}
						FROM chronicevents
						WHERE
						${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
						term_id = ?
						${uncomputablegrades_clause( arg.ds )}
						GROUP BY sample
					)
					SELECT grade,count(sample) as samplecount
					FROM tmp_grade_table
					GROUP BY grade`
				thisvalues.push( arg.term1_id )
				keyisgrade = true
			} else {
				if( arg.bar_by_grade ) {
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
							${grade_age_select_clause(arg)}
							FROM chronicevents
							WHERE
							${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
							term_id IN tmp_term_table
							${uncomputablegrades_clause( arg.ds )}
							GROUP BY sample
						)
						SELECT grade,count(sample) as samplecount
						FROM tmp_grade_table
						GROUP BY grade`
					thisvalues.push( arg.term1_id, arg.term1_id )
					keyisgrade = true
				} else if( arg.bar_by_children ) {
					string =
						`WITH
						tmp_children_table AS (
							SELECT id AS child,
							FROM terms
							WHERE parent_id=?
						),
						tmp_grandchildren_table AS (
							SELECT term_id, c.child AS child
							FROM ancestry a, tmp_children_table c
							WHERE c.child=a.ancestor_id OR c.child=a.term_id
							ORDER BY term_id ACC
						),
						tmp_events_table AS (
							SELECT sample, d.child as child
							FROM chronicevents a, tmp_grandchildren_table d
							WHERE
							${filter ? 'sample IN '+filter.lastCTEname+' AND ' : ''}
							d.term_id = a.term_id
							${uncomputablegrades_clause( arg.ds )}
							GROUP BY d.child, sample
						)
						SELECT
							child AS key,
							count(sample) AS samplecount
						FROM tmp_events_table
						GROUP BY child`
					thisvalues.push( arg.term1_id )
				} else {
					throw 'unknown bar_by_? for a non-leaf term'
				}
			}
			const re = arg.ds.cohort.db.connection.prepare( string )
				.all([ ...(filter?filter.values:[]), ...thisvalues ])
			return re
		}
		// overlay
		return
	}
	throw 'unknown type of term1'
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
	if( tvs.value_by_max_grade ) return 'SELECT sample,MAX(grade) as grade '
	if( tvs.value_by_most_recent ) return 'SELECT sample,MAX(age_graded),grade '
	throw 'unknown value_by_? for condition term by grade'
}
