import type { DescrStatsRequest, DescrStatsResponse, DescrStats, RouteApi } from '#types'
import { descrStatsPayload } from '#types/checkers'
import { getData } from '#src/termdb.matrix.js'
import computePercentile from '#shared/compute.percentile.js'
import { roundValueAuto } from '#shared/roundValue.js'

export const api: RouteApi = {
	endpoint: 'termdb/descrstats',
	methods: {
		get: {
			...descrStatsPayload,
			init
		},
		post: {
			...descrStatsPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: DescrStatsRequest = req.query
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			if (!q.tw.$id) q.tw.$id = '_' // current typing thinks tw$id is undefined. add this to avoid tsc err. delete this line when typing is fixed

			const result: DescrStatsResponse = await trigger_getDescrStats(q, ds)
			res.send(result)
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			const result = { error: e?.message || e }
			res.send(result)
		}
	}
}

async function trigger_getDescrStats(q, ds) {
	const data = await getData(
		{ filter: q.filter, filter0: q.filter0, terms: [q.tw], __protected__: q.__protected__ },
		ds
	)
	if (data.error) throw data.error

	const values: number[] = []
	for (const key in data.samples) {
		const sample = data.samples[key]
		const v = sample[q.tw.$id]
		if (!v && v !== 0) {
			// skip undefined values
			continue
		}
		const value = v.value
		if (q.tw.term.values?.[value]?.uncomputable) {
			// skip uncomputable values
			continue
		}
		//skip computing for zeros if scale is log.
		if (q.logScale) {
			if (value === 0) {
				continue
			}
		}
		values.push(Number(value))
	}

	const stats = getDescrStats(values)

	return stats
}

// function to compute descriptive statistics for an
// array of numeric values
export function getDescrStats(values, showOutlierRange = false) {
	if (!values.length) {
		// no values, do not get stats as it breaks code
		// set result to blank obj to avoid "missing response.header['content-type']" err on client
		return {}
	}

	if (values.some(v => !Number.isFinite(v))) throw new Error('non-numeric values found')

	//compute total
	const sorted_arr = values.sort((a, b) => a - b)
	const n = sorted_arr.length

	//compute median
	const median = computePercentile(sorted_arr, 50, true)
	//compute mean
	const mean = getMean(sorted_arr)
	// compute variance
	const variance = getVariance(sorted_arr)
	// compute standard deviation
	const stdDev = Math.sqrt(variance)

	//compute percentile ranges
	const p25 = computePercentile(sorted_arr, 25, true)
	const p75 = computePercentile(sorted_arr, 75, true)

	//compute IQR
	const IQR = p75 - p25
	const min = sorted_arr[0]
	const max = sorted_arr[sorted_arr.length - 1]

	// Calculate outlier boundaries
	const outlierMin = p25 - 1.5 * IQR //p25 is same as q1
	const outlierMax = p75 + 1.5 * IQR //p75 is same as q3

	const stats: DescrStats = {
		total: { key: 'total', label: 'Total', value: n },
		min: { key: 'min', label: 'Minimum', value: min },
		p25: { key: 'p25', label: '1st quartile', value: p25 },
		median: { key: 'median', label: 'Median', value: median },
		p75: { key: 'p75', label: '3rd quartile', value: p75 },
		max: { key: 'max', label: 'Maximum', value: max },
		mean: { key: 'mean', label: 'Mean', value: mean },
		stdDev: { key: 'stdDev', label: 'Standard deviation', value: stdDev }
		//variance: { label: 'Variance', value: variance }, // not necessary to report, as it is just stdDev^2
		//iqr: { label: 'Inter-quartile range', value: IQR } // not necessary to report, as it is just p75-p25
	}

	if (showOutlierRange) {
		stats.outlierMin = { key: 'outlierMin', label: 'Outlier minimum', value: outlierMin }
		stats.outlierMax = { key: 'outlierMax', label: 'Outlier maximum', value: outlierMax }
	}

	for (const v of Object.values(stats)) {
		const rounded = roundValueAuto(v.value)
		v.value = rounded
	}

	return stats
}

export function getMean(data) {
	return data.reduce((sum, value) => sum + value, 0) / data.length
}

export function getVariance(data) {
	const meanValue = getMean(data)
	const squaredDifferences = data.map(value => Math.pow(value - meanValue, 2))
	//Using n−1 compensates for the fact that we're basing variance on a sample mean,
	// which tends to underestimate true variability. The correction is especially important with small sample sizes,
	// where dividing by n would significantly distort the variance estimate.
	// For more details see https://en.wikipedia.org/wiki/Bessel%27s_correction
	return squaredDifferences.reduce((sum, value) => sum + value, 0) / (data.length - 1)
}

export function getStdDev(data) {
	const variance = getVariance(data)
	return Math.sqrt(variance)
}
