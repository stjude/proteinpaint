import { sampleLstSql } from './termdb.sql.samplelst'

const { getData } = require('./termdb.matrix')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const serverconfig = require('./serverconfig')
const d3scale = require('d3-scale')
const schemeCategory10 = require('d3-scale-chromatic').schemeCategory10
const { mclass } = require('#shared/common')
const { rgb } = require('d3-color')

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
const refColor = '#ccc'
const defaultColor = 'gray'
const noCategory = 'None'

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


colorTW is required
shapeTW is optional

if q.colorTW{} is provided, use sample categories of this term to color dots.
Run q.get_rows() to get category assignment of all eligible samples

as get_rows() accounts for filter, the samples dropped by filter are missing from result
and should only retain samples passed filter for scatterplot

whether to drop a sample from allSamples[] is depends on if sampleId is set
if sampleId is set on a sample, it's a filter-able sample
otherwise, it's un-filterable, e.g. reference sample

input:

allSamples = []
q = {}
ds = {}

output:

{
	samples=[ {} ]
		.sample=str
		.category=str // rename to .colorCategory
		.color=str
		.shapeCategory=str
		.shape=int
	colorLegend=[]
		each element [ category, {color=str, sampleCount=int} ]
	shapeLegend=[]
		each element [ category, {shape=int, sampleCount=int} ]
}
*/
export async function trigger_getSampleScatter(q, res, ds, genome) {
	try {
		if (!ds.cohort.scatterplots || !ds.cohort.scatterplots.plots) throw 'not supported'

		const plot = ds.cohort.scatterplots.plots.find(p => p.name == q.plotName)
		if (!plot) throw 'plot not found with plotName'

		const [refSamples, cohortSamples] = await getSamples(plot)
		// array of all samples
		// [ { sample=str, sampleId=int, x, y } ]
		const terms = [q.colorTW]
		if (q.shapeTW) terms.push(q.shapeTW)
		const data = await getData(Object.assign({}, q, { for: 'matrix', terms }), ds, genome)
		if (data.error) throw data.error
		//res.send({ status: 'ok', data })
		const result = await colorAndShapeSamples(refSamples, cohortSamples, data.samples, q)
		res.send(result)
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

async function getSamples(plot) {
	if (plot.filterableSamples) {
		// must make in-memory duplication of the objects as they will be modified by assigning .color/shape
		const samples = [],
			refSamples = []
		if (plot.referenceSamples) {
			// put reference samples in front of the returned array, so they are rendered as "background"
			for (const i of JSON.parse(JSON.stringify(plot.referenceSamples))) refSamples.push(i)
		}
		for (const i of JSON.parse(JSON.stringify(plot.filterableSamples))) samples.push(i)
		return [refSamples, samples]
	}
	if (plot.gdcapi) throw 'gdcapi not implemented yet'
	throw 'do not know how to load data from this plot'
}

async function colorAndShapeSamples(refSamples, cohortSamples, dbSamples, q) {
	let samples = [...refSamples] // samples pass filter and to be returned to client and display
	samples = samples.map(sample => ({ ...sample, category: 'Ref', shape: 'Ref' }))

	const shapeMap = new Map()
	const colorMap = new Map()

	let dbSample
	let noColorCount = 0,
		noShapeCount = 0
	for (const sample of cohortSamples) {
		dbSample = dbSamples[sample.sampleId.toString()]
		const [category, color] = getCategory(dbSample, q.colorTW)
		if (category) {
			sample.category = category
			if (!colorMap.has(category)) colorMap.set(category, { sampleCount: 1, color })
			else colorMap.get(category).sampleCount++
		} else noColorCount++
		sample.shape = noCategory
		if (q.shapeTW) {
			const [shape, color2] = getCategory(dbSample, q.shapeTW)
			if (shape) {
				sample.shape = shape
				if (!shapeMap.has(shape)) shapeMap.set(shape, { sampleCount: 1 })
				else shapeMap.get(shape).sampleCount++
			} else noShapeCount++
		}
		samples.push(sample)
	}

	const k2c = d3scale.scaleOrdinal(schemeCategory10)
	for (const [category, value] of colorMap) {
		if (!value.color) {
			if (q.colorTW?.term?.values?.[category]?.color) value.color = q.colorTW.term.values[category].color
			else value.color = k2c(category)
		}
	}
	shapeMap.set(noCategory, { sampleCount: noShapeCount, shape: 0 })
	let i = 1

	shapeMap.set('Ref', { sampleCount: refSamples.length, shape: q.shapeTW ? i++ : 0 })
	for (const [category, value] of shapeMap) {
		if (!('shape' in value)) value.shape = i
		i++
	}

	colorMap.set(noCategory, { sampleCount: noColorCount, color: defaultColor })
	colorMap.set('Ref', { sampleCount: refSamples.length, color: refColor })

	return { samples, colorLegend: Object.fromEntries(colorMap), shapeLegend: Object.fromEntries(shapeMap) }
}

function getCategory(dbSample, tw) {
	const category = tw.term.name
	let color, value, variant
	if (dbSample && category in dbSample) {
		color = null
		value = tw.term.type == 'geneVariant' ? dbSample[category].values[0] : dbSample[category].value
		if (value) {
			if (tw.term.type == 'geneVariant') {
				variant = mclass[value.class]
				if (variant) {
					value = variant.label
					color = variant.color
				} else console.log(`${value} does not have an mclass associated`)
			}
		}
	}
	return [value, color]
}
