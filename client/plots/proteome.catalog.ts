/* The proteome sample-set catalog.

   A sample-set–centred dataset (queries.proteome.organisms) describes its cohorts in the
   dataset file, not in the sample dictionary. Each organism → assay → cohort carries a
   `catalog` block of display attributes; this module flattens those into one row per
   cohort. DOM-free, shared by the Studies catalog, the cohort sunburst and the Protein View tiles. */

import type { ProteomeCohortMatch } from '#types'

export type CatalogRow = { [key: string]: any } & { organism: string; assay: string; cohort: string }

/** one row per organism→assay→cohort. `species` and `proteome` are derived from the query
 *  structure (organism key + the assay's proteomeLabel), `dataType` from the assay's PTMType;
 *  every other display field comes from the cohort's `catalog` object in the dataset. A
 *  `catalog` key can still override any derived field; the identity keys come last so it
 *  can't override those. */
export function deriveCatalogRows(organisms: any): CatalogRow[] {
	const rows: CatalogRow[] = []
	for (const organism in organisms || {}) {
		const species = organism.charAt(0).toUpperCase() + organism.slice(1)
		const assays = organisms[organism]?.assays || {}
		for (const assay in assays) {
			const proteome = assays[assay].proteomeLabel || assay
			const cohorts = assays[assay].cohorts || {}
			for (const cohort in cohorts) {
				// Proteome: protein-level abundance (whole, insoluble); PTM: site-level
				const dataType = assays[assay].PTMType ? 'PTM' : 'Proteome'
				rows.push({
					species,
					proteome,
					dataType,
					...(cohorts[cohort].catalog || {}),
					organism,
					assay,
					cohort
				} as CatalogRow)
			}
		}
	}
	return rows
}

/** stable identity of a cohort row */
export function catalogRowKey(organism: string, assay: string, cohort: string): string {
	return `${organism}|${assay}|${cohort}`
}

/** does a cohort (by organism/assay + catalog) satisfy a cohortMatch rule; a missing rule matches nothing */
export function cohortMatches(
	m: ProteomeCohortMatch | undefined,
	organism: string,
	assay: string,
	catalog: any
): boolean {
	if (!m) return false
	if (m.organism && m.organism !== organism) return false
	if (m.assay && m.assay !== assay) return false
	const c = catalog || {}
	for (const k in m.catalog || {}) if (c[k] !== m.catalog![k]) return false
	for (const k of m.with || []) if (!c[k]) return false
	for (const k of m.without || []) if (c[k]) return false
	return true
}
