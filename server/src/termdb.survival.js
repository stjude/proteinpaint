const path = require('path')
const get_rows = require('./termdb.sql').get_rows
const write_file = require('./utils').write_file
const fs = require('fs')
const serverconfig = require('./serverconfig')
const lines2R = require('./lines2R')
const getGeneVariantData = require('./bulk.mset').getGeneVariantData

export async function get_survival(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
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
			if (typeof q[termnum_q] == 'string') {
				q[termnum_q] = JSON.parse(decodeURIComponent(q[termnum_q]))
			}
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

		// only term1 XOR term2 may be a survival term
		const survTermIndex = q.term1 && q.term1.type == 'survival' ? 1 : 2
		const tNum = `t${survTermIndex}` // survival CTE table name
		const kNum = `key${survTermIndex}` // seriesId = censored boolean
		const vNum = `val${survTermIndex}` // time to event value
		const sNum = tNum == 't1' ? 'key2' : 'key1'
		const survq = tNum == 't1' ? q.term1_q : q.term2_q

		const results = get_rows(q, { withCTEs: true })
		results.lst.sort((a, b) => (a[vNum] < b[vNum] ? -1 : 1))

		if (q.term2?.type == 'geneVariant') {
			console.log(54)
			await addGeneData(q, results.lst)
		}

		const byChartSeries = {}
		const keys = { chart: new Set(), series: new Set() }
		for (const d of results.lst) {
			// time-to-event
			const time = d[vNum]
			if (time < 0) continue // do not include data when years_to_event < 0
			// status codes
			// 0=censored; 1=dead
			// codes match the codes expected by Surv() in R
			const status = d[kNum]
			// series
			const series = d[sNum] === '' ? '*' : d[sNum] // R errors on empty string series value, so replace with '*' (will reconvert later)
			keys.series.add(series)
			// enter chart data
			if (!(d.key0 in byChartSeries)) {
				byChartSeries[d.key0] = []
				keys.chart.add(d.key0)
			}
			byChartSeries[d.key0].push({ time, status, series })
		}
		const bins = q.term2_id && results.CTE2.bins ? results.CTE2.bins : []
		const final_data = {
			keys: ['chartId', 'seriesId', 'time', 'survival', 'lower', 'upper', 'nevent', 'ncensor', 'nrisk'],
			case: [],
			refs: { bins }
		}

		// perform survival analysis for each chart
		for (const chartId in byChartSeries) {
			const data = byChartSeries[chartId]
			const datafile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
			await write_file(datafile, JSON.stringify(data))
			const out = await lines2R(path.join(serverconfig.binpath, 'utils/survival.R'), [], [datafile])
			const survival_data = JSON.parse(out)

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

			fs.unlink(datafile, () => {})
		}
		// sort by d.x
		final_data.case.sort((a, b) => a[2] - b[2])
		const orderedLabels = getOrderedLabels(q.term2, bins ? bins.map(bin => (bin.name ? bin.name : bin.label)) : [])
		final_data.refs.orderedKeys = {
			chart: [...keys.chart].sort(),
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

function getOrderedLabels(term, bins = []) {
	if (term) {
		if (term.type == 'condition' && term.values) {
			return Object.keys(term.values)
				.map(Number)
				.sort((a, b) => a - b)
				.map(i => term.values[i].label)
		}
		if (term.values) {
			return Object.keys(term.values)
				.sort((a, b) =>
					'order' in term.values[a] && 'order' in term.values[b] ? term.values[a].order - term.values[b].order : 0
				)
				.map(i => term.values[i].label)
		}
	}
	return bins.map(bin => (bin.name ? bin.name : bin.label))
}

async function addGeneData(q, rows) {
	const termq = q.term2_q
	const bySampleId = await getGeneVariantData({ term: q.term2, q: termq }, q)
	if (!termq.exclude) termq.exclude = []
	const tname = q.term2.name
	for (const row of rows) {
		let matched = false
		const sampleData = bySampleId.get(row.sample)
		if (sampleData && tname in sampleData) {
			for (const d of sampleData[tname].values) {
				if (!termq.exclude.includes(d.class)) {
					matched++
					break
				}
			}
		}
		row.val2 = matched ? 'Altered' : 'Wildtype'
		row.key2 = row.val2
	}
}
