import { getData } from './termdb.matrix.js'

/*
Shared helper used by the v1 profileFormScores route to fetch site/sample data
for facility-aware profile scoring.

The v1 termdb/profileScores endpoint that previously lived here was removed
when the v2 charts (polar2/barchart2/radar2/radarFacility2) moved to their
own dedicated routes. termdb/profileFormScores is the last consumer; once
forms2 ships, this helper can move into that route or be deleted.
*/

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
	const lst: any[] = Object.values(data.samples)
	let sites = lst.map(s => {
		let label = query.facilityTW.term.values[s[query.facilityTW.$id].value]?.label || s[query.facilityTW.$id].value
		if (label.length > 50) label = label.slice(0, 47) + '...' //truncate long labels
		return {
			value: s[query.facilityTW.$id].value,
			label
		}
	})
	//If the user has sites keep only the sites that are visible to the user as choices for selection
	if (userSites) {
		// NOTE: getData() in termdb.matrix uses checkAccessToSampleData() to make sure
		// that data results are protected, as needed
		sites = sites.filter(s => userSites.includes(s.value))
	}
	sites.sort((a, b) => {
		return a.label.localeCompare(b.label)
	})
	const samples = Object.values(data.samples)
	let sampleData, site
	if ('facilitySite' in query) {
		const facilitySite = query.facilitySite || sites[0].value
		const index = lst.findIndex(s => s[query.facilityTW.$id].value == facilitySite)
		sampleData = lst[index]
		site = sites.find(s => s.value == facilitySite)
	} else if (sites.length == 1) {
		sampleData = data.samples[sites[0].value]
		site = sites[0]
	}

	return { samples, sampleData, sites, site }
}
