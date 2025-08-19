import type { RouteApi } from '#types'
import { ProfileFormScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

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
	if (!query.filterByUserSites) query.__protected__.ignoredTermIds.push(query.facilityTW.term.id)
	const terms = [...query.scoreTerms, query.facilityTW]
	if (query.scScoreTerms) terms.push(...query.scScoreTerms)

	const data = await getData(
		{
			terms,
			filter: query.site || !query.isAggregate ? undefined : query.filter, //if isRadarFacility and site is specified, do not apply the filter
			__protected__: query.__protected__
		},
		ds
	)
	const lst: any[] = Object.values(data.samples)
	let sites = lst.map((s: any) => {
		return { label: data.refs.bySampleId[s.sample].label, value: s.sample }
	})

	sites = lst.map((s: any) => {
		return { label: data.refs.bySampleId[s.sample].label, value: s.sample }
	})
	if (query.userSites) {
		sites = sites.filter(s => query.userSites.includes(s.label))
		if (lst.length == 1 && !sites.length) {
			const siteId: number = lst[0].sample
			const site = data.refs.bySampleId[siteId].label
			const hospital = query.facilityTW.term.values[site].label
			throw `The access to the hospital ${hospital} is denied`
		}
	}

	let sitesSelected: any[] = []
	if (query.site) sitesSelected = [query.site]
	else if (!query.isAggregate) sitesSelected = [sites[0].value] //only one site selected
	else sitesSelected = query.sites
	const sampleData = sitesSelected?.length == 1 ? data.samples[sitesSelected[0]] : null
	let samples = sampleData ? [sampleData] : Object.values(data.samples)
	if (sitesSelected?.length > 0) samples = samples.filter((s: any) => sitesSelected.includes(s.sample))

	const term2Score: any = {}
	for (const d of query.scoreTerms) {
		const getDictFunc = (sample: any) => getDict(d.$id, sample)
		const percents: { [key: string]: number } = getPercentsDict(getDictFunc, samples)
		term2Score[d.term.id] = percents
	}
	if (query.scScoreTerms)
		for (const d of query.scScoreTerms) {
			const percents: { [key: string]: number } = getSCPercentsDict(d, samples)
			term2Score[d.term.id] = percents
		}
	const facilityValue = sampleData?.[query.facilityTW.$id]
	const termValue = query.facilityTW.term.values[facilityValue?.value]
	const hospital = termValue?.label || termValue?.key

	return { term2Score, sites, hospital, n: sampleData ? 1 : samples.length }
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
