export const dateCTE = {
	getCTE(tablename, tw) {
		return {
			sql: `${tablename} AS (
				SELECT 
					sample,
					value as key, 
					value
				FROM anno_date
				WHERE term_id='${tw.term.id}'
			)`,
			tablename
		}
	}
}
