export const multivalueCTE = {
	getCTE(tablename, tw) {
		console.log('multivalueCTE.getCTE', tablename, tw)
		return {
			sql: `${tablename} AS (
				SELECT 
					sample,
					value as key, 
					value
				FROM anno_multivalue
				WHERE term_id='${tw.term.id}'
			)`,
			tablename
		}
	}
}
