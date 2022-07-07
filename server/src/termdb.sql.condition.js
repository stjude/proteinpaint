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
	getCTE(tablename, term, ds, q, values) {
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
	getCTE(tablename, term, ds, q, values) {
		if (!q.breaks) throw 'binary mode requires breaks'
		if (q.breaks.length != 1) throw 'binary mode requires one break'
		return getCTE_discreteWithBreaks(tablename, term, q, values)
	}
}

export const cuminc = {
	/*
	Get CTE for cuminc term

	SQL output: sample|key|value
		- sample: sample id
		- key: exit code (0 = censored; 1 = event)
			- An event is defined by the grade breakpoint given in q.breaks
				- E.g. if q.breaks[0] == 3, then an event is an occurrence of any grade between grades 3-5
		- value: years from cancer diagnosis until last assessment (exit code = 0) or first occurrence of event (exit code = 1)
			- if years < ds.cohort.minYearsSinceDx, then years is set to ds.cohort.minYearsSinceDx
	*/
	getCTE(tablename, term, ds, q, values, filter) {
		if (!q.breaks || q.breaks.length != 1) throw 'one break is required'
		if (!ds.cohort.minYearsSinceDx) throw 'min years since dx is missing'

		// CTE for gathering event term(s)
		// conditioned on whether or not the term is a leaf term
		let eventTerms
		if (term.isleaf) {
			eventTerms = `eventTerms AS (
				SELECT term_id
				FROM chronicevents
				WHERE term_id = ?
			)`
		} else {
			eventTerms = `parentTerms AS (
					SELECT distinct(ancestor_id) 
					FROM ancestry
				),
				eventTerms AS (
					SELECT a.term_id 
					FROM ancestry a
					JOIN terms t ON t.id = a.term_id AND t.id NOT IN parentTerms 
					WHERE a.ancestor_id = ?
				)`
		}
		values.push(term.id)

		// CTE for discarding entries with negative years_to_event values
		const positiveYears = `positiveYears AS (
			SELECT *
			FROM chronicevents
			WHERE years_to_event > 0
		)`

		// CTE for extracting event 1 entries
		const event1 = `event1 AS (
			SELECT sample, 1 as key, CASE
				WHEN MIN(years_to_event) < ? THEN ?
				ELSE MIN(years_to_event)
				END value
			FROM positiveYears
			WHERE term_id in eventTerms
			AND grade >= ?
			AND grade <= 5
			${filter ? 'AND sample IN ' + filter.CTEname : ''}
			GROUP BY sample
		)`
		values.push(ds.cohort.minYearsSinceDx, ds.cohort.minYearsSinceDx, q.breaks[0])

		// CTE for extracting event 0 entries
		const event0 = `event0 AS (
			SELECT sample, 0 as key, CASE
				WHEN MAX(years_to_event) < ? THEN ?
				ELSE MAX(years_to_event)
				END value
			FROM positiveYears
			WHERE grade <= 5 
			AND sample NOT IN event1samples
			${filter ? 'AND sample IN ' + filter.CTEname : ''}
			GROUP BY sample
		)`
		values.push(ds.cohort.minYearsSinceDx, ds.cohort.minYearsSinceDx)

		return {
			sql: `${eventTerms},
			${positiveYears},
			${event1},
			event1samples AS (
				SELECT sample
				FROM event1
			),
			${event0},
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
	/*
	Get CTE for cox term

	SQL output: sample|key|value
		- sample: sample id
		- key: exit code (0 = censored; 1 = event)
			- An event is defined by the grade breakpoint given in q.breaks
				- E.g. if q.breaks[0] == 3, then an event is an occurrence of any grade between grades 3-5
		- value:
			- for timeScale='time': years from ds.cohort.minYearsSinceDx until last assessment (exit code = 0) or first occurrence of event (exit code = 1)
			- for timeScale='age': {age_start, age_end, time}
				age_start: agedx + ds.cohort.minYearsSinceDx
				age_end: age at last assessment (exit code = 0) or first occurrence of event (exit code = 1)
					- 1 day (i.e. 1/365 or 0.00274) is added to age_end to prevent age_end = age_start (which would cause regression analysis to fail in R)
				time: years from ds.cohort.minYearsSinceDx until last assessment (exit code = 0) or first occurrence of event (exit code = 1)
					- time is included in this output so that cuminc analysis can run for rare variants when age scale is selected for cox regression
	
	Entries with years < ds.cohort.minYearsSinceDx are discarded
	*/
	getCTE(tablename, term, ds, q, values, filter) {
		if (!q.breaks || q.breaks.length != 1) throw 'one break is required'
		if (!q.timeScale) throw 'time scale is missing'
		if (!ds.cohort.minYearsSinceDx) throw 'min years since dx is missing'

		// CTE for gathering event term(s)
		// conditioned on whether or not the term is a leaf term
		let eventTerms
		if (term.isleaf) {
			eventTerms = `eventTerms AS (
				SELECT term_id
				FROM chronicevents
				WHERE term_id = ?
			)`
		} else {
			eventTerms = `parentTerms AS (
					SELECT distinct(ancestor_id) 
					FROM ancestry
				),
				eventTerms AS (
					SELECT a.term_id 
					FROM ancestry a
					JOIN terms t ON t.id = a.term_id AND t.id NOT IN parentTerms 
					WHERE a.ancestor_id = ?
				)`
		}
		values.push(term.id)

		// CTE for discarding entries with years_to_event values below ds.cohort.minYearsSinceDx
		const filteredYears = `filteredYears AS (
			SELECT *
			FROM chronicevents
			WHERE years_to_event >= ?
		)`
		values.push(ds.cohort.minYearsSinceDx)

		let event1, event0
		if (q.timeScale == 'time') {
			// time scale is 'time'

			// CTE for extracting event 1 entries
			event1 = `event1 AS (
				SELECT sample, 1 as key, (MIN(years_to_event) - ?) as value
				FROM filteredYears
				WHERE term_id in eventTerms
				AND grade >= ?
				AND grade <= 5
				${filter ? 'AND sample IN ' + filter.CTEname : ''}
				GROUP BY sample
			)`
			values.push(ds.cohort.minYearsSinceDx, q.breaks[0])

			// CTE for extracting event 0 entries
			event0 = `event0 AS (
				SELECT sample, 0 as key, (MAX(years_to_event) - ?) as value
				FROM filteredYears
				WHERE grade <= 5 
				AND sample NOT IN event1samples
				${filter ? 'AND sample IN ' + filter.CTEname : ''}
				GROUP BY sample
			)`
			values.push(ds.cohort.minYearsSinceDx)
		} else if (q.timeScale == 'age') {
			// time scale is 'age'

			// CTE for extracting event 1 entries
			event1 = `event1 AS (
				SELECT f.sample, 1 as key, json_object('age_start', a.value + ?, 'age_end', (MIN(f.age_graded) + 0.00274), 'time', MIN(f.years_to_event) - ?) as value
				FROM filteredYears f
				INNER JOIN anno_float a ON f.sample = a.sample
				WHERE a.term_id = 'agedx'
				AND f.term_id in eventTerms
				AND f.grade >= ?
				AND f.grade <= 5
				${filter ? 'AND f.sample IN ' + filter.CTEname : ''}
				GROUP BY f.sample
			)`
			values.push(ds.cohort.minYearsSinceDx, ds.cohort.minYearsSinceDx, q.breaks[0])

			// CTE for extracting event 0 entries
			event0 = `event0 AS (
				SELECT f.sample, 0 as key, json_object('age_start', a.value + ?, 'age_end', (MAX(f.age_graded) + 0.00274), 'time', MAX(f.years_to_event) - ?) as value
				FROM filteredYears f
				INNER JOIN anno_float a ON f.sample = a.sample
				WHERE a.term_id = 'agedx'
				AND f.grade <= 5
				AND f.sample NOT IN event1samples
				${filter ? 'AND f.sample IN ' + filter.CTEname : ''}
				GROUP BY f.sample
			)`
			values.push(ds.cohort.minYearsSinceDx, ds.cohort.minYearsSinceDx)
		}

		return {
			sql: `${eventTerms},
			${filteredYears},
			${event1},
			event1samples AS (
				SELECT sample
				FROM event1
			),
			${event0},
			${tablename} AS (
				SELECT * FROM event1
				UNION ALL
				SELECT * FROM event0
			)`,
			tablename
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
