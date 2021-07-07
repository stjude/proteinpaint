const serverconfig = require('../../serverconfig')
const got = require('got')
const tape = require('tape')
const dodiff = require('deep-object-diff')
const barchart_data = require('./back.barchart').barchart_data

async function compareResponseData(test, params, mssg) {
	/* 
    RECOMMENDED:
    In case of failing tests, 
    run test/test.server.js instead for easier 
    inspection and comparison of server response
    instead of adjusting i, j, k, ... below
  */
	// i=series start, j=series end, k=chart index
	// for debugging result data, set i < j to slice chart.serieses
	const i = 0,
		j = 0,
		k = 0,
		l = 0,
		refkey = ''
	const url0 = getSqlUrl(params)

	try {
		const response = await got(url0)
		if (!response.body) test.fail('empty response for barsql at :' + url0)
		else {
			switch (response.statusCode) {
				case 200:
					const data0 = JSON.parse(response.body)
					// reshape sql results in order to match
					// the compared results
					const dataCharts = data0
					const summary0 = normalizeCharts(data0)
					// get an alternatively computed results
					// for comparing against sql results
					const data1 = barchart_data(params, data0)
					const summary1 = normalizeCharts(data1, data0.refs)
					// reduce results if an option applies
					const sqlSummary = getComparableResults(summary0, refkey, i, j, k)
					const barSummary = getComparableResults(summary1, refkey, i, j, k)
					const diff = dodiff.diff(sqlSummary, barSummary)
					const diffStr = JSON.stringify(diff)
					test.deepEqual(
						diff,
						{}, //barSummary,
						mssg == 'WEB-TEST' ? { diffStr, sqlSummary, barSummary } : mssg + (diffStr == '{}' ? '' : ' ' + diffStr)
					)

					break
				default:
					console.log(url0)
					test.fail('invalid status')
			}
		}
	} catch (error) {
		console.log(url0)
		test.fail(error)
	}
}

exports.compareResponseData = compareResponseData

const sqlBasePath = '/termdb-barsql?'
const sqlParamsReformat = {
	rename: {
		term0: 'term0_id',
		term1: 'term1_id',
		term2: 'term2_id'
	},
	asis: [
		'term0_id',
		'term0_is_genotype',
		'term1_id',
		'term1_is_genotype',
		'term2_id',
		'term2_is_genotype',
		'ssid',
		'chr',
		'pos',
		'mname'
	],
	json: ['term0_q', 'term1_q', 'term2_q', 'filter']
}

function getSqlUrl(_params = {}) {
	const params = Object.assign({}, _params)
	let url = 'http://localhost:' + serverconfig.port + sqlBasePath + '&genome=hg38' + '&dslabel=TermdbTest'

	for (const key in params) {
		if (key in sqlParamsReformat.rename) {
			params[sqlParamsReformat.rename[key]] = params[key]
			delete params[key]
		}
	}
	for (const key in params) {
		if (sqlParamsReformat.json.includes(key)) {
			url += `&${key}=${encodeURIComponent(JSON.stringify(params[key]))}`
		} else if (sqlParamsReformat.asis.includes(key)) {
			url += `&${key}=${params[key]}`
		}
	}

	return url
}

function normalizeCharts(data, comparedRefs = null) {
	const charts = data ? data.charts : null
	if (!charts) {
		return { charts: [{ serieses: [] }] }
	}

	charts.forEach(onlyComparableChartKeys)
	sortResults(charts)
	const reformattedRefs = normalizeRefs(data.refs, comparedRefs)
	if (reformattedRefs) data.refs = reformattedRefs
	const summary = { charts, refs: data.refs }

	if (data.boxplot) {
		summary.boxplot = data.boxplot
		summary.boxplot.mean = summary.boxplot.mean.toPrecision(8)
		if (summary.boxplot.sd) {
			summary.boxplot.sd = summary.boxplot.sd.toPrecision(8)
		}
		for (const key of Object.keys(summary.boxplot)) {
			if (key.startsWith('p')) summary.boxplot[key] = summary.boxplot[key].toPrecision(8)
		}
		if (data.boxplot.min) {
			summary.boxplot.min = summary.boxplot.min.toPrecision(8)
		}
		if (data.boxplot.max) {
			summary.boxplot.max = summary.boxplot.max.toPrecision(8)
		}
	}
	for (const chart of summary.charts) {
		for (const series of chart.serieses) {
			if (series.boxplot) {
				if (series.boxplot.mean) {
					series.boxplot.mean = series.boxplot.mean.toPrecision(8)
					if (series.boxplot.sd) {
						series.boxplot.sd = series.boxplot.sd.toPrecision(8)
					}
				}
				if (series.boxplot.min) {
					series.boxplot.min = series.boxplot.min.toPrecision(8)
				}
				if (series.boxplot.max) {
					series.boxplot.max = series.boxplot.max.toPrecision(8)
				}
			}
		}
	}

	return summary
}

function onlyComparableChartKeys(chart) {
	delete chart.total
	chart.serieses.sort((a, b) => (a.seriesId < b.seriesId ? -1 : 1))
	chart.serieses.forEach(onlyComparableSeriesKeys)
}

function onlyComparableSeriesKeys(series) {
	delete series.max
	delete series['@errors']
}

function sortResults(charts) {
	charts.sort(chartSorter)
	for (const chart of charts) {
		chart.serieses.sort(seriesSorter)
		for (const series of chart.serieses) {
			series.data.sort(dataSorter)
		}
	}
}

function chartSorter(a, b) {
	return a.chartId < b.chartId ? -1 : 1
}

function seriesSorter(a, b) {
	return a.seriesId < b.seriesId ? -1 : 1
}

function dataSorter(a, b) {
	return a.dataId < b.dataId ? -1 : 1
}

function normalizeRefs(refs, comparedRefs) {
	if (!refs || !Object.keys(refs).length) return
	delete refs['@errors']
	delete refs.row2name['@errors']
	if (!refs.useColOrder) refs.cols.sort(valueSort)
	if (!refs.useRowOrder) refs.rows.sort(valueSort)

	// normalize the minor differences
	if (refs.bins) {
		for (const i in refs.bins) {
			refs.bins[i].forEach(bin => {
				if (bin.name) {
					if (!('label' in bin)) bin.label = bin.name
					delete bin.name
				}
				for (const key in bin) {
					if (bin[key] === true) {
						bin[key] = 1
					}
					if (bin[key] === false) {
						bin[key] = 0
					}
				}
			})
		}
	}

	if (refs.q) {
		for (const q of refs.q) {
			if (!q) continue
			delete q.label_offset_ignored
		}
	}

	// make it easier to manually inspect results by
	// matching the result key ordering in the json printout
	let obj
	if (comparedRefs) {
		obj = {}
		for (const key in comparedRefs) {
			if (!refs[key] || !comparedRefs[key]) {
				obj[key] = refs[key]
			} else if (Array.isArray(refs[key]) && Array.isArray(comparedRefs[key])) {
				obj[key] = refs[key]
				obj[key].sort(valueSort)
				comparedRefs[key].sort(valueSort)
			} else if (typeof refs[key] == 'object' && typeof comparedRefs[key] == 'object') {
				obj[key] = {}
				for (const subkey in comparedRefs[key]) {
					obj[key][subkey] = refs[key][subkey]
				}
				for (const subkey in refs[key]) {
					if (!(key in obj[key])) obj[key][subkey] = refs[key][subkey]
				}
			} else {
				obj[key] = refs[key]
			}
		}
		for (const key in refs) {
			if (!(key in obj)) obj[key] = refs[key]
		}
	}
	return obj
}

function valueSort(a, b) {
	return a < b ? -1 : 1
}

function getComparableResults(summary, refkey, i, j, k) {
	const result =
		refkey == '*'
			? summary.refs
			: refkey
			? summary.refs[refkey]
			: k == -1
			? summary
				? k !== l
				: summary0.charts.slice(k, l)
			: i !== j
			? summary.charts[k].serieses.slice(i, j)
			: summary

	// some result diffs are normalized via JSON stringify,
	// such as NaN -> null
	return JSON.parse(JSON.stringify(result))
}
