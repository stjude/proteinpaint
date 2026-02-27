function getTermIds(term) {
	if (term.termIds?.length) return term.termIds
	if (term.termlst?.length) return term.termlst.map(t => t.id || t)
	throw 'termCollection: neither termIds nor termlst available'
}

export const termCollectionNumeric = {
	getCTE(tablename, tw, values) {
		const ids = getTermIds(tw.term)
		values.push(...ids)
		return {
			sql: `${tablename} AS (
				SELECT sample,
				sample as key, 
                json_group_object(
                    term_id,
                    value
                ) AS value 
				FROM anno_float
				WHERE term_id IN (${ids.map(() => '?').join(',')})
                GROUP BY sample
			)`,
			tablename
		}
	}
}

export const termCollectionCategorical = {
	getCTE(tablename, tw, values) {
		const ids = getTermIds(tw.term)
		values.push(...ids)
		return {
			sql: `${tablename} AS (
				SELECT sample, term_id as key, value
				FROM anno_categorical
				WHERE term_id IN (${ids.map(() => '?').join(',')})
			)`,
			tablename
		}
	}
}
