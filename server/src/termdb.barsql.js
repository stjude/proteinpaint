const app = require('./app')
const path = require('path')
const utils = require('./utils')
const Partjson = require('partjson')
const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')
const termdbsql = require('./termdb.sql')

/*
********************** EXPORTED
handle_request_closure
**********************
*/

exports.handle_request_closure = genomes => {
	return async (req, res) => {
		const q = req.query
		for (const i of [0, 1, 2]) {
			const termnum = 'term' + i
			const termnum_id = termnum + '_id'
			if (q[termnum_id]) {
				q[termnum_id] = decodeURIComponent(q[termnum_id])
			}
			const termnum_q = termnum + '_q'
			if (q[termnum_q]) {
				q[termnum_q] = JSON.parse(decodeURIComponent(q[termnum_q]))
			}
		}
		app.log(req)
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.cohort) throw 'ds.cohort missing'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'no termdb for this dataset'

			// process triggers
			await barchart_data(q, ds, res, tdb)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function barchart_data(q, ds, res, tdb) {
	/*
  q: objectified URL query string
  ds: dataset
  res: express route callback's response argument
  tdb: cohort termdb tree 
*/
	if (!ds.cohort) throw 'cohort missing from ds'
	q.ds = ds

	if (q.ssid) {
		const [sample2gt, genotype2sample] = await utils.loadfile_ssid(q.ssid)
		q.sample2gt = sample2gt
		q.genotype2sample = genotype2sample
	}

	const startTime = +new Date()
	q.results = termdbsql.get_rows(q, { withCTEs: true })
	const sqlDone = +new Date()
	const pj = getPj(q, q.results.lst, tdb, ds)
	if (pj.tree.results) {
		pj.tree.results.times = {
			sql: sqlDone - startTime,
			pj: pj.times
		}
	}
	res.send(pj.tree.results)
}

// template for partjson, already stringified so that it does not
// have to be re-stringified within partjson refresh for every request
const template = JSON.stringify({
	'@errmode': ['', '', '', ''],
	'@before()': '=prep()',
	results: {
		'_2:maxAcrossCharts': '=maxAcrossCharts()',
		'_:_min': '>$nval1',
		'_:_max': '<$nval1',
		charts: [
			{
				chartId: '@key',
				'~samples': ['$sample', 'set'],
				'__:total': '=sampleCount()',
				'_1:maxSeriesTotal': '=maxSeriesTotal()',
				'@done()': '=filterEmptySeries()',
				serieses: [
					{
						seriesId: '@key',
						data: [
							{
								dataId: '@key',
								'~samples': ['$sample', 'set'],
								'__:total': '=sampleCount()'
							},
							'$key2'
						],
						'_:_max': '<$nval2', // needed by client-side boxplot renderer
						'~values': ['$nval2', 0],
						'~sum': '+$nval2',
						'~samples': ['$sample', 'set'],
						'__:total': '=sampleCount()',
						'__:boxplot': '=boxplot()',
						'__:AF': '=getAF()'
					},
					'$key1'
				]
			},
			'$key0'
		],
		'~sum': '+$nval1',
		'~values': ['$nval1', 0],
		'__:boxplot': '=boxplot()',
		'_:_refs': {
			cols: ['$key1'],
			colgrps: ['-'],
			rows: ['$key2'],
			rowgrps: ['-'],
			col2name: {
				$key1: {
					name: '@branch',
					grp: '-'
				}
			},
			row2name: {
				$key2: {
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

function getPj(q, data, tdb, ds) {
	/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/
	const joinAliases = ['chart', 'series', 'data']
	const terms = [0, 1, 2].map(i => {
		const d = getTermDetails(q, tdb, i)
		d.q.index = i
		const bins = q.results['CTE' + i].bins ? q.results['CTE' + i].bins : []
		return Object.assign(d, {
			key: 'key' + i,
			val: 'val' + i,
			nval: 'nval' + i,
			isGenotype: q['term' + i + '_is_genotype'],
			bins,
			q: d.q,
			orderedLabels:
				d.term.type == 'condition' && d.term.grades
					? d.term.grades.map(grade => d.term.values[grade].label)
					: d.term.type == 'condition'
					? [0, 1, 2, 3, 4, 5, 9].map(grade => d.term.values[grade].label) // hardcoded default order
					: bins.map(bin => (bin.name ? bin.name : bin.label))
		})
	})

	return new Partjson({
		data,
		seed: `{"results": {"charts": [], "refs":{}}}`, // result seed
		template,
		'=': {
			prep(row) {
				// mutates the data row, ok since
				// rows from db query are unique to request
				for (const d of terms) {
					if (d.isGenotype) {
						const genotype = q.sample2gt.get(row.sample)
						if (!genotype) return
						row[d.key] = genotype
						row[d.val] = genotype
					} else if (d.term.type == 'condition') {
						row[d.key] = d.q.bar_by_grade && row[d.key] in d.term.values ? d.term.values[row[d.key]].label : row[d.key]
						row[d.val] = row[d.key]
					} else if (d.term.type == 'float' || d.term.type == 'integer') {
						// only computable values are included for boxplot
						if (d.isComputableVal(row[d.val])) row[d.nval] = row[d.val]
					}
				}
				return true
			},
			sampleCount(row, context) {
				return context.self.samples ? context.self.samples.size : undefined
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
				const values = context.self.values
				if (!values || !values.length) return
				values.sort((i, j) => i - j)
				const stat = app.boxplot_getvalue(
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
				stat.min = context.self.min
				stat.max = context.self.max
				return stat
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
					q.genotype2sample,
					ds
				)
			},
			filterEmptySeries(result) {
				const nonempty = result.serieses.filter(series => series.total)
				result.serieses.splice(0, result.serieses.length, ...nonempty)
			},
			bins() {
				return terms.map(d => d.bins)
			},
			q() {
				return terms.map((d, i) => {
					const q = {}
					for (const key in d.q) {
						if (key != 'index') q[key] = d.q[key]
					}
					return q
				})
			},
			useColOrder() {
				return terms[1].orderedLabels.length > 0
			},
			useRowOrder() {
				return terms[2].orderedLabels.length > 0
			},
			sortColsRows(result) {
				if (terms[1].orderedLabels.length) {
					const labels = terms[1].orderedLabels
					result.cols.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}
				if (terms[2].orderedLabels.length) {
					const labels = terms[2].orderedLabels
					result.rows.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}
			},
			sortCharts(result) {
				if (terms[0].orderedLabels.length) {
					const labels = terms[0].orderedLabels
					result.charts.sort((a, b) => labels.indexOf(a.chartId) - labels.indexOf(b.chartId))
				}
			}
		}
	})
}

function getTermDetails(q, tdb, index) {
	const termnum_id = 'term' + index + '_id'
	const termid = q[termnum_id]
	const term = termid && !q['term' + index + '_is_genotype'] ? tdb.q.termjsonByOneid(termid) : {}
	const termIsNumeric = term.type == 'integer' || term.type == 'float'
	const unannotatedValues = term.values
		? Object.keys(term.values)
				.filter(key => term.values[key].uncomputable)
				.map(v => +v)
		: []
	// isComputableVal is needed for boxplot
	const isComputableVal = val => termIsNumeric && !unannotatedValues.includes(val)
	const termq = q['term' + index + '_q'] ? q['term' + index + '_q'] : {}
	return { term, isComputableVal, q: termq }
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
    returned by loadfile_ssid()
- ds{}
*/
	const afconfig = ds.track.vcf.termdb_bygenotype // location of configurations
	const href = genotype2sample.has(utils.genotype_types.href)
		? genotype2sample.get(utils.genotype_types.href)
		: new Set()
	const halt = genotype2sample.has(utils.genotype_types.halt)
		? genotype2sample.get(utils.genotype_types.halt)
		: new Set()
	const het = genotype2sample.has(utils.genotype_types.het) ? genotype2sample.get(utils.genotype_types.het) : new Set()
	let AC = 0,
		AN = 0
	for (const sample of samples) {
		let isdiploid = false
		if (afconfig.sex_chrs.has(chr)) {
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
