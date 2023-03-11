import { getData } from './termdb.matrix'
import fs from 'fs'
import path from 'path'
import utils from './utils'
import serverconfig from './serverconfig'
import { schemeCategory20, getColors } from '#shared/common'
import { interpolateSqlValues } from './termdb.sql'
import { mclass, dt2label, morigin } from '#shared/common'
import { getFilterCTEs } from './termdb.filter'
import authApi from './auth'

/*
works with "canned" scatterplots in a dataset, e.g. data from a text file of tSNE coordinates from a pre-analyzed cohort (contrary to on-the-fly analysis)

reason of not storing x/y data of canned plots in termdb annotations table:
1. a sample can have different x/y in multiple plots
   still, using term id e.g. x_tsne/y_tsne/x_umap/y_umap will solve it
2. keeping all plot data in annotations table adds complexity to sql query
   in that get_rows() may not work directly (need to pull out two numbers per sample)?
3. has need to support "reference" samples (e.g. DKFZ reference cohort in PNET tsne)
   with annotations table, the reference samples need to be mixed with case samples
   but this cause filtering to skip all reference samples (which shouldn't)
   thus can be tricky to manage

to find out efficiency comparison of file vs sqlite db with 1 million dots


exported functions:

mayInitiateScatterplots()
trigger_getSampleScatter()

*/

// color of reference samples, they should be shown as a "cloud" of dots at backdrop
const refColor = '#F5F5DC'

// called in mds3.init
export async function mayInitiateScatterplots(ds) {
	if (!ds.cohort.scatterplots) return
	if (!Array.isArray(ds.cohort.scatterplots.plots)) throw 'cohort.scatterplots.plots is not array'
	for (const p of ds.cohort.scatterplots.plots) {
		if (!p.name) throw '.name missing from one of scatterplots.plots[]'
		if (p.file) {
			const lines = (await utils.read_file(path.join(serverconfig.tpmasterdir, p.file))).trim().split('\n')

			const headerFields = lines[0].split('\t')

			p.filterableSamples = [] // array to keep filterable samples
			const referenceSamples = [] // optional array to keep reference samples

			let invalidXY = 0,
				sampleCount = 0

			for (let i = 1; i < lines.length; i++) {
				const l = lines[i].split('\t')
				// sampleName \t x \t y ...
				const x = Number(l[1]),
					y = Number(l[2])
				if (Number.isNaN(x) || Number.isNaN(y)) {
					invalidXY++
					continue
				}

				const sample = { sample: l[0], x, y }

				const id = ds.cohort.termdb.q.sampleName2id(l[0])
				if (id == undefined) {
					// no integer sample id found, this is a reference sample
					// for rest of columns starting from 4th, attach as key/value pairs to the sample object for showing on client
					if (headerFields[3]) {
						sample.info = {}
						for (let j = 3; j < headerFields.length; j++) {
							sample.info[headerFields[j]] = l[j]
						}
					}
					referenceSamples.push(sample)
				} else {
					// sample id can be undefined, e.g. reference samples
					sampleCount++
					sample.sampleId = id
					p.filterableSamples.push(sample)
				}
			}

			if (referenceSamples.length) p.referenceSamples = referenceSamples

			console.log(
				p.filterableSamples.length,
				`scatterplot lines from ${p.name} of ${ds.label},`,
				p.referenceSamples ? p.referenceSamples.length + ' reference cases' : '',
				invalidXY ? invalidXY + ' lines with invalid X/Y values' : ''
			)
		} else {
			throw 'unknown data source of one of scatterplots.plots[]'
		}
	}
}

/*


q.colorTW is required
q.shapeTW is optional

Uses q.colorTW{}  categories to color dots.
If q.shapeTW is provided uses categories to assign different shapes to dots
Runs getData to get category assignment of all eligible samples(filtered) for colorTW and shapeTW

The samples dropped by filter are missing from result.
input:

allSamples = []
q = {}
ds = {}

output:

{
	samples=[ {} ]
		.sample=str
		.category=str // rename to .colorCategory
		.shape=int
	colorLegend={}
		each element { category: {color=str, sampleCount=int} }
	shapeLegend=[]
		each element {category, {shape=int, sampleCount=int} }
}
*/
export async function trigger_getSampleScatter(req, q, res, ds, genome) {
	try {
		let refSamples, cohortSamples
		if (q.coordTWs.length == 2) {
			refSamples = []
			cohortSamples = await getScatterCoordinates(req, q, ds)
		} else {
			if (!q.plotName) throw `Neither plot name or coordinates where provided`
			if (!ds.cohort.scatterplots || !ds.cohort.scatterplots.plots) throw 'not supported'
			const plot = ds.cohort.scatterplots.plots.find(p => p.name == q.plotName)
			if (!plot) throw `plot not found with plotName ${q.plotName}`

			const result = await getSamples(req, ds, plot)
			refSamples = result[0]
			cohortSamples = result[1]
		}
		const terms = []
		if (q.colorTW) terms.push(q.colorTW)
		if (q.shapeTW) terms.push(q.shapeTW)
		const data = await getData({ filter: q.filter, terms }, ds, genome)
		if (data.error) throw data.error

		const result = await colorAndShapeSamples(refSamples, cohortSamples, data, q)
		res.send(result)
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

async function getSamples(req, ds, plot) {
	if (plot.filterableSamples) {
		// must make in-memory duplication of the objects as they will be modified by assigning .color/shape
		let samples = [],
			refSamples = []
		if (plot.referenceSamples) refSamples = readSamples(plot.referenceSamples)
		if (plot.filterableSamples) samples = readSamples(plot.filterableSamples)
		return [refSamples, samples]
	}
	if (plot.gdcapi) throw 'gdcapi not implemented yet'
	throw 'do not know how to load data from this plot'

	function readSamples(samples) {
		const result = []
		for (const i of JSON.parse(JSON.stringify(samples))) {
			//When reading from a file coordinates can be displayed
			//if (!authApi.canDisplaySampleIds(req, ds)) delete i.sample
			result.push(i)
		}
		return result
	}
}

async function colorAndShapeSamples(refSamples, cohortSamples, data, q) {
	const samples = refSamples.map(sample => ({ ...sample, category: 'Ref', shape: 'Ref' }))

	const shapeMap = new Map()
	const colorMap = new Map()

	for (const sample of cohortSamples) {
		const dbSample = data.samples[sample.sampleId.toString()]

		sample.cat_info = {}
		sample.hidden = {}
		let result = []
		if (!q.colorTW) {
			sample.category = 'Default'
			result.push(sample)
		} else {
			if (q.colorTW?.q?.mode === 'continuous') {
				if (dbSample) {
					sample.category = dbSample[q.colorTW.term.id].value
					result.push(sample)
				}
			} else result = processSample(dbSample, sample, q.colorTW, colorMap, 'category')
		}
		if (q.shapeTW) {
			for (const _sample of result) {
				const sresult = processSample(dbSample, _sample, q.shapeTW, shapeMap, 'shape')
				samples.push(...sresult)
			}
		} else {
			sample.shape = 'Ref'
			samples.push(...result)
		}
	}
	if (q.colorTW && q.colorTW.q.mode !== 'continuous') {
		let i = 20
		const scheme = schemeCategory20
		const k2c = getColors(colorMap.size)
		for (const [category, value] of colorMap) {
			const tvalue = q.colorTW.term.values?.[category]
			if (tvalue && 'color' in tvalue) value.color = tvalue.color
			else if (data.refs?.byTermId[q.colorTW.term.id]?.bins) {
				const bin = data.refs.byTermId[q.colorTW.term.id].bins.find(bin => bin.name === category)
				if (bin) value.color = bin.color
				else {
					value.color = scheme[i]
					i--
				}
			} else if (q.colorTW.term.type != 'geneVariant') value.color = k2c(category)
		}
	}
	//else
	//sample.value = dbSample.value

	let i = 1
	for (const [category, value] of shapeMap) {
		if (!('shape' in value)) value.shape = i
		i++
	}

	const colorLegend = q.colorTW
		? order(colorMap, q.colorTW, data.refs)
		: [['Default', { sampleCount: cohortSamples.length, color: 'blue' }]]
	colorLegend.push([
		'Ref',
		{
			sampleCount: refSamples.length,
			color: q.colorTW?.term.values?.['Ref'] ? q.colorTW.term.values?.['Ref'].color : refColor
		}
	])
	const shapeLegend = order(shapeMap, q.shapeTW, data.refs)
	shapeLegend.push(['Ref', { sampleCount: refSamples.length, shape: 0 }])

	return {
		samples,
		colorLegend: Object.fromEntries(colorLegend),
		shapeLegend: Object.fromEntries(shapeLegend)
	}
}

function processSample(dbSample, sample, tw, categoryMap, category) {
	let color = null,
		value = null
	if (!dbSample) {
		console.log(JSON.stringify(sample) + ' not in the database or filtered')
		return []
	}
	const result = []
	if (tw.term.type == 'geneVariant') {
		const mutations = dbSample?.[tw.term.name]?.values
		sample.cat_info[category] = []
		for (const mutation of mutations) {
			const class_info = mclass[mutation.class]
			value = getCategory(mutation)
			sample.cat_info[category].push(mutation)
			if (!categoryMap.has(value)) categoryMap.set(value, { color: class_info.color, sampleCount: 1 })
			else categoryMap.get(value).sampleCount++

			// TODO mutation.mname is amino acid change. pass mname to sample to be shown in tooltip
		}
		for (const [dt, label] of Object.entries(dt2label)) {
			const mutation = mutations.find(mutation => {
				const value = getCategory(mutation)
				const visible = !(tw.q.hiddenValues && value in tw.q.hiddenValues)
				return mutation.dt == dt && visible
			})
			if (!mutation) continue

			const value = getCategory(mutation)
			sample[category] = value
			break //Found a color
		}
		if (!sample[category])
			//all hidden, will take any
			sample[category] = getCategory(mutations[0])
		sample.hidden[category] = tw.q.hiddenValues ? sample[category] in tw.q.hiddenValues : false
		result.push(sample)
	} else {
		value = dbSample?.[tw.id]?.key
		sample.hidden[category] = tw.q.hiddenValues ? dbSample?.[tw.id]?.key in tw.q.hiddenValues : false
		if (value) {
			sample[category] = value.toString()
			if (!categoryMap.has(value)) categoryMap.set(value, { sampleCount: 1 })
			else categoryMap.get(value).sampleCount++
			result.push(sample)
		}
	}
	return result
}

function getCategory(mutation) {
	const dt = mutation.dt
	const class_info = mclass[mutation.class]
	const origin = morigin[mutation.origin]?.label
	const dtlabel = origin ? `${origin} ${dt2label[dt]}` : dt2label[dt]
	return `${class_info.label} ${dtlabel}`
}

function order(map, tw, refs) {
	let entries = []
	if (!tw || map.size == 0) return entries
	if (tw.term.type == 'geneVariant') {
		entries = [...map.entries()]
		entries.sort((a, b) => {
			if (a[0] < b[0]) return -1
			if (a[0] > b[0]) return 1
			return 0
		})
	} else if (!refs?.byTermId[tw.term.id]?.bins) {
		entries = [...map.entries()]
		entries.sort((a, b) => {
			const v1 = tw.term.values?.[a[0]]
			if (v1 && 'order' in v1) {
				const v2 = tw.term.values[b[0]]

				if (v1.order < v2.order) return -1
				return 1
			} else {
				if (a[1].sampleCount > b[1].sampleCount) return -1
				else return 1
			}
		})
	} else {
		const bins = refs.byTermId[tw.term.id].bins
		for (const bin of bins) if (map.get(bin.name)) entries.push([bin.name, map.get(bin.name)])
		//If some category is not defined in the bins, should be added
		for (const [category, value] of map) if (!entries.some(e => e[0] === category)) entries.push([category, value])
	}
	return entries
}

export async function getScatterCoordinates(req, q, ds) {
	q.ds = ds
	const samples = []
	if (q.coordTWs.length != 2) return samples

	const filter = await getFilterCTEs(q.filter, q.ds)
	let sql = ''
	if (filter) sql += interpolateSqlValues(`WITH ${filter.filters}`, filter.values.slice())
	const xterm = q.coordTWs[0].term
	const yterm = q.coordTWs[1].term
	sql += `SELECT ax.sample AS sampleId, ax.value as x, ay.value AS y 
			FROM anno_${xterm.type} ax 
			JOIN anno_${yterm.type} ay on ax.sample = ay.sample and ay.term_id = '${yterm.id}'  
			WHERE ax.term_id = '${xterm.id}'`
	if (filter) sql += ` AND ax.sample IN ${filter.CTEname}`
	const rows = q.ds.cohort.db.connection.prepare(sql).all()
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	for (const { sampleId, x, y } of rows) {
		const sample = { sampleId, x, y }
		if (canDisplay) sample.sample = ds.sampleId2Name.get(sampleId)
		const computable = isComputable(q.coordTWs[0].term, x) && isComputable(q.coordTWs[1].term, y)
		if (sample && computable) samples.push(sample)
	}
	return samples
}

function isComputable(term, value) {
	return !term.values?.[value]?.uncomputable
}
