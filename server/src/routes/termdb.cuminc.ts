import { getData } from '#src/termdb.matrix.js'
import { getTwByIndex, getTwBins } from '#src/termdb.twFromRequest.ts'
import { run_R } from '@sjcrh/proteinpaint-r'
import type { RouteApi, RoutePayload } from '#types'

const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbCumincRequest' },
	response: { typeId: 'TermdbCumincResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/cuminc',
	methods: {
		get: payload,
		post: payload
	}
}

export async function get_cuminc(q: any, ds: any) {
	if (!ds.cohort?.termdb) throw new Error('ds.cohort.termdb missing')
	const minTimeSinceDx = ds.cohort.termdb.minTimeSinceDx
	const minSampleSize = Number(q.minSampleSize)
	if (minTimeSinceDx && !Number.isFinite(minTimeSinceDx)) throw 'invalid minTimeSinceDx'
	if (!Number.isFinite(minSampleSize)) throw 'invalid minSampleSize'
	q.ds = ds
	const twByIndex = getTwByIndex(q)
	const twLst = [...twByIndex.values()]

	// tw0 divides the samples into charts, tw1 supplies the time and event, tw2 the series
	const tw0 = twByIndex.get(0)
	const tw1 = twByIndex.get(1)
	const tw2 = twByIndex.get(2)
	if (!tw1) throw 'term1 is missing'
	if (tw1.term.type != 'condition') throw 'term1 must be condition term'
	if (tw2?.term.type == 'condition') throw 'overlay term cannot be condition term'
	if (tw0?.term.type == 'condition') throw 'divideBy term cannot be condition term'

	const data = await getData(
		{ terms: twLst, filter: q.filter, filter0: q.filter0, __protected__: q.__protected__ },
		ds,
		true
	) // FIXME hardcoded 3rd arg
	if (data.error) throw data.error

	const results: any = { data: {} }
	if (!Object.keys(data.samples).length) return results

	// parse data
	const byChartSeries: { [chartId: string]: { time: number; event: number; series: string }[] } = {}
	for (const d of Object.values(data.samples) as any[]) {
		if (twLst.some(tw => !(tw.$id in d))) continue // skip samples without data for all terms
		const chartId = tw0 ? d[tw0.$id].key : ''
		const time = d[tw1.$id].value
		const event = d[tw1.$id].key
		const series = tw2 ? d[tw2.$id].key : ''
		if (!(chartId in byChartSeries)) byChartSeries[chartId] = []
		byChartSeries[chartId].push({ time, event, series })
	}
	results.refs = { bins: getTwBins(tw2, data) }

	// prepare R input
	const Rinput: any = { data: {}, startTime: minTimeSinceDx }
	results.noEvents = {}
	results.lowSampleSize = {}
	for (const chartId in byChartSeries) {
		const chart = byChartSeries[chartId]
		const seriesIds = new Set(chart.map(x => x.series))
		for (const seriesId of seriesIds) {
			const series = chart.filter(sample => sample.series == seriesId)
			if (!series.find(sample => sample.event === 1)) {
				// skip series with no events of interest (i.e. event=1)
				// need to do this because if series only has event=0/2
				// then R will consider event=2 to be event of interest
				results.noEvents[chartId] = (results.noEvents[chartId] || []).concat([seriesId])
				continue
			}
			if (series.length < minSampleSize) {
				// skip series with low sample size
				// should do this because cuminc computation of series
				// with low sample size can trigger permutation tests
				// which have long execution times
				results.lowSampleSize[chartId] = (results.lowSampleSize[chartId] || []).concat([seriesId])
				continue
			}
			Rinput.data[chartId] = (Rinput.data[chartId] || []).concat(series)
		}
		if (!(chartId in Rinput.data)) results.data[chartId] = {}
	}
	if (!Object.keys(Rinput.data).length) return { data: {} }

	// run cumulative incidence analysis in R
	const ci_data = await runCumincR(Rinput)
	Object.assign(results.data, ci_data)

	return results
}

function init({ genomes }: any) {
	return async (req: any, res: any) => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			res.send(await get_cuminc(q, ds))
		} catch (e: any) {
			if (e?.stack) console.log(e.stack)
			else console.log(e)
			res.send({ error: e.message || e })
		}
	}
}

// run cumulative incidence analysis in R
export async function runCumincR(Rinput: any) {
	// replace empty string chartIds and seriesIds with '*' for R (will reconvert later)
	for (let chartId in Rinput.data) {
		if (chartId === '') {
			chartId = '*'
			Rinput.data[chartId] = Rinput.data['']
			delete Rinput.data['']
		}
		Rinput.data[chartId] = Rinput.data[chartId].map((sample: any) => {
			const container = {
				time: sample.time,
				event: sample.event,
				series: sample.series === '' ? '*' : sample.series
			}
			return container
		})
	}

	// run cumulative incidence analysis
	const ci_data = JSON.parse(await run_R('cuminc.R', JSON.stringify(Rinput)))

	// parse cumulative incidence results
	// revert placeholders
	for (const chartId in ci_data) {
		if (chartId === '*') {
			ci_data[''] = ci_data[chartId]
			delete ci_data[chartId]
		}
	}
	for (const chartId in ci_data) {
		for (const seriesId in ci_data[chartId].estimates) {
			if (seriesId === '*') {
				ci_data[chartId].estimates[''] = ci_data[chartId].estimates[seriesId]
				delete ci_data[chartId].estimates[seriesId]
			}
		}
	}

	return ci_data
}
