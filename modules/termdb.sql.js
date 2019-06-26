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
		CTEcascade: CTEs.join(', '),
		values,
		lastCTEname: 'sampleset_'+sampleset_id
	}

	// helpers
	function add_categorical ( tvs, and_clause ) {
		const questionmarks = tvs.values.map(i=>'?').join(' ')
		CTEs.push(
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
		CTEs.push(
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
			CTEs.push(
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
			CTEs.push(
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
			CTEs.push(
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
				+' GROUP BY sample'
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
			CTEs.push(
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
				+'term_id IN sampleset_'+(sampleset_id-1)
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







export function get_samples ( tvslst, ds ) {
/*
must have tvslst[]
as the actual query is embedded in tvslst
return an array of sample names passing through the filter
*/
	const filter = makesql_by_tvsfilter( tvslst, ds )
	const string =
		'WITH '+filter.CTEcascade
		+' SELECT sample FROM '+filter.lastCTEname
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
*/
	const filter =  arg.tvslst ? makesql_by_tvsfilter( arg.tvslst, arg.ds ) : undefined
	if(!arg.term1_id) throw '.term1_id is required but missing'
	const term1 = arg.ds.cohort.termdb.q.termjsonByOneid( arg.term1_id )
	if(!term1) throw 'unknown term1_id: '+arg.term1_id

	if( term1.iscategorical ) {
		
		// if term2 is not provided..
		const string = (filter ? 'WITH '+filter.CTEcascade+' ' : '')
			+'SELECT value AS key,count(sample) AS samplecount '
			+'FROM annotations '
			+'WHERE '
			+(filter ? 'sample IN '+filter.lastCTEname+' AND ' : '')
			+'term_id=? '
			+'GROUP BY value'
		const re = arg.ds.cohort.db.connection.prepare( string )
			.all([ ...(filter?filter.values:[]), arg.term1_id ])
		return re
	}

	if( term1.isinteger || term1.isfloat ) {
		// todo
		return
	}
	if( term1.iscondition ) {
		return
	}
	throw 'unknown type of term1'
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
