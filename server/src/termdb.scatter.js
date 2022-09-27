const termdbsql = require('./termdb.sql')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const serverconfig = require('./serverconfig')
const d3scale = require('d3-scale')

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
					for (let j = 3; j < headerFields.length; j++) {
						sample[headerFields[j]] = l[j]
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

		const [samples, categories] = await mayColorAndFilterSamples(allSamples, q, ds)
		// array of plottable samples
		// [ { sample=str, sampleId=int, x, y, category } ]

		res.send({ samples, categories })
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
if q.term{} is provided, use sample categories of this term to color dots
later may rename q.term to q.termWrapper, as it's a termsetting object
run q.get_rows() to get category assignment of all eligible samples

as get_rows() accounts for filter, the samples dropped by filter are missing from result
and should only retain samples passed filter for scatterplot

whether to drop a sample from allSamples[] is depends on if sampleId is set
if sampleId is set on a sample, it's a filter-able sample
otherwise, it's un-filterable, e.g. reference sample
*/
async function mayColorAndFilterSamples(allSamples, q, ds) {
	if (!q.term) return [allSamples] // no term to get sample category

	// q.term{} is a termsetting
	// TODO groupsetting
	// TODO numeric bins
	// TODO numeric continuous values
	if (!('id' in q.term)) throw 'q.term.id missing'
	if (typeof q.term.q != 'object') throw 'q.term.q is not object'

	const rowsQ = {
		ds,
		term1_id: q.term.id,
		term1_q: q.term.q,
		filter: q.filter
	}

	const result = termdbsql.get_rows(rowsQ)
	/*
	result = {
	  lst: [
		{
		  key0: '', val0: '',
		  key1: 'HGG', val1: 'HGG',
		  key2: '', val2: '',
		  sample: 1
		},
		...
	  ]
	}
	*/

	const sampleId2category = new Map() // k: sample id, v: category
	for (const i of result.lst) {
		sampleId2category.set(i.sample, i.key1)
	}

	const samples = [] // samples pass filter and to be returned to client and display
	const categories = new Map()
	// key: category, value: {sampleCount=integer, color=str}

	for (const s of allSamples) {
		if ('sampleId' in s) {
			// this sample has ID and is filterable
			if (!sampleId2category.has(s.sampleId)) {
				// this id is not present in the map, meaning the sample is dropped by filter
				// and will exclude it from the scatterplot
				continue
			}

			// the sample is kept by filter and will show in scatterplot

			if (sampleId2category.has(s.sampleId)) {
				// sample has category assignment
				s.category = sampleId2category.get(s.sampleId)
				if (!categories.has(s.category)) {
					categories.set(s.category, { sampleCount: 0 })
				}
				categories.get(s.category).sampleCount++
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
	const k2c = d3scale.scaleOrdinal(d3scale.schemeCategory10)
	for (const [category, o] of categories) {
		if (q.term?.term?.values?.[category]?.color) {
			o.color = q.term.term.values[category].color
		} else {
			o.color = k2c(category)
		}
	}

	// now each category gets an color, apply to samples
	let referenceSampleCount = 0
	for (const s of samples) {
		if (categories.has(s.category)) {
			s.color = categories.get(s.category).color
		} else {
			s.color = referenceSampleColor
			referenceSampleCount++
		}
	}

	// sort in descending order
	const legendItems = [...categories].sort((a, b) => b[1].sampleCount - a[1].sampleCount)
	// each element: [ 'categoryKey', { sampleCount=int, color=str } ]
	if (referenceSampleCount) {
		legendItems.push(['Reference samples', { sampleCount: referenceSampleCount, color: referenceSampleColor }])
	}

	return [samples, legendItems]
}
