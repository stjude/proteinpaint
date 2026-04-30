import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

/*
Route for profileRadarFacility2.

Unlike polar2/barchart2/radar2 which are aggregate-only, this route returns
BOTH the aggregate median (the "Global" line) AND a single-site row (the
"Facility" line) in ONE response, cutting v1's two-request pattern down to one.

Response shape:
  {
    term2Score: { [scoreTermId]: median 0-100 },    // aggregate median
    sampleData: {
      term2Score: { [scoreTermId]: 0-100 },         // single-site raw percentage
      site:        { value, label }                  // the facility being shown
    },
    sites: [ {value, label}, ... ],                  // for the facility dropdown
    n: eligibleCount
  }

Key differences from termdb.profileScores:
  - Client does NOT send facilityTW — server derives from term ID prefixes.
  - Minimal client payload (scoreTerms stripped to { term: { id }, q }).
  - Zero-score sites included in the median (!= null, not truthy).
  - Public role: sites always [] and sampleData undefined (defense-in-depth;
    the chart is also gated by isSupportedChartOverride).
*/

export const api: RouteApi = {
	endpoint: 'termdb/profileRadarFacility2Scores',
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

	// Allow the facility term to be read across all eligible sites for the aggregate.
	// filterByUserSites narrows the median to the user's own sites when true.
	if (!query.filterByUserSites) {
		query.__protected__.ignoredTermIds.push(facilityTermId)
	}

	const cohortAuth = clientAuthResult[activeCohort]
	const isPublic = !cohortAuth?.role || cohortAuth.role === 'public'
	const isAdmin = cohortAuth?.role === 'admin'
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

	const samples: any[] = Object.values(raw.samples)

	// Build the sites list — user sees their own accessible sites; admin sees all.
	let sites = samples.map(s => {
		const val = s[facilityTW.$id].value
		let label = facilityTW.term.values?.[val]?.label || val
		if (label.length > 50) label = label.slice(0, 47) + '...'
		return { value: val, label }
	})
	if (userSites && !isAdmin) {
		sites = sites.filter(s => userSites.includes(s.value))
	}
	sites.sort((a, b) => a.label.localeCompare(b.label))

	// Aggregate median — scope depends on filterByUserSites
	const eligibleSamples =
		userSites && query.filterByUserSites ? samples.filter(s => userSites.includes(s[facilityTW.$id].value)) : samples

	const aggregateScore: Record<string, number> = {}
	for (const d of query.scoreTerms) {
		const score = computeMedianPercentage(d, eligibleSamples)
		if (score !== null) aggregateScore[d.score.term.id] = score
	}

	// Pick the facility site to return as sampleData.
	// Admin: user-picked via query.facilitySite, else first from sorted site list.
	// Site-user: user-picked if it's in their sites, else first of their sites.
	let targetSiteValue: any = null
	if (query.facilitySite) {
		if (isAdmin) targetSiteValue = query.facilitySite
		else if (userSites?.includes(query.facilitySite)) targetSiteValue = query.facilitySite
	}
	if (!targetSiteValue && sites.length > 0) targetSiteValue = sites[0].value

	let sampleData: any = undefined
	if (!isPublic && targetSiteValue) {
		const sampleRow = samples.find(s => s[facilityTW.$id].value == targetSiteValue)
		if (sampleRow) {
			const site = sites.find(s => s.value == targetSiteValue) || {
				value: targetSiteValue,
				label: facilityTW.term.values?.[targetSiteValue]?.label || targetSiteValue
			}
			const singleSiteScore: Record<string, number> = {}
			for (const d of query.scoreTerms) {
				const percent = computeSinglePercentage(d, sampleRow)
				if (percent !== null) singleSiteScore[d.score.term.id] = percent
			}
			// Keep sampleData shape compatible with v1 (term2Score + site + sites) so the base
			// class's isRadarFacility dropdown logic can consume it unchanged.
			sampleData = { term2Score: singleSiteScore, site, sites, n: 1 }
		}
	}

	return {
		term2Score: aggregateScore,
		sampleData,
		// Public users: empty (chart should be unreachable anyway via isSupportedChartOverride)
		sites: isPublic ? [] : sites,
		n: eligibleSamples.length
	}
}

/**
 * For a single sample, compute (score / maxScore) * 100.
 * Returns null if score is missing or maxScore is null/zero.
 */
function computeSinglePercentage(d: any, sample: any): number | null {
	const scoreValue = sample[d.score.$id]?.value
	if (scoreValue == null) return null

	let maxScoreValue: number | null = null
	if (typeof d.maxScore === 'number') {
		maxScoreValue = d.maxScore
	} else {
		maxScoreValue = sample[d.maxScore.$id]?.value
	}
	if (maxScoreValue == null || maxScoreValue === 0) return null

	return Math.round((scoreValue / maxScoreValue) * 100)
}

/**
 * Median of (score/maxScore)*100 across samples. Zero-score sites included.
 * Matches polar2/barchart2/radar2 implementations.
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
