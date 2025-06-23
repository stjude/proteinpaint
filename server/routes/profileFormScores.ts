import type { RouteApi } from '#types'
import { ProfileScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

export const api: RouteApi = {
	endpoint: 'profileFormScores',
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
			const result: any = await getScoresDict(req.query, ds, g)
			res.send(result)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getScoresDict(query, ds, genome) {
	const data = await getData(
		{
			terms: [...query.scoreTerms, ...query.scScoreTerms],
			filter: query.filter //if isRadarFacility and site is specified, do not apply the filter
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
	let userSite
	if (query.userSites) {
		const siteName = query.userSites[0]
		userSite = ds.sampleName2Id.get(siteName)
		if (!userSite) {
			throw `Invalid user site: ${siteName}`
		}
	}
	const site = query.isAggregate ? query.site : userSite
	const sampleData = data.samples[site] || null
	const samples = Object.values(data.samples)
	const term2Score: any = {}
	for (const d of query.scoreTerms) {
		const samples = sampleData ? [sampleData] : Object.values(data.samples)
		const getDictFunc = (sample: any) => getDict(d.$id, sample)
		const percents: { [key: string]: number } = getPercentsDict(getDictFunc, samples)
		term2Score[d.term.id] = percents
	}
	for (const d of query.scScoreTerms) {
		const samples = sampleData ? [sampleData] : Object.values(data.samples)
		const percents: { [key: string]: number } = getSCPercentsDict(d, samples)
		term2Score[d.term.id] = percents
	}

	const hospital = sampleData?.[query.facilityTW.$id]?.value

	return { term2Score, sites, hospital, n: samples.length }
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
