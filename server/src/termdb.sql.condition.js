import { getUncomputableClause } from './termdb.sql'

export const discrete = {
	/*
	Get CTE for discrete term.

	If q.breaks is present, then grades will be split into groups based on breakpoints. A CTE will be generated for each group.

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
	getCTE(tablename, term, q, values) {
		if (q.breaks && q.breaks.length > 0) {
			// breaks present, split grades into groups
			return getCTE_discreteWithBreaks(tablename, term, q, values)
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

export const binary = {
	// Get CTE for binary term
	// must have a single breakpoint
	getCTE(tablename, term, q, values) {
		if (!q.breaks) throw 'binary mode requires breaks'
		if (q.breaks.length != 1) throw 'binary mode requires one break'
		return getCTE_discreteWithBreaks(tablename, term, q, values)
	}
}

export const time2event = {
	// Get CTE for time2event term
	// must have a time scale for time component
	// must have a single breakpoint for event component
	getCTE(tablename, term, q, values, filter) {
		const minYearsToEvent = 'minYearsToEvent' in q ? q.minYearsToEvent : 5
		if (!q.breaks) throw 'breaks is missing'
		if (q.breaks.length != 1) throw 'time2event term requires one break'
		if (!q.timeScale) throw 'time scale missing'
		if (q.timeScale == 'time') {
			/*
			time scale is time from diagnosis
			sql output -> 'key': event status (0/1); 'value': follow-up time
			when 'key' is 0, 'value' is time until last assessment
			when 'key' is 1, 'value' is time until first occurrence of event
			FIXME: should "time" be (1) time from diagnosis or (2) time from study enrollment?
			*/
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
			/*
			time scale is age
			sql output -> 'key': event status (0/1); 'value': {age_start, age_end, time}
			when 'key' is 0, 'value' is {age_start: age at cancer diagnosis, age_end: age at last assessment, time: time from diagnosis until last assessment}
			when 'key' is 1, 'value' is {age_start: age at cancer diagnosis, age_end: age at first occurrence of event, time: time from diagnosis until first occurrence of event}
			NOTE: time is included in this output so that cuminc analysis can run for rare variants when age scale is selected for cox regression
			NOTE: one day (i.e. 1/365 or 0.00274) is added to age_end so that age_end does not equal age_start (otherwise model fit will fail in R)
			FIXME: determine whether "age_start" should be (1) agedx, (2) (agedx + 5), or (3) ageconsent (from annotations table)
			FIXME: see above FIXME for what kind of time should "time" refer to
			TODO: do not hardcode '0.00274' or 'agedx'. Should retrieve from dataset.
			*/
			let event1CTE
			if (term.isleaf) {
				event1CTE = `event1 AS (
					SELECT c.sample, 1 as key, json_object('age_start', a.value, 'age_end', (MIN(c.age_graded) + 0.00274), 'time', MIN(c.years_to_event)) as value
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
					SELECT c.sample, 1 as key, json_object('age_start', a.value, 'age_end', (MIN(c.age_graded) + 0.00274), 'time', MIN(c.years_to_event)) as value
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
				SELECT c.sample, 0 as key, json_object('age_start', a.value, 'age_end', (MAX(c.age_graded) + 0.00274), 'time', MAX(c.years_to_event)) as value
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

function getCTE_discreteWithBreaks(tablename, term, q, values) {
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
}
