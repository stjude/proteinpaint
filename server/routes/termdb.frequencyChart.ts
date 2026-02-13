import type { RouteApi, FrequencyChartRequest, FrequencyChartResponse, FrequencyChartPoint } from '#types'
import { frequencyChartPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { getNumberFromDate } from '#shared/terms.js'

export const api: RouteApi = {
	endpoint: 'termdb/frequencyChart',
	methods: {
		get: {
			...frequencyChartPayload,
			init
		},
		post: {
			...frequencyChartPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: FrequencyChartRequest = req.query

			if (!q.genome || !q.dslabel) {
				throw new Error('Genome and dataset label are required')
			}

			if (!q.coordTWs || !Array.isArray(q.coordTWs) || q.coordTWs.length === 0) {
				throw new Error('coordTWs array with at least one term wrapper is required')
			}

			const genome = genomes[q.genome]
			if (!genome) throw new Error('Invalid genome name')

			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('Invalid dataset')

			const result = await getFrequencyChart(q, ds)
			res.send(result)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getFrequencyChart(q: FrequencyChartRequest, ds: any): Promise<FrequencyChartResponse> {
	// Use the first term in coordTWs array
	const tw = q.coordTWs[0]
	const termId = tw.$id || tw.term?.id

	if (!termId) {
		throw new Error('Term ID is required in coordTWs[0]')
	}

	// Fetch sample data for the date term
	const data = await getData(
		{
			filter: q.filter,
			terms: [tw],
			__protected__: q.__protected__
		},
		ds,
		true
	)

	if (data.error) throw new Error(data.error)

	const samples = data.samples || {}

	// Group samples by year-month
	const monthCounts = new Map<string, number>()

	for (const sampleId in samples) {
		const sample = samples[sampleId]
		const termValue = sample[termId]

		if (!termValue) continue

		// Get the date value
		const dateValue = termValue.value ?? termValue.key

		if (dateValue == null || typeof dateValue !== 'number') continue

		// Parse year and month from the numeric date value
		// Format could be YYYY.MM (e.g., 2024.03) or fractional year (e.g., 2024.25)
		const year = Math.floor(dateValue)
		const decimalPart = dateValue - year

		let month: number
		const parts = String(dateValue).split('.')
		if (parts.length > 1 && parts[1].length === 2) {
			// Format: YYYY.MM
			month = Number(parts[1])
			if (month < 1 || month > 12) {
				// Invalid month, convert from fractional year
				month = Math.floor(decimalPart * 12) + 1
			}
		} else {
			// Fractional year format
			month = Math.floor(decimalPart * 12) + 1
		}

		// Ensure month is in valid range
		if (month < 1) month = 1
		if (month > 12) month = 12

		const yearMonth = `${year}-${String(month).padStart(2, '0')}`
		monthCounts.set(yearMonth, (monthCounts.get(yearMonth) || 0) + 1)
	}

	// Sort by year-month and convert to points
	const sortedMonths = Array.from(monthCounts.entries()).sort(([a], [b]) => a.localeCompare(b))

	const points: FrequencyChartPoint[] = sortedMonths.map(([yearMonth, count]) => {
		const [year, month] = yearMonth.split('-').map(Number)

		// Create date at middle of month (day 15) for x-axis positioning
		const midMonthDate = new Date(year, month - 1, 15)
		const x = getNumberFromDate(midMonthDate)
		const xName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

		return {
			x: Math.round(x * 100) / 100,
			xName,
			y: count,
			sampleCount: count
		}
	})

	return {
		status: 'ok',
		points
	}
}
