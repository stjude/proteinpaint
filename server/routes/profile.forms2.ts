import type { RouteApi } from '#types'
import { ProfileForms2ScoresPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

/*
Route for profileForms2.

Key differences from termdb.profileFormScores:
  - Client does NOT send facilityTW.
  - Server derives the facility term id from query.__protected__.activeCohort
    (server-trusted; set by auth middleware). Forms scoreTerm IDs start with
    POC* and do not carry an F/A prefix, so the polar2-style term-ID scan
    would always fall back to filter terms — fragile when no filter is applied.
  - Always returns aggregated dicts across all eligible sites (no
    sampleData / single-site shortcut). For one eligible site, the aggregation
    is numerically identical to v1's sampleData branch.
  - Public-role users never see site IDs (`sites: []`).
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

/**
 * Derives the cohort prefix from the server-trusted activeCohort, which is
 * the subcohort filter's `key` value (set by auth.mayUpdate__protected__()).
 * For sjglobal: 'full' → 'F' (facility term FUNIT), 'abbrev' → 'A' (AUNIT).
 */
function derivePrefix(query: any): string {
	const cohort = query.__protected__?.activeCohort
	if (cohort === 'full') return 'F'
	if (cohort === 'abbrev') return 'A'
	throw `cannot determine cohort prefix from activeCohort=${cohort}`
}

async function getScores(query: any, ds: any) {
	const { activeCohort, clientAuthResult } = query.__protected__
	const facilityTermId = `${derivePrefix(query)}UNIT`

	// Minimal facility term wrapper — getData fills term.values, $id via termjsonByOneid
	const facilityTW: any = { term: { id: facilityTermId }, q: {} }

	// Collect all terms for getData: facility + every score term + every SC score term
	const terms: any[] = [facilityTW, ...query.scoreTerms]
	if (query.scScoreTerms) terms.push(...query.scScoreTerms)

	// Allow the facility term to be seen across all users (matches v1 behavior).
	// When filterByUserSites is true the term goes through normal access control.
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

	// Build site list (filtered to user-accessible sites if needed)
	let sites = samples.map(s => {
		const val = s[facilityTW.$id].value
		let label = facilityTW.term.values?.[val]?.label || val
		if (label.length > 50) label = label.slice(0, 47) + '...'
		return { value: val, label }
	})
	if (userSites && query.filterByUserSites) sites = sites.filter(s => userSites.includes(s.value))
	sites.sort((a, b) => a.label.localeCompare(b.label))

	// Eligible samples: only filter to userSites when filterByUserSites is explicitly true.
	// When false, facilityTW is in ignoredTermIds so getData() returns all sites; aggregate globally.
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
		// Public users never see site IDs/names
		sites: isPublic ? [] : sites,
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
		const twData = sample[tw.$id]
		const key = twData?.value
		if (!percentageDict[key]) percentageDict[key] = 0
		percentageDict[key] += 1
	}
	return percentageDict
}
