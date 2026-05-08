import type { RouteApi } from '#types'
import { ProfileForms2ScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

/*
profileForms2 route. Differs from termdb.profileFormScores:
  - Facility term id read from dataset config (plotConfigByCohort[cohort].profileForms2.facilityTW.id),
    not client-supplied or scanned from term IDs (forms2 score terms are POC*-prefixed).
  - Always aggregated across eligible sites; no sampleData shortcut.
  - Public role never sees site IDs (sites: []).

The Templates 2 picker config is read by clients directly from
termdbConfig.plotConfigByCohort[cohort].profileForms2.domains — no
helper is needed here.
*/

export const api: RouteApi = {
	endpoint: 'termdb/profileForms2Scores',
	methods: {
		get: {
			...ProfileForms2ScoresPayload,
			init
		},
		post: {
			...ProfileForms2ScoresPayload,
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
	const { activeCohort, clientAuthResult } = query.__protected__
	// Facility term id from dataset config (forms2 scoreTerms are POC*, not F*/A* — can't
	// reuse the polar2/barchart2/radar2 derivePrefix scan).
	const facilityTermId = ds.cohort.termdb.plotConfigByCohort?.[activeCohort]?.profileForms2?.facilityTW?.id
	if (!facilityTermId) throw `profileForms2.facilityTW.id missing for cohort '${activeCohort}'`

	// Minimal wrapper; getData fills term.values + $id.
	const facilityTW: any = { term: { id: facilityTermId }, q: {} }

	const terms: any[] = [facilityTW, ...query.scoreTerms]
	if (query.scScoreTerms) terms.push(...query.scScoreTerms)

	// Skip access control on facility term when aggregating globally (matches v1).
	if (!query.filterByUserSites) query.__protected__.ignoredTermIds.push(facilityTermId)

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
	const samples: any[] = Object.values(raw.samples)

	let sites = samples.map(s => {
		const val = s[facilityTW.$id].value
		let label = facilityTW.term.values?.[val]?.label || val
		if (label.length > 50) label = label.slice(0, 47) + '...'
		return { value: val, label }
	})
	if (userSites && query.filterByUserSites) sites = sites.filter(s => userSites.includes(s.value))
	sites.sort((a, b) => a.label.localeCompare(b.label))

	// Narrow eligible samples to user's sites only when filterByUserSites=true; otherwise aggregate globally.
	const eligibleSamples =
		userSites && query.filterByUserSites ? samples.filter(s => userSites.includes(s[facilityTW.$id].value)) : samples

	const term2Score: Record<string, { [k: string]: number }> = {}
	for (const d of query.scoreTerms) {
		term2Score[d.term.id] = getPercentsDict((sample: any) => getDict(d.$id, sample), eligibleSamples)
	}
	if (query.scScoreTerms) {
		for (const d of query.scScoreTerms) {
			term2Score[d.term.id] = getSCPercentsDict(d, eligibleSamples)
		}
	}

	return {
		term2Score,
		sites: isPublic ? [] : sites, // public never sees site IDs
		n: eligibleSamples.length
	}
}

function getDict(key: string, sample: any) {
	if (!sample[key]) return null
	const termData = sample[key].value
	return JSON.parse(termData)
}

function getPercentsDict(getDictFunc: (s: any) => any, samples: any[]): { [key: string]: number } {
	const percentageDict: { [key: string]: number } = {}
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

function getSCPercentsDict(tw: any, samples: any[]): { [key: string]: number } {
	if (!tw) throw 'tw not defined'
	const percentageDict: { [key: string]: number } = {}
	for (const sample of samples) {
		const key = sample[tw.$id]?.value
		if (key == null) continue // skip missing values to avoid an "undefined" bucket
		if (!percentageDict[key]) percentageDict[key] = 0
		percentageDict[key] += 1
	}
	return percentageDict
}
