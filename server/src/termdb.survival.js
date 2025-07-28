import { getData } from './termdb.matrix'
import { run_R } from '@sjcrh/proteinpaint-r'
import { TermTypes } from '#shared/terms.js'

export async function get_survival(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		const twLst = []
		for (const i of [0, 1, 2]) {
			const termnum = 'term' + i
			const termnum_id = termnum + '_id'
			if (typeof q[termnum_id] == 'string') {
				q[termnum_id] = decodeURIComponent(q[termnum_id])
				q[termnum] = q.ds.cohort.termdb.q.termjsonByOneid(q[termnum_id])
			} else if (typeof q[termnum] == 'string') {
				q[termnum] = JSON.parse(decodeURIComponent(q[termnum]))
			}

			const termnum_q = termnum + '_q'

			if (q[termnum]) twLst.push({ term: q[termnum], q: q[termnum_q] })
		}

		if (q.term2) {
			if (q.term2.type == 'survival' && q.term1.type == 'survival') {
				throw `term and overlay are both survival terms - only one could be a survival term`
			}
			if (q.term2.type != 'survival' && q.term1.type != 'survival') {
				throw `no survival terms, either the main term OR the overlay term must be a survival term`
			}
		} else if (q.term1.type != 'survival') {
			throw `non-survival term`
		}
		if (q.term0 && q.term0.type == 'survival') {
			throw `term0 must not be a survival term`
		}

		const survTermIndex = getSurvTermIndex(q) // 1 or 2
		// st: survival term
		const st = q[`term${survTermIndex}`]
		// ot: overlay term, the series term
		const ot = q[`term${survTermIndex == 1 ? 2 : 1}`]
		const data = await getData(
			{ terms: twLst, filter: q.filter, filter0: q.filter0 },
			ds,
			q.genome,
			ifIsOnlyChildren(q, st, ot, ds)
		)
		if (data.error) throw data.error
		const results = getSampleArray(data, st)

		const byChartSeries = {}
		const keys = { chart: new Set(), series: new Set() }
		for (const d of results) {
			// survival data
			const s = d[st.id]
			// time-to-event
			const time = s.value
			if (time < 0) continue // do not include data when years_to_event < 0
			// status codes
			// 0=censored; 1=dead
			// codes match the codes expected by Surv() in R
			const status = s.key
			// series ID for distinct overlays
			// R errors on empty string series value, so replace with '*' (will reconvert later)
			let series
			if (!ot) series = '*'
			else if ('id' in ot) {
				if (!(ot.id in d)) continue //This sample is not in any group
				series = d[ot.id].key
			} else if (ot.type == 'samplelst') {
				if (!(ot.name in d)) continue //This sample is not in any group
				series = d[ot.name].key
			} else series = getSeriesKey(ot, d)

			keys.series.add(series)
			// enter chart data
			const d0 = (q.term0 && d[q.term0.id || q.term0.name]) || { key: '' }
			if (!(d0.key in byChartSeries)) {
				byChartSeries[d0.key] = []
				keys.chart.add(d0.key)
			}
			byChartSeries[d0.key].push({ time, status, series })
		}
		const bins = (q.term2_id && data.refs[q.term2.id]?.bins) || []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk'],
			case: [],
			refs: { bins }
		}

		// perform survival analysis for each chart
		for (const chartId in byChartSeries) {
			const data = byChartSeries[chartId]
			const survival_data = JSON.parse(await run_R('survival.R', JSON.stringify(data)))
			// parse survival estimates
			for (const obj of survival_data.estimates) {
				for (const key in obj) {
					if (key == 'series') {
						// reconvert series placeholder back to empty string
						obj[key] = obj[key] == '*' ? '' : obj[key]
					} else {
						// ensure estimate values are numeric (important for
						// 'NA' strings from R)
						obj[key] = Number(obj[key])
					}
				}
				// add estimate values to final data
				final_data.case.push([
					chartId,
					obj.series,
					obj.time,
					obj.surv,
					obj.lower,
					obj.upper,
					obj.nevent,
					obj.ncensor,
					obj.nrisk
				])
			}

			// parse results of statistical tests
			if (survival_data.tests) {
				if (!final_data.tests) final_data.tests = {}
				final_data.tests[chartId] = survival_data.tests
			}
		}
		// sort by d.x
		final_data.case.sort((a, b) => a[2] - b[2])
		const orderedLabels = getOrderedLabels(q.term2, bins ? bins.map(bin => (bin.name ? bin.name : bin.label)) : [])
		const orderedLabelsTerm0 = getOrderedLabels(q.term0)
		final_data.refs.orderedKeys = {
			chart: [...keys.chart].sort(
				!orderedLabelsTerm0 ? undefined : (a, b) => orderedLabelsTerm0.indexOf(a) - orderedLabelsTerm0.indexOf(b)
			),
			series: [...keys.series].sort(
				!orderedLabels ? undefined : (a, b) => orderedLabels.indexOf(a) - orderedLabels.indexOf(b)
			)
		}
		return final_data
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function ifIsOnlyChildren(q, st, ot, ds) {
	const types = new Set()
	const ids = [st.id]
	if (ot) ids.push(ot.id)
	if (q.term0) ids.push(q.term0.id)
	for (const id of ids) types.add(ds.cohort.termdb.term2SampleType.get(id))
	// true if there are multiple sample types, false if there is a single sample type
	return types.size > 1
}

function getSurvTermIndex(q) {
	// only term1 XOR term2 may be a survival term
	if (q.term1) {
		if (q.term1.type == 'survival') return 1
	}
	if (!q.term2) throw 'term1.type is not survival and term2 is missing'
	if (q.term2.type != 'survival') throw 'both term1 and term2 are not survival type'
	return 2
}

function getSampleArray(data, st) {
	// convert getData() result into list of samples that has survival data
	// array order by survival value
	const lst = Object.values(data.samples).filter(i => i[st.id])
	return lst.sort((a, b) => (a[st.id].value < b[st.id].value ? -1 : 1))
}

function getSeriesKey(ot, d) {
	const n = ot.name
	if (ot.type == TermTypes.GENE_VARIANT) {
		// TODO: may no longer need this code as geneVariant groupsetting is now performed on client-side
		if (!d[n] || !d[n].values) return 'Wildtype' // TODO: should require definitive not-tested vs WT data
		const tested = d[n].values.filter(v => v.class != 'Blank')

		/*
			TODO: ot.q may specify to
			- filter out any value that has a certain dt or class (similar to the matrix)
			- what classes to group together (groupsetting)

			NOTE: handle this filtering/value processing per the q object within the getData() function?

			!!! Very simplified series grouping below !!!
		*/
		// if a sample is mutated for any test, ignore that is may be wildtype and/or not tested for any other assay
		if (tested.find(v => v.class != 'WT')) return `${n} Variant`
		// so far, no variant was found. is the sample specifically marked as wildtype for any test?
		if (tested.find(v => v.class == 'WT')) return `${n} Wildtype`
		// not mutant or wildtype, was it marked not tested for any assay?
		if (d[n].values.length > tested.length) return 'Not tested'
		// TODO: more helpful message or throw
		return 'Not sure'
	} else if (ot.type == TermTypes.GENE_EXPRESSION) {
		return d[ot.name]?.key || 'Missing data'
	} else if (d[ot.name]) {
		return d[ot.name].key
	} else {
		throw `cannot get series key for term='${n}'`
	}
}

function getOrderedLabels(term, bins = []) {
	if (term) {
		if (term.type == 'condition' && term.values) {
			return Object.keys(term.values)
				.map(Number)
				.sort((a, b) => a - b)
				.map(i => term.values[i].label)
		}
		if (term.values) {
			return Object.keys(term.values).sort((a, b) =>
				'order' in term.values[a] && 'order' in term.values[b] ? term.values[a].order - term.values[b].order : 0
			)
		}
	}
	return bins.map(bin => (bin.name ? bin.name : bin.label))
}
