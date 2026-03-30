import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

/*
Route for profilePolar2.

Key differences from termdb.profileScores:
  - Client does NOT send facilityTW.
  - Server derives the facility term id by inspecting term ID prefixes already
    present in the request (scoreTerms or filter), so no cohort-specific logic
    is needed on the client side.
  - Site data is queried server-side using getData(), same pattern as
    termdb.profileScores.ts getScoresData().
  - Always returns aggregated (median across all eligible sites) percentages.
*/

export const api: RouteApi = {
	endpoint: 'termdb/profilePolar2Scores',
	methods: {
		get: {
			...ProfileScoresPayload,
			init
		},
		post: {
			...ProfileScoresPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets?.[req.query.dslabel]
			const result = await getScores(req.query, ds)
			res.send(result)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

/**
 * Derives the cohort prefix from term IDs already present in the request.
 * Primary source: scoreTerms (always present in the request).
 * Fallback: filter term IDs (may be absent if no filters are applied).
 * Term IDs share the same prefix as the facility term for a given cohort.
 */
function derivePrefix(query: any): string {
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

async function getScores(query: any, ds: any) {
	// 1. Derive facility term id from term IDs already in the request.
	//    scoreTerms and filter terms share the same cohort prefix as the facility term,
	//    so no client-supplied facilityTW is needed.
	const { activeCohort, clientAuthResult } = query.__protected__ // still needed for auth
	const prefix = derivePrefix(query)
	const facilityTermId = `${prefix}UNIT`

	// Minimal term wrapper — getData will fill term.values, $id, etc.
	// via ds.cohort.termdb.q.termjsonByOneid(facilityTermId)
	const facilityTW: any = { term: { id: facilityTermId }, q: {} }

	// 2. Collect all terms for getData: facility + every score/maxScore pair
	const terms: any[] = [facilityTW]
	for (const t of query.scoreTerms) {
		terms.push(t.score)
		if (t.maxScore?.term) terms.push(t.maxScore)
	}

	// 3. Allow facility term to be seen by all users (same logic as existing route)
	if (!query.filterByUserSites) {
		query.__protected__.ignoredTermIds.push(facilityTermId)
	}

	// 4. Query eligible site data at module level
	const cohortAuth = clientAuthResult[activeCohort]
	const isPublic = !cohortAuth?.role || cohortAuth.role === 'public'
	const userSites = cohortAuth?.sites
	const raw = await getData(
		{
			terms,
			filter: query.filter,
			__protected__: query.__protected__
		},
		ds
	)
	if (raw.error) throw raw.error

	// 5. Build eligible sites list (filter to user's accessible sites if needed)
	const sampleList: any[] = Object.values(raw.samples)
	let sites = sampleList.map(s => {
		const val = s[facilityTW.$id].value
		let label = facilityTW.term.values?.[val]?.label || val
		if (label.length > 50) label = label.slice(0, 47) + '...'
		return { value: val, label }
	})
	if (userSites && query.filterByUserSites) {
		// getData() already enforces access control via checkAccessToSampleData();
		// this further narrows the site list to what the user is authorised to see
		sites = sites.filter(s => userSites.includes(s.value))
	}
	sites.sort((a, b) => a.label.localeCompare(b.label))

	// 6. Compute median percentage per module across all eligible sites.
	//    When only one site is accessible (sites.length == 1) the median of a
	//    single value equals that value — identical to the old route's sampleData shortcut.
	const samples: any[] = Object.values(raw.samples)
	// Only filter to userSites when filterByUserSites is explicitly enabled.
	// When filterByUserSites is false, facilityTW is in ignoredTermIds so getData()
	// returns all sites — median should be computed across all sites (global aggregate)
	const eligibleSamples =
		userSites && query.filterByUserSites ? samples.filter(s => userSites.includes(s[facilityTW.$id].value)) : samples

	const term2Score: Record<string, number | null> = {}
	for (const d of query.scoreTerms) {
		term2Score[d.score.term.id] = computeMedianPercentage(d, eligibleSamples)
	}

	return {
		term2Score,
		// Public users see only aggregated scores — do not expose site IDs or names
		sites: isPublic ? [] : sites,
		n: eligibleSamples.length
	}
}

/**
 * For each sample (site), computes (score / maxScore) * 100,
 * collects all values, sorts them, and returns the median — rounded to integer.
 * Returns null when no samples have data for the term.
 */
function computeMedianPercentage(d: any, samples: any[]): number | null {
	const percentages = samples
		.filter(s => s[d.score.$id]?.value)
		.map(s => (s[d.score.$id].value / (s[d.maxScore.$id]?.value || d.maxScore)) * 100)

	if (percentages.length === 0) return null
	percentages.sort((a, b) => a - b)

	const mid = Math.floor(percentages.length / 2)
	const median = percentages.length % 2 !== 0 ? percentages[mid] : (percentages[mid - 1] + percentages[mid]) / 2
	return Math.round(median)
}
