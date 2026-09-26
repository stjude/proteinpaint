import { sql } from './sql.ts'

export const multivalueCTE = {
	getCTE(tablename, tw) {
		if (tw.term.valueMeaning == 'membership') {
			/* the {key: number} annotation lists categories the sample belongs to;
			expand into one row per key so each key is its own category.
			a sample belonging to multiple keys yields multiple rows and is counted
			under each category */
			return {
				sql: sql`${sql.id(tablename)} AS (
					SELECT
						sample,
						j.key AS key,
						j.key AS value
					FROM anno_multivalue, json_each(anno_multivalue.value) j
					WHERE term_id=${tw.term.id} AND j.value > 0
				)`,
				tablename
			}
		}
		/* valueMeaning missing or 'score': keys map to dataset-specific numeric scores
		(e.g. PrOFILE module ratings). return the raw JSON string; consumers
		such as the profile routes parse it themselves */
		return {
			sql: sql`${sql.id(tablename)} AS (
				SELECT 
					sample,
					value as key, 
					value
				FROM anno_multivalue
				WHERE term_id=${tw.term.id}
			)`,
			tablename
		}
	}
}
