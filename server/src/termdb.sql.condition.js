import { getUncomputableClause } from './termdb.sql.js'

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
		if (q.breaks?.length != 1) throw 'binary mode requires one break'
		return getCTE_discreteWithBreaks(tablename, term, q, values)
	}
}

export const cuminc = {
	/*
	Get CTE for cuminc term

	SQL output: sample|key|value
		- sample: sample id
		- key: event status code
			0 = censored
			1 = event of interest
			2 = competing risk event
		- value: time-to-event
			When key=0, time is from diagnosis to last visit
			When key=1, time is from diagnosis to first occurence of event
			When key=2, time is from diagnosis to death
	*/
	getCTE(tablename, term, ds, q, values) {
		if (q.breaks?.length != 1) throw 'cuminc mode requires one break'
		values.push(term.id, q.breaks[0])
		return {
			sql: `${tablename} AS (
				SELECT
					sample,
					event AS key,
					time AS value
				FROM
					precomputed_cuminc
				WHERE
					term_id = ?
					AND grade_cutoff = ?
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
		- key: event status code
			0 = censored/death
			1 = event of interest
			-1 = event of interest before follow-up
		- value: {age_start, age_end}
			age_start: age at beginning of follow-up
			age_end:
				- when event=0:
					- if sample died within study period, then end age is age at death
					- otherwise, end age is age at last visit
				- when event=1/-1:
					- end age is age at first occurence of event
	*/
	getCTE(tablename, term, ds, q, values) {
		if (q.breaks?.length != 1) throw 'cox mode requires one break'
		values.push(term.id, q.breaks[0])
		const grades = Object.keys(term.values).map(Number)
		const maxgrade = Math.max(...grades)
		return {
			sql: `${tablename} AS (
				SELECT
					sample,
					event AS key,
					json_object('age_start', age_start, 'age_end', age_end) AS value
				FROM
					precomputed_cox
				WHERE
					term_id = ?
					AND grade_cutoff = ?
			)`,
			tablename,
			events: [
				{ event: 1, label: `Event (grade ${q.breaks[0] === maxgrade ? q.breaks[0] : `${q.breaks[0]}-${maxgrade}`})` },
				{ event: 0, label: 'Censored/death' },
				{ event: -1, label: 'Event before entry into the cohort' }
			]
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
	// build CTE
	const [value_for, restriction] = validateQ(q)
	if (value_for != 'grade') throw 'breaks must be used on grade values'
	const categories = []
	for (const g of q.groups) {
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
