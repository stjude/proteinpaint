import type { RouteApi, RunChartRequest, RunChartResponse } from '#types'
import { runChartPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'termdb/runChart',
	methods: {
		get: {
			...runChartPayload,
			init
		},
		post: {
			...runChartPayload,
			init
		}
	}
}

export async function getRunChart(q: RunChartRequest, ds: any): Promise<RunChartResponse> {
	// Collect terms from term and term2
	const terms: any = []
	let xTermId: string | undefined
	let yTermId: string | undefined

	if (q.term && q.term2) {
		const tws = [
			{ term: q.term, q: { mode: 'continuous' }, $id: q.term.id },
			{ term: q.term2, q: { mode: 'continuous' }, $id: q.term2.id }
		]
		terms.push(...tws)
		xTermId = q.term.id
		yTermId = q.term2.id
	} else {
		throw new Error('term and term2 must be provided')
	}

	if (!xTermId || !yTermId) {
		throw new Error('Unable to determine term IDs for x and y axes')
	}

	const { getData } = await import('../src/termdb.matrix.js')

	const data = await getData(
		{
			filter: q.filter,
			terms,
			__protected__: q.__protected__
		},
		ds,
		true
	)

	if (data.error) throw new Error(data.error)

	return buildRunChartFromData(q.aggregation, xTermId, yTermId, data)
}

export function buildRunChartFromData(
	aggregation: string,
	xTermId: string,
	yTermId: string,
	data: any
): RunChartResponse {
	const buckets: Record<
		string,
		{
			x: number
			xName: string
			ySum: number
			count: number
			success?: number
			total?: number
			countSum?: number
			sortKey: number
			yValues: number[]
		}
	> = {}

	for (const sampleId in (data.samples || {}) as any) {
		const sample = (data.samples as any)[sampleId]
		const xRaw = sample?.[xTermId]?.value ?? sample?.[xTermId]?.key
		const yRaw = sample?.[yTermId]?.value ?? sample?.[yTermId]?.key

		if (xRaw == null || yRaw == null) continue

		let year: number | null = null
		let month: number | null = null
		if (typeof xRaw === 'string' && /^\d{4}-\d{2}/.test(xRaw)) {
			const m = xRaw.match(/(\d{4})-(\d{2})/)
			if (m) {
				year = Number(m[1])
				month = Number(m[2])
			}
		} else if (typeof xRaw === 'number') {
			const parts = String(xRaw).split('.')
			year = Number(parts[0])
			if (parts.length > 1) {
				const decimalPart = parts[1]
				// If decimal part is exactly 2 digits and represents a valid month (01-12), treat as YYYY.MM
				if (decimalPart.length === 2) {
					const monthCandidate = Number(decimalPart)
					if (monthCandidate >= 1 && monthCandidate <= 12) {
						month = monthCandidate
					} else {
						// Invalid month, treat as fractional year
						const frac = xRaw - year
						month = Math.floor(frac * 12) + 1
					}
				} else {
					// Decimal part is not 2 digits, treat as fractional year
					const frac = xRaw - year
					month = Math.floor(frac * 12) + 1
				}
			} else {
				// No decimal part, invalid date
				year = null
			}
		} else if (typeof xRaw === 'string' && /^\d{4}\.\d+$/.test(xRaw)) {
			const [y, m] = xRaw.split('.')
			year = Number(y)
			// If decimal part is exactly 2 digits, treat as month, otherwise as fractional year
			if (m.length === 2) {
				const monthCandidate = Number(m)
				if (monthCandidate >= 1 && monthCandidate <= 12) {
					month = monthCandidate
				} else {
					const frac = Number(`0.${m}`)
					month = Math.floor(frac * 12) + 1
				}
			} else {
				const frac = Number(`0.${m}`)
				month = Math.floor(frac * 12) + 1
			}
		}

		if (year == null || month == null || Number.isNaN(year) || Number.isNaN(month)) continue

		const bucketKey = `${year}-${String(month).padStart(2, '0')}`
		const x = Number(`${year}.${String(month).padStart(2, '0')}`)
		const date = new Date(year, month - 1, 1)
		const xName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' })

		if (!buckets[bucketKey]) {
			buckets[bucketKey] = {
				x,
				xName,
				ySum: 0,
				count: 0,
				success: 0,
				total: 0,
				countSum: 0,
				sortKey: year * 100 + month,
				yValues: []
			}
		}

		if (chartType === 'proportion') {
			if (typeof yRaw === 'boolean') {
				buckets[bucketKey].success! += yRaw ? 1 : 0
				buckets[bucketKey].total! += 1
			} else if (typeof yRaw === 'number') {
				const yn = Number(yRaw)
				if (!Number.isFinite(yn)) continue
				if (yn <= 1 && yn >= 0) {
					buckets[bucketKey].success! += yn
					buckets[bucketKey].total! += 1
				} else {
					buckets[bucketKey].success! += yn
					buckets[bucketKey].total! += 1
				}
			} else if (typeof yRaw === 'object' && yRaw != null) {
				const s = Number((yRaw as any).success ?? (yRaw as any).y ?? (yRaw as any).value ?? NaN)
				const t = Number((yRaw as any).total ?? (yRaw as any).n ?? 1)
				if (Number.isFinite(s) && Number.isFinite(t)) {
					buckets[bucketKey].success! += s
					buckets[bucketKey].total! += t
				}
			}
		} else if (chartType === 'count') {
			const yn = Number(yRaw)
			if (!Number.isFinite(yn)) continue
			buckets[bucketKey].countSum! += yn
			buckets[bucketKey].count += 1
		} else {
			const yn = Number(yRaw)
			if (!Number.isFinite(yn)) continue
			buckets[bucketKey].ySum += yn
			buckets[bucketKey].count += 1
			buckets[bucketKey].yValues.push(yn)
		}
	}

	const points = Object.values(buckets)
		.sort((a, b) => a.sortKey - b.sortKey)
		.map(b => {
			if (chartType === 'proportion') {
				const total = b.total || 0
				const succ = b.success || 0
				const y = total ? Math.round((succ / total) * 1000) / 1000 : 0
				return { x: b.x, xName: b.xName, y, sampleCount: total }
			} else if (chartType === 'count') {
				const y = Math.round((b.countSum || 0) * 100) / 100
				return { x: b.x, xName: b.xName, y, sampleCount: b.count }
			} else {
				const avg = b.count ? Math.round((b.ySum / b.count) * 100) / 100 : 0
				return { x: b.x, xName: b.xName, y: avg, sampleCount: b.count }
			}
		})

	const yValues = points.map(p => p.y).filter(v => typeof v === 'number' && !Number.isNaN(v))
	const median =
		yValues.length > 0
			? (() => {
					const sorted = [...yValues].sort((a, b) => a - b)
					const mid = Math.floor(sorted.length / 2)
					return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
			  })()
			: 0

	return {
		status: 'ok',
		series: [
			{
				median,
				points
			}
		]
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: RunChartRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome name')
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('invalid ds')

			const result = await getRunChart(q, ds)
			res.send(result)
		} catch (e: any) {
			console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}
