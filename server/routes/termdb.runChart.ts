import type { RouteApi, RunChartRequest, RunChartSeries, RunChartSuccessResponse } from '#types'
import { runChartPayload } from '#types/checkers'
import { getDateFromNumber, getNumberFromDate } from '#shared/terms.js'

/**
 * Parse numeric x (decimal year or legacy YYYY.MM) to year and month for bucketing.
 * Prefer getDateFromNumber (fraction-of-days-in-year); fall back to legacy string-splitting
 * for invalid dates or alternate formats (e.g. YYYY.MM).
 */
export function decimalYearToYearMonth(xRaw: number): { yearNum: number; monthNum: number } | null {
	const date = getDateFromNumber(xRaw)
	const t = date.getTime()
	if (Number.isFinite(t)) {
		const yearNum = date.getFullYear()
		const monthNum = date.getMonth() + 1
		if (Number.isFinite(yearNum) && Number.isFinite(monthNum)) return { yearNum, monthNum }
	}
	// Fallback: legacy YYYY.MM or fractional-year interpretation
	const parts = String(xRaw).split('.')
	const year = Number(parts[0])
	if (!Number.isFinite(year)) return null
	let month: number
	if (parts.length > 1) {
		const decimalPart = parts[1]
		if (decimalPart.length === 2) {
			const monthCandidate = Number(decimalPart)
			month = monthCandidate >= 1 && monthCandidate <= 12 ? monthCandidate : Math.floor((xRaw - year) * 12) + 1
		} else {
			month = Math.floor((xRaw - year) * 12) + 1
		}
	} else {
		month = 1
	}
	if (!Number.isFinite(month) || month < 1 || month > 12) return null
	return { yearNum: year, monthNum: month }
}

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

export async function getRunChart(q: RunChartRequest, ds: any): Promise<RunChartSuccessResponse> {
	const xTermId = q.xtw['$id'] ?? q.xtw.term?.id
	const yTermId = q.ytw ? q.ytw['$id'] ?? q.ytw.term?.id : undefined

	if (xTermId == null || xTermId === '') {
		throw new Error('runChart requires xtw with $id or term.id')
	}
	const isFrequency = !q.ytw
	if (!isFrequency && (yTermId == null || yTermId === '')) {
		throw new Error('runChart requires ytw with $id or term.id when ytw is provided')
	}

	const terms: any = isFrequency ? [q.xtw] : [q.xtw, q.ytw]
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

	// Partition by xtw when xtw is in discrete mode
	const shouldPartition = q.xtw?.q?.mode === 'discrete'

	if (isFrequency) {
		return buildFrequencyFromData(xTermId, data, shouldPartition, xTermId, q.showCumulativeFrequency === true)
	}
	if (yTermId == null || yTermId === '') {
		throw new Error('runChart requires ytw with $id or term.id when ytw is provided')
	}
	return buildRunChartFromData(q.aggregation ?? 'median', xTermId, yTermId, data, shouldPartition, xTermId)
}

export function buildRunChartFromData(
	aggregation: string,
	xTermId: string,
	yTermId: string,
	data: any,
	shouldPartition: boolean,
	partitionTermId?: string
): RunChartSuccessResponse {
	const allSamples = (data.samples || {}) as Record<string, any>

	if (shouldPartition && partitionTermId) {
		// runChart2Period: partition samples by divide-by term's bin key (period)
		const period2Samples: Record<string, Record<string, any>> = {}
		for (const sampleId in allSamples) {
			const sample = allSamples[sampleId]
			const partitionTerm = sample?.[partitionTermId]
			if (partitionTerm?.key == null) {
				// Skip samples that don't have a value for the partition term
				continue
			}
			const periodKey = partitionTerm.key
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

/** Frequency mode: no y term; Y = count of samples per time bucket (or cumulative when showCumulativeFrequency). */
export function buildFrequencyFromData(
	xTermId: string,
	data: any,
	shouldPartition: boolean,
	partitionTermId?: string,
	showCumulativeFrequency?: boolean
): RunChartSuccessResponse {
	const allSamples = (data.samples || {}) as Record<string, any>

	if (shouldPartition && partitionTermId) {
		const period2Samples: Record<string, Record<string, any>> = {}
		for (const sampleId in allSamples) {
			const sample = allSamples[sampleId]
			const partitionTerm = sample?.[partitionTermId]
			if (partitionTerm?.key == null) continue
			const periodKey = partitionTerm.key
			if (!period2Samples[periodKey]) period2Samples[periodKey] = {}
			period2Samples[periodKey][sampleId] = sample
		}
		const periodKeys = Object.keys(period2Samples).sort()
		const series = periodKeys.map(seriesId => {
			const subset = { samples: period2Samples[seriesId] }
			const one = buildOneSeriesFrequency(xTermId, subset, showCumulativeFrequency === true)
			return { seriesId, ...one }
		})
		return { status: 'ok', series }
	}

	const one = buildOneSeriesFrequency(xTermId, data, showCumulativeFrequency === true)
	return { status: 'ok', series: [{ ...one }] }
}

function buildOneSeriesFrequency(
	xTermId: string,
	data: any,
	showCumulativeFrequency = false
): { median: number; points: any[] } {
	if (xTermId == null || xTermId === '') {
		throw new Error('buildOneSeriesFrequency requires a defined xTermId (xtw.$id or xtw.term.id)')
	}
	const buckets: Record<string, { x: number; xName: string; count: number; sortKey: number }> = {}

	for (const sampleId in (data.samples || {}) as any) {
		const sample = (data.samples as any)[sampleId]
		const xRaw = sample?.[xTermId]?.value ?? sample?.[xTermId]?.key
		if (xRaw == null) continue
		if (typeof xRaw !== 'number') {
			throw new Error(
				`x value must be a number for sample ${sampleId}: xTermId=${xTermId}, received type ${typeof xRaw}, value: ${xRaw}`
			)
		}

		const parsed = decimalYearToYearMonth(xRaw)
		if (!parsed) continue
		const { yearNum, monthNum } = parsed

		const bucketKey = `${yearNum}-${String(monthNum).padStart(2, '0')}`
		const bucketDate = new Date(yearNum, monthNum - 1, 1)
		const xName = bucketDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

		if (!buckets[bucketKey]) {
			const midMonthX = getNumberFromDate(new Date(yearNum, monthNum - 1, 15))
			buckets[bucketKey] = {
				x: Math.round(midMonthX * 100) / 100,
				xName,
				count: 0,
				sortKey: yearNum * 100 + monthNum
			}
		}
		buckets[bucketKey].count += 1
	}

	let points = Object.values(buckets)
		.sort((a, b) => a.sortKey - b.sortKey)
		.map(b => ({
			x: b.x,
			xName: b.xName,
			y: b.count,
			sampleCount: b.count
		}))

	if (showCumulativeFrequency) {
		let sum = 0
		points = points.map(p => {
			sum += p.y
			return { ...p, y: sum }
		})
	}

	const yValues = points.map(p => p.y).filter(v => typeof v === 'number' && !Number.isNaN(v))
	const median =
		yValues.length > 0
			? (() => {
					const sorted = [...yValues].sort((a, b) => a - b)
					const mid = Math.floor(sorted.length / 2)
					return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]
			  })()
			: 0

	return { median, points }
}

function buildOneSeries(
	aggregation: string,
	xTermId: string,
	yTermId: string,
	data: any
): { median: number; points: any[] } {
	const supportedAggregations = ['proportion', 'count', 'median']
	if (!supportedAggregations.includes(aggregation)) {
		throw new Error(
			`Unsupported aggregation method: ${aggregation}. Supported values are: ${supportedAggregations.join(', ')}`
		)
	}

	const buckets: Record<
		string,
		{
			x: number
			xName: string
			count: number
			missingCount?: number
			success?: number
			total?: number
			countSum?: number
			sortKey: number
			yValues: number[]
		}
	> = {}

	for (const sampleId in (data.samples || {}) as any) {
		const sample = (data.samples as any)[sampleId]
		// For discrete xtw, use .value (raw date) for x positioning; .key is the period label
		const xRaw = sample?.[xTermId]?.value ?? sample?.[xTermId]?.key
		const yRaw = sample?.[yTermId]?.value ?? sample?.[yTermId]?.key

		if (xRaw == null) {
			continue
		}

		// Only handle numeric values, throw error for strings
		if (typeof xRaw !== 'number') {
			throw new Error(
				`x value must be a number for sample ${sampleId}: xTermId=${xTermId}, received type ${typeof xRaw}, value: ${xRaw}`
			)
		}

		const parsed = decimalYearToYearMonth(xRaw)
		if (!parsed) continue
		const { yearNum, monthNum } = parsed

		const bucketKey = `${yearNum}-${String(monthNum).padStart(2, '0')}`
		const bucketDate = new Date(yearNum, monthNum - 1, 1)
		const xName = bucketDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

		if (!buckets[bucketKey]) {
			buckets[bucketKey] = {
				x: getNumberFromDate(new Date(yearNum, monthNum - 1, 15)),
				xName,
				count: 0,
				missingCount: 0,
				success: 0,
				total: 0,
				countSum: 0,
				sortKey: yearNum * 100 + monthNum,
				yValues: []
			}
		}

		// If y is missing, track the bucket but do not add to aggregates
		if (yRaw == null) {
			buckets[bucketKey].missingCount = (buckets[bucketKey].missingCount || 0) + 1
			continue
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
					`Non-finite y value for ${aggregation} aggregation in sample ${sampleId}: yTermId=${yTermId}, yRaw=${yRaw}`
				)
			}
			buckets[bucketKey].count += 1
			buckets[bucketKey].yValues.push(yn)
		}
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
				if ((b.yValues?.length ?? 0) > 0) {
					const sorted = [...b.yValues].sort((a, b) => a - b)
					const mid = Math.floor(sorted.length / 2)
					y = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
				} else {
					y = 0
				}
				y = Math.round(y * 100) / 100
				const sampleCount = b.count > 0 ? b.count : b.missingCount || 0
				return { x, xName: b.xName, y, sampleCount }
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

/** Builds the error response body so it always includes required fields (e.g. series: []). */
export function runChartErrorPayload(message: string): { error: string; series: RunChartSeries[] } {
	return { error: String(message), series: [] }
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
			res.send(runChartErrorPayload(e.message || e))
		}
	}
}
