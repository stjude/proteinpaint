import Partjson from 'partjson'
import { compute_bins } from '#shared/termdb.bins.js'
import { sample_match_termvaluesetting } from '../common/termutils'
import { isNumeric } from '#shared/helpers.js'

export function getBarchartData(_q, data) {
	/*
	  _q: term.q 
	  data:  rows of data, each row is unique by sample
	*/
	// need to not overwrite original term definition data
	const q = JSON.parse(JSON.stringify(_q))

	// support legacy query parameter names
	if (!q.term1) q.term1 = q.term ? q.term : {}
	if (!q.term1_q) q.term1_q = {}
	if (!q.term0) q.term0 = {}
	if (!q.term0_q) q.term0_q = {}
	if (!q.term2) q.term2 = {}
	if (!q.term2_q) q.term2_q = {}
	if (!q.filter) q.filter = { type: 'tvslst', join: '', lst: [] }

	const pj = getCharts(q, data)
	return pj.tree.results
}

function getTrackers() {
	return {
		joinFxns: { '': () => '' }, // keys are term0, term1, term2 names; ...
		numValFxns: { '': () => {} }, // ... if key == empty string then the term is not specified
		orderedLabels: [],
		bins: []
	}
}

// template for partjson, already stringified so that it does not
// have to be re-stringified within partjson refresh for every request
const templateBar = JSON.stringify({
	'@before()': '=prep()',
	'@join()': {
		idVal: '=idVal()'
	},
	results: {
		'_2:maxAcrossCharts': '=maxAcrossCharts()',
		charts: [
			{
				chartId: '@key',
				total: '+1',
				'_1:maxSeriesTotal': '=maxSeriesTotal()',
				'@done()': '=filterEmptySeries()',
				serieses: [
					{
						total: '+1',
						seriesId: '@key',
						max: '<&idVal.dataVal', // needed by client-side boxplot renderer
						'~values': ['&idVal.dataVal', 0],
						'~sum': '+&idVal.dataVal',
						'__:boxplot': '=boxplot()',
						'~samples': ['$sample', 'set'],
						//'__:AF': '=getAF()',
						data: [
							{
								dataId: '@key',
								total: '+1'
								//samples: ['$sample']
							},
							'&idVal.dataId[]'
						]
					},
					'&idVal.seriesId[]'
				]
			},
			'&idVal.chartId[]'
		],
		'~sum': '+&idVal.seriesVal',
		'~values': ['&idVal.seriesVal', 0],
		'__:boxplot': '=boxplot()',
		refs: {
			cols: ['&idVal.seriesId[]'],
			colgrps: ['-'],
			rows: ['&idVal.dataId[]'],
			rowgrps: ['-'],
			col2name: {
				'&idVal.seriesId[]': {
					name: '@branch',
					grp: '-'
				}
			},
			row2name: {
				'&idVal.dataId[]': {
					name: '@branch',
					grp: '-'
				}
			},
			'__:useColOrder': '=useColOrder()',
			'__:useRowOrder': '=useRowOrder()',
			'__:bins': '=bins()',
			//'__:q': '=q()',
			'@done()': '=sortColsRows()'
		},
		'@done()': '=sortCharts()'
	}
})

function getCharts(q, data) {
	/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
  */

	/*
		A map of functions to get a term's id and value, by its term.type
		The function will be used in idVal() below to get the chart/series/data ID and value
		for a given data row
  */
	const idValFxns = {
		categorical: getCategoricalIdVal,
		integer: getNumericIdVal,
		float: getNumericIdVal,
		undefined: getUndefinedIdVal
		// NOTE: condition terms are not currently supported for frontend vocab
	}

	return new Partjson({
		data,
		seed: `{"values": []}`, // result seed
		template: templateBar,
		'=': {
			idVal(row, context) {
				const [chartId, chartVal] = idValFxns[q.term0.type](row.data, q.term0, q.term0_q, data)
				const [seriesId, seriesVal] = idValFxns[q.term1.type](row.data, q.term1, q.term1_q, data)
				const [dataId, dataVal] = idValFxns[q.term2.type](row.data, q.term2, q.term2_q, data)
				return {
					chartId,
					chartVal,
					seriesId,
					seriesVal,
					dataId,
					dataVal
				}
			},
			prep(row) {
				return sample_match_termvaluesetting(row.data, q.filter)
			},
			maxSeriesTotal(row, context) {
				let maxSeriesTotal = 0
				for (const grp of context.self.serieses) {
					if (grp && grp.total > maxSeriesTotal) {
						maxSeriesTotal = grp.total
					}
				}
				return maxSeriesTotal
			},
			maxAcrossCharts(row, context) {
				let maxAcrossCharts = 0
				for (const chart of context.self.charts) {
					if (chart.maxSeriesTotal > maxAcrossCharts) {
						maxAcrossCharts = chart.maxSeriesTotal
					}
				}
				return maxAcrossCharts
			},
			boxplot(row, context) {
				if (!context.self.values || !context.self.values.length) return
				const values = context.self.values.filter(d => d !== null && !isNaN(d))
				if (!values.length) return
				values.sort((i, j) => i - j)
				const stat = boxplot_getvalue(
					values.map(v => {
						return { value: +v }
					})
				)
				stat.mean = context.self.sum / values.length
				let s = 0
				for (const v of values) {
					s += Math.pow(v - stat.mean, 2)
				}
				stat.sd = Math.sqrt(s / (values.length - 1))
				if (isNaN(stat.sd)) stat.sd = null
				return stat
			},
			numSamples(row, context) {
				return context.self.samples.size
			},
			filterEmptySeries(result) {
				const nonempty = result.serieses.filter(series => series.total)
				result.serieses.splice(0, result.serieses.length, ...nonempty)
			},
			sortColsRows(result) {
				if (q.term1_q.orderedLabels) {
					const labels = q.term1_q.orderedLabels
					result.cols.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}
				if (q.term2.orderedLabels) {
					const labels = q.term2_q.orderedLabels
					result.rows.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}
			},
			sortCharts(result) {},
			useColOrder() {
				return q.term1_q.orderedLabels && q.term1_q.orderedLabels.length > 0
			},
			useRowOrder() {
				return q.term2_q.orderedLabels && q.term2_q.orderedLabels.length > 0
			},
			bins() {
				return [q.term0_q, q.term1_q, q.term2_q].map(d => d.computed_bins)
			},
			q() {}
		}
	})
}

function setDatasetAnnotations(item) {
	if (item.type == 'tvslst') {
		for (const subitem of item.lst) {
			setDatasetAnnotations(subitem)
		}
	} else {
		if (item.tvs.term.type == 'categorical') {
			item.tvs.valueset = new Set(item.tvs.values.map(i => i.key))
		}
	}
}

/* 
	Arguments: 
	d: data row, an object with sample ID and the annotation values for one or more terms,
		 but this function is used specifically for annotation terms that are categorical
	term

	Returns:
	[	
		[id]: a list of matching chartId, seriesId, or dataId for this data row,
		value: the annotation value for this term
	]
*/
function getCategoricalIdVal(d, term) {
	const id = 'id' in term ? d[term.id] : '-'
	const value = 'id' in term && isNumeric(d[term.id]) ? +d[term.id] : 0
	return [[id], value]
}

/* 
	Arguments: 
	d: data row, an object with sample ID and the annotation values for one or more terms,
		 but this function is used specifically for annotation terms that are categorical
	term

	Returns:
	[
		[id]: a list of matching chartId, seriesId, or dataId for this data row,
		value: the annotation value for this term
	]
*/
function getNumericIdVal(d, term, q, rows) {
	if (!('id' in term) || !(term.id in d)) return [[], undefined]
	if (!q.computed_bins) {
		const summary = {}
		rows.map(row => {
			if (!isNumeric(row.data[term.id])) return
			const v = +row.data[term.id]
			if (!('min' in summary) || summary.min > v) summary.min = v
			if (!('max' in summary) || summary.max < v) summary.max = v
		})
		q.computed_bins = compute_bins(q, percentiles => summary)
		q.orderedLabels = q.computed_bins.map(d => d.label)
	}
	const v = d[term.id]
	if (term.values && v in term.values && term.values[v].uncomputable) {
		return [[term.values[v].label], undefined]
	}
	// ignore non-numeric values like empty string, ""
	// which may occur naturally in a csv/tab-delimited input
	if (isNumeric(d[term.id])) {
		const ids = []
		for (const b of q.computed_bins) {
			if (b.startunbounded) {
				if (v < b.stop) {
					ids.push(b.label)
				} else if (b.stopinclusive && v === b.stop) {
					ids.push(b.label)
				}
			} else if (b.stopunbounded) {
				// a bin should not be true for both b.startunbounded and b.stopunbounded,
				// since that is not a finite bin
				if (v > b.start) {
					ids.push(b.label)
				} else if (b.stopinclusive && v === b.start) {
					ids.push(b.label)
				}
			} else if (
				(v > b.start || (v === b.start && b.startinclusive)) &&
				(v < b.stop || (v === b.stop && b.stopinclusive))
			) {
				ids.push(b.label)
			}
			// for numeric terms, may match the sample annotation to at most one chartId, seriesId, or dataId,
			// so break the loop as soon as a matching id is found for a data row
			// TODO: may allow exceptions later to have more than 1 matching id???
			if (ids.length) break
		}
		return [ids, v]
	}
	return [[], undefined]
}

function getUndefinedIdVal() {
	return [['-'], undefined]
}

function boxplot_getvalue(lst) {
	/* ascending order
  each element: {value}
  */
	const l = lst.length
	if (l < 5) {
		// less than 5 items, won't make boxplot
		return { out: lst }
	}
	const p50 = lst[Math.floor(l / 2)].value
	const p25 = lst[Math.floor(l / 4)].value
	const p75 = lst[Math.floor((l * 3) / 4)].value
	const p05 = lst[Math.floor(l * 0.05)].value
	const p95 = lst[Math.floor(l * 0.95)].value
	const p01 = lst[Math.floor(l * 0.01)].value
	const iqr = p75 - p25

	let w1, w2
	if (iqr == 0) {
		w1 = 0
		w2 = 0
	} else {
		const i = lst.findIndex(i => i.value > p25 - iqr * 1.5)
		w1 = lst[i == -1 ? 0 : i].value
		const j = lst.findIndex(i => i.value > p75 + iqr * 1.5)
		w2 = lst[j == -1 ? l - 1 : Math.max(0, j - 1)].value
	}
	const out = lst.filter(i => i.value < p25 - iqr * 1.5 || i.value > p75 + iqr * 1.5)
	return { w1, w2, p05, p25, p50, p75, p95, iqr, out }
}

export function getCategoryData(q, data) {
	if (!data || !data.length) {
		// support custom vocab/adhoc dictionary with no sample annotations
		return {
			lst: Object.keys(q.term.values).map(k => {
				return { key: k, label: q.term.values[k].label, value: k }
			})
		}
	}
	//
	const pj = new Partjson({
		data,
		template: JSON.stringify({
			'@before()': '=prep()',
			'@join()': {
				idVal: '=idVal()'
			},
			results: {
				'&idVal.id': {
					samplecount: '+1',
					':__key': '&idVal.id',
					':__label': '&idVal.id',
					':__value': '&idVal.id'
				}
			}
		}),
		'=': {
			prep(row) {
				return sample_match_termvaluesetting(row.data, q.filter)
			},
			idVal(row, context) {
				const [id, value] = getCategoricalIdVal(row.data, q.term)
				return { id: id[0], value }
			}
		}
	})
	return { lst: Object.values(pj.tree.results) }
}
