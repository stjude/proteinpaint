import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

/*
Route for profileRadar2.

Mirrors profile.polar2.ts / profile.barchart2.ts. Each radar row contributes
term1 and term2 (the two comparison series). The client flattens them into
scoreTerms, so this route is shape-identical to polar2/barchart2's request/response.

Key differences from termdb.profileScores (the shared v1 route):
  - Client does NOT send facilityTW — server derives it from term ID prefixes.
  - Always returns aggregated (median across eligible sites).
  - Public role: sites is always [].
  - Zero-score sites included in the median (via != null filter).
*/

export const api: RouteApi = {
	endpoint: 'termdb/profileRadar2Scores',
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
 * Primary source: scoreTerms (always present). Fallback: filter term IDs.
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
	const { activeCohort, clientAuthResult } = query.__protected__
	const prefix = derivePrefix(query)
	const facilityTermId = `${prefix}UNIT`

	const facilityTW: any = { term: { id: facilityTermId }, q: {} }

	const terms: any[] = [facilityTW]
	for (const t of query.scoreTerms) {
		terms.push(t.score)
		if (t.maxScore?.term) terms.push(t.maxScore)
	}

	if (!query.filterByUserSites) {
		query.__protected__.ignoredTermIds.push(facilityTermId)
	}

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
		sites: isPublic ? [] : sites,
		n: eligibleSamples.length
	}
}

/**
 * For each sample, computes (score / maxScore) * 100.
 * d.maxScore is either a term wrapper or a raw number (radar's Impressions
 * options use maxScore: 10 as a number instead of a term reference).
 * Skips samples where score is missing or maxScore is zero/null (avoid NaN/Infinity).
 * Includes zero-score sites in the median (!= null filter, not truthy).
 */
function computeMedianPercentage(d: any, samples: any[]): number | null {
	const percentages: number[] = []

	for (const s of samples) {
		const scoreValue = s[d.score.$id]?.value
		if (scoreValue == null) continue

		let maxScoreValue: number | null = null
		if (typeof d.maxScore === 'number') {
			maxScoreValue = d.maxScore
		} else {
			maxScoreValue = s[d.maxScore.$id]?.value
		}

		if (maxScoreValue == null || maxScoreValue === 0) continue

		percentages.push((scoreValue / maxScoreValue) * 100)
	}

	if (percentages.length === 0) return null
	percentages.sort((a, b) => a - b)

	const mid = Math.floor(percentages.length / 2)
	const median = percentages.length % 2 !== 0 ? percentages[mid] : (percentages[mid - 1] + percentages[mid]) / 2
	return Math.round(median)
}
