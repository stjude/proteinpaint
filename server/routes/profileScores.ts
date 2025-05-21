import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

export const api: RouteApi = {
	endpoint: 'profileScores',
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
			const result: any = await getScores(req.query, ds, g)
			res.send({ ...result })
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getScores(query, ds, genome) {
	const data = await getData(
		{
			terms: query.terms
		},
		ds,
		genome
	)
	const samples = Object.values(data.samples)
	const tw2Score: any = {}
	for (const d of query.scoreTerms) {
		tw2Score[d.score.term.id] = getPercentage(d, samples, null, query.isAggregate)
	}
	return tw2Score
}

function getPercentage(d, samples, sampleData, isAggregate: any = null) {
	if (!d) return null
	if (isAggregate == null)
		// if not specified when called (not profileRadarFacility), if a sample is loaded do not aggregate
		isAggregate = sampleData == null
	if (isAggregate) {
		const maxScore = d.maxScore.term ? samples[0]?.[d.maxScore.$id]?.value : d.maxScore
		const scores = samples.map(sample => (sample[d.score.$id]?.value / maxScore) * 100)
		scores.sort((s1, s2) => s1 - s2)
		const middle = Math.floor(scores.length / 2)
		const score = scores.length % 2 !== 0 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2
		return Math.round(score)
	} else {
		const score = sampleData[d.score.$id]?.value
		const maxScore = d.maxScore.term ? sampleData[d.maxScore.$id]?.value : d.maxScore //if maxScore is not a term, it is a number
		const percentage = (score / maxScore) * 100
		return Math.round(percentage)
	}
}
