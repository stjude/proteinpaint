const { getData } = require('./termdb.matrix')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const serverconfig = require('./serverconfig')
const d3scale = require('d3-scale')
import { schemeCategory20 } from '#shared/common'
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
export async function trigger_getSampleScatter(q, res, ds, genome) {
	try {
		if (!ds.cohort.scatterplots || !ds.cohort.scatterplots.plots) throw 'not supported'

		const plot = ds.cohort.scatterplots.plots.find(p => p.name == q.plotName)
		if (!plot) throw 'plot not found with plotName'

		const [refSamples, cohortSamples] = await getSamples(plot)
		const terms = [q.colorTW]
		if (q.shapeTW) terms.push(q.shapeTW)
		const data = await getData({ filter: q.filter, terms }, ds, genome)

		if (data.error) throw data.error
		const result = await colorAndShapeSamples(refSamples, cohortSamples, data, q)
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

async function colorAndShapeSamples(refSamples, cohortSamples, data, q) {
	const samples = refSamples.map(sample => ({ ...sample, category: 'Ref', shape: 'Ref' }))

	const shapeMap = new Map()
	const colorMap = new Map()

	for (const sample of cohortSamples) {
		const dbSample = data.samples[sample.sampleId.toString()]

		sample.category_info = {}
		sample.hidden = {}
		if (q.colorTW.q?.mode === 'continuous') sample.category = dbSample[q.colorTW.term.id].value
		else {
			assignCategory(dbSample, sample, q.colorTW, colorMap, 'category')
			if (!('category' in sample)) continue
		}

		sample.shape = 'Ref'
		if (q.shapeTW) {
			assignCategory(dbSample, sample, q.shapeTW, shapeMap, 'shape')
			if (!('shape' in sample)) continue
		}
		samples.push(sample)
	}
	if (q.colorTW.q.mode !== 'continuous') {
		const k2c = d3scale.scaleOrdinal(schemeCategory20)
		for (const [category, value] of colorMap) {
			const tvalue = q.colorTW.term.values?.[category]
			if (tvalue?.color) value.color = tvalue.color
			else if (data.refs?.byTermId[q.colorTW.term.id]?.bins) {
				const bin = data.refs.byTermId[q.colorTW.term.id].bins.find(bin => bin.name === category)
				value.color = bin.color
			} else if (q.colorTW.term.type == 'geneVariant') value.color = mclass[value.mclass]?.color || 'black'
			// should be invalid_mclass_color
			else value.color = k2c(category)
		}
	}
	//else
	//sample.value = dbSample.value

	shapeMap.set('Ref', { sampleCount: refSamples.length, shape: 0 })
	let i = 1
	for (const [category, value] of shapeMap) {
		if (!('shape' in value)) value.shape = i
		i++
	}

	//colorMap.set(noCategory, { sampleCount: noColorCount, color: defaultColor })
	colorMap.set('Ref', { sampleCount: refSamples.length, color: refColor })

	return {
		samples,
		colorLegend: order(colorMap, q.colorTW, data.refs),
		shapeLegend: order(shapeMap, q.shapeTW, data.refs)
	}
}

function order(map, tw, refs) {
	if (!tw) return Object.fromEntries(map)
	let entries = []

	if (!refs?.byTermId[tw.term.id]?.bins) {
		entries = [...map.entries()]
		entries.sort((a, b) => {
			if (a[1].sampleCount > b[1].sampleCount) return -1
			else return 1
		})
	} else {
		const bins = refs.byTermId[tw.term.id].bins
		for (const bin of bins) if (map.get(bin.name)) entries.push([bin.name, map.get(bin.name)])
		entries.push(['Ref', map.get('Ref')])
	}
	return Object.fromEntries(entries)
}

function assignCategory(dbSample, sample, tw, categoryMap, category) {
	let color = null,
		value = null
	if (!dbSample) {
		console.log(JSON.stringify(sample) + ' not in the database or filtered')
		return
	}
	let mutation = null
	if (tw.term.type == 'geneVariant') {
		mutation = dbSample?.[tw.term.name]?.values?.[0]
		if (mutation) {
			value = mclass[mutation.class]?.label
			sample.category_info[category] = mutation.mname
			sample.hidden[category] = tw.q.hiddenValues ? value in tw.q.hiddenValues : false
			// TODO mutation.mname is amino acid change. pass mname to sample to be shown in tooltip
		}
	} else {
		value = dbSample?.[tw.id]?.key
		sample.hidden[category] = tw.q.hiddenValues ? dbSample?.[tw.id]?.key in tw.q.hiddenValues : false
	}
	if (value) {
		sample[category] = value.toString()
		if (!categoryMap.has(value)) categoryMap.set(value, { sampleCount: 1 })
		else categoryMap.get(value).sampleCount++
		if (tw.term.type == 'geneVariant') categoryMap.get(value).mclass = mutation?.class
	}
}
