import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getScoresData } from './termdb.profileScores.js'

/*
Clean route for profilePolar2.
Reuses getScoresData() from termdb.profileScores for data retrieval,
then runs the same median-based percentage calculation in a typed, explicit form.
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

async function getScores(query: any, ds: any) {
	// Collect all terms needed for the data fetch: facility + score pairs
	const terms: any[] = [query.facilityTW]
	for (const term of query.scoreTerms) {
		terms.push(term.score)
		if (term.maxScore?.term) terms.push(term.maxScore)
	}

	const data = await getScoresData(query, ds, terms)

	const term2Score: Record<string, number | null> = {}
	for (const d of query.scoreTerms) {
		term2Score[d.score.term.id] = computePercentage(d, data.samples, data.sampleData)
	}

	return {
		term2Score,
		sites: data.sites,
		site: data.site,
		n: data.sampleData ? 1 : data.samples.length
	}
}

/**
 * Aggregate mode (no specific facility):
 *   Computes (score / maxScore) * 100 for every sample, then returns the median.
 *
 * Single-facility mode (sampleData is set):
 *   Returns (score / maxScore) * 100 for that one facility, rounded.
 */
function computePercentage(d: any, samples: any[], sampleData: any): number | null {
	if (!d) return null

	if (sampleData == null) {
		// Aggregate: collect per-site percentages, sort, take median
		const percentages = samples
			.filter(s => s[d.score.$id]?.value)
			.map(s => (s[d.score.$id].value / (s[d.maxScore.$id]?.value || d.maxScore)) * 100)

		if (percentages.length === 0) return null
		percentages.sort((a, b) => a - b)

		const mid = Math.floor(percentages.length / 2)
		const median = percentages.length % 2 !== 0 ? percentages[mid] : (percentages[mid - 1] + percentages[mid]) / 2

		return Math.round(median)
	} else {
		// Single facility
		const score = sampleData[d.score.$id]?.value
		const maxScore = d.maxScore.term ? sampleData[d.maxScore.$id]?.value : d.maxScore
		if (!score || !maxScore) return null
		return Math.round((score / maxScore) * 100)
	}
}
