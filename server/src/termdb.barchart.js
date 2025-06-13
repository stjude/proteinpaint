import path from 'path'
import * as utils from './utils.js'
import Partjson from 'partjson'
import { format } from 'd3-format'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from './termdb.matrix.js'
import { mclass, dt2label } from '#shared/common.js'

const binLabelFormatter = format('.3r')

/*
********************** EXPORTED
handle_request_closure
getOrderedLabels
barchart_data
**********************
*/

export function handle_request_closure(genomes) {
	return async (req, res) => {
		const q = req.query
		for (const i of [0, 1, 2]) {
			const termnum = 'term' + i
			const termnum_id = termnum + '_id'
			const termnum_type = termnum + '_type'
			if (typeof q[termnum_id] == 'string') {
				q[termnum_id] = decodeURIComponent(q[termnum_id])
			} else if (typeof q[termnum] == 'string') {
				q[termnum] = JSON.parse(decodeURIComponent(q[termnum]))
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
			const results = await barchart_data(q, ds, tdb)
			if (q.term2_q) {
				//term2 is present
				//compute pvalues using Fisher's exact/Chi-squared test
				await computePvalues(results.data, ds, q.hiddenValues)
			}
			res.send(results)
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
export async function barchart_data(q, ds, tdb) {
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
	q.results = {}
	const map = new Map()
	for (let i = 0; i <= 2; i++) {
		let term = null
		if (q[`term${i}_id`]) {
			const id = q[`term${i}_id`]
			term = { id, q: q[`term${i}_q`], term: { id }, $id: q[`term${i}_$id`] }
		} else if (q[`term${i}`]) term = { term: q[`term${i}`], q: q[`term${i}_q`], $id: q[`term${i}_$id`] }
		if (term) map.set(i, term)
	}
	const terms = [...map.values()]
	const data = await getData({ filter: q.filter, filter0: q.filter0, terms }, q.ds, q.genome)
	if (data.error) throw data.error
	const samplesMap = new Map()
	const bins = []
	const categories = []
	if (data.samples) {
		const t1 = map.get(1)
		const t2 = map.get(2)
		if (
			(t1?.term?.type == 'geneVariant' && t1.q.type == 'values') ||
			(t2?.term?.type == 'geneVariant' && t2.q.type == 'values')
		) {
			// term1 or term2 is a geneVariant term that is not using groupsetting
			// data will need to be handled using specialized logic
			// data from geneVariant term using groupsetting can be handled using regular logic
			processGeneVariantSamples(map, bins, data, samplesMap, ds)
		} else {
			for (let i = 0; i <= 2; i++) {
				const q = map.get(i)?.q
				const tw = map.get(i)
				const term = tw?.term || null
				const id = tw?.$id
				if (id && data.refs.byTermId[id]?.bins) bins.push(data.refs.byTermId[id]?.bins)
				else bins.push([])
				if (id && data.refs.byTermId[id]?.categories) categories.push(data.refs.byTermId[id]?.categories)
				else categories.push([])
				if (q?.binColored) {
					for (const bin of bins[i]) {
						const qbin = q.binColored
						const binMatched = qbin.find(i => bin.start == i.start && bin.stop == i.stop)
						if (binMatched) bin.color = binMatched.color
					}
				}
				for (const [sampleId, values] of Object.entries(data.samples)) {
					let item
					if (samplesMap.get(sampleId)) item = samplesMap.get(sampleId)
					else if (!samplesMap.has(sampleId)) {
						item = { sample: sampleId }
						samplesMap.set(sampleId, item)
					}
					if (!item) continue
					if (id) {
						const value = values[id]
						if (!value) {
							//console.log(`Sample ${sampleId} has no term ${id} value, filtered out`)
							samplesMap.set(sampleId, null)
						} else {
							if (tw.term.type == 'geneVariant') {
								// geneVariant term using groupsetting
								// value{} will have .key, .value, and .values[]
								// .key and .value are both the group
								// assignment of the sample and should be
								// used for plotting
								// .values[] contains the mutation data of
								// the sample and should not be used for
								// plotting/dedpulication
								item[`key${i}`] = i != 1 ? value.key : [value.key]
								item[`val${i}`] = value.value
							} else {
								// this series key will not deduplicate multi-valued samples (those that belong to multiple groups)
								item[`key${i}`] = i != 1 ? value.key : value.values?.map(v => v.key) || [value.key]
								item[`val${i}`] = value.value
								// the dedupkey1 will separate out multi-valued samples
								if (i === 1) item.dedupkey1 = value.values ? [`${value.values.length}-value samples`] : [value.key]
							}
						}
					} else {
						item[`key${i}`] = ''
						item[`val${i}`] = ''
					}
				}
			}
		}
	}
	q.results.lst = [...samplesMap.values()].filter(value => value !== null)
	q.results.bins = bins
	const sqlDone = +new Date()
	const pj = getPj(q, q.results.lst, tdb, ds)
	if (pj.tree.results) {
		pj.tree.results.times = {
			sql: sqlDone - startTime,
			pj: pj.times
		}
	}
	const result = { data: pj.tree.results, bins, categories, sampleType: data.sampleType }
	return result
}

//used by barchart_data
//process gene variant data into samplesMap
function processGeneVariantSamples(map, bins, data, samplesMap, ds) {
	bins.push([])
	let customSampleID = 1
	const tw1 = map.get(1)
	const term1 = tw1?.term || null
	const id1 = tw1?.$id ? tw1.$id : term1?.id && term1?.type != 'geneVariant' ? term1.id : term1?.name
	if (id1 && data.refs.byTermId[id1]?.bins) bins.push(data.refs.byTermId[id1]?.bins)
	else bins.push([])

	const tw2 = map.get(2)
	const term2 = tw2?.term || null
	const id2 = tw2?.$id ? tw2.$id : term2?.id && term1?.type != 'geneVariant' ? term2.id : term2?.name
	if (id2 && data.refs.byTermId[id2]?.bins) bins.push(data.refs.byTermId[id2]?.bins)
	else bins.push([])

	for (const [sampleId, values] of Object.entries(data.samples)) {
		if (map.get(1)?.term?.type == 'geneVariant') {
			const processedValues = []
			const value1 = values[id1]
			if (!value1) continue // skip samples without data for geneVariant term
			for (const v1 of value1.values) {
				const v1label = v1.label || mclass[v1.class].label
				if (processedValues.some(p => p.value.dt == v1.dt && (v1.origin ? v1.origin == p.value.origin : true))) {
					const sameDtOrigin = processedValues.filter(
						p => p.value.dt == v1.dt && (v1.origin ? v1.origin == p.value.origin : true)
					)[0]
					if (typeof sameDtOrigin.item[`key1`] !== 'object') {
						const tmpKey = sameDtOrigin.item[`key1`]
						sameDtOrigin.item[`key1`] = {}
						sameDtOrigin.item[`key1`][tmpKey] = 1
					}
					sameDtOrigin.item[`key1`][v1label] = sameDtOrigin.item[`key1`][v1label]
						? sameDtOrigin.item[`key1`][v1label] + 1
						: 1
				} else {
					const item = { sample: customSampleID }
					item[`key1`] = item[`val1`] = v1label

					const byOrigin = ds.assayAvailability?.byDt?.[v1.dt]?.byOrigin
					if (byOrigin) {
						item.key0 = item.val0 = (byOrigin[v1.origin]?.label || v1.origin) + ' ' + dt2label[v1.dt]
					} else {
						// not by origin
						item.key0 = item.val0 = dt2label[v1.dt]
					}

					item[`key2`] = values[id2] ? values[id2].key : ''
					item[`val2`] = values[id2] ? values[id2].value : ''
					processedValues.push({ value: v1, item })
				}
			}
			for (const processedValue of processedValues) {
				if (typeof processedValue.item['key1'] == 'object') {
					let finalKey = ''
					for (const [key, value] of Object.entries(processedValue.item['key1'])) {
						finalKey += `${key}(${value})+`
					}
					processedValue.item['key1'] = finalKey.slice(0, -1)
					processedValue.item['val1'] = finalKey.slice(0, -1)
				}
				samplesMap.set(customSampleID.toString(), processedValue.item)
				customSampleID++
			}
		} else if (map.get(2)?.term?.type == 'geneVariant') {
			const processedValues = []
			const value2 = values[id2]
			const value1 = values[id1]
			if (!value2) continue // skip samples without data for geneVariant term
			for (const v2 of value2.values) {
				const v2label = v2.label || mclass[v2.class].label
				if (processedValues.some(p => p.value.dt == v2.dt && (v2.origin ? v2.origin == p.value.origin : true))) {
					const sameDtOrigin = processedValues.filter(
						p => p.value.dt == v2.dt && (v2.origin ? v2.origin == p.value.origin : true)
					)[0]
					if (typeof sameDtOrigin.item[`key2`] !== 'object') {
						const tmpKey = sameDtOrigin.item[`key2`]
						sameDtOrigin.item[`key2`] = {}
						sameDtOrigin.item[`key2`][tmpKey] = 1
					}
					sameDtOrigin.item[`key2`][v2label] = sameDtOrigin.item[`key2`][v2label]
						? sameDtOrigin.item[`key2`][v2label] + 1
						: 1
				} else {
					const item = { sample: customSampleID }
					item[`key1`] = value1.key
					item[`val1`] = value1.value

					const byOrigin = ds.assayAvailability?.byDt?.[v2.dt]?.byOrigin
					if (byOrigin) {
						item.key0 = item.val0 = (byOrigin[v2.origin]?.label || v2.origin) + ' ' + dt2label[v2.dt]
					} else {
						// not by origin
						item.key0 = item.val0 = dt2label[v2.dt]
					}

					item[`key2`] = v2label
					item[`val2`] = v2label
					processedValues.push({ value: v2, item })
				}
			}
			for (const processedValue of processedValues) {
				if (typeof processedValue.item['key2'] == 'object') {
					let finalKey = ''
					for (const [key, value] of Object.entries(processedValue.item['key2'])) {
						finalKey += `${key}(${value})+`
					}
					processedValue.item['key2'] = finalKey.slice(0, -1)
					processedValue.item['val2'] = finalKey.slice(0, -1)
				}
				samplesMap.set(customSampleID.toString(), processedValue.item)
				customSampleID++
			}
		}
	}
}

// template for partjson, already stringified so that it does not
// have to be re-stringified within partjson refresh for every request
const seriesTemplate = {
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
}

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
				serieses: [seriesTemplate, '$key1[]'],
				dedupedSerieses: [seriesTemplate, '$dedupkey1[]']
			},
			'$key0'
		],
		'~sum': '+$nval1',
		'~values': ['$nval1', 0],
		'__:boxplot': '=boxplot()',
		'_:_refs': {
			cols: ['$key1[]'],
			dedupCols: ['$dedupkey1[]'],
			colgrps: ['-'],
			rows: ['$key2'],
			rowgrps: ['-'],
			col2name: {
				'$key1[]': {
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
		const bins = q.results.bins[i]

		return Object.assign(d, {
			key: 'key' + i,
			val: 'val' + i,
			nval: 'nval' + i,
			bins,
			q: d.q,
			orderedLabels: getOrderedLabels(d.term, bins, undefined, d.q)
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
					// Expect all main term data to be an array, even if single-keyed,
					// in order for the input data shape to match the $key1[] template,
					// and in case the row key is not already an array
					if (d.key == 'key1' && !Array.isArray(row[d.key])) row[d.key] = [row[d.key]]

					if (d.term.type == 'condition') {
						if (d.q.bar_by_grade) {
							if (Array.isArray(row[d.key])) {
								for (const [i, k] of row[d.key].entries()) {
									if (k in d.term.values) row[d.key][i] = d.term.values[k].label
								}
								if (d.key == 'key1' && row.dedupkey1) {
									for (const [i, k] of row.dedupkey1.entries()) {
										if (k in d.term.values) row.dedupkey1[i] = d.term.values[k].label
									}
								}
							} else {
								if (row[d.key] in d.term.values) row[d.key] = d.term.values[row[d.key]].label
							}
						}

						//row[d.key] = d.q.bar_by_grade && row[d.key] in d.term.values ? d.term.values[row[d.key]].label : row[d.key]
						//row[d.val] = row[d.key]
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
				const stat = utils.boxplot_getvalue(
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
					if (result.dedupCols) result.dedupCols.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}
				if (terms[2].orderedLabels.length) {
					const labels = terms[2].orderedLabels
					result.rows.sort((a, b) => labels.indexOf(a) - labels.indexOf(b))
				}

				if (result.dedupCols) {
					const labels = terms[1].orderedLabels
					result.dedupCols.sort((a, b) => {
						const da = `${a}`.includes('-value samples')
						const db = `${b}`.includes('-value samples')
						if (!da && !db) return labels.indexOf(a) - labels.indexOf(b)
						if (da && db) return a < b ? -1 : 1
						if (da) return 1
						if (db) return -1
						return 0
					})
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

export function getOrderedLabels(term, bins, events, q) {
	if (events) return events.map(e => e.label)
	if (term.type == 'condition') {
		if (q?.groups?.length) return q.groups.map(g => g.name)
		if (term.values) {
			return Object.keys(term.values)
				.map(Number)
				.sort((a, b) => a - b)
				.map(i => term.values[i].label)
		}
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
			.map(i => term.values[i].key)
	}
	return bins?.map(bin => (bin.name ? bin.name : bin.label))
}

function getTermDetails(q, tdb, index) {
	const termnum_id = 'term' + index + '_id'
	const termid = q[termnum_id]
	let term = {}
	if (q[termid]) term = tdb.q.termjsonByOneid(termid)
	else if (termid) term = tdb.q.termjsonByOneid(termid)
	else if (q[`term${index}`]) term = q[`term${index}`]

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

/*
Run Fisher's exact test or Chi-squared test to determine if the proportion of a spcific term2 category is significantly different
between a specific term1 group and the rest of term1 groups combined, using a 2x2 contingency table:

            [Male]  [not Male]
[white]       R1C1     R1C2
[not white]   R2C1     R2C2

input parameter: 
{
	data: an object contains data of barcharts, structure is 

			.charts=[]
			.serieses=[]
				.seriesId=str // key of term1 category
				.total=int // total of this category
				.data=[]
					.dataId=str // key of term2 category, '' if no term2
					.total=int // size of this term1-term2 combination

	hiddenValues: an object contains hidden term1 and term2 group labels
			.term1=[str]
			.term2=[str]
}

Output: The function has no return but appends the statistical results to the provided data object as data.tests:
{
	chartId:[
		{
			term1comparison: term1,
			term2tests:[
				term2id: term2,
				pvalue: ...,
				adjusted_p_value: ...,
				tableValues: {R1C1, R2C1, R1C2, R2C2},
				isChi,
				skipped
			]
		}
	]
}
*/
async function computePvalues(data, ds, hiddenValues) {
	// create new charts without hidden values
	const charts = []
	for (const chart of data.charts) {
		const newChart = {}
		newChart.chartId = chart.chartId
		newChart.serieses = []
		const filteredSerieses = chart.serieses.filter(s => !hiddenValues.term1.includes(s.seriesId))
		for (const s of filteredSerieses) {
			const newS = {}
			newS.seriesId = s.seriesId
			newS.data = s.data.filter(d => !hiddenValues.term2.includes(d.dataId))
			newS.total = newS.data.reduce((sum, curr) => sum + curr.total, 0)
			newChart.serieses.push(newS)
		}
		newChart.total = newChart.serieses.reduce((sum, curr) => sum + curr.total, 0)
		newChart.maxSeriesTotal = newChart.serieses.reduce((max, curr) => (max < curr.total ? curr.total : max), 0)
		charts.push(newChart)
	}

	data.tests = {}
	for (const chart of charts) {
		// calculate sum of each term2 category. Structure: {term2Catergory1: num of samples, term2Catergory2: num of samples, ...}
		const colSums = {}
		for (const row of chart.serieses) {
			for (const col of row.data) {
				colSums[col.dataId] = colSums[col.dataId] === undefined ? col.total : colSums[col.dataId] + col.total
			}
		}

		//generate input for Fisher's exact test/Chi-squared test
		const input = []
		let testIndex = 0
		const index2labels = new Map()
		for (const row of chart.serieses) {
			for (const term2cat of row.data) {
				const R1C1 = term2cat.total //# of term2 category of interest in term1 category of interest (e.g. # of male in white), represents R1C1 in 2X2 contingency table
				const R2C1 = colSums[term2cat.dataId] - term2cat.total //# of term2 category of interest in term1 not category of interest (e.g. # of male in not white),  represents R2C1 in 2X2 contingency table
				const R1C2 = row.total - term2cat.total //# of term2 not category of interest in term1 category of interest (e.g. # of not male in white), represents R1C2 in 2X2 contingency table
				const R2C2 = chart.total - colSums[term2cat.dataId] - (row.total - term2cat.total) //# of term2 not category of interest in term1 not category of interest (e.g. # of not male in not white), represents R2C2 in 2X2 contingency table

				const seriesId = row.seriesId
				const dataId = term2cat.dataId
				input.push({
					index: testIndex,
					n1: R1C1,
					n2: R2C1,
					n3: R1C2,
					n4: R2C2
				})
				index2labels.set(testIndex, { seriesId, dataId })
				testIndex++
			}
		}

		// run Fisher's exact test/Chi-squared test
		const rust_input = { input }
		const mtc = ds.cohort.termdb.multipleTestingCorrection
		if (mtc) {
			rust_input.mtc = mtc.method
			if (mtc.skipLowSampleSize) rust_input.skipLowSampleSize = mtc.skipLowSampleSize
		}
		const resultWithPvalue = await run_rust('fisher', JSON.stringify(rust_input))
		/*
		parse the test result into pvalueTable array:
		[{
			term1comparison: seriesId,
			term2tests:[
				term2id: dataId,
				pvalue: ...,
				adjusted_p_value: ...,
				tableValues: {R1C1, R2C1, R1C2, R2C2},
				isChi
				skipped
			]
		}, ...]
		*/
		const pvalueTable = []
		for (const test of JSON.parse(resultWithPvalue)) {
			const seriesId = index2labels.get(test.index).seriesId
			const dataId = index2labels.get(test.index).dataId
			const R1C1 = test.n1
			const R2C1 = test.n2
			const R1C2 = test.n3
			const R2C2 = test.n4
			const pvalue = test.p_value //if skipLowSampleSize is true, null for cases with low sample sizes
			const isChi = test.fisher_chisq === 'chisq'
			const skipped = pvalue === null
			const adjusted_p_value = test.adjusted_p_value

			const t1c = pvalueTable.find(t1c => t1c.term1comparison === seriesId)
			if (!t1c) {
				pvalueTable.push({
					term1comparison: seriesId,
					term2tests: [
						{
							term2id: dataId,
							pvalue: pvalue,
							adjusted_p_value: adjusted_p_value,
							tableValues: {
								R1C1,
								R2C1,
								R1C2,
								R2C2
							},
							isChi,
							skipped
						}
					]
				})
			} else {
				t1c.term2tests.push({
					term2id: dataId,
					pvalue: pvalue,
					adjusted_p_value: adjusted_p_value,
					tableValues: {
						R1C1,
						R2C1,
						R1C2,
						R2C2
					},
					isChi,
					skipped
				})
			}
		}
		data.tests[chart.chartId] = pvalueTable
	}
}
