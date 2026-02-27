export const termCollectionNumeric = {
	getCTE(tablename, tw, values) {
		values.push(...tw.term.termIds)
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
				WHERE term_id IN (${tw.term.termIds.map(() => '?').join(',')})
                GROUP BY sample
			)`,
			tablename
		}
	}
}

export const termCollectionCategorical = {
	getCTE(tablename, tw, values) {
		values.push(...tw.term.termIds)
		return {
			sql: `${tablename} AS (
				SELECT sample, term_id as key, value
				FROM anno_categorical
				WHERE term_id IN (${tw.term.termIds.map(_ => '?').join(',')})
			)`,
			tablename
		}
	}
}
