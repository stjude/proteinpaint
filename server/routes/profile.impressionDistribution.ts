import type { RouteApi } from '#types'
import { ProfileImpressionDistributionPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'

/*
Route for the per-module impression thermometer rendered inside profileForms
when the user clicks an "__Impression" domain.

Request takes a single SC term id and a single POC term id (children of
F<Component>__<Module>__Impression). Both are scalar (integer/float).

Returns:
  - scMedian: median SC rating across eligible sites (rounded to nearest int)
  - pocMedian: median POC rating across eligible sites
  - pocDistribution: per-rating count + pct (rating values rounded to int 1..maxScore)
  - sites + n: same convention as profile.polar2

Mirrors the auth/site-eligibility pattern from profile.polar2.ts.
*/

export const api: RouteApi = {
	endpoint: 'termdb/profileImpressionDistribution',
	methods: {
		get: {
			...ProfileImpressionDistributionPayload,
			init
		},
		post: {
			...ProfileImpressionDistributionPayload,
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
			const result = await getDistribution(req.query, ds)
			res.send(result)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

function derivePrefix(query: any): string {
	const id = query.scTermId || query.pocTermId
	if (id?.startsWith('F')) return 'F'
	if (id?.startsWith('A')) return 'A'
	for (const entry of query.filter?.lst || []) {
		const fid = entry.tvs?.term?.id
		if (fid?.startsWith('F')) return 'F'
		if (fid?.startsWith('A')) return 'A'
	}
	throw 'cannot determine cohort prefix from request term IDs'
}

async function getDistribution(query: any, ds: any) {
	const { activeCohort, clientAuthResult } = query.__protected__
	const prefix = derivePrefix(query)
	const facilityTermId = `${prefix}UNIT`
	const facilityTW: any = { term: { id: facilityTermId }, q: {} }
	const scTW: any = { term: { id: query.scTermId }, q: { mode: 'continuous' } }
	// SC-only mode (e.g. Patients & Outcomes): pocTermId is omitted by the client
	// when the module has no POC term. Server returns pocTotal=0/pocMedian=null/
	// pocDistribution=[] and the renderer hides the POC-side visuals.
	const pocTW: any = query.pocTermId ? { term: { id: query.pocTermId }, q: { mode: 'continuous' } } : null
	const maxScore: number = Number(query.maxScore) || 10

	if (!query.filterByUserSites) {
		query.__protected__.ignoredTermIds.push(facilityTermId)
	}

	const cohortAuth = clientAuthResult[activeCohort]
	const isPublic = !cohortAuth?.role || cohortAuth.role === 'public'
	const userSites = cohortAuth?.sites

	const terms: any[] = [facilityTW, scTW]
	if (pocTW) terms.push(pocTW)
	const raw = await getData(
		{
			terms,
			filter: query.filter,
			__protected__: query.__protected__
		},
		ds
	)
	if (raw.error) throw raw.error

	const sampleList: any[] = Object.values(raw.samples)
	let sites = sampleList.map(s => {
		const val = s[facilityTW.$id].value
		let label = facilityTW.term.values?.[val]?.label || val
		if (label.length > 50) label = label.slice(0, 47) + '...'
		return { value: val, label }
	})
	if (userSites && query.filterByUserSites) {
		sites = sites.filter(s => userSites.includes(s.value))
	}
	sites.sort((a, b) => a.label.localeCompare(b.label))

	const eligibleSamples =
		userSites && query.filterByUserSites
			? sampleList.filter(s => userSites.includes(s[facilityTW.$id].value))
			: sampleList

	const scValues = collectScalarValues(eligibleSamples, scTW.$id)
	const pocValues = pocTW ? collectScalarValues(eligibleSamples, pocTW.$id) : []

	return {
		scMedian: median(scValues),
		scTotal: scValues.length,
		pocMedian: pocTW ? median(pocValues) : null,
		pocTotal: pocValues.length,
		pocDistribution: pocTW ? buildDistribution(pocValues, maxScore) : [],
		sites: isPublic ? [] : sites,
		n: eligibleSamples.length
	}
}

function collectScalarValues(samples: any[], $id: string): number[] {
	const out: number[] = []
	for (const s of samples) {
		const cell = s[$id]
		if (!cell) continue
		// Prefer .value (single scalar). For multivalue terms (defensive — these
		// SC/POC impression terms are integer/float, not multivalue) flatten .values.
		if (cell.value != null && typeof cell.value !== 'object') {
			const n = Number(cell.value)
			if (Number.isFinite(n)) out.push(n)
		} else if (Array.isArray(cell.values)) {
			for (const v of cell.values) {
				const n = Number(v?.value)
				if (Number.isFinite(n)) out.push(n)
			}
		}
	}
	return out
}

function median(values: number[]): number | null {
	if (values.length === 0) return null
	const sorted = [...values].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	const m = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
	return Math.round(m)
}

function buildDistribution(values: number[], maxScore: number): { rating: number; count: number; pct: number }[] {
	const total = values.length
	const counts: Record<number, number> = {}
	for (let r = 1; r <= maxScore; r++) counts[r] = 0
	for (const v of values) {
		const r = Math.round(v)
		if (r >= 1 && r <= maxScore) counts[r] += 1
	}
	const out: { rating: number; count: number; pct: number }[] = []
	for (let r = 1; r <= maxScore; r++) {
		const count = counts[r]
		const pct = total > 0 ? (count / total) * 100 : 0
		out.push({ rating: r, count, pct: Math.round(pct * 10) / 10 })
	}
	return out
}
