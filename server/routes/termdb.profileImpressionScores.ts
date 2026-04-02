import type { RouteApi } from '#types'
import { ProfileImpressionScoresPayload } from '#types/checkers'
import { getScoresData } from './termdb.profileScores.ts'

/*
Given a set of integer impression terms, a filter, login site info, etc.,
this route returns per-site scores and median for each impression term.
Used by the profileForms Impressions tab (thermometer + heatmap visualizations).
*/
export const api: RouteApi = {
	endpoint: 'termdb/profileImpressionScores',
	methods: {
		get: {
			...ProfileImpressionScoresPayload,
			init
		},
		post: {
			...ProfileImpressionScoresPayload,
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
			const result: any = await getImpressionScores(req.query, ds)
			res.send(result)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getImpressionScores(query, ds) {
	const terms = [...query.impressionTerms, query.facilityTW]
	const data = await getScoresData(query, ds, terms)

	const { clientAuthResult, activeCohort } = query.__protected__
	const isPublic = !clientAuthResult[activeCohort]?.role || clientAuthResult[activeCohort].role === 'public'
	const userSites = clientAuthResult[activeCohort]?.sites

	const term2Scores: any = {}
	for (const d of query.impressionTerms) {
		const values: { siteId: string; siteLabel: string; value: number }[] = []
		const rawValues: number[] = []

		for (const sample of data.samples) {
			const termData = sample[d.$id]
			if (!termData || termData.value == null) continue
			const value = Number(termData.value)
			if (isNaN(value)) continue

			const facilityData = sample[query.facilityTW.$id]
			const siteId = facilityData?.value || ''
			const siteLabel = query.facilityTW.term.values?.[siteId]?.label || siteId
			values.push({ siteId, siteLabel, value })
			rawValues.push(value)
		}

		// Calculate median from all samples (aggregate stat is safe for all roles)
		rawValues.sort((a, b) => a - b)
		let median = 0
		if (rawValues.length > 0) {
			const mid = Math.floor(rawValues.length / 2)
			median = rawValues.length % 2 !== 0 ? rawValues[mid] : (rawValues[mid - 1] + rawValues[mid]) / 2
		}

		if (isPublic) {
			// Public users: only see median, no per-site data
			term2Scores[d.term.id] = { median, values: [] }
		} else if (userSites) {
			// Users with site-limited access: only see their authorized sites
			term2Scores[d.term.id] = {
				median,
				values: values.filter(v => userSites.includes(v.siteId))
			}
		} else {
			// Admin users: see all sites
			term2Scores[d.term.id] = { median, values }
		}
	}

	let hospital: string | undefined
	if (!isPublic && data.sampleData) {
		const facilityValue = data.sampleData[query.facilityTW.$id]
		const termValue = query.facilityTW.term.values[facilityValue?.value]
		hospital = termValue?.label || termValue?.key
	}

	return {
		term2Scores,
		// Do not expose individual site IDs or names to public-role users
		sites: isPublic ? [] : data.sites,
		hospital,
		n: data.sampleData ? 1 : data.samples.length
	}
}
