import { getUncomputableClause, get_bins } from './termdb.sql.js'
import { annoNumericTypes } from '#shared/terms.js'

export const continuous = {
	getCTE(tablename, term, ds, q, values, index, filter) {
		const annoTable = `anno_${term.type}`
		if (!annoNumericTypes.has(term.type)) throw `unknown '${annoTable}' table (continuous.getCTE)`

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
		if (!annoNumericTypes.has(term.type)) throw `unknown '${annoTable}' table (discrete.getCTE)`

		values.push(term.id)
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
				`SELECT '${b.name}' AS name,
				${b.start == undefined ? 0 : b.start} AS start,
				${b.stop == undefined ? 0 : b.stop} AS stop,
				0 AS unannotated,
				${b.startunbounded ? 1 : 0} AS startunbounded,
				${b.stopunbounded ? 1 : 0} AS stopunbounded,
				${b.startinclusive ? 1 : 0} AS startinclusive,
				${b.stopinclusive ? 1 : 0} AS stopinclusive`
			)
		}
		const excludevalues = []
		if (term.values) {
			for (const key in term.values) {
				const isUncomputable = term.values[key].uncomputable
				if (q.computableValuesOnly && isUncomputable) continue
				if (!q.computableValuesOnly && !isUncomputable) continue
				excludevalues.push(key)
				const v = term.values[key]
				bin_def_lst.push(
					`SELECT '${v.label}' AS name,
	        ${key} AS start,
	        0 AS stop,
	        1 AS unannotated,
	        0 AS startunbounded,
	        0 AS stopunbounded,
	        0 AS startinclusive,
	        0 AS stopinclusive`
				)
				name2bin.set(v.label, {
					is_unannotated: true,
					value: key,
					label: v.label
				})
			}
		}

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
						${excludevalues.length ? 'value NOT IN (' + excludevalues.join(',') + ') AND' : ''}
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
