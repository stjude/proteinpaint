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
			values.push(term.id)
			const uncomputable = getUncomputableClause(term, q)
			values.push(...uncomputable.values)
			return {
				sql: `${tablename} AS (
					SELECT
						sample,
						value as key,
						value
					FROM
						${value_for == 'grade' ? 'precomputed_chc_grade' : 'precomputed_chc_child'}
					WHERE
						term_id = ?
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

export const time2event = {
	/*
	Get CTE for time-to-event term

	SQL output: sample|key|value
		- sample: sample id
		- key: event status
			0 = censored
			1 = event of interest
			2 = competing risk event
		- value: {
			age_dx: age at diagnosis
			age_event: age at event. When key=0, age_event is age at last visit. When key=1, age_event is age at first occurence of event. When key=2, age_event is age at death
		}
	
	Event of interest
		- sample has event of interest if sample had a grade >= q.breaks[0] of the event of interest before the last visit or had a grade 5 of the event of interest before the last NDI search
	
	Competing risk event
		- sample has competing risk event if sample died before the last NDI search and is not an event 1 sample
	
	Censored
		- sample is censored if sample is neiter an event 1 or an event 2 sample
	*/
	getCTE(tablename, term, ds, q, values) {
		if (!q.breaks || q.breaks.length != 1) throw 'one break is required'
		const { ageDxId, ageLastVisitId, ageNdiId, ageDeathId } = ds.cohort.termdb.termIds
		if (!ageDxId || !ageLastVisitId || !ageNdiId || !ageDeathId) throw 'missing age terms ids'

		// CTE for age at diagnosis
		const ageDx = `ageDx AS (
			SELECT sample, ROUND(value,2) AS value
			FROM ${'anno_' + ds.cohort.termdb.q.termjsonByOneid(ageDxId).type}
			WHERE term_id = ?
		)`
		values.push(ageDxId)

		// CTE for age at last visit
		const ageLastVisit = `ageLastVisit AS (
			SELECT sample, ROUND(value,2) AS value
			FROM ${'anno_' + ds.cohort.termdb.q.termjsonByOneid(ageLastVisitId).type}
			WHERE term_id = ?
		)`
		values.push(ageLastVisitId)

		// CTE for age at last NDI search
		const ageNdi = `ageNdi AS (
			SELECT sample, ROUND(value,2) AS value
			FROM ${'anno_' + ds.cohort.termdb.q.termjsonByOneid(ageNdiId).type}
			WHERE term_id = ?
		)`
		values.push(ageNdiId)

		// CTE for dead samples
		const dead = `dead AS (
			SELECT anno.sample, ageDx.value AS ageDx, ageNdi.value AS ageNdi, ROUND(anno.value,2) AS ageDeath
			FROM ${'anno_' + ds.cohort.termdb.q.termjsonByOneid(ageDeathId).type} anno
			JOIN ageNdi ON anno.sample = ageNdi.sample
			JOIN ageDx ON anno.sample = ageDx.sample
			WHERE anno.term_id = ?
		)`
		values.push(ageDeathId)

		/*
		CTE for generating the time-to-event table
			- pre-process the chronicevents table
				- discard negative years_to_event values (i.e. events that
		occurred prior to cancer diagnosis)
				- dicard entries with grade > 5 (i.e. uncomputable grades)
			- join age values to chronicevents table
		*/
		const timeToEvent = `timeToEvent AS (
			SELECT c.*, ageDx.value AS ageDx, ageLastVisit.value AS ageLastVisit, ageNdi.value AS ageNdi
			FROM chronicevents c
			JOIN ageDx ON c.sample = ageDx.sample
			JOIN ageLastVisit ON c.sample = ageLastVisit.sample
			JOIN ageNdi ON c.sample = ageNdi.sample
			WHERE c.years_to_event > 0
			AND c.grade <= 5
		)`

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

		// CTE for samples with event of interest (event=1)
		const event1 = `event1 AS (
			SELECT sample, 1 AS key, json_object('age_dx', ageDx, 'age_event', MIN(age_graded)) AS value
			FROM timeToEvent
			WHERE term_id IN eventTerms
			AND (
				(grade >= ? AND age_graded <= ageLastVisit)
				OR
				(grade = 5 AND age_graded <= ageNdi)
			)
			GROUP BY sample
		)`
		values.push(q.breaks[0])

		const event1samples = `event1samples AS (
			SELECT sample
			FROM event1
		)`

		// CTE for samples with competing risk event (event=2)
		const event2 = `event2 AS (
			SELECT sample, 2 AS key, json_object('age_dx', ageDx, 'age_event', ageDeath) AS value
			FROM dead
			WHERE ageDeath <= ageNdi
			AND sample NOT IN event1samples
		)`

		const event2samples = `event2samples AS (
			SELECT sample
			FROM event2
		)`

		// CTE for censored samples (event=0)
		const event0 = `event0 AS (
			SELECT DISTINCT sample, 0 AS key, json_object('age_dx', ageDx, 'age_event', ageLastVisit) AS value
			FROM timeToEvent
			WHERE sample NOT IN event1samples
			AND sample NOT IN event2samples
		)`

		return {
			sql: `${ageDx},
			${ageLastVisit},
			${ageNdi},
			${dead},
			${timeToEvent},
			${eventTerms},
			${event1},
			${event1samples},
			${event2},
			${event2samples},
			${event0},
			${tablename} AS (
				SELECT * FROM event1
				UNION ALL
				SELECT * FROM event2
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
	if (value_for != 'grade') throw 'breaks must be used on grade values'
	const categories = []
	for (const g of groups) {
		categories.push(`SELECT sample, ? as key, value
			FROM precomputed_chc_grade
			WHERE
				term_id=?
				AND ${restriction}=1
				AND value IN (${g.values.map(v => '?').join(',')})
		`)
		values.push(g.name, term.id, ...g.values.map(v => v.toString()))
	}

	return {
		sql: `${tablename} AS (
			${categories.join('\nUNION ALL\n')}
		)`,
		tablename
	}
}
