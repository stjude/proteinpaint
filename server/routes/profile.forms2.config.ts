/*
Lazy compute for termdbConfig.profileForms2Domains (Templates 2 picker map). Invoked from
termdb.config.ts on each /termdb/config request; caches on tdb.profileForms2Domains so the
SQL runs once per dataset. Empty inner submaps signal "cohort declared but no template data".
*/
export function getProfileForms2Domains(ds: any) {
	const tdb = ds.cohort?.termdb
	if (!tdb) return undefined
	if (tdb.profileForms2Domains !== undefined) return tdb.profileForms2Domains
	if (!tdb.plotConfigByCohort || !ds.cohort?.db?.connection) {
		tdb.profileForms2Domains = undefined
		return undefined
	}
	const subtypeLabels: Record<string, string> = {}
	for (const cohortKey of Object.keys(tdb.plotConfigByCohort)) {
		const opts = tdb.plotConfigByCohort[cohortKey]?.profileForms2?.options
		if (!opts) continue
		for (const o of opts) if (o.subtype && o.name) subtypeLabels[o.subtype] = o.name
	}
	const subtypes = Object.keys(subtypeLabels)
	if (!subtypes.length) {
		tdb.profileForms2Domains = undefined
		return undefined
	}
	const placeholders = subtypes.map(() => '?').join(',')
	const sql = `SELECT DISTINCT s.cohort, t.parent_id, json_extract(t.jsondata, '$.subtype') AS subtype
		FROM terms t
		JOIN subcohort_terms s ON s.term_id = t.parent_id
		WHERE t.type='multivalue'
			AND json_extract(t.jsondata, '$.subtype') IN (${placeholders})
			AND t.parent_id IS NOT NULL`
	const rows = ds.cohort.db.connection.prepare(sql).all(subtypes)
	// Seed declared cohorts so an empty submap is distinguishable from a missing key.
	const out: Record<string, Record<string, string[]>> = {}
	for (const cohortKey of Object.keys(tdb.plotConfigByCohort)) {
		if (tdb.plotConfigByCohort[cohortKey]?.profileForms2?.options) out[cohortKey] = {}
	}
	for (const r of rows) {
		if (!out[r.cohort]) out[r.cohort] = {}
		const label = subtypeLabels[r.subtype]
		const arr = (out[r.cohort][r.parent_id] ||= [])
		if (!arr.includes(label)) arr.push(label)
	}
	tdb.profileForms2Domains = out
	return out
}
