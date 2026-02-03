import type { RouteApi, RunChartRequest, RunChartResponse } from '#types'
import { runChartPayload } from '#types/checkers'
import { compute_bins } from '#shared'
import { getNumberFromDate } from '#shared/terms.js'

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
	const terms: any = [q.xtw, q.ytw]
	if (q.divideByTW) terms.push(q.divideByTW)

	const xTermId = q.xtw['$id'] ?? q.xtw.term?.id
	const yTermId = q.ytw['$id'] ?? q.ytw.term?.id
	const divideByTermId = q.divideByTW ? q.divideByTW['$id'] ?? q.divideByTW.term?.id : null

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

	// divideByTW (term0) takes precedence; else partition by xtw when xtw is discrete
	const partitionByTermId = divideByTermId || (q.xtw?.q?.mode === 'discrete' ? xTermId : null)

	if (q.xtw?.q?.mode === 'discrete') {
		const xValues = getXValuesFromData(data.samples, xTermId)
		const min = xValues.length ? Math.min(...xValues) : 0
		const max = xValues.length ? Math.max(...xValues) : 1
		try {
			const bins = compute_bins(q.xtw.q, () => ({ min, max }))
			console.log(bins)
		} catch (e) {
			console.warn('runChart: compute_bins for period failed', e)
		}
	}

	return buildRunChartFromData(q.aggregation, xTermId, yTermId, data, partitionByTermId)
}

/** Collect numeric X values from samples for min/max (e.g. for period binning). */
function getXValuesFromData(samples: Record<string, any> | undefined, xTermId: string): number[] {
	const vals: number[] = []
	if (!samples) return vals
	for (const sampleId in samples) {
		const v = samples[sampleId]?.[xTermId]?.value ?? samples[sampleId]?.[xTermId]?.key
		if (typeof v === 'number' && Number.isFinite(v)) vals.push(v)
	}
	return vals
}

export function buildRunChartFromData(
	aggregation: string,
	xTermId: string,
	yTermId: string,
	data: any,
	partitionByTermId?: string | null
): RunChartResponse {
	const allSamples = (data.samples || {}) as Record<string, any>

	if (partitionByTermId) {
		// runChart2Period: partition samples by divide-by term's bin key (period)
		const period2Samples: Record<string, Record<string, any>> = {}
		for (const sampleId in allSamples) {
			const sample = allSamples[sampleId]
			const periodKey = sample?.[partitionByTermId]?.key ?? sample?.[partitionByTermId]?.value ?? 'Default'
			if (!period2Samples[periodKey]) period2Samples[periodKey] = {}
			period2Samples[periodKey][sampleId] = sample
		}
		const periodKeys = Object.keys(period2Samples).sort()
		const series = periodKeys.map(seriesId => {
			const subset = { samples: period2Samples[seriesId] }
			const one = buildOneSeries(aggregation, xTermId, yTermId, subset)
			return { seriesId, ...one }
		})
		return { status: 'ok', series }
	}

	const one = buildOneSeries(aggregation, xTermId, yTermId, data)
	return { status: 'ok', series: [{ ...one }] }
}

function buildOneSeries(
	aggregation: string,
	xTermId: string,
	yTermId: string,
	data: any
): { median: number; points: any[] } {
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

	let skippedSamples = 0

	for (const sampleId in (data.samples || {}) as any) {
		const sample = (data.samples as any)[sampleId]
		// For discrete xtw, use .value (raw date) for x positioning; .key is the period label
		const xRaw = sample?.[xTermId]?.value ?? sample?.[xTermId]?.key
		const yRaw = sample?.[yTermId]?.value ?? sample?.[yTermId]?.key

		if (xRaw == null || yRaw == null) {
			skippedSamples++
			console.log(
				`Skipping sample ${sampleId}: Missing x or y value - xTermId=${xTermId} (value: ${xRaw}), yTermId=${yTermId} (value: ${yRaw})`
			)
			continue
		}

		// Only handle numeric values, throw error for strings
		if (typeof xRaw !== 'number') {
			throw new Error(
				`x value must be a number for sample ${sampleId}: xTermId=${xTermId}, received type ${typeof xRaw}, value: ${xRaw}`
			)
		}

		let year: number | null = null
		let month: number | null = null
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

		if (year == null || month == null || Number.isNaN(year) || Number.isNaN(month)) {
			skippedSamples++
			console.log(
				`Skipping sample ${sampleId}: Invalid date value - xTermId=${xTermId}, xRaw=${xRaw}, parsed year=${year}, month=${month}`
			)
			continue
		}

		// TypeScript narrowing: at this point year and month are guaranteed to be numbers
		const yearNum = year as number
		const monthNum = month as number

		const bucketKey = `${yearNum}-${String(monthNum).padStart(2, '0')}`
		const x = Number(`${yearNum}.${String(monthNum).padStart(2, '0')}`)
		const date = new Date(yearNum, monthNum - 1, 1)
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
				sortKey: yearNum * 100 + monthNum,
				yValues: []
			}
		}

		if (aggregation === 'proportion') {
			if (typeof yRaw === 'boolean') {
				buckets[bucketKey].success! += yRaw ? 1 : 0
				buckets[bucketKey].total! += 1
			} else if (typeof yRaw === 'number') {
				const yn = Number(yRaw)
				if (!Number.isFinite(yn)) {
					throw new Error(
						`Non-finite y value for proportion aggregation in sample ${sampleId}: yTermId=${yTermId}, yRaw=${yRaw}`
					)
				}
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
				if (!Number.isFinite(s) || !Number.isFinite(t)) {
					throw new Error(
						`Non-finite success or total value for proportion aggregation in sample ${sampleId}: yTermId=${yTermId}, success=${s}, total=${t}`
					)
				}
				buckets[bucketKey].success! += s
				buckets[bucketKey].total! += t
			} else {
				throw new Error(
					`Invalid y value type for proportion aggregation in sample ${sampleId}: yTermId=${yTermId}, type=${typeof yRaw}, value=${yRaw}`
				)
			}
		} else if (aggregation === 'count') {
			const yn = Number(yRaw)
			if (!Number.isFinite(yn)) {
				throw new Error(
					`Non-finite y value for count aggregation in sample ${sampleId}: yTermId=${yTermId}, yRaw=${yRaw}`
				)
			}
			buckets[bucketKey].countSum! += yn
			buckets[bucketKey].count += 1
		} else {
			const yn = Number(yRaw)
			if (!Number.isFinite(yn)) {
				throw new Error(
					`Non-finite y value for mean aggregation in sample ${sampleId}: yTermId=${yTermId}, yRaw=${yRaw}`
				)
			}
			buckets[bucketKey].ySum += yn
			buckets[bucketKey].count += 1
			buckets[bucketKey].yValues.push(yn)
		}
	}

	if (skippedSamples > 0) {
		console.log(`buildRunChartFromData: Skipped ${skippedSamples} sample(s) due to missing x or y values`)
	}

	function xFromBucket(b: { sortKey: number }) {
		const yearNum = Math.floor(b.sortKey / 100)
		const monthNum = b.sortKey % 100
		const x = getNumberFromDate(new Date(yearNum, monthNum - 1, 15))
		return Math.round(x * 100) / 100
	}

	const points = Object.values(buckets)
		.sort((a, b) => a.sortKey - b.sortKey)
		.map(b => {
			const x = xFromBucket(b)
			if (aggregation === 'proportion') {
				const total = b.total || 0
				const succ = b.success || 0
				const y = total ? Math.round((succ / total) * 1000) / 1000 : 0
				return { x, xName: b.xName, y, sampleCount: total }
			} else if (aggregation === 'count') {
				const y = Math.round((b.countSum || 0) * 100) / 100
				return { x, xName: b.xName, y, sampleCount: b.count }
			} else {
				let y: number
				if (aggregation === 'median' && (b.yValues?.length ?? 0) > 0) {
					const sorted = [...b.yValues].sort((a, b) => a - b)
					const mid = Math.floor(sorted.length / 2)
					y = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
				} else {
					y = b.count ? b.ySum / b.count : 0
				}
				y = Math.round(y * 100) / 100
				return { x, xName: b.xName, y, sampleCount: b.count }
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

	return { median, points }
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
