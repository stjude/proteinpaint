import { getUncomputableClause } from './termdb.sql'

function validateQ(q) {
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
	return [value_for, restriction]
}

export const values = {
	getCTE(tablename, term, ds, q, values, index) {
		const [value_for, restriction] = validateQ(q)
		values.push(term.id, value_for)
		const uncomputable = getUncomputableClause(term, q)
		values.push(...uncomputable.values)
		return {
			sql: `${tablename} AS (
				SELECT
					sample,
					${value_for == 'grade' ? `CAST(value AS integer) as key` : 'value as key'},
					${value_for == 'grade' ? `CAST(value AS integer) as value` : 'value'}
				FROM
					precomputed
				WHERE
					term_id = ?
					AND value_for = ?
					AND ${restriction} = 1
					${uncomputable.clause}
			)`,
			tablename
		}
	}
}

// used to assign a unique CTE name to extra filters (xf) for groupsets
let xfIndex = 0

export const groupset = {
	/*
		Arguments
		- tablename: string name for this CTE
		- term{}
		- groupset: the active groupset, such as returned by get_active_groupset()
		- values: the array of values to fill-in the '?' in the prepared sql statement, may append to this array
		- ds: dataset with db connection
		- value_for: required for condition terms, "grade" or "child"
		- restriction: required for condition terms, "computable_grade" | "max_grade" | "most_recent_grade"
		
		Return
		- a series of "SELECT name, value" statements that are joined by UNION ALL
		- uncomputable values are not included in the CTE results, EXCEPT IF such values are in a group
	*/
	getCTE(tablename, term, ds, q, values, index, groupset) {
		const [value_for, restriction] = validateQ(q)

		if (!groupset.groups) throw `.groups[] missing from a group-set, term.id='${term.id}'`

		const categories = []
		const filters = []
		for (const g of groupset.groups) {
			if (!g.type || g.type == 'values') {
				categories.push(`SELECT sample, ? as key, value
					FROM precomputed a
					WHERE
						term_id=?
						AND value_for=?
						AND ${restriction}=1
						AND value IN (${g.values.map(v => '?').join(',')})
				`)
				values.push(g.name, term.id, value_for, ...g.values.map(v => v.key.toString()))
			} else if (g.type == 'filter') {
				// TODO: create filter sql for group.type == 'filter'
				if ('activeCohort' in q.groupsetting && g.filter4activeCohort) {
					const tvs_filter = g.filter4activeCohort[q.groupsetting.activeCohort]

					const filter = getFilterCTEs(tvs_filter, ds, 'xf' + xfIndex++)
					if (!filter) throw `unable to construct a group='${g.name}' filter for term.id='${term.id}'`
					filters.push(filter.filters)
					values.push(...filter.values.slice(), g.name, g.name)

					categories.push(
						`SELECT sample, ? AS key, ? AS value
						FROM ${filter.CTEname}`
					)
				} else {
					throw `activeCohort error: cannot construct filter statement for group name='${g.name}', term.id=${term.id}`
				}
			} else {
				throw `unsupported groupset type='${g.type}'`
			}
		}

		return {
			sql: `${filters.length ? filters.join('\n,') + ',' : ''}
			${tablename} AS (
				${categories.join('\nUNION ALL\n')}
			)`,
			tablename
		}
	}
}

export const cuminc = {
	getCTE(tablename, term, q, values, filter) {
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
}
