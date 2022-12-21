export function getCohortsData(ds) {
	const features = ds.cohort.db.connection.prepare('select * from features').all()
	const cohorts = ds.cohort.db.connection
		.prepare(`select * from cohorts where cohort in (select distinct(cohort) from cohort_features)`)
		.all()
	const cfeatures = ds.cohort.db.connection.prepare('select * from cohort_features').all()

	return { cohorts, features, cfeatures }
}
