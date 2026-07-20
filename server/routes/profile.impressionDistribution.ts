import type { RouteApi } from '#types'
import { ProfileImpressionDistributionPayload } from '../../shared/types/src/routes/termdb.profileImpressionDistribution'
import { getData } from '../src/termdb.matrix.js'

/*
Route for the per-module impression thermometer rendered inside profileForms
when the user clicks an "__Impression" domain.

Request takes a single SC term id and a single POC term id (children of
F<Component>__<Module>__Impression). Both are scalar (integer/float).

Returns:
  - scMedian: median SC rating across eligible sites (rounded to nearest int)
  - scDistribution: SC site counts binned per rating (1..maxScore) — the SC line series
  - responders[]: per responder group { median, total, distribution } — the POC column series
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
	/*
	Per-site POC float. Only used as a fallback when a module has no responder terms
	(none do today besides SC-only Patients & Outcomes, which omits pocTermId entirely
	and renders a single SC-only thermometer).
	*/
	const pocTW: any = query.pocTermId ? { term: { id: query.pocTermId }, q: { mode: 'continuous' } } : null
	// Responder-level multivalue impression terms — one thermometer per term (a module may
	// carry several, e.g. Service Capacity = PHO & PHOE + PHO & Nurses). Not aggregated.
	const responderTWs: any[] = (query.pocResponderTermIds || []).map((id: string) => ({ term: { id }, q: {} }))
	const maxScore: number = Number(query.maxScore) || 10

	if (!query.filterByUserSites) {
		query.__protected__.ignoredTermIds.push(facilityTermId)
	}

	const cohortAuth = clientAuthResult[activeCohort]
	const isPublic = !cohortAuth?.role || cohortAuth.role === 'public'
	const userSites = cohortAuth?.sites

	const terms: any[] = [facilityTW, scTW]
	if (pocTW) terms.push(pocTW)
	for (const tw of responderTWs) terms.push(tw)
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
	// FUNIT (site) is a hidden term, so getData omits it for the public role. The site list is
	// withheld from public anyway, so only build it when facility values are present.
	let sites: { value: any; label: string }[] = []
	if (!isPublic) {
		for (const s of sampleList) {
			const cell = s[facilityTW.$id]
			if (!cell) continue
			const val = cell.value
			let label = facilityTW.term.values?.[val]?.label || val
			if (typeof label === 'string' && label.length > 50) label = label.slice(0, 47) + '...'
			sites.push({ value: val, label })
		}
		if (userSites && query.filterByUserSites) sites = sites.filter(s => userSites.includes(s.value))
		sites.sort((a, b) => a.label.localeCompare(b.label))
	}

	const eligibleSamples =
		userSites && query.filterByUserSites
			? sampleList.filter(s => userSites.includes(s[facilityTW.$id]?.value))
			: sampleList

	const scValues = collectScalarValues(eligibleSamples, scTW.$id)

	/*
	Build one distribution per responder group — each becomes its own thermometer.
	The values are per responder (expanded from the rating→count maps), so median/total
	match the chart's "staff responses" labels. SC overlay (scMedian/scTotal) is shared.
	*/
	const responders = responderTWs.map(tw => {
		const values = collectResponderRatings(eligibleSamples, [tw.$id])
		return {
			termId: tw.term.id,
			label: responderLabel(tw.term?.name, tw.term.id),
			median: median(values),
			total: values.length,
			distribution: buildDistribution(values, maxScore)
		}
	})
	// Fallback: a module with a per-site POC float but no responder terms gets a single
	// "POC Staff" thermometer from the site-level values. (Not hit by current datasets.)
	if (!responders.length && pocTW) {
		const values = collectScalarValues(eligibleSamples, pocTW.$id)
		responders.push({
			termId: pocTW.term.id,
			label: 'POC Staff',
			median: median(values),
			total: values.length,
			distribution: buildDistribution(values, maxScore)
		})
	}

	return {
		scMedian: median(scValues),
		scTotal: scValues.length,
		// Shared SC frequency distribution (site counts binned per rating), used for the SC line
		// on the response-distribution chart. Same across every responder group's chart pair.
		scDistribution: buildDistribution(scValues, maxScore),
		responders,
		sites: isPublic ? [] : sites,
		n: eligibleSamples.length
	}
}

// Term names are stored as "Impression PHO & Nurses" etc.; strip the redundant leading
// "Impression " so the per-thermometer label reads "PHO & Nurses". Falls back to the id.
function responderLabel(name: string | undefined, id: string): string {
	if (!name) return id
	const stripped = name.replace(/^Impression\s+/i, '').trim()
	return stripped || name
}

// Collect scalar values for the SC integer / POC float terms (one value per site).
export function collectScalarValues(samples: any[], $id: string): number[] {
	const out: number[] = []
	for (const s of samples) {
		const cell = s[$id]
		if (!cell || cell.value == null) continue
		const n = Number(cell.value)
		if (Number.isFinite(n)) out.push(n)
	}
	return out
}

/*
Expand the responder-level multivalue impression terms into a flat per-responder rating
list. getData returns each multivalue cell as a JSON rating→count map string in cell.value
(e.g. {"8":2,"7":3}); a module may have several responder terms (PHO, Nurses, Clinicians),
so accumulate the counts across all of them.
*/
export function collectResponderRatings(samples: any[], $ids: string[]): number[] {
	const out: number[] = []
	for (const s of samples) {
		for (const $id of $ids) {
			const cell = s[$id]
			if (!cell || cell.value == null) continue
			const map = typeof cell.value === 'string' ? JSON.parse(cell.value) : cell.value
			for (const [rating, count] of Object.entries(map)) {
				const r = Number(rating)
				const c = Number(count)
				if (Number.isFinite(r) && Number.isFinite(c)) for (let i = 0; i < c; i++) out.push(r)
			}
		}
	}
	return out
}

export function median(values: number[]): number | null {
	if (values.length === 0) return null
	const sorted = [...values].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	const m = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
	return Math.round(m)
}

export function buildDistribution(
	values: number[],
	maxScore: number
): { rating: number; count: number; pct: number }[] {
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
