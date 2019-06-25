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
*/
	if( !tvslst ) return null

	let sampleset_id = 0 // increment this id before creating a CTE
	const statements = []
	const values = []

	for(const tvs of tvslst) {

		let and_clause = sampleset_id > 0 ? 'sample IN sampleset_'+sampleset_id+' AND ' : ''

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
		statement: statements.join(', '),
		values,
		sampleset_id
	}

	// helpers
	function add_categorical ( tvs, and_clause ) {
		const questionmarks = tvs.values.map(i=>'?').join(' ')
		statements.push(
			'sampleset_'+(++sampleset_id)+' AS ('
			+'SELECT sample '
			+'FROM annotations '
			+'WHERE '
			+and_clause
			+'term_id = ? '
			+'AND value IN ('+ tvs.values.map(i=>'?').join(', ')+')'
			+')'
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
		statements.push(
			'sampleset_'+(++sampleset_id)+' AS ('
			+'SELECT sample '
			+'FROM annotations '
			+'WHERE '
			+and_clause
			+'term_id = ? '
			+'AND '+clauses.join(' AND ')
			+')'
		)
	}
	
	function add_condition ( tvs, and_clause ) {
		if( ds.cohort.termdb.q.termIsLeaf( tvs.term.id ) ) {
			// is leaf
			statements.push(
				'sampleset_'+(++sampleset_id)+' AS ('
				+grade_age_select_clause(tvs)
				+'FROM chronicevents '
				+'WHERE '
				+and_clause
				+'grade IN '+computablegrades2str( ds )
				+' AND term_id = ? '
				+'GROUP BY sample'
				+'),'
				+'sampleset_'+(++sampleset_id)+' AS ('
				+'SELECT sample '
				+'FROM sampleset_'+(sampleset_id-1)+' '
				+'WHERE grade IN ('+tvs.values.map(i=>'?').join(', ')+')'
				+')'
			)
			values.push( tvs.term.id, ...tvs.values.map(i=>i.key) )
			return
		}


		// not leaf
		if( tvs.grade_and_child ) {
			statements.push(
				'sampleset_'+(++sampleset_id)+' AS ('
				+'SELECT term_id '
				+'FROM ancestry '
				+'WHERE ancestor_id=? OR term_id=?' // hardcoded to process just grade_and_child[0]
				+'),'
				+'sampleset_'+(++sampleset_id)+' AS ('
				+grade_age_select_clause(tvs)
				+'FROM chronicevents '
				+'WHERE '
				+and_clause
				+'term_id IN sampleset_'+(sampleset_id-1)
				+' AND grade IN '+computablegrades2str(ds)
				+' GROUP BY sample'
				+'),'
				+'sampleset_'+(++sampleset_id)+' AS ('
				+'SELECT sample '
				+'FROM sampleset_'+(sampleset_id-1)+' '
				+'WHERE grade = ?'
				+')'
			)
			values.push(
				tvs.grade_and_child[0].child_id,
				tvs.grade_and_child[0].child_id,
				tvs.grade_and_child[0].grade
			)
			return
		}



		if( tvs.bar_by_grade ) {
			statements.push(
				'sampleset_'+(++sampleset_id)+' AS ('
				+'SELECT term_id '
				+'FROM ancestry '
				+'WHERE ancestor_id=? OR term_id=?'
				+'),'
				+'sampleset_'+(++sampleset_id)+' AS ('
				+grade_age_select_clause(tvs)
				+'FROM chronicevents '
				+'WHERE '
				+and_clause
				+'term_id IN sampleset_'+(sampleset_id-1)
				+' AND grade IN '+computablegrades2str( ds )
				+'GROUP BY sample'
				+'),'
				+'sampleset_'+(++sampleset_id)+' AS ('
				+'SELECT sample '
				+'FROM sampleset_'+(sampleset_id-1)+' '
				+'WHERE grade IN ('+tvs.values.map(i=>'?').join(', ')+')'
				+')'
			)
			values.push(
				tvs.term.id,
				tvs.term.id,
				...tvs.values.map(i=>i.key)
			)
			return
		}


		if( tvs.bar_by_children ) {
			statements.push(
				'sampleset_'+(++sampleset_id)+' AS ('
				+'SELECT term_id '
				+'FROM ancestry '
				+'WHERE '
				+tvs.values.map(i=>'ancestor_id=? OR term_id=?').join(' OR ')
				+'),'
				+'sampleset_'+(++sampleset_id)+' AS ('
				+'SELECT distinct(sample) '
				+'FROM chronicevents '
				+'WHERE '
				+and_clause
				+' term_id IN sampleset_'+(sampleset_id-1)
				+' AND grade IN '+computablegrades2str( ds )
				+')'
			)
			for(const i of tvs.values) {
				values.push(i.key, i.key)
			}
			return
		}

		throw 'unknown mode for non-leaf condition term'
	}
}







export function get_samples( filter, connection ) {
/*
requires the filter{}, as returned by makesql_by_tvsfilter()
return an array of sample names passing through the filter
*/
	const string = 'WITH '
		+filter.statement
		+' SELECT sample FROM sampleset_'
		+filter.sampleset_id
	console.log('SQL: ',string)
	console.log('PARAM: ',filter.values)
	// may cache the prepared query using string as key
	const re = connection.prepare( string )
		.all( filter.values )
	return re.map(i=>i.sample)
}



function computablegrades2str ( ds ) {
	return '('+ds.cohort.termdb.patient_condition.grade_labels.map(i=>i.grade).join(',')+')'
}
function grade_age_select_clause ( tvs ) {
// work for grade as bars
	if( tvs.value_by_max_grade ) return 'SELECT sample,MAX(grade) as grade '
	if( tvs.value_by_most_recent ) return 'SELECT sample,MAX(age_graded),grade '
	throw 'unknown value_by_? for condition term by grade'
}
