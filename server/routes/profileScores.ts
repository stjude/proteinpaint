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
	const isRadarFacility = query.isRadarFacility
	const terms: any[] = [query.facilityTW]
	for (const term of query.scoreTerms) {
		terms.push(term.score)
		if (term.maxScore) {
			terms.push(term.maxScore)
		}
	}
	const data = await getData(
		{
			terms,
			filter: isRadarFacility && query.site ? undefined : query.filter //if isRadarFacility and site is specified, do not apply the filter
		},
		ds,
		genome
	)
	const lst = Object.values(data.samples)
	let sites = lst.map((s: any) => {
		return { label: data.refs.bySampleId[s.sample].label, value: s.sample }
	})
	//The site in the facility radar is not dependent on the other filters

	sites = lst.map((s: any) => {
		return { label: data.refs.bySampleId[s.sample].label, value: s.sample }
	})

	//If the user has sites keep only the sites that are visible to the user
	if (query.userSites) {
		sites = sites.filter(s => query.userSites.includes(s.label))
	}
	let userSite
	if (query.userSites) {
		const siteName = query.userSites[0]
		userSite = ds.sampleName2Id.get(siteName)
		if (!userSite) {
			throw `Invalid user site: ${siteName}`
		}
	}
	let sitesSelected: any[] = []
	if (isRadarFacility) sitesSelected = query.sites
	else sitesSelected = query.isAggregate ? query.sites : [userSite]
	const sampleData = sitesSelected?.length == 1 ? data.samples[sitesSelected[0]] : null
	let samples = Object.values(data.samples)
	if (sitesSelected?.length > 0) samples = samples.filter((s: any) => sitesSelected.includes(s.sample))
	const term2Score: any = {}
	for (const d of query.scoreTerms) {
		term2Score[d.score.term.id] = getPercentage(d, samples, sampleData)
	}

	const hospital = sampleData?.[query.facilityTW.$id]?.value

	return { term2Score, sites, hospital, n: samples.length }
}

function getPercentage(d, samples, sampleData) {
	if (!d) return null
	// if not specified when called (not profileRadarFacility), if a sample is loaded do not aggregate
	const isAggregate = sampleData == null
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
