const serverconfig = require('../../serverconfig')
const fs = require('fs')
const path = require('path')
const Partjson = require('partjson')
const sjlife = require('./load.sjlife').init('sjlife2.hg38.js')
const filterUtils = require('../../../shared/src/filter')

function barchart_data(q, data0) {
	/*
  Intended to be used in tests, to generate 
  alternatively computed results to compare 
  against sql-based server response
  
  q:      objectified URL query string
  data0:  the response data from /termdb-barsql, 
          needed to reuse computed bins
*/
	// support legacy query parameter names
	if (q.term1_id) q.term1 = q.term1_id
	if (!q.term1_q) q.term1_q = {}
	if (!q.term0) q.term0 = ''
	if (q.term0_id) q.term0 = q.term0_id
	if (!q.term0_q) q.term0_q = {}
	if (!q.term2) q.term2 = ''
	if (q.term2_id) q.term2 = q.term2_id
	if (!q.term2_q) q.term2_q = {}
	const ds = sjlife.ds
	const tdb = ds.cohort.termdb

	// request-specific variables
	const startTime = +new Date()
	const inReqs = [getTrackers(), getTrackers(), getTrackers()]
	inReqs.filterFxn = () => 1 // default allow all rows, may be replaced via q.termfilter
	setValFxns(q, inReqs, ds, tdb, data0)
	const pj = getPj(q, inReqs, ds.cohort.annorows, tdb, ds)
	if (pj.tree.results) pj.tree.results.pjtime = pj.times
	return pj.tree.results
}

exports.barchart_data = barchart_data

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
	'@errmode': ['', '', '', ''],
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
						'__:AF': '=getAF()',
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
			'__:q': '=q()',
			'@done()': '=sortColsRows()'
		},
		'@done()': '=sortCharts()'
	}
})

function getPj(q, inReqs, data, tdb, ds) {
	/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/

	const terms = [
		{ i: 0, term: 'term0', key: 'chartId', val: 'chartVal', q: q.term0_q },
		{ i: 1, term: 'term1', key: 'seriesId', val: 'seriesVal', q: q.term1_q },
		{ i: 2, term: 'term2', key: 'dataId', val: 'dataVal', q: q.term2_q }
	]

	inReqs[0].q = q.term0_q
	inReqs[1].q = q.term1_q
	inReqs[2].q = q.term2_q

	return new Partjson({
		data,
		seed: `{"values": []}`, // result seed
		template: templateBar,
		'=': {
			prep(row) {
				// a falsy filter return value for a data row will cause the
				// exclusion of that row from farther processing
				return inReqs.filterFxn(row)
			},
			idVal(row, context, joinAlias) {
				// chart, series, data
				const csd = Object.create(null)
				for (const term of terms) {
					const termid = q[term.term]
					const id = inReqs[term.i].joinFxns[termid](row, context, joinAlias)
					if (id === undefined || (Array.isArray(id) && !id.length)) return
					csd[term.key] = Array.isArray(id) ? id : [id]
					csd[term.val] =
						typeof inReqs[term.i].numValFxns[termid] == 'function' ? inReqs[term.i].numValFxns[termid](row) : undefined
				}
				return csd
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
				const values = context.self.values.filter(d => d !== null)
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
			getAF(row, context) {
				// only get AF when termdb_bygenotype.getAF is true
				if (!ds.track || !ds.track.vcf || !ds.track.vcf.termdb_bygenotype || !ds.track.vcf.termdb_bygenotype.getAF)
					return
				if (!q.term2_is_genotype) return
				if (!q.chr) throw 'chr missing for getting AF'
				if (!q.pos) throw 'pos missing for getting AF'

				return get_AF(
					context.self.samples ? [...context.self.samples] : [],
					q.chr,
					Number(q.pos),
					inReqs.genotype2sample,
					ds
				)
			},
			filterEmptySeries(result) {
				const nonempty = result.serieses.filter(series => series.total)
				result.serieses.splice(0, result.serieses.length, ...nonempty)
			},
			sortColsRows(result) {
				if (inReqs[1].orderedLabels.length) {
					const labels = inReqs[1].orderedLabels
					result.cols.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}
				if (inReqs[2].orderedLabels.length) {
					const labels = inReqs[2].orderedLabels
					result.rows.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}
			},
			sortCharts(result) {
				for (const term of terms) {
					const termid = q[term.term]
				}
			},
			useColOrder() {
				return inReqs[1].orderedLabels.length > 0
			},
			useRowOrder() {
				return inReqs[2].orderedLabels.length > 0
			},
			bins() {
				return inReqs.map(d => d.bins)
			},
			q() {
				return inReqs.map(d => {
					const q = {}
					for (const key in d.q) {
						if (key != 'index') q[key] = d.q[key]
					}
					return q
				})
			}
		}
	})
}

function setValFxns(q, inReqs, ds, tdb, data0) {
	/*
  sets request-specific value and filter functions
*/
	if (q.filter) {
		if (!q.filter.join) q.filter.join = ''
		filterUtils.setDatasetAnnotations(q.filter, sjlife)
		inReqs.filterFxn = row => {
			return filterUtils.sample_match_termvaluesetting(row, q.filter)
		}
	}

	for (const i of [0, 1, 2]) {
		const inReq = inReqs[i]
		const termnum = 'term' + i
		const termid = q[termnum]
		const term_q = q[termnum + '_q']
		inReq.q = term_q
		term_q.index = i
		if (!inReq.orderedLabels) {
			inReq.orderedLabels = []
		}
		if (q[termnum + '_is_genotype']) {
			if (!q.ssid) throw `missing ssid for genotype`
			const [bySample, genotype2sample] = load_genotype_by_sample(q.ssid)
			inReqs.genotype2sample = genotype2sample
			inReq.joinFxns[termid] = row => bySample[row.sample]
			continue
		}
		sjlife.setAnnoByTermId(termid)
		const term = termid ? tdb.termjson.map.get(termid) : null
		if ((!termid || term.type == 'categorical') && termid in inReq.joinFxns) continue
		if (!term) throw `Unknown ${termnum}="${q[termnum]}"`
		if (term.type == 'categorical') {
			inReq.joinFxns[termid] = row => row[termid]
		} else if (term.type == 'integer' || term.type == 'float') {
			get_numeric_bin_name(term_q, termid, term, ds, termnum, inReq, data0)
		} else if (term.type == 'condition') {
			// tdb.patient_condition
			//if (!tdb.patient_condition) throw 'missing termdb patient_condition'
			//if (!tdb.patient_condition.events_key) throw 'missing termdb patient_condition.events_key'
			inReq.orderedLabels = term.grades ? term.grades : [0, 1, 2, 3, 4, 5, 9] // hardcoded default order
			set_condition_fxn(termid, term.values, tdb, inReq, i)
		} else {
			throw 'unable to handle request, unknown term type'
		}
	}
}

function set_condition_fxn(termid, values, tdb, inReq, index) {
	const q = inReq.q
	const precomputedKey = getPrecomputedKey(q)

	inReq.joinFxns[termid] = row => {
		if (!(termid in row) || !(precomputedKey in row[termid])) return []
		const value = row[termid][precomputedKey]
		if (q.bar_by_grade) {
			const grades = Array.isArray(value) ? value : [value]
			return grades.map(grade => values[grade].label)
		} else {
			return Array.isArray(value) ? value : [value]
		}
	}
}

function getPrecomputedKey(q) {
	const precomputedKey =
		q.bar_by_children && q.value_by_max_grade
			? 'childrenAtMaxGrade'
			: q.bar_by_children && q.value_by_most_recent
			? 'childrenAtMostRecent'
			: q.bar_by_children && q.value_by_computable_grade
			? 'children'
			: q.bar_by_grade && q.value_by_max_grade
			? 'maxGrade'
			: q.bar_by_grade && q.value_by_most_recent
			? 'mostRecentGrades'
			: q.bar_by_grade && q.value_by_computable_grade
			? 'computableGrades'
			: ''
	if (!precomputedKey) throw `unknown condition term bar_by_* and/or value_by_*`
	return precomputedKey
}

function get_numeric_bin_name(term_q, termid, term, ds, termnum, inReq, data0) {
	if (!data0.refs.bins) throw 'missing bins array in server response of /termdb-barsql'
	const index = +termnum.slice(-1)
	const bins = data0.refs.bins[index]
	const binconfig = data0.refs.bins[index] //.binconfig
	inReq.bins = bins
	inReq.binconfig = binconfig
	inReq.orderedLabels = bins.map(d => d.label)
	term_q.results = data0.refs.q[index].results

	inReq.joinFxns[termid] = row => {
		const v = row[termid]
		if (!isNumeric(v)) return
		if (term.values && '' + v in term.values && term.values[v].uncomputable) {
			return term.values[v].label
		}

		for (const b of bins) {
			if (b.startunbounded) {
				if (v < b.stop) return b.label
				if (b.stopinclusive && v == b.stop) return b.label
			}
			if (b.stopunbounded) {
				if (v > b.start) return b.label
				if (b.stopinclusive && v == b.start) return b.label
			}
			if (b.startinclusive && v < b.start) continue
			if (!b.startinclusive && v <= b.start) continue
			if (b.stopinclusive && v > b.stop) continue
			if (!b.stopinclusive && v >= b.stop) continue
			return b.label
		}
	}

	inReq.numValFxns[termid] = row => {
		const v = row[termid]
		if (!term.values || !('' + v in term.values) || !term.values[v].uncomputable) {
			if (isNumeric(v)) return v
		}
	}
}

function load_genotype_by_sample(id) {
	/* id is the file name under cache/samples-by-genotype/
	 */
	const filename = path.join(serverconfig.cachedir, 'ssid', id)
	const text = fs.readFileSync(filename, { encoding: 'utf8' })

	const bySample = Object.create(null)
	const genotype2sample = new Map()
	for (const line of text.split('\n')) {
		const [type, samplesStr] = line.split('\t')
		const samples = samplesStr.split(',').map(d => Number(d))
		for (const sample of samples) {
			bySample[sample] = type
		}

		if (!genotype_type_set.has(type)) throw 'unknown hardcoded genotype label: ' + type
		genotype2sample.set(type, new Set(samples))
	}
	return [bySample, genotype2sample]
}

const genotype_type_set = new Set(['Homozygous reference', 'Homozygous alternative', 'Heterozygous'])
const genotype_types = {
	href: 'Homozygous reference',
	halt: 'Homozygous alternative',
	het: 'Heterozygous'
}

function get_AF(samples, chr, pos, genotype2sample, ds) {
	/*
as configured by ds.track.vcf.termdb_bygenotype,
at genotype overlay of a barchart,
to show AF=? for each bar, based on the current variant

arguments:
- samples[]
  list of sample names from a bar
- chr
  chromosome of the variant
- genotype2sample Map
    returned by load_genotype_by_sample()
- ds{}
*/
	const afconfig = ds.track.vcf.termdb_bygenotype // location of configurations
	const href = genotype2sample.has(genotype_types.href) ? genotype2sample.get(genotype_types.href) : new Set()
	const halt = genotype2sample.has(genotype_types.halt) ? genotype2sample.get(genotype_types.halt) : new Set()
	const het = genotype2sample.has(genotype_types.het) ? genotype2sample.get(genotype_types.het) : new Set()
	let AC = 0,
		AN = 0
	for (const sample of samples) {
		let isdiploid = false
		if (afconfig.sex_chrs.includes(chr)) {
			if (afconfig.male_samples.has(sample)) {
				if (afconfig.chr2par && afconfig.chr2par[chr]) {
					for (const par of afconfig.chr2par[chr]) {
						if (pos >= par.start && pos <= par.stop) {
							isdiploid = true
							break
						}
					}
				}
			} else {
				isdiploid = true
			}
		} else {
			isdiploid = true
		}
		if (isdiploid) {
			AN += 2
			if (halt.has(sample)) {
				AC += 2
			} else if (het.has(sample)) {
				AC++
			}
		} else {
			AN++
			if (!href.has(sample)) AC++
		}
	}
	return AN == 0 || AC == 0 ? 0 : (AC / AN).toFixed(3)
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
		w2 = lst[j == -1 ? l - 1 : j - 1].value
	}
	const out = lst.filter(i => i.value < p25 - iqr * 1.5 || i.value > p75 + iqr * 1.5)
	return { w1, w2, p05, p25, p50, p75, p95, iqr, out }
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}
