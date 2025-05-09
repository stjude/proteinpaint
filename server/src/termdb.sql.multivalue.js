export const multivalueCTE = {
	getCTE(tablename, tw, values) {
		values.push(tw.term.id)
		return {
			sql: `${tablename} AS (
				SELECT 
					sample,
					value as key, 
					value
				FROM anno_multivalue
				WHERE term_id=?
			)`,
			tablename
		}
	}
}
