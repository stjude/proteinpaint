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
		// NOTE: may be user configurable later via client-side UI
		const minYearsToEvent = 'minYearsToEvent' in q ? q.minYearsToEvent : 5
		let event1CTE
		if (term.isleaf) {
			event1CTE = `event1 AS (
				SELECT sample, 1 as key, MIN(years_to_event) as value
				FROM chronicevents
				WHERE term_id = ?
					AND grade >= ?
				  AND grade <= 5
				  AND years_to_event >= ?
				  ${filter ? 'AND sample IN ' + filter.CTEname : ''}
				GROUP BY sample
			)`
			values.push(term.id, q.grade, minYearsToEvent, minYearsToEvent)
		} else {
			event1CTE = `parentTerms AS (
				SELECT distinct(ancestor_id) 
				FROM ancestry
			),
			eventTerms AS (
				SELECT a.term_id 
				FROM ancestry a
				JOIN terms t ON t.id = a.term_id AND t.id NOT IN parentTerms 
				WHERE a.ancestor_id = ?
			),
			event1 AS (
				SELECT sample, 1 as key, MIN(years_to_event) as value
				FROM chronicevents
				WHERE term_id in eventTerms
					AND grade >= ?
				  AND grade <= 5
				  AND years_to_event >= ?
				  ${filter ? 'AND sample IN ' + filter.CTEname : ''}
				GROUP BY sample
			)`
			values.push(term.id, q.grade, minYearsToEvent, minYearsToEvent)
		}

		return {
			sql: `${event1CTE},
			event1samples AS (
				SELECT sample
				FROM event1
			),
			event0 AS (
				SELECT sample, 0 as key, MAX(years_to_event) as value
				FROM chronicevents
				WHERE grade <= 5 
					AND sample NOT IN event1samples
					AND years_to_event >= ?
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

export const cox = {
	getCTE(tablename, term, q, values, filter) {
		const minYearsToEvent = 'minYearsToEvent' in q ? q.minYearsToEvent : 5
		// NOTE: may be user configurable later via client-side UI
		if (q.timeScale == 'year') {
			// 'value' column will contain follow-up time from 5 years post cancer diagnosis
			// event 1: follow up time is for first event to occur
			// event 0: follow-up time is until last assessment
			let event1CTE
			if (term.isleaf) {
				event1CTE = `event1 AS (
					SELECT sample, 1 as key, MIN(years_to_event) as value
					FROM chronicevents
					WHERE term_id = ?
						AND grade >= ?
					AND grade <= 5
					AND years_to_event >= ?
					${filter ? 'AND sample IN ' + filter.CTEname : ''}
					GROUP BY sample
				)`
				values.push(term.id, q.cutoff, minYearsToEvent)
			} else {
				event1CTE = `parentTerms AS (
					SELECT distinct(ancestor_id) 
					FROM ancestry
				),
				eventTerms AS (
					SELECT a.term_id 
					FROM ancestry a
					JOIN terms t ON t.id = a.term_id AND t.id NOT IN parentTerms 
					WHERE a.ancestor_id = ?
				),
				event1 AS (
					SELECT sample, 1 as key, MIN(years_to_event) as value
					FROM chronicevents
					WHERE term_id in eventTerms
						AND grade >= ?
					AND grade <= 5
					AND years_to_event >= ?
					${filter ? 'AND sample IN ' + filter.CTEname : ''}
					GROUP BY sample
				)`
				values.push(term.id, q.cutoff, minYearsToEvent)
			}

			// TODO: for event 0, CTE may need to be adjusted for groupsetting usage
			const event0CTE = `event0 AS (
				SELECT sample, 0 as key, MAX(years_to_event) as value
				FROM chronicevents
				WHERE grade <= 5 
					AND sample NOT IN event1samples
					AND years_to_event >= ?
				${filter ? 'AND sample IN ' + filter.CTEname : ''}
				GROUP BY sample
			)`
			values.push(minYearsToEvent)

			return {
				sql: `${event1CTE},
				event1samples AS (
					SELECT sample
					FROM event1
				),
				${event0CTE},
				${tablename} AS (
					SELECT * FROM event1
					UNION ALL
					SELECT * FROM event0
				)`,
				tablename
			}
		} else if (q.timeScale == 'age') {
			// FIXME: do not hardcode '5', '0.00274', and 'agedx'. Should retrieve from dataset.
			// 'value' column will be json of start and end ages
			// age_start is age at 5 years post cancer diagnosis
			// age_end is either age at first event (event 1) or age at last assessment (event 0)
			// one day (i.e. 1/365 or 0.00274) is added to age_end so that age_end does not equal age_start (otherwise model fit will fail in R)
			let event1CTE
			if (term.isleaf) {
				event1CTE = `event1 AS (
					SELECT c.sample, 1 as key, json_object('age_start', (a.value + 5), 'age_end', (MIN(c.age_graded) + 0.00274)) as value
					FROM chronicevents c
					INNER JOIN anno_float a ON c.sample = a.sample
					WHERE a.term_id = 'agedx'
					AND c.term_id = ?
					AND c.grade >= ?
					AND c.grade <= 5
					AND c.years_to_event >= ?
					${filter ? 'AND c.sample IN ' + filter.CTEname : ''}
					GROUP BY c.sample
				)`
				values.push(term.id, q.cutoff, minYearsToEvent)
			} else {
				event1CTE = `parentTerms AS (
					SELECT distinct(ancestor_id) 
					FROM ancestry
				),
				eventTerms AS (
					SELECT a.term_id 
					FROM ancestry a
					JOIN terms t ON t.id = a.term_id AND t.id NOT IN parentTerms 
					WHERE a.ancestor_id = ?
				),
				event1 AS (
					SELECT c.sample, 1 as key, json_object('age_start', (a.value + 5), 'age_end', (MIN(c.age_graded) + 0.00274)) as value
					FROM chronicevents c
					INNER JOIN anno_float a ON c.sample = a.sample
					WHERE a.term_id = 'agedx'
					AND c.term_id in eventTerms
					AND c.grade >= ?
					AND c.grade <= 5
					AND c.years_to_event >= ?
					${filter ? 'AND c.sample IN ' + filter.CTEname : ''}
					GROUP BY c.sample
				)`
				values.push(term.id, q.cutoff, minYearsToEvent)
			}

			const event0CTE = `event0 AS (
				SELECT c.sample, 0 as key, json_object('age_start', (a.value + 5), 'age_end', (MAX(c.age_graded) + 0.00274)) as value
				FROM chronicevents c
				INNER JOIN anno_float a ON c.sample = a.sample
				WHERE a.term_id = 'agedx'
				AND c.grade <= 5 
				AND c.sample NOT IN event1samples
				AND c.years_to_event >= ?
				${filter ? 'AND c.sample IN ' + filter.CTEname : ''}
				GROUP BY c.sample
			)`
			values.push(minYearsToEvent)

			return {
				sql: `${event1CTE},
				event1samples AS (
					SELECT sample
					FROM event1
				),
				${event0CTE},
				${tablename} AS (
					SELECT * FROM event1
					UNION ALL
					SELECT * FROM event0
				)`,
				tablename
			}
		} else {
			throw 'unknown time scale'
		}
	}
}
