/* true if at least one loaded ds has dictionary terms of the given type in any cohort, per the term
counts in ds.cohort.termdb.termtypeByCohort{}; used by term-type-specific routes (e.g. termdb/cuminc,
termdb/survival) to decide if they are set up */
export function hasTermTypeDs(genomes, termType: string) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) =>
			Object.values<any>(ds.cohort?.termdb?.termtypeByCohort || {}).some(cohortTypes => cohortTypes?.[termType])
		)
	)
}
