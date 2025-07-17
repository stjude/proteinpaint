import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
/*
Given a set of score terms, a filter, login site info, etc,
 this route returns the term scores calculated based on the samples selected by the filter.
It allows to build the profile plots based on the scores
*/

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
			res.send(result)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getScores(query, ds, genome) {
	const terms: any[] = [query.facilityTW]
	for (const term of query.scoreTerms) {
		terms.push(term.score)
		if (term.maxScore?.term) {
			terms.push(term.maxScore)
		}
	}

	const data = await getData(
		{
			terms,
			filter: query.site || !query.isAggregate ? undefined : query.filter //if site is specified, do not apply the filter that is for the aggregation
		},
		ds,
		genome
	)
	const lst = Object.values(data.samples)
	let sites = lst.map((s: any) => {
		return { label: data.refs.bySampleId[s.sample].label, value: s.sample }
	})

	sites = lst.map((s: any) => {
		return { label: data.refs.bySampleId[s.sample].label, value: s.sample }
	})

	//If the user has sites keep only the sites that are visible to the user
	if (query.userSites) {
		sites = sites.filter(s => query.userSites.includes(s.label))
	}

	let sitesSelected: any[] = []
	if (query.site) sitesSelected = [query.site]
	else if (!query.isAggregate) sitesSelected = [sites[0].value] //only one site selected
	else sitesSelected = query.sites
	const sampleData = sitesSelected?.length == 1 ? data.samples[sitesSelected[0]] : null
	let samples = Object.values(data.samples)
	if (sitesSelected?.length > 0) samples = samples.filter((s: any) => sitesSelected.includes(s.sample))
	const term2Score: any = {}
	for (const d of query.scoreTerms) {
		term2Score[d.score.term.id] = getPercentage(d, samples, sampleData)
	}

	const hospital = sampleData?.[query.facilityTW.$id]?.value

	return { term2Score, sites, hospital, n: sampleData ? 1 : samples.length }
}

function getPercentage(d, samples, sampleData) {
	if (!d) return null
	// if not specified when called (not profileRadarFacility), if a sample is loaded do not aggregate
	const isAggregate = sampleData == null
	if (isAggregate) {
		const scores = samples.map(
			sample => (sample[d.score.$id].value / (sample[d.maxScore.$id]?.value || d.maxScore)) * 100
		)
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
