export const termCollectionNumeric = {
	getCTE(tablename, tw, values) {
		values.push(...tw.term.termlst.map(term => term.id))
		// For now, use sample as key for matrix, could update key later if used for other types of plots.
		return {
			sql: `${tablename} AS (
				SELECT sample,
				sample as key, 
                json_group_object(
                    term_id,
                    value
                ) AS value 
				FROM anno_float
				WHERE term_id IN (${tw.term.termlst.map(() => '?').join(',')})
                GROUP BY sample
			)`,
			tablename
		}
	}
}

export const termCollectionCategorical = {
	getCTE(tablename, tw, values) {
		console.log(23, 'termCollectionCategorical', tw)
		values.push(...tw.term.termlst.map(t => t.id))
		console.log(24, values)
		//const uncomputable = getUncomputableClause(term, q)
		//values.push(...uncomputable.values)
		// groupsetting not applied
		return {
			sql: `${tablename} AS (
				SELECT '_TEST_' as sample, term_id as key, count(distinct(sample)) as value
				FROM anno_categorical
				WHERE term_id IN (${tw.term.termlst.map(_ => '?').join(',')})
				GROUP BY sample, term_id
			)`,
			tablename
		}
	}
}
