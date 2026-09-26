import { getUncomputableClause } from './termdb.sql.js'
import { getFilterCTEs } from './termdb.filter.js'
import { sql } from './sql.ts'

export const values = {
	getCTE(tablename, term, ds, q) {
		// groupsetting not applied
		return {
			sql: sql`${sql.id(tablename)} AS (
				SELECT sample,value as key, value as value
				FROM anno_categorical
				WHERE term_id=${term.id} ${getUncomputableClause(term, q)}
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
		- ds: dataset with db connection
		- value_for: required for condition terms, "grade" or "child"
		- restriction: required for condition terms, "computable_grade" | "max_grade" | "most_recent_grade"
		
		Return
		- { sql, tablename }, where sql is a sql`` fragment of a series of "SELECT name, value" statements that are joined by UNION ALL
		- uncomputable values are not included in the CTE results, EXCEPT IF such values are in a group
	*/
	async getCTE(tablename, term, ds, q, groupset) {
		if (!groupset.groups) throw `.groups[] missing from a group-set, term.id='${term.id}'`

		const categories = []
		const filters = []
		for (const g of groupset.groups) {
			if (g.uncomputable) continue
			if (g.type == 'values') {
				categories.push(sql`SELECT sample, ${g.name} as key, value
					FROM anno_categorical a
					WHERE term_id=${term.id}
						AND value IN (${sql.list(
							g.values.map(v => v.key.toString()),
							{ allowEmpty: true }
						)})
				`)
			} else if (g.type == 'filter') {
				// TODO: create filter sql for group.type == 'filter'
				if ('activeCohort' in q.groupsetting && g.filter4activeCohort) {
					const tvs_filter = g.filter4activeCohort[q.groupsetting.activeCohort]

					const filter = await getFilterCTEs(tvs_filter, ds, undefined, undefined, 'xf' + xfIndex++)
					if (!filter) throw `unable to construct a group='${g.name}' filter for term.id='${term.id}'`
					filters.push(filter.filters)

					categories.push(
						sql`SELECT sample, ${g.name} AS key, ${g.name} AS value
						FROM ${sql.id(filter.CTEname)}`
					)
				} else {
					throw `activeCohort error: cannot construct filter statement for group name='${g.name}', term.id=${term.id}`
				}
			} else {
				throw `unsupported groupset type='${g.type}'`
			}
		}

		return {
			sql: sql`${filters.length ? sql`${sql.join(filters, sql`\n,`)},` : sql``}
			${sql.id(tablename)} AS (
				${sql.join(categories, sql`\nUNION ALL\n`)}
			)`,
			tablename
		}
	}
}
