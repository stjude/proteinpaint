import { getUncomputableClause, get_bins } from './termdb.sql.js'
import { dictionaryNumericTypes } from '#shared/terms.js'

export const continuous = {
	getCTE(tablename, term, ds, q, values, index, filter) {
		const annoTable = `anno_${term.type}`
		if (!dictionaryNumericTypes.has(term.type)) throw `unknown '${annoTable}' table (continuous.getCTE)`

		values.push(term.id)
		const uncomputable = getUncomputableClause(term, q)
		values.push(...uncomputable.values)
		return {
			sql: `${tablename} AS (
				SELECT 
					sample,
					value as key, 
					value
				FROM ${annoTable}
				WHERE term_id=? ${uncomputable.clause}
			)`,
			tablename
		}
	}
}

export const cubicSpline = continuous

export const discrete = {
	/*
	decide bins and produce CTE

	q{}
		managed by termsetting

	index

	filter
		{} or null

	returns { sql, tablename, name2bin, bins }
	*/
	getCTE(tablename, term, ds, q, values, index, filter) {
		const annoTable = `anno_${term.type}`
		if (!dictionaryNumericTypes.has(term.type)) throw `unknown '${annoTable}' table (discrete.getCTE)`

		const bins = get_bins(q, term, ds, index, filter)
		//console.log('last2', bins[bins.length - 2], 'last1', bins[bins.length - 1])
		const bin_def_lst = []
		const name2bin = new Map() // k: name str, v: bin{}
		const bin_size = q.bin_size
		let has_percentiles = false
		let binid = 0
		for (const b of bins) {
			if (!('name' in b) && b.label) b.name = b.label
			name2bin.set(b.name, b)
			bin_def_lst.push(
				`SELECT ? AS name,
				? AS start,
				? AS stop,
				0 AS unannotated,
				${b.startunbounded ? 1 : 0} AS startunbounded,
				${b.stopunbounded ? 1 : 0} AS stopunbounded,
				${b.startinclusive ? 1 : 0} AS startinclusive,
				${b.stopinclusive ? 1 : 0} AS stopinclusive`
			)
			// names are bound as strings, same as the previously quoted sql literals
			values.push(String(b.name), getBinBoundary(b.start, b.startunbounded), getBinBoundary(b.stop, b.stopunbounded))
		}
		const excludevalues = []
		if (term.values) {
			for (const key in term.values) {
				const isUncomputable = term.values[key].uncomputable
				if (q.computableValuesOnly && isUncomputable) continue
				if (!q.computableValuesOnly && !isUncomputable) continue
				const numKey = Number(key)
				if (!Number.isFinite(numKey)) throw `non-numeric uncomputable value key='${key}' (discrete.getCTE)`
				excludevalues.push(numKey)
				const v = term.values[key]
				bin_def_lst.push(
					`SELECT ? AS name,
	        ? AS start,
	        0 AS stop,
	        1 AS unannotated,
	        0 AS startunbounded,
	        0 AS stopunbounded,
	        0 AS startinclusive,
	        0 AS stopinclusive`
				)
				values.push(String(v.label), numKey)
				name2bin.set(v.label, {
					is_unannotated: true,
					value: key,
					label: v.label
				})
			}
		}

		// values must be pushed in the order that their placeholders appear in the sql below
		values.push(...excludevalues, term.id)
		const bin_def_table = 'bin_defs_' + index
		const uncomputable = getUncomputableClause(term, q, 'a')
		values.push(...uncomputable.values)

		const sql = `${bin_def_table} AS (
				${bin_def_lst.join('\nUNION ALL\n')}
			),
			${tablename} AS (
				SELECT
					sample,
					b.name AS key,
					value
				FROM
					${annoTable} a
				JOIN ${bin_def_table} b ON
					( b.unannotated=1 AND value=b.start )
					OR
					(
						b.unannotated=0 AND
						${excludevalues.length ? 'value NOT IN (' + excludevalues.map(() => '?').join(',') + ') AND' : ''}
						(
							b.startunbounded = 1
							OR value > b.start
							OR (b.startinclusive=1 AND value = b.start)
						)
						AND
						(
							b.stopunbounded
							OR value < b.stop
							OR (b.stopinclusive=1 AND value = b.stop)
						)
					)
				WHERE
				term_id=? ${uncomputable.clause}
			)`

		return {
			sql,
			tablename,
			name2bin,
			bins
		}
	}
}

export const binary = discrete

/* an undefined or unbounded bin boundary is stored as 0, it is ignored by the sql when the bin is unbounded on that side */
function getBinBoundary(v, unbounded) {
	if (v === undefined || v === null || unbounded) return 0
	const n = Number(v)
	if (!Number.isFinite(n)) throw `invalid bin boundary='${v}'`
	return n
}
