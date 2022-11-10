const app = require('./app')
const path = require('path')
const utils = require('./utils')
const Partjson = require('partjson')
const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')
const termdbsql = require('./termdb.sql')
const run_rust = require('@stjude/proteinpaint-rust').run_rust

/*
********************** EXPORTED
handle_request_closure
getOrderedLabels
get_barchart_data_sqlitedb
**********************
*/

export function handle_request_closure(genomes) {
	return async (req, res) => {
		const q = req.query
		for (const i of [0, 1, 2]) {
			const termnum = 'term' + i
			const termnum_id = termnum + '_id'
			if (typeof q[termnum_id] == 'string') {
				q[termnum_id] = decodeURIComponent(q[termnum_id])
			}
			const termnum_q = termnum + '_q'
			if (typeof q[termnum_q] == 'string') {
				q[termnum_q] = JSON.parse(decodeURIComponent(q[termnum_q]))
			}
		}
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.cohort) throw 'ds.cohort missing'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'no termdb for this dataset'
			const data = await barchart_data(q, ds, tdb)
			await computePvalues(data) //Generate and attach to data the pvalueTable object, which stores p-values of Fisher's exact/Chi-squared test
			res.send(data)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

/*
inputs:
q{}
	objectified URL query string
	.term1_id=str
	.term1_q={}
		termsetting obj for term1
	.term2_id=str
	.term2_q={}
		termsetting obj for term2
	.term0_id=str
	.term0_q={}
		termsetting obj for term0
	.filter=stringified filter json obj
ds{}
	server-side dataset obj
tdb{}
	ds.cohort.termdb

output an object:
.charts=[]
	.serieses=[]
		.seriesId=str // key of term1 category
		.total=int // total of this category
		.data=[]
			.dataId=str // key of term2 category, '' if no term2
			.total=int // size of this term1-term2 combination
*/
async function barchart_data(q, ds, tdb) {
	/*
	!!quick fix!!
	tricky logic

	(1) when a barchart is launched from mass, it needs to retrieve total number of samples annotated to a term

	(2) when a barchart is launched from a mds3 track, it needs to retrieve number of *mutated* samples based on a term, in addition to total

	in (1), it launches from a mds2 dataset with termdb
	in (2), it launches from a mds3 dataset which supports termdb among others (gdc api, bcf/tabix)

	TODO in future:
	mds3 should serve both (1) and (2), and deprecate mds2
	add new attribute in q{} to tell if query is (1) or (2)
	TODO mds3 getter for (1), since it can be served by sqlite db or gdc api
	*/

	if (typeof q.get == 'string' && ds.isMds3 && ds?.variant2samples?.get) {
		/*
		presence of q.get (value should be "summary") indicates this is for mds3 variant2sample.get()

		for now this condition checking is a quick fix to detect (2)
		later should state this explicitly with new attribute in q{}
		*/
		return await ds.variant2samples.get(q, ds)
	}

	// this query is for (1)
	if (ds?.termdb?.termid2totalsize2?.get) {
		// mds3 implementation which wraps sqlitedb support
		throw 'barsql parameter not fitting termid2totalsize2.get() yet'
		return await ds.termdb.termid2totalsize2.get(q)
	}

	if (ds.cohort?.db?.connection) {
		// using sqlite db
		return await get_barchart_data_sqlitedb(q, ds, tdb)
	}

	throw 'unknown method to get barchart data'
}

export async function get_barchart_data_sqlitedb(q, ds, tdb) {
	/* existing code to work with mds2 which only supports backend-termdb
	as later mds2 will be deprecated and migrated to mds3,
	there should be no need to check for isMds3 flag
	*/

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
	//console.log(JSON.stringify(pj.tree.results))
	return pj.tree.results
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
			orderedLabels: getOrderedLabels(d.term, bins)
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

export function getOrderedLabels(term, bins) {
	if (term.type == 'condition' && term.values) {
		return Object.keys(term.values)
			.map(Number)
			.sort((a, b) => a - b)
			.map(i => term.values[i].label)
	}
	const firstVal = Object.values(term.values || {})[0]
	if (firstVal && 'order' in firstVal) {
		return Object.keys(term.values)
			.sort((a, b) =>
				'order' in term.values[a] && 'order' in term.values[b]
					? term.values[a].order - term.values[b].order
					: 'order' in term.values[a]
					? term.values[a].order
					: 'order' in term.values[b]
					? term.values[b].order
					: 0
			)
			.map(i => term.values[i].label)
	}
	return bins.map(bin => (bin.name ? bin.name : bin.label))
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

//Given the data object below, generate an array that is composed of elements in format `0\t1005\t1180\t1000\t1200`,
//then call the run_rust() function to calculate p-values: run_rust('fisher', 'fisher_limits\t' + 300 + '\t' + 150 + '-' + data.join('-')),
//then add the returned value from run_rust () into data as a new property data.pvalueTable.
/*
example of data.charts[0].serieses 
[
  {
    seriesId: '5 to <10',
    data: [ [Object], [Object], [Object], [Object] ],
    total: 999
  },
  {
    seriesId: '15 to <20',
    data: [ [Object], [Object], [Object] ],
    total: 649
  },
  {
    seriesId: '<5',
    data: [ [Object], [Object], [Object], [Object] ],
    total: 1924
  },
  {
    seriesId: '10 to <15',
    data: [ [Object], [Object], [Object], [Object] ],
    total: 924
  },
  {
    seriesId: '≥20',
    data: [ [Object], [Object], [Object] ],
    total: 32
  }
]

example of data.charts[0].serieses[0].data 

[
  { dataId: 'White', total: 818 },
  { dataId: 'Black', total: 153 },
  { dataId: 'Other', total: 26 },
  { dataId: 'Unknown', total: 2 }
]

  */
async function computePvalues(data, fisher_limit = 300, individual_fisher_limit = 150, pvalueCutoff = 0.05) {
	if (data.refs.rows.length < 2) return //no term2, cannot calculate p-value

	// calculate sum of each term2 category. Structure: {term2Catergory1: num of samples, term2Catergory2: num of samples, ...}
	const colSums = {}
	for (const row of data.charts[0].serieses) {
		for (const col of row.data) {
			colSums[col.dataId] = colSums[col.dataId] === undefined ? col.total : colSums[col.dataId] + col.total
		}
	}

	//generate inputs for Fisher's exact test/Chi-squared test. format for each input: `label\tR1C1\tR2C1\tR1C2\tR2C2`
	const fisherAndChiInputData = []
	for (const row of data.charts[0].serieses) {
		for (const term2cat of row.data) {
			let R1C1 = term2cat.total //# of term2 category of interest in term1 category of interest (e.g. # of male in age group < 5), represents R1C1 in 2X2 contingency table
			let R2C1 = colSums[term2cat.dataId] - term2cat.total //# of term2 category of interest in term1 not category of interest (e.g. # of male in age group not < 5),  represents R2C1 in 2X2 contingency table
			let R1C2 = row.total - term2cat.total //# of term2 not category of interest in term1 category of interest (e.g. # of not male in age group < 5), represents R1C2 in 2X2 contingency table
			let R2C2 = data.charts[0].total - colSums[term2cat.dataId] - (row.total - term2cat.total) //# of term2 not category of interest in term1 not category of interest (e.g. # of not male in age group not < 5), represents R2C2 in 2X2 contingency table

			//replace hyphen/tab in seriesId and dataId with @hyphen@ and @tab@ to avoid being split in fisher.rs, which uses '-' and '\t' to split input
			let seriesId = row.seriesId.replace('-', '@hyphen@').replace('\t', '@tab@')
			let dataId = term2cat.dataId.replace('-', '@hyphen@').replace('\t', '@tab@')

			fisherAndChiInputData.push(`${seriesId}@@${dataId}\t${R1C1}\t${R2C1}\t${R1C2}\t${R2C2}`)
		}
	}
	const resultWithPvalue = await run_rust(
		'fisher',
		'fisher_limits\t' + fisher_limit + '\t' + individual_fisher_limit + '-' + fisherAndChiInputData.join('-')
	)

	const pvalueTable = []
	let group = {
		term1comparison: undefined,
		term2tests: []
	}
	for (const test of resultWithPvalue.split('\n').filter(Boolean)) {
		let seriesId = test.split('@@')[0]
		seriesId = seriesId.replace('@hyphen@', '-').replace('@tab@', '\t') //change @hyphen@ and @tab@ in seriesId back to hyphen/tab
		let term1comparison = seriesId

		if (group.term1comparison !== undefined && group.term1comparison !== term1comparison) {
			pvalueTable.push(group)
			group = {
				term1comparison: undefined,
				term2tests: []
			}
		}
		group.term1comparison = term1comparison

		let dataId = test.split('@@')[1].split('\t')[0]
		dataId = dataId.replace('@hyphen@', '-').replace('@tab@', '\t') //change @hyphen@ and @tab@ in dataId back to hyphen/tab
		group.term2tests.push({
			term2id: dataId,
			pvalue: test.split('@@')[1].split('\t')[5],
			significant: test.split('@@')[1].split('\t')[5] < pvalueCutoff
		})
	}
	pvalueTable.push(group)

	data.pvalueTable = pvalueTable
}
