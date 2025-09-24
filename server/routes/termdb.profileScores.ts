import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
/*
Given a set of score terms, a filter, login site info, etc,
 this route returns the term scores calculated based on the samples selected by the filter.
It allows to build the profile plots based on the scores
*/

export const api: RouteApi = {
	endpoint: 'termdb/profileScores',
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
			const result: any = await getScores(req.query, ds)
			res.send(result)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

export async function getScoresData(query, ds, terms) {
	const data = await getData(
		{
			terms,
			filter: query.filter, //if site is specified, do not apply the filter that is for the aggregation
			__protected__: query.__protected__
		},
		ds
	)
	if (data.error) throw data.error
	const lst: any[] = Object.values(data.samples)
	let sites = lst.map(s => ({
		value: s[query.facilityTW.$id].value,
		label: query.facilityTW.term.values[s[query.facilityTW.$id].value]?.label || s[query.facilityTW.$id].value
	}))

	//If the user has sites keep only the sites that are visible to the user
	if (query.userSites) {
		sites = sites.filter(s => query.userSites.includes(s.value))
		if (lst.length == 1 && !sites.length) {
			const siteId: number = lst[0].sample
			const site = data.refs.bySampleId[siteId].label
			const hospital = query.facilityTW.term.values[site].label
			throw `The access to the hospital ${hospital} is denied`
		}
	}
	const samples = Object.values(data.samples)

	let sampleData
	if (query.facilitySite) sampleData = lst.find(s => s[query.facilityTW.$id].value == query.facilitySite)
	else if (sites.length == 1) sampleData = data.samples[sites[0].value]
	return { samples, sampleData, sites }
}

async function getScores(query, ds) {
	if (!query.filterByUserSites) query.__protected__.ignoredTermIds.push(query.facilityTW.term.id)
	const terms: any[] = [query.facilityTW]
	for (const term of query.scoreTerms) {
		terms.push(term.score)
		if (term.maxScore?.term) {
			terms.push(term.maxScore)
		}
	}
	const data = await getScoresData(query, ds, terms)
	const term2Score: any = {}
	for (const d of query.scoreTerms) {
		term2Score[d.score.term.id] = getPercentage(d, data.samples, data.sampleData)
	}

	const facilityValue = data.sampleData?.[query.facilityTW.$id]
	const termValue = query.facilityTW.term.values[facilityValue?.value]
	const hospital = termValue?.label || termValue?.key

	return { term2Score, sites: data.sites, hospital, n: data.sampleData ? 1 : data.samples.length }
}

function getPercentage(d, samples, sampleData) {
	if (!d) return null
	// if not specified when called (not profileRadarFacility), if a sample is loaded do not aggregate
	const isAggregate = sampleData == null
	if (isAggregate) {
		const scores = samples
			.filter(sample => sample[d.score.$id]?.value)
			.map(sample => (sample[d.score.$id].value / (sample[d.maxScore.$id]?.value || d.maxScore)) * 100)
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
