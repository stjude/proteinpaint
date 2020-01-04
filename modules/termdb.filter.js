const termjson = require('../test/termdb/termjson').termjson

function getFilterCTEs(filter, ds, CTEname = 'f') {
	/*
	lst,
	{	
		type: 'tvslst',
		in: bool, // defaults to true
		join: "and" || "or",
		lst: [
			tvs0, // {type: 'tvs', tvs: {term, values, isnot}}
			tvs1, // {type: 'tvs', tvs: {term, ranges, isnot}}
			..., 
			lst0{}, // may contain arbitrary levels of nested lst{}
			lst1{},
			...
		]	
	}
*/
	if (!filter) return
	if (filter.type != 'tvslst') throw 'invalid filter argument' + JSON.stringify(filter)
	if (!Array.isArray(filter.lst)) throw `filter.lst must be an array`
	if (filter.lst.length > 1 && filter.join != 'or' && filter.join != 'and')
		throw 'filter.join must equal either "or" or "and"'
	if (!('in' in filter)) filter.in = true
	const filters = []
	const CTEs = []
	const values = []
	let i = 0
	for (const [i, item] of filter.lst.entries()) {
		const CTEname_i = CTEname + '_' + i
		let f
		if (item.type == 'tvslst') {
			f = getFilterCTEs(item, ds, CTEname_i)
		} else if (item.tvs.term.iscategorical) {
			f = get_categorical(item.tvs, CTEname_i)
		} else if (item.tvs.term.isinteger || item.tvs.term.isfloat) {
			f = get_numerical(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.iscondition) {
			f = get_condition(item.tvs, CTEname_i)
		} else {
			throw 'unknown term type'
		}
		if (!f) continue
		//console.log(42, f)
		filters.push(f)
		CTEs.push(...f.CTEs)
		values.push(...f.values)
	}

	/*if (filters.length == 1) {
		return {
			filters: CTEs[0],
			CTEs,
			values,
			CTEname
		}
	} else {*/
	const JOINOPER = filter.join == 'and' ? 'INTERSECT' : 'UNION'
	const superCTE = filters.map(f => 'SELECT * FROM ' + f.CTEname).join('\n' + JOINOPER + '\n')
	if (filter.in) {
		CTEs.push(`
				${CTEname} AS (
					${superCTE}
				)
			`)
	} else {
		CTEs.push(`
				${CTEname} AS (
					SELECT sample
					FROM annotations
					WHERE sample NOT IN (
						${superCTE}
					)
				)
			`)
	}
	//console.log(72, CTEs)
	return {
		filters: CTEs.join(',\n'),
		CTEs,
		values,
		CTEname
	}
	//}
}

exports.getFilterCTEs = getFilterCTEs

// makesql_by_tvsfilter helpers
// put here instead of inside makesql_by_tvsfilter
// to parse function once at server start instead of
// multiple times per server request
function get_categorical(tvs, CTEname) {
	return {
		CTEs: [
			`
		  ${CTEname} AS (
				SELECT sample
				FROM annotations
				WHERE term_id = ?
				AND value ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})
			)`
		],
		values: [tvs.term.id, ...tvs.values.map(i => i.key)],
		CTEname
	}
}

function get_numerical(tvs, CTEname, ds) {
	if (!tvs.ranges) throw '.ranges{} missing'
	const values = [tvs.term.id]
	// get term object, in case isinteger flag is missing from tvs.term
	const term = ds.cohort.termdb.q.termjsonByOneid(tvs.term.id)
	const cast = 'CAST(value AS ' + (term.isinteger ? 'INT' : 'REAL') + ')'

	const rangeclauses = []
	let hasactualrange = false // if true, will exclude special categories

	for (const range of tvs.ranges) {
		if (range.value != undefined) {
			// special category
			rangeclauses.push(cast + '=?')
			values.push(range.value)
		} else {
			// actual range
			hasactualrange = true
			const lst = []
			if (!range.startunbounded) {
				if (range.startinclusive) {
					lst.push(cast + ' >= ?')
				} else {
					lst.push(cast + ' > ? ')
				}
				values.push(range.start)
			}
			if (!range.stopunbounded) {
				if (range.stopinclusive) {
					lst.push(cast + ' <= ?')
				} else {
					lst.push(cast + ' < ? ')
				}
				values.push(range.stop)
			}
			rangeclauses.push('(' + lst.join(' AND ') + ')')
		}
	}

	let excludevalues
	if (hasactualrange && term.values) {
		excludevalues = Object.keys(term.values)
			.filter(key => term.values[key].uncomputable)
			.map(Number)
			.filter(key => tvs.isnot || !tvs.ranges.find(range => 'value' in range && range.value === key))
		if (excludevalues.length) values.push(...excludevalues)
	}

	return {
		CTEs: [
			`
		    ${CTEname} AS (
				SELECT sample
				FROM annotations
				WHERE term_id = ?
				AND ( ${rangeclauses.join(' OR ')} )
				${excludevalues && excludevalues.length ? `AND ${cast} NOT IN (${excludevalues.map(d => '?').join(',')})` : ''}
			)`
		],
		values,
		CTEname
	}
}

function get_condition(tvs, CTEname) {
	let value_for
	if (tvs.bar_by_children) value_for = 'child'
	else if (tvs.bar_by_grade) value_for = 'grade'
	else throw 'must set the bar_by_grade or bar_by_children query parameter'

	let restriction
	if (tvs.value_by_max_grade) restriction = 'max_grade'
	else if (tvs.value_by_most_recent) restriction = 'most_recent'
	else if (tvs.value_by_computable_grade) restriction = 'computable_grade'
	else throw 'unknown setting of value_by_?'

	const CTEs = []
	const values = []
	if (tvs.values) {
		values.push(tvs.term.id, value_for, ...tvs.values.map(i => '' + i.key))
		CTEs.push(`
			${CTEname} AS (
				SELECT sample
				FROM precomputed
				WHERE term_id = ? 
				AND value_for = ? 
				AND ${restriction} = 1
				AND value IN (${tvs.values.map(i => '?').join(', ')})
			)`)
	} else if (tvs.grade_and_child) {
		throw `-- Todo: tvs.grade_and_child`
		//grade_and_child: [{grade, child_id}]
		for (const gc of tvs.grade_and_child) {
			values.push(tvs.term.id, '' + gc.grade)
			CTEs.push(`
				SELECT sample
				FROM precomputed
				WHERE term_id = ? 
				AND value_for = 'grade'
				AND ${restriction} = 1
				AND value IN (?)`)

			values.push(tvs.term.id, gc.child_id)
			CTEs.push(`
				SELECT sample
				FROM precomputed
				WHERE term_id = ? 
				AND value_for = 'child'
				AND ${restriction} = 1
				AND value IN (?)`)
		}
	} else {
		throw 'unknown condition term filter type: expecting term-value "values" or "grade_and_child" key'
	}
	return {
		CTEs,
		values,
		CTEname
	}
}
