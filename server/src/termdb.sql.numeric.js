import { getUncomputableClause, get_bins } from './termdb.sql.js'
import { dictionaryNumericTypes } from '#shared/terms.js'
import { sql } from './sql.ts'

export const continuous = {
	getCTE(tablename, term, ds, q) {
		const annoTable = `anno_${term.type}`
		if (!dictionaryNumericTypes.has(term.type)) throw `unknown '${annoTable}' table (continuous.getCTE)`

		return {
			sql: sql`${sql.id(tablename)} AS (
				SELECT 
					sample,
					value as key, 
					value
				FROM ${sql.id(annoTable)}
				WHERE term_id=${term.id} ${getUncomputableClause(term, q)}
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
	getCTE(tablename, term, ds, q, index, filter) {
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
			// names are bound as strings, same as the previously quoted sql literals
			bin_def_lst.push(
				sql`SELECT ${String(b.name)} AS name,
				${getBinBoundary(b.start, b.startunbounded)} AS start,
				${getBinBoundary(b.stop, b.stopunbounded)} AS stop,
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
				const numKey = Number(key)
				if (!Number.isFinite(numKey)) throw `non-numeric uncomputable value key='${key}' (discrete.getCTE)`
				excludevalues.push(numKey)
				const v = term.values[key]
				bin_def_lst.push(
					sql`SELECT ${String(v.label)} AS name,
	        ${numKey} AS start,
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

		const bin_def_table = sql.id('bin_defs_' + index)

		const query = sql`${bin_def_table} AS (
				${sql.join(bin_def_lst, sql`\nUNION ALL\n`)}
			),
			${sql.id(tablename)} AS (
				SELECT
					sample,
					b.name AS key,
					value
				FROM
					${sql.id(annoTable)} a
				JOIN ${bin_def_table} b ON
					( b.unannotated=1 AND value=b.start )
					OR
					(
						b.unannotated=0 AND
						${excludevalues.length ? sql`value NOT IN (${sql.list(excludevalues)}) AND` : sql``}
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
				term_id=${term.id} ${getUncomputableClause(term, q, 'a')}
			)`

		return {
			sql: query,
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
