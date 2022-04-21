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

export const other = {
	/*
	Get CTE for condition term that is not cuminc or cox outcome.

	If q.breaks is present, then grades will be split into groups based on breakpoints. Separete CTEs will then be generated for each group of grades.

	If q.breaks is not present, then a single CTE will be generated for all grades.
	
	Arguments
		- tablename: string name for this CTE
		- term{}
		- values: the array of values to fill-in the '?' in the prepared sql statement, may append to this array
		- ds: dataset with db connection
		- value_for: required for condition terms, "grade" or "child"
		- restriction: required for condition terms, "computable_grade" | "max_grade" | "most_recent_grade"
		
		Return
		- a series of "SELECT name, value" statements that are joined by UNION ALL
		- uncomputable values are not included in the CTE results, EXCEPT IF such values are in a group

	*/
	getCTE(tablename, term, ds, q, values, index) {
		if (q.breaks && q.breaks.length > 0) {
			// breaks present
			const breaks = q.breaks

			// split grades into groups based on breaks
			const grades = Object.keys(term.values)
				.map(Number)
				.sort((a, b) => a - b)

			const groups = [] // [ {name, values}, {name, values} ]
			let group = { values: [] }
			let b
			for (const g of grades) {
				if (breaks.includes(g)) {
					b = g
					// new break in grades
					// modify name of previously iterated group
					if (groups.length === 0) {
						// first group of groups[]
						group.name = 'Grade < ' + b
					} else {
						// interior group of groups[]
						group.name = group.name + ' < ' + b
					}
					// add previously iterated group to groups[]
					groups.push(group)
					// create new group of grades based on new break
					group = {
						name: b + ' =< Grade',
						values: [g]
					}
				} else {
					// add grade to group of grades
					group.values.push(g)
				}
			}
			// add last group of groups[]
			group.name = 'Grade >= ' + b
			groups.push(group)

			// use group names in q.groupNames, if present
			if (q.groupNames && q.groupNames.length > 0) {
				for (const [i, name] of q.groupNames.entries()) {
					groups[i].name = name
				}
			}

			// build CTE
			const [value_for, restriction] = validateQ(q)
			const categories = []
			for (const g of groups) {
				categories.push(`SELECT sample, ? as key, value
					FROM precomputed a
					WHERE
						term_id=?
						AND value_for=?
						AND ${restriction}=1
						AND value IN (${g.values.map(v => '?').join(',')})
				`)
				values.push(g.name, term.id, value_for, ...g.values.map(v => v.toString()))
			}

			return {
				sql: `${tablename} AS (
					${categories.join('\nUNION ALL\n')}
				)`,
				tablename
			}
		} else {
			// no breaks, so all grades in one group
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
}

export const cuminc = {
	getCTE(tablename, term, q, values, filter) {
		if (!q.minYearsToEvent) throw 'minYearsToEvent is missing'
		const minYearsToEvent = q.minYearsToEvent
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
		const minYearsToEvent = 'minYearsToEvent' in q ? q.minYearsToEvent : 5 // NOTE: may be user configurable later via client-side UI
		if (!q.breaks) throw 'cox outcome requires breaks'
		if (q.breaks.length != 1) throw 'cox outcome requires one break'
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
				values.push(term.id, q.breaks[0], minYearsToEvent)
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
				values.push(term.id, q.breaks[0], minYearsToEvent)
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
				values.push(term.id, q.breaks[0], minYearsToEvent)
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
				values.push(term.id, q.breaks[0], minYearsToEvent)
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
