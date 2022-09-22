const termdbsql = require('./termdb.sql')
const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const serverconfig = require('./serverconfig')

/*
works with pre-coded scatterplots in a dataset, e.g. data from a text file

reason of not storing x/y data in termdb annotations table:
1. a sample can have different x/y in multiple plots
   still, using term id e.g. x_tsne/y_tsne/x_umap/y_umap will solve it
2. keeping all plot data in annotations table adds complexity to sql query
   in that get_rows() may not work directly?
3. keeping all plot data in annotations table requires "control" samples to be there too
   but control samples are not to be skipped by filtering
   thus can be tricky to manage

to find out efficiency comparison of file vs sqlite db with 1 million dots


exported functions:

mayInitiateScatterplots()
trigger_getSampleScatter()

*/

// called in mds3.init
export async function mayInitiateScatterplots(ds) {
	if (!ds.cohort.scatterplots) return
	if (!Array.isArray(ds.cohort.scatterplots.plots)) throw 'cohort.scatterplots.plots is not array'
	for (const p of ds.cohort.scatterplots.plots) {
		if (!p.name) throw '.name missing from one of scatterplots.plots[]'
		if (p.file) {
			p.fileData = []
			const lines = (await utils.read_file(path.join(serverconfig.tpmasterdir, p.file))).trim().split('\n')
			for (let i = 1; i < lines.length; i++) {
				const l = lines[i].split('\t')
				// sampleName \t x \t y ...
				const x = Number(l[1]),
					y = Number(l[2])
				if (Number.isNaN(x) || Number.isNaN(y)) continue
				const sampleId = ds.cohort.termdb.q.sampleName2id(l[0])
				const sample = {
					sample: l[0],
					sampleId, // sample id can be undefined, e.g. for "control" samples that are display only
					x,
					y
				}
				p.fileData.push(sample)
			}
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

		const [samples, category2color] = await mayColorAndFilterSamples(allSamples, q, ds)
		// array of plottable samples
		// [ { sample=str, sampleId=int, x, y, category } ]

		res.send({ samples, category2color })
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

async function getSampleLst(plot) {
	/* returns an array, each sample:
{ sample=str, x, y }
*/
	if (plot.fileData) return JSON.parse(JSON.stringify(plot.fileData)) // efficiency concern for .5M dots?
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
otherwise, it's un-filterable, e.g. control sample
*/
async function mayColorAndFilterSamples(allSamples, q, ds) {
	if (!q.term) return [allSamples] // no term to get sample category

	// q.term{} is a termsetting
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

	const samples = [] // samples pass filter and to be shown in plot

	for (const s of allSamples) {
		if ('sampleId' in s) {
			// this sample has ID and is filterable
			if (!sampleId2category.has(s.sampleId)) {
				// this id is not present in the map, meaning the sample is dropped by filter
				// and will exclude it from the scatterplot
				continue
			}
			// the sample is kept in filter and will show in scatterplot
			s.category = sampleId2category.get(s.sampleId)
			samples.push(s)
		} else {
			// this sample does not has ID, and is un-filterable
			// always keep it in scatterplot
			samples.push(s)
		}
	}

	const category2color = {} // k: category, v: color TODO

	return [samples, category2color]
}
