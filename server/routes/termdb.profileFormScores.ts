import type { RouteApi } from '#types'
import { ProfileFormScoresPayload } from '#types/checkers'
import { getScoresData } from './termdb.profileScores.ts'

/*
Given a set of multivalue score terms, a filter, login site info, etc.,
 this route returns the  scores dictionary for each term. The dict is calculated based on the samples selected by the filter.
It allows to build the profile forms based on the number of people who selected an answer to a question/term for a given site/hospital
*/
export const api: RouteApi = {
	endpoint: 'termdb/profileFormScores',
	methods: {
		get: {
			...ProfileFormScoresPayload,
			init
		},
		post: {
			...ProfileFormScoresPayload,
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
			const result: any = await getScoresDict(req.query, ds)
			res.send(result)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getScoresDict(query, ds) {
	const terms = [...query.scoreTerms, query.facilityTW]
	if (query.scScoreTerms) terms.push(...query.scScoreTerms)

	const data = await getScoresData(query, ds, terms)
	const term2Score: any = {}
	for (const d of query.scoreTerms) {
		const getDictFunc = (sample: any) => getDict(d.$id, sample)
		const percents: { [key: string]: number } = getPercentsDict(getDictFunc, data.samples)
		term2Score[d.term.id] = percents
	}
	if (query.scScoreTerms)
		for (const d of query.scScoreTerms) {
			const percents: { [key: string]: number } = getSCPercentsDict(d, data.samples)
			term2Score[d.term.id] = percents
		}
	const facilityValue = data.sampleData?.[query.facilityTW.$id]
	const termValue = query.facilityTW.term.values[facilityValue?.value]
	const hospital = termValue?.label || termValue?.key

	return { term2Score, sites: data.sites, hospital, n: data.sampleData ? 1 : data.samples.length }
}

function getDict(key, sample) {
	if (!sample[key]) return null
	const termData = sample[key].value
	return JSON.parse(termData)
}

function getPercentsDict(getDictFunc, samples): { [key: string]: number } {
	const percentageDict = {}
	for (const sample of samples) {
		const percents: { [key: string]: number } = getDictFunc(sample)
		if (!percents) continue
		for (const key in percents) {
			const value = percents[key]
			if (!percentageDict[key]) percentageDict[key] = 0
			percentageDict[key] += value
		}
	}
	return percentageDict
}

function getSCPercentsDict(tw, samples): { [key: string]: number } {
	if (!tw) throw 'tw not defined'
	//not specified when called
	//if defined in the settings a site is provided and the user can decide what to see, otherwise it is admin view and if the site was set sampleData is not null
	const percentageDict = {}
	for (const sample of samples) {
		const twData = sample[tw.$id]
		const key = twData?.value
		if (!percentageDict[key]) percentageDict[key] = 0
		percentageDict[key] += 1
	}
	return percentageDict
}
