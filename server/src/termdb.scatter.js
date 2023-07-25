import { getData } from './termdb.matrix'
import path from 'path'
import utils from './utils'
import serverconfig from './serverconfig'
import { schemeCategory20, getColors } from '#shared/common'
import { interpolateSqlValues } from './termdb.sql'
import { mclass, dt2label, morigin } from '#shared/common'
import { getFilterCTEs } from './termdb.filter'
import authApi from './auth'
import lines2R from './lines2R'
const write_file = require('./utils').write_file

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
		if (q.coordTWs) terms.push(...q.coordTWs)
		if (q.colorTW) terms.push(q.colorTW)
		if (q.shapeTW) terms.push(q.shapeTW)
		if (q.divideByTW) terms.push(q.divideByTW)
		if (q.scaleDotTW) terms.push(q.scaleDotTW)

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
	const results = {}
	for (const sample of cohortSamples) {
		const dbSample = data.samples[sample.sampleId.toString()]
		if (!dbSample && q.colorTW) {
			console.log(JSON.stringify(sample) + ' not in the database or filtered')
			continue
		}
		if ((q.colorTW && !hasValue(dbSample, q.colorTW)) || (q.shapeTW && !hasValue(dbSample, q.shapeTW))) continue
		let divideBy = 'Default'
		if (q.divideByTW && q.divideByTW.q.mode != 'continuous') {
			sample.z = 0
			if (q.divideByTW.term.type == 'geneVariant')
				divideBy = getMutation(true, dbSample, q.divideByTW) || getMutation(false, dbSample, q.divideByTW)
			else {
				const key = dbSample[q.divideByTW.term.id || q.divideByTW.term.name]?.key
				divideBy = q.divideByTW.term.values?.[key]?.label || key
			}
		}
		if (!results[divideBy]) {
			const samples = refSamples.map(sample => ({ ...sample, category: 'Ref', shape: 'Ref', z: 0 }))
			results[divideBy] = { samples, colorMap: {}, shapeMap: {} }
		}
		if (!q.divideByTW) sample.z = 0
		if (!q.scaleDotTW) sample.scale = 1
		else {
			const value = dbSample?.[q.scaleDotTW.id].key
			if (!value || !isComputable(q.scaleDotTW.term, value)) continue
			sample.scale = value
		}

		sample.cat_info = {}
		sample.hidden = {}
		if (!q.colorTW) {
			sample.category = 'Default'
		} else {
			if (q.colorTW?.q?.mode === 'continuous') {
				if (dbSample) sample.category = dbSample[q.colorTW.term.id || q.colorTW.term.name].value
			} else processSample(dbSample, sample, q.colorTW, results[divideBy].colorMap, 'category')
		}

		if (q.shapeTW) processSample(dbSample, sample, q.shapeTW, results[divideBy].shapeMap, 'shape')
		else sample.shape = 'Ref'

		results[divideBy].samples.push(sample)
	}
	//To choose a color scheme we pass the max number of categories
	let max = 0
	for (const [divideBy, result] of Object.entries(results)) max = Math.max(max, Object.keys(result.colorMap).length)
	const k2c = getColors(max)

	for (const [divideBy, result] of Object.entries(results)) {
		if (q.colorTW && q.colorTW.q.mode !== 'continuous') {
			let i = 20
			const scheme = schemeCategory20
			const colorEntries = Object.entries(result.colorMap)

			for (const [category, value] of colorEntries) {
				let tvalue
				if (q.colorTW.term.values?.[category]) tvalue = q.colorTW.term.values?.[category]
				else
					for (const field in q.colorTW.term.values)
						if (q.colorTW.term.values?.[field].label == category) tvalue = q.colorTW.term.values?.[field]
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
		let i = 1
		for (const [category, value] of Object.entries(result.shapeMap)) {
			if (!('shape' in value)) value.shape = i
			i++
		}

		result.colorLegend = q.colorTW
			? order(result.colorMap, q.colorTW, data.refs)
			: [['Default', { sampleCount: cohortSamples.length, color: 'blue' }]]
		result.colorLegend.push([
			'Ref',
			{
				sampleCount: refSamples.length,
				color: q.colorTW?.term.values?.['Ref'] ? q.colorTW.term.values?.['Ref'].color : refColor
			}
		])
		result.shapeLegend = order(result.shapeMap, q.shapeTW, data.refs)
		result.shapeLegend.push(['Ref', { sampleCount: refSamples.length, shape: 0 }])
	}
	return results
}

function hasValue(dbSample, tw) {
	const key = dbSample?.[tw?.term?.id || tw?.term?.name]?.key
	const hasKey = key !== undefined
	if (!hasKey) console.log(JSON.stringify(dbSample) + ' missing value for the term ' + JSON.stringify(tw))
	return hasKey
}

function processSample(dbSample, sample, tw, categoryMap, category) {
	let value = null
	if (tw.term.type == 'geneVariant') assignGeneVariantValue(dbSample, sample, tw, categoryMap, category)
	else {
		value = dbSample?.[tw.id || tw.term.name]?.key
		if (tw.term.values?.[value]?.label) value = tw.term.values?.[value]?.label
		sample.hidden[category] = tw.q.hiddenValues ? dbSample?.[tw.id]?.key in tw.q.hiddenValues : false
		if (value) {
			sample[category] = value.toString()
			if (categoryMap[value] == undefined) categoryMap[value] = { sampleCount: 1 }
			else categoryMap[value].sampleCount++
		}
	}
}

function assignGeneVariantValue(dbSample, sample, tw, categoryMap, category) {
	if (tw.term.type == 'geneVariant') {
		const mutations = dbSample?.[tw.term.name]?.values
		sample.cat_info[category] = []

		for (const mutation of mutations) {
			const class_info = mclass[mutation.class]
			const value = getCategory(mutation)
			sample.cat_info[category].push(mutation)

			let mapValue
			if (categoryMap[value] == undefined) {
				mapValue = { color: class_info.color, sampleCount: 1, hasOrigin: 'origin' in mutation }
				categoryMap[value] = mapValue
			} else {
				mapValue = categoryMap[value]
				mapValue.sampleCount = mapValue.sampleCount + 1
				mapValue.hasOrigin = mapValue.hasOrigin || 'origin' in mutation
			}
		}
		sample[category] = getMutation(true, dbSample, tw) || getMutation(false, dbSample, tw)
		//all hidden, will take any
		if (!sample[category]) sample[category] = getCategory(mutations[0])
		sample.hidden[category] = tw.q.hiddenValues ? sample[category] in tw.q.hiddenValues : false
	}
}

function getMutation(strict, dbSample, tw) {
	const mutations = dbSample?.[tw.term.name]?.values

	for (const [dt, label] of Object.entries(dt2label)) {
		const mutation = mutations.find(mutation => {
			const value = getCategory(mutation)
			const visible = !(tw.q.hiddenValues && value in tw.q.hiddenValues)
			return mutation.dt == dt && visible
		})
		if (!mutation) continue
		if (strict) if (mutation.class == 'WT' || mutation.class == 'Blank') continue
		const value = getCategory(mutation)
		return value
	}
}

function getCategory(mutation) {
	const dt = mutation.dt
	const class_info = mclass[mutation.class]
	const origin = morigin[mutation.origin]?.label
	const dtlabel = origin ? `${origin[0]} ${dt2label[dt]}` : dt2label[dt]
	return `${class_info.label},${dtlabel}`
}

function order(map, tw, refs) {
	let entries = []
	if (!tw || map.size == 0) return entries
	if (tw.term.type == 'geneVariant') {
		entries = Object.entries(map)
		entries.sort((a, b) => {
			if (a[0] < b[0]) return -1
			if (a[0] > b[0]) return 1
			return 0
		})
	} else if (!refs?.byTermId[tw.term.id]?.bins) {
		entries = Object.entries(map)
		entries.sort((a, b) => {
			const v1 = tw.term.values?.[a[0]]
			if (v1 && 'order' in v1) {
				const v2 = tw.term.values[b[0]]

				if (v1?.order < v2?.order) return -1
				return 1
			} else {
				if (a[1].sampleCount > b[1].sampleCount) return -1
				else return 1
			}
		})
	} else {
		const bins = refs.byTermId[tw.term.id].bins
		for (const bin of bins) if (map[bin.name]) entries.push([bin.name, map[bin.name]])
		//If some category is not defined in the bins, should be added
		for (const [category, value] of Object.entries(map))
			if (!entries.some(e => e[0] === category)) entries.push([category, value])
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
	let zterm

	if (q.divideByTW && q.divideByTW.q.mode == 'continuous') zterm = q.divideByTW.term

	sql += `SELECT ax.sample AS sampleId, ax.value as x, ay.value AS y , ${zterm ? 'az.value AS z' : '0 as z'}
			FROM anno_${xterm.type} ax 
			JOIN anno_${yterm.type} ay on ax.sample = ay.sample and ay.term_id = '${yterm.id}'  
			${zterm ? `JOIN anno_${zterm.type} az on ax.sample = az.sample and az.term_id = '${zterm.id}' ` : ''}
			WHERE ax.term_id = '${xterm.id}'`
	if (filter) sql += ` AND ax.sample IN ${filter.CTEname}`
	const rows = q.ds.cohort.db.connection.prepare(sql).all()
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	for (const { sampleId, x, y, z } of rows) {
		if (zterm?.values && z in zterm.values) continue
		const sample = { sampleId, x, y, z }
		if (canDisplay) sample.sample = ds.sampleId2Name.get(sampleId)
		const computable = isComputable(q.coordTWs[0].term, x) && isComputable(q.coordTWs[1].term, y)
		if (sample && computable) samples.push(sample)
	}
	return samples
}

function isComputable(term, value) {
	const computable = !term.values?.[value]?.uncomputable
	return computable
}

export async function trigger_getLowessCurve(req, q, res) {
	const data = q.coords
	const datafile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
	await write_file(datafile, JSON.stringify(data))
	let result = await lines2R(path.join(serverconfig.binpath, 'utils/lowess.R'), [], [datafile])
	result = JSON.parse(result)
	const lowessCurve = []
	for (const [i, x] of Object.entries(result.x)) lowessCurve.push([x, result.y[i]])
	return res.send(lowessCurve)
}
