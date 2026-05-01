/*
Builds termdbConfig.profileForms2Domain2PlotType for the Templates 2 picker:
{ [cohort]: { [domainId]: [plotTypeName, ...] } }.

The mapping is statically declared per cohort in the dataset config at
plotConfigByCohort[cohort].profileForms2.domain2plotType — no SQL is needed.
Empty inner submaps signal "cohort declared but no template data".
*/
export function getProfileForms2Domain2PlotType(ds: any) {
	const tdb = ds.cohort?.termdb
	if (!tdb?.plotConfigByCohort) return undefined
	const out: Record<string, Record<string, string[]>> = {}
	for (const cohortKey of Object.keys(tdb.plotConfigByCohort)) {
		const cfg = tdb.plotConfigByCohort[cohortKey]?.profileForms2
		if (!cfg?.options) continue
		out[cohortKey] = cfg.domain2plotType || {}
	}
	return Object.keys(out).length ? out : undefined
}
