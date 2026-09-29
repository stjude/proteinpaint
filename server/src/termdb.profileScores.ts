import { getData } from './termdb.matrix.js'
import { filterJoin } from '#shared/filter.js'

/*
Fetches site/sample data for facility-aware profile scoring.

getScoresData() runs getData() against the facility term wrapper plus the
caller-supplied score/maxScore terms, then returns:
  - samples:    raw sample rows for the caller to aggregate
  - sites:      [{ value, label }] list for the facility dropdown, sorted
                alphabetically by label and filtered down to the user's
                authorized sites (clientAuthResult[activeCohort].sites)
  - sampleData: a single sample row when the caller requests a specific
                facility (query.facilitySite) or when only one site remains
                after access filtering — undefined otherwise
  - site:       the {value, label} entry for sampleData, or undefined

The orchestration calls four pure helpers (buildSitesList,
filterSitesByUserAccess, sortSitesByLabel, pickSampleAndSite) exported
alongside so they can be unit-tested without the getData() I/O boundary —
see server/src/test/termdb.profileScores.unit.spec.ts.
*/

export type Site = { value: any; label: string }

const LABEL_MAX_LENGTH = 50
const LABEL_TRUNCATE_AT = 47

/**
 * Derives the cohort prefix from term IDs already present in the request.
 * Primary source: scoreTerms (always present in the request).
 * Fallback: filter term IDs (may be absent if no filters are applied).
 * Term IDs share the same prefix as the facility term for a given cohort.
 */
export function derivePrefix(query: any): string {
	const firstScoreId = query.scoreTerms?.[0]?.score?.term?.id
	if (firstScoreId?.startsWith('F')) return 'F'
	if (firstScoreId?.startsWith('A')) return 'A'
	for (const entry of query.filter?.lst || []) {
		const id = entry.tvs?.term?.id
		if (id?.startsWith('F')) return 'F'
		if (id?.startsWith('A')) return 'A'
	}
	throw 'cannot determine cohort prefix from scoreTerms or filter term IDs'
}

/*
A site may submit more than once, and each submission is its own sample. Charts
that aggregate across sites narrow to each site's most recent round so a site
that resubmitted is not weighted twice. The flag term is computed at build time
and follows the same cohort-prefix convention as `${prefix}UNIT`.

Applied server-side so the narrowing holds regardless of what the client sends;
callers that genuinely want the full history (a site comparing its own rounds)
pass includeAllRounds.

RELEASE CONSTRAINT: the flag term only exists in profile db.9 and later. Filter
CTEs put the term id straight into SQL with no existence check, so running this
against an older db matches zero samples and empties every profile chart. This
must ship in the same change as the db: line bump in dataset/sjglobal.profile.ts.
*/
export function withLatestSubmissionFilter(filter: any, prefix: string, includeAllRounds?: boolean) {
	if (includeAllRounds) return filter
	const latestOnly = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: `${prefix}Latest_submission`, type: 'categorical' },
					values: [{ key: 'Yes' }]
				}
			}
		]
	}
	return filter ? filterJoin([filter, latestOnly]) : latestOnly
}

export function buildSitesList(samples: any[], facilityTW: any): Site[] {
	// one entry per site, not per sample — a site with several submission rounds
	// contributes several samples but must appear once in the facility dropdown
	const byValue = new Map<any, Site>()
	for (const s of samples) {
		if (!s[facilityTW.$id]) continue
		const rawValue = s[facilityTW.$id].value
		if (byValue.has(rawValue)) continue
		let label = facilityTW.term.values?.[rawValue]?.label || rawValue
		if (label.length > LABEL_MAX_LENGTH) label = label.slice(0, LABEL_TRUNCATE_AT) + '...'
		byValue.set(rawValue, { value: rawValue, label })
	}
	return [...byValue.values()]
}

export function filterSitesByUserAccess(sites: Site[], userSites: any[] | undefined): Site[] {
	// NOTE: getData() in termdb.matrix uses checkAccessToSampleData() to make sure
	// that data results are protected, as needed
	if (!userSites) return sites
	return sites.filter(s => userSites.includes(s.value))
}

export function sortSitesByLabel(sites: Site[]): Site[] {
	return [...sites].sort((a, b) => a.label.localeCompare(b.label))
}

export function pickSampleAndSite(
	query: any,
	sites: Site[],
	samplesList: any[],
	samplesByValue: Record<string, any>,
	facilityTW: any
): { sampleData: any; site: Site | undefined } {
	if ('facilitySite' in query) {
		const facilitySite = query.facilitySite || sites[0]?.value
		const sampleData = samplesList.find(s => s[facilityTW.$id]?.value == facilitySite)
		const site = sites.find(s => s.value == facilitySite)
		return { sampleData, site }
	}
	if (sites.length == 1) {
		return { sampleData: samplesByValue[sites[0].value], site: sites[0] }
	}
	return { sampleData: undefined, site: undefined }
}

export async function getScoresData(query, ds, terms) {
	// we show aggregated data for facility term, so we can ignore site-based access control
	// Only the sites need to be filtered, done below if userSites is defined
	if (!query.filterByUserSites) query.__protected__.ignoredTermIds.push(query.facilityTW.term.id)
	const { clientAuthResult, activeCohort } = query.__protected__
	const userSites = clientAuthResult[activeCohort].sites
	const prefix = query.facilityTW.term.id[0]
	const data = await getData(
		{
			terms,
			filter: withLatestSubmissionFilter(query.filter, prefix, query.includeAllRounds),
			__protected__: query.__protected__
		},
		ds
	)
	if (data.error) throw data.error

	const samples: any[] = Object.values(data.samples)
	const sites = sortSitesByLabel(filterSitesByUserAccess(buildSitesList(samples, query.facilityTW), userSites))
	const { sampleData, site } = pickSampleAndSite(query, sites, samples, data.samples, query.facilityTW)

	return { samples, sampleData, sites, site }
}
