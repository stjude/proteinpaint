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
		const categoryKeys = tw.term.categoryKeys
		values.push(...ids)
		if (categoryKeys?.length) values.push(...categoryKeys)
		return {
			sql: `${tablename} AS (
				SELECT a.sample, t.name as key, a.value
				FROM anno_categorical a
				JOIN terms t ON t.id = a.term_id
				WHERE a.term_id IN (${ids.map(() => '?').join(',')})
				${categoryKeys?.length ? `AND a.value IN (${categoryKeys.map(() => '?').join(',')})` : ''}
			)`,
			tablename
		}
	}
}
