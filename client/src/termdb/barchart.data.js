import Partjson from 'partjson'
import { compute_bins } from '../../shared/termdb.bins'

export function getBarchartData(_q, data0) {
	/*
  Intended to be used in tests, to generate 
  alternatively computed results to compare 
  against sql-based server response
  
  q:      objectified URL query string
  data0:  the response data from /termdb-barsql, 
          needed to reuse computed bins
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

	const pj = getCharts(q, data0)
	if (pj.tree.results) pj.tree.results.pjtime = pj.times
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

	const idValFxns = {
		categorical: getCategoricalIdVal,
		integer: getNumericIdVal,
		float: getNumericIdVal,
		undefined: getUndefinedIdVal
	}

	return new Partjson({
		data,
		seed: `{"values": []}`, // result seed
		template: templateBar,
		'=': {
			idVal(row, context) {
				const [chartId, chartVal] = idValFxns[q.term0.type](row.data, q.term0, q.term0_q, data)
				const [seriesId, seriesVal] = idValFxns[q.term1.type](row.data, q.term1, q.term1_q, data)
				const [dataId, dataVal] = idValFxns[q.term0.type](row.data, q.term2, q.term2_q, data)
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

function getCategoricalIdVal(d, term) {
	const id = 'id' in term ? d[term.id] : '-'
	const value = 'id' in term && isNumeric(d[term.id]) ? +d[term.id] : 0
	return [[id], value]
}

function getNumericIdVal(d, term, q, rows) {
	const ids = []
	if (!('id' in term) || !(term.id in d)) return [ids, undefined]
	if (!q.computed_bins) {
		const summary = {}
		rows.map(row => {
			const v = row.data[term.id]
			if (!isNumeric(v)) return
			if (!('min' in summary) || summary.min > v) summary.min = v
			if (!('max' in summary) || summary.max < v) summary.max = v
		})
		q.computed_bins = compute_bins(q, percentiles => summary)
		q.orderedLabels = q.computed_bins.map(d => d.label)
	}
	const v = d[term.id]
	if (isNumeric(v)) {
		if (term.values && '' + v in term.values && term.values[v].uncomputable) {
			ids.push(term.values[v].label)
		}

		for (const b of q.computed_bins) {
			if (b.startunbounded) {
				if (v < b.stop) ids.push(b.label)
				if (b.stopinclusive && v == b.stop) ids.push(b.label)
			}
			if (b.stopunbounded) {
				if (v > b.start) ids.push(b.label)
				if (b.stopinclusive && v == b.start) ids.push(b.label)
			}
			if (b.startinclusive && v < b.start) continue
			if (!b.startinclusive && v <= b.start) continue
			if (b.stopinclusive && v > b.stop) continue
			if (!b.stopinclusive && v >= b.stop) continue
			ids.push(b.label)
		}
	}
	return [ids, v]
}

function getUndefinedIdVal() {
	return [['-'], undefined]
}

function sample_match_termvaluesetting(row, filter) {
	const lst = filter.type == 'tvslst' ? filter.lst : [filter]
	let numberofmatchedterms = 0

	/* for AND, require all terms to match */
	for (const item of lst) {
		if (item.type == 'tvslst') {
			if (sample_match_termvaluesetting(row, item)) {
				numberofmatchedterms++
			}
		} else {
			const t = item.tvs
			const samplevalue = row[t.term.id]

			let thistermmatch

			if (t.term.type == 'categorical') {
				if (samplevalue === undefined) continue // this sample has no anno for this term, do not count
				if (!t.valueset) t.valueset = new Set(t.values.map(i => i.key))
				thistermmatch = t.valueset.has(samplevalue)
			} else if (t.term.type == 'integer' || t.term.type == 'float') {
				if (samplevalue === undefined) continue // this sample has no anno for this term, do not count

				for (const range of t.ranges) {
					if ('value' in range) {
						thistermmatch = samplevalue === range.value // || ""+samplevalue == range.value || samplevalue == ""+range.value //; if (thistermmatch) console.log(i++)
						if (thistermmatch) break
					} else {
						// actual range
						if (t.term.values) {
							const v = t.term.values[samplevalue.toString()]
							if (v && v.uncomputable) {
								continue
							}
						}
						let left, right
						if (range.startunbounded) {
							left = true
						} else if ('start' in range) {
							if (range.startinclusive) {
								left = samplevalue >= range.start
							} else {
								left = samplevalue > range.start
							}
						}
						if (range.stopunbounded) {
							right = true
						} else if ('stop' in range) {
							if (range.stopinclusive) {
								right = samplevalue <= range.stop
							} else {
								right = samplevalue < range.stop
							}
						}
						thistermmatch = left && right
					}
					if (thistermmatch) break
				}
			} else if (t.term.type == 'condition') {
				const key = getPrecomputedKey(t)
				const anno = samplevalue && samplevalue[key]
				if (anno) {
					thistermmatch = Array.isArray(anno)
						? t.values.find(d => anno.includes(d.key))
						: t.values.find(d => d.key == anno)
				}
			} else {
				throw 'unknown term type'
			}

			if (t.isnot) {
				thistermmatch = !thistermmatch
			}
			if (thistermmatch) numberofmatchedterms++
		}

		// if one tvslst is matched with an "or" (Set UNION), then sample is okay
		if (filter.join == 'or' && numberofmatchedterms) return true
	}

	// for join="and" (Set intersection)
	if (numberofmatchedterms == lst.length) return true
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
					':__label': '&idVal.id'
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

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}
