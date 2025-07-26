import { getUncomputableClause } from './termdb.sql'

export const values = {
	getCTE(tablename, term, ds, q, values) {
		values.push(term.id)
		const uncomputable = getUncomputableClause(term, q)
		values.push(...uncomputable.values)
		// groupsetting not applied
		return {
			sql: `${tablename} AS (
				SELECT sample,value as key, value as value
				FROM anno_categorical
				WHERE term_id=? ${uncomputable.clause}
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
	async getCTE(tablename, term, ds, q, values, groupset) {
		if (!groupset.groups) throw `.groups[] missing from a group-set, term.id='${term.id}'`

		const categories = []
		const filters = []
		for (const g of groupset.groups) {
			if (g.uncomputable) continue
			if (g.type == 'values') {
				categories.push(`SELECT sample, ? as key, value
					FROM anno_categorical a
					WHERE term_id=?
						AND value IN (${g.values.map(v => '?').join(',')})
				`)
				values.push(g.name, term.id, ...g.values.map(v => v.key.toString()))
			} else if (g.type == 'filter') {
				// TODO: create filter sql for group.type == 'filter'
				if ('activeCohort' in q.groupsetting && g.filter4activeCohort) {
					const tvs_filter = g.filter4activeCohort[q.groupsetting.activeCohort]

					const filter = await getFilterCTEs(tvs_filter, ds, 'xf' + xfIndex++)
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
