import { getData } from './termdb.matrix.js'

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

export function buildSitesList(samples: any[], facilityTW: any): Site[] {
	return samples
		.filter(s => s[facilityTW.$id])
		.map(s => {
			const rawValue = s[facilityTW.$id].value
			let label = facilityTW.term.values[rawValue]?.label || rawValue
			if (label.length > LABEL_MAX_LENGTH) label = label.slice(0, LABEL_TRUNCATE_AT) + '...'
			return { value: rawValue, label }
		})
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
	const data = await getData(
		{
			terms,
			filter: query.filter,
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
