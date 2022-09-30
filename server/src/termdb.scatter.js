const termdbsql = require('./termdb.sql')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const serverconfig = require('./serverconfig')
const d3scale = require('d3-scale')
const schemeCategory10 = require('d3-scale-chromatic').schemeCategory10

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
const referenceSampleColor = '#ccc'
const defaultShape = 0

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
get a pre-generated plot from a dataset
e.g. plot encoded in a text file
apply sample coloring and filtering

q={
	plotName=str
	term={} // optional, a term wrapper
	filter={}
}
*/
export async function trigger_getSampleScatter(q, res, ds) {
	try {
		if (!ds.cohort.scatterplots || !ds.cohort.scatterplots.plots) throw 'not supported'

		const plot = ds.cohort.scatterplots.plots.find(p => p.name == q.plotName)
		if (!plot) throw 'plot not found with plotName'

		const allSamples = await getSampleLst(plot)
		// array of all samples
		// [ { sample=str, sampleId=int, x, y } ]

		res.send(await mayColorAndFilterSamples(allSamples, q, ds))
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

async function getSampleLst(plot) {
	if (plot.filterableSamples) {
		// must make in-memory duplication of the objects as they will be modified by assigning .color/shape
		const samples = []
		if (plot.referenceSamples) {
			// put reference samples in front of the returned array, so they are rendered as "background"
			for (const i of JSON.parse(JSON.stringify(plot.referenceSamples))) samples.push(i)
		}
		for (const i of JSON.parse(JSON.stringify(plot.filterableSamples))) samples.push(i)
		return samples
	}
	if (plot.gdcapi) throw 'gdcapi not implemented yet'
	throw 'do not know how to load data from this plot'
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
async function mayColorAndFilterSamples(allSamples, q, ds) {
	if (!q.colorTW) {
		// no term to get category assignments for color, nothing to do
		return [allSamples]
	}

	/******************************
	!!!!!!!!!!!!!! following checks are stop-gap
	fixes must be done in upstream and these can be deleted afterwards
	*/
	// if (typeof q.colorTW == 'string') {
	// 	q.colorTW = JSON.parse(q.colorTW)
	// 	console.log('warning!!!! colorTW is stringified json')
	// }
	// if (q.shapeTW == 'undefined') {
	// 	delete q.shapeTW
	// 	console.log('warning!!!! shapeTW="undefined"')
	// }
	// if (typeof q.shapeTW == 'string') {
	// 	q.shapeTW = JSON.parse(q.shapeTW)
	// 	console.log('warning!!!! shapeTW is stringified json')
	// }

	const getRowsParam = {
		ds,
		filter: q.filter
	}

	if (!('id' in q.colorTW)) throw 'q.colorTW.id missing'
	if (typeof q.colorTW.q != 'object') throw 'q.colorTW.q is not object'
	getRowsParam.term1_id = q.colorTW.id
	getRowsParam.term1_q = q.colorTW.q

	if (q.shapeTW) {
		if (!('id' in q.shapeTW)) throw 'q.shapeTW.id missing'
		if (typeof q.shapeTW.q != 'object') throw 'q.shapeTW.q is not object'
		getRowsParam.term2_id = q.shapeTW.id
		getRowsParam.term2_q = q.shapeTW.q
	}

	const [sampleId2colorCategory, sampleId2shapeCategory] = callGetRows(getRowsParam, q)

	const samples = [] // samples pass filter and to be returned to client and display

	const colorCategories = new Map()
	// key: category, value: {sampleCount=integer, color=str}

	let shapeCategories
	if (q.shapeTW) {
		shapeCategories = new Map()
		shapeCategories.set('None', { sampleCount: 0 })
		// key: category, value: {sampleCount=integer, shape=int}
	}

	for (const s of allSamples) {
		if ('sampleId' in s) {
			// this sample has ID and is filterable

			if (!sampleId2colorCategory.has(s.sampleId)) {
				// this id is not present in the map, meaning the sample is dropped by filter
				// and will exclude it from the scatterplot
				continue
			}

			// the sample is kept by filter and will show in scatterplot

			// sample has color category assignment
			s.category = sampleId2colorCategory.get(s.sampleId) // change 'category' to 'colorCategory'
			if (!colorCategories.has(s.category)) {
				colorCategories.set(s.category, { sampleCount: 0 })
			}
			colorCategories.get(s.category).sampleCount++

			if (sampleId2shapeCategory) {
				// using shape
				if (sampleId2shapeCategory.has(s.sampleId)) {
					// sample has shape
					s.shapeCategory = sampleId2shapeCategory.get(s.sampleId)
					if (!shapeCategories.has(s.shapeCategory)) {
						shapeCategories.set(s.shapeCategory, { sampleCount: 0 })
					}
					shapeCategories.get(s.shapeCategory).sampleCount++
				}
			}

			delete s.sampleId // no need to send to client
			samples.push(s)
		} else {
			// this sample does not has ID, and is un-filterable
			// always keep it in scatterplot
			samples.push(s)
		}
	}

	// assign color to unique categories, but not reference
	const k2c = d3scale.scaleOrdinal(schemeCategory10)
	for (const [category, o] of colorCategories) {
		if (q.colorTW?.term?.values?.[category]?.color) {
			o.color = q.colorTW.term.values[category].color
		} else {
			o.color = k2c(category)
		}
	}

	if (shapeCategories) {
		let i = 0
		for (const [category, o] of shapeCategories) {
			o.shape = i++
		}
	}

	// now each category gets an color/shape, apply to samples

	let referenceSampleCount = 0
	for (const s of samples) {
		if (colorCategories.has(s.category)) {
			s.color = colorCategories.get(s.category).color

			if (shapeCategories && shapeCategories.has(s.shapeCategory)) {
				s.shape = shapeCategories.get(s.shapeCategory).shape
			}
		} else {
			s.color = referenceSampleColor
			referenceSampleCount++
		}
		if (!('shape' in s)) s.shape = defaultShape
	}

	// sort in descending order

	const colorLegend = [...colorCategories].sort((a, b) => b[1].sampleCount - a[1].sampleCount)
	// each element: [ 'categoryKey', { sampleCount=int, color=str } ]
	if (referenceSampleCount) {
		colorLegend.push(['Reference samples', { sampleCount: referenceSampleCount, color: referenceSampleColor }])
	}

	const result = { samples, colorLegend }

	if (shapeCategories) {
		result.shapeLegend = [...shapeCategories].sort((a, b) => b[1].sampleCount - a[1].sampleCount)
	}
	return result
}

function callGetRows(param, q) {
	const result = termdbsql.get_rows(param)
	/*
	{
	  lst: [
		{
		  key0: '', val0: '',
		  key1: 'HGG', val1: 'HGG', // category value for color term
		  key2: 'M', val2: 'Male', // optional category value for shape term
		  sample: integer 
		},
		...
	  ]
	}
	*/

	const sampleId2colorCategory = new Map() // k: sample id, v: category
	for (const i of result.lst) {
		sampleId2colorCategory.set(i.sample, i.key1)
	}

	let sampleId2shapeCategory // k: sample id, v: category
	if (q.shapeTW) {
		sampleId2shapeCategory = new Map()
		// k: sample id, v: category
		for (const i of result.lst) {
			sampleId2shapeCategory.set(i.sample, i.key2)
		}
	}
	return [sampleId2colorCategory, sampleId2shapeCategory]
}
