import { sql } from './sql.ts'

function getTermIds(term) {
	if (term.termIds?.length) return term.termIds
	if (term.termlst?.length) return term.termlst.map(t => t.id || t)
	throw 'termCollection: neither termIds nor termlst available'
}

export const termCollectionNumeric = {
	getCTE(tablename, tw) {
		const ids = getTermIds(tw.term)
		return {
			sql: sql`${sql.id(tablename)} AS (
				SELECT sample,
				sample as key, 
                json_group_object(
                    term_id,
                    value
                ) AS value 
				FROM anno_float
				WHERE term_id IN (${sql.list(ids)})
                GROUP BY sample
			)`,
			tablename
		}
	}
}

export const termCollectionCategorical = {
	getCTE(tablename, tw) {
		const ids = getTermIds(tw.term)
		const rawKeys = tw.q?.categoryKeys || tw.term.categoryKeys
		for (const k of rawKeys || []) {
			if (!k || typeof k !== 'object' || typeof k.key !== 'string')
				throw `termCollection categoryKeys entry must be {key, shown} but got: ${JSON.stringify(k)}`
		}
		const categoryKeys = rawKeys?.filter(k => k.shown).map(k => k.key)
		return {
			sql: sql`${sql.id(tablename)} AS (
				SELECT a.sample, t.name as key, a.value
				FROM anno_categorical a
				JOIN terms t ON t.id = a.term_id
				WHERE a.term_id IN (${sql.list(ids)})
				${categoryKeys?.length ? sql`AND a.value IN (${sql.list(categoryKeys)})` : sql``}
			)`,
			tablename
		}
	}
}
