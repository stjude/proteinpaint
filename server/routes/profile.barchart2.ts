import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

/*
Route for profileBarchart2.

Key differences from termdb.profileScores:
  - Client does NOT send facilityTW.
  - Server derives the facility term id by inspecting term ID prefixes already
    present in the request (scoreTerms or filter), so no cohort-specific logic
    is needed on the client side.
  - Site data is queried server-side using getData(), same pattern as
    termdb.profileScores.ts getScoresData().
  - Always returns aggregated (median across all eligible sites) percentages.

Mirrors profile.polar2.ts. Each bar chart row contributes term1 (objective) and
optionally term2 (subjective). The client flattens them into scoreTerms, so this
route is shape-identical to polar2's request/response.
*/

export const api: RouteApi = {
	endpoint: 'termdb/profileBarchart2Scores',
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
	const { activeCohort, clientAuthResult } = query.__protected__
	const prefix = derivePrefix(query)
	const facilityTermId = `${prefix}UNIT`

	// Minimal term wrapper — getData will fill term.values, $id, etc.
	const facilityTW: any = { term: { id: facilityTermId }, q: {} }

	// 2. Collect all terms for getData: facility + every score/maxScore pair
	const terms: any[] = [facilityTW]
	for (const t of query.scoreTerms) {
		terms.push(t.score)
		if (t.maxScore?.term) terms.push(t.maxScore)
	}

	// 3. Allow facility term to be seen by all users when not filtering by user sites
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
		sites = sites.filter(s => userSites.includes(s.value))
	}
	sites.sort((a, b) => a.label.localeCompare(b.label))

	// 6. Compute median percentage per score term across all eligible sites.
	const samples: any[] = Object.values(raw.samples)
	const eligibleSamples =
		userSites && query.filterByUserSites ? samples.filter(s => userSites.includes(s[facilityTW.$id].value)) : samples

	const term2Score: Record<string, number> = {}
	for (const d of query.scoreTerms) {
		const score = computeMedianPercentage(d, eligibleSamples)
		if (score !== null) term2Score[d.score.term.id] = score
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
 * d.maxScore can be either a number or a term wrapper.
 * Skips samples where score or maxScore are missing or maxScore is zero (to avoid NaN/Infinity).
 * Returns null when no samples have valid data for the term.
 */
function computeMedianPercentage(d: any, samples: any[]): number | null {
	const percentages: number[] = []

	for (const s of samples) {
		const scoreValue = s[d.score.$id]?.value
		if (scoreValue == null) continue

		// Resolve maxScore: either a number or a term wrapper
		let maxScoreValue: number | null = null
		if (typeof d.maxScore === 'number') {
			maxScoreValue = d.maxScore
		} else {
			// d.maxScore is a term wrapper
			maxScoreValue = s[d.maxScore.$id]?.value
		}

		// Skip if max score is null or zero (avoid NaN or Infinity)
		if (maxScoreValue == null || maxScoreValue === 0) continue

		const percentage = (scoreValue / maxScoreValue) * 100
		percentages.push(percentage)
	}

	if (percentages.length === 0) return null
	percentages.sort((a, b) => a - b)

	const mid = Math.floor(percentages.length / 2)
	const median = percentages.length % 2 !== 0 ? percentages[mid] : (percentages[mid - 1] + percentages[mid]) / 2
	return Math.round(median)
}
