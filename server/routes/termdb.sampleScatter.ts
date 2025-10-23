import type {
	ColorLegendEntry,
	ColorMap,
	ScatterSample,
	ShapeLegendEntry,
	ShapeMap,
	TermdbSampleScatterRequest,
	TermdbSampleScatterResponse,
	RouteApi,
	TermWrapper,
	Term,
	ValidGetDataResponse,
	Cell
} from '#types'
import { termdbSampleScatterPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import path from 'path'
import serverconfig from '../src/serverconfig.js'
import { schemeCategory20, getColors } from '#shared/common.js'
import { mclass, dt2label, morigin } from '#shared/common.js'
import { authApi } from '../src/auth.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { read_file } from '../src/utils.js'
import { isNumericTerm } from '@sjcrh/proteinpaint-shared/terms.js'
import { getDescrStats } from '#routes/termdb.descrstats.ts'

export const api: RouteApi = {
	endpoint: 'termdb/sampleScatter',
	methods: {
		get: {
			...termdbSampleScatterPayload,
			init
		},
		post: {
			...termdbSampleScatterPayload,
			init
		}
	}
}

// color of reference samples, they should be shown as a "cloud" of dots at backdrop
const refColor = '#F5F5DC'

/** sample coordinates are retrieved from one of two sources:
1. from a prebuilt plot. q.plotName is required to identify the plot on server
2. from two numeric terms. determined by q.coordTWs[] */
function init({ genomes }) {
	return async function (req, res) {
		const q = req.query satisfies TermdbSampleScatterRequest
		if (!q.genome || !q.dslabel) {
			throw new Error('Genome and dataset label are required for termdb/sampleScatter request.')
		}
		const g = genomes[q.genome]
		const ds = g.datasets[q.dslabel]
		if (q.singleCellPlot)
			//single cell plot
			return getSingleCellScatter(req, res, ds)
		try {
			let refSamples: number[] = [], // reference samples, those that are not in termdb and only present in prebuilt scatter map
				cohortSamples // cohort (or termdb) samples, those are annotated by terms
			// coordTwData // getData() returned obj. only when sample coordinates are determined by TW. if created, this will be used for colorAndShapeSamples()

			const terms: any = []
			if (q.colorTW) terms.push(q.colorTW)
			if (q.shapeTW) terms.push(q.shapeTW)
			if (q.divideByTW) terms.push(q.divideByTW)
			if (q.scaleDotTW) terms.push(q.scaleDotTW)
			if (q.coordTWs) for (const tw of q.coordTWs) terms.push(tw)
			const data = await getData(
				{ filter: q.filter, filter0: q.filter0, terms, __protected__: q.__protected__ },
				ds,
				true // FIXME 3rd arg hardcoded to true
			)
			if (data.error) throw data.error
			let result
			if (q.coordTWs.length > 0) {
				const tmp = await getSampleCoordinatesByTerms(req, q, ds, data as ValidGetDataResponse)
				cohortSamples = tmp[0]
				// coordTwData = tmp[1]
			} else {
				// no coordinate terms. check prebuilt map
				if (!q.plotName) throw `Neither plot name or coordinates where provided`
				if (!Array.isArray(ds.cohort?.scatterplots?.plots)) throw 'not supported'
				const plot = ds.cohort.scatterplots.plots.find(p => p.name == q.plotName)
				if (!plot) throw `plot not found with plotName ${q.plotName}`

				const tmp = await getSamples(ds, plot)
				refSamples = tmp[0]
				cohortSamples = tmp[1]

				if (q.colorColumn) {
					//Samples are marked as ref as they dont have a db mapping, but they are not necessarily ref samples
					let categories: any = new Set(refSamples.map((s: any) => s.category))
					categories = Array.from(categories)
					const colorMap = {}
					const k2c = getColors(categories.length)
					for (const category of categories) {
						const color = q.colorColumn.colorMap?.[category] || k2c(category)
						colorMap[category] = {
							sampleCount: refSamples.filter((s: any) => s.category == category).length,
							color,
							key: category
						}
					}
					const shapeMap = { Ref: { shape: 0, sampleCount: refSamples.length, key: 'Ref' } }
					result = {
						Default: {
							samples: refSamples,
							colorLegend: Object.entries(colorMap),
							shapeLegend: Object.entries(shapeMap)
						}
					}
				}
			}
			const samples = [...cohortSamples, ...refSamples]

			let range
			if (samples.length > 0) {
				if (q.excludeOutliers) {
					const ystats = getDescrStats(
						samples.map(s => s.y),
						q.excludeOutliers
					)
					cohortSamples = cohortSamples.filter(
						sample => sample.y > ystats.outlierMin.value && sample.y < ystats.outlierMax.value
					)
					refSamples = refSamples.filter(
						(sample: any) => sample.y > ystats.outlierMin.value && sample.y < ystats.outlierMax.value
					)
				}
				// Calculate global min/max range of x/y coordinates needed for the scatter plot. Needs to be done before colorAndShapeSamples that will dismiss
				//  samples without color/shape or filtered out. If the plot is not premade and a filter on the coordinate terms is done, the coordinates excluded will be filtered out,
				// . In that case the min and max values are not global.
				const s0 = samples[0]
				const [xMin, xMax, yMin, yMax] = samples.reduce(
					(s, d) => [
						d.x < s[0] ? d.x : s[0],
						d.x > s[1] ? d.x : s[1],
						d.y < s[2] ? d.y : s[2],
						d.y > s[3] ? d.y : s[3]
					],
					[s0.x, s0.x, s0.y, s0.y]
				)
				range = { xMin, xMax, yMin, yMax }
			}
			if (!result) result = await colorAndShapeSamples(refSamples, cohortSamples, data as ValidGetDataResponse, q)
			res.send({ result, range } satisfies TermdbSampleScatterResponse)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

async function getSingleCellScatter(req, res, ds) {
	const q = req.query satisfies TermdbSampleScatterRequest
	const { name, sample } = q.singleCellPlot
	const data = await ds.queries.singleCell.data.get({ plots: [name], sample })
	const plot = data.plots[0]
	const cells: Cell[] = [...plot.expCells, ...plot.noExpCells]
	const samples: ScatterSample[] = cells.map(cell => {
		return {
			sample: cell.cellId,
			x: cell.x,
			y: cell.y,
			z: 0,
			category: cell.category,
			shape: 'Ref'
		}
	})
	const [xMin, xMax, yMin, yMax] = samples.reduce(
		(s, d) => [d.x < s[0] ? d.x : s[0], d.x > s[1] ? d.x : s[1], d.y < s[2] ? d.y : s[2], d.y > s[3] ? d.y : s[3]],
		[samples[0].x, samples[0].x, samples[0].y, samples[0].y]
	)
	const categories: any = new Set(samples.map(s => s.category))
	const colorMap = {}
	const k2c = getColors(categories.size)
	for (const category of categories) {
		const color = k2c(category)
		colorMap[category] = {
			sampleCount: samples.filter((s: any) => s.category == category).length,
			color,
			key: category
		}
	}
	const shapeLegend: ShapeLegendEntry[] = [['Ref', { sampleCount: samples.length, shape: 0, key: 'Ref' }]]
	const colorLegend: ColorLegendEntry[] = Object.entries(colorMap)

	res.send({
		result: { Default: { samples, colorLegend, shapeLegend } },
		range: { xMin, xMax, yMin, yMax }
	} satisfies TermdbSampleScatterResponse)
}

async function getSamples(ds: any, plot: any) {
	if (!plot.filterableSamples) await loadFile(plot, ds) // this is the first time the plot is accessed. load the data in mem

	return [readSamples(plot.referenceSamples), readSamples(plot.filterableSamples)]

	function readSamples(samples) {
		const result: number[] = []
		// must make in-memory duplication of the objects as they will be modified by assigning .color/shape
		for (const i of JSON.parse(JSON.stringify(samples))) {
			//When reading from a file coordinates can be displayed
			//if (!authApi.canDisplaySampleIds(req, ds)) delete i.sample
			result.push(i)
		}
		return result
	}
}

async function colorAndShapeSamples(
	refSamples: any,
	cohortSamples: any,
	data: any,
	q: TermdbSampleScatterRequest
): Promise<{ [index: string]: any }> {
	const results: {
		[index: string]: {
			samples: ScatterSample[]
			colorMap: ColorMap
			shapeMap: ShapeMap
			colorLegend?: ColorLegendEntry[]
			shapeLegend?: ShapeLegendEntry[]
		}
	} = {}
	let fCount = 0
	const hasTerms = Object.keys(data.samples).length > 0
	for (const sample of cohortSamples) {
		// use either data object to look up samples
		const dbSample = data.samples[sample.sampleId.toString()]

		if (!dbSample && hasTerms) {
			fCount++
			//console.log(JSON.stringify(sample) + ' not in the database or filtered')
			continue
		}

		if ((q.colorTW && !hasValue(dbSample, q.colorTW)) || (q.shapeTW && !hasValue(dbSample, q.shapeTW))) continue
		let divideBy: string | undefined | null = 'Default'
		if (q.divideByTW) {
			sample.z = 0
			if (q.divideByTW.term.type == 'geneVariant' && q.divideByTW.q.type == 'values') {
				divideBy = getMutation(true, dbSample, q.divideByTW)
				if (divideBy == null) {
					divideBy = getMutation(false, dbSample, q.divideByTW)
				}
			} else {
				const field = q.divideByTW.$id
				const key = dbSample[field]?.key
				if (key == null) continue
				if (q.divideByTW.q.mode != 'continuous') divideBy = q.divideByTW.term.values?.[key]?.label || key
				else sample.z = key
			}
		}
		if (divideBy == null || divideBy == undefined) {
			console.log('divideBy is null/undefined for sample ' + JSON.stringify(sample))
			continue
		}
		if (!results[divideBy]) {
			const samples = refSamples.map(sample => ({ ...sample, category: 'Ref', shape: 'Ref', z: 0 }))
			results[divideBy] = { samples, colorMap: {}, shapeMap: {} }
		}
		if (!q.divideByTW) sample.z = 0
		if (!q.scaleDotTW) sample.scale = 1
		else {
			const value = dbSample?.[q.scaleDotTW.$id]?.key
			if (!value || !isComputable(q.scaleDotTW.term, value)) continue
			sample.scale = value
		}

		sample.cat_info = {}
		sample.hidden = {}
		if (!q.colorTW) {
			sample.category = 'Default'
		} else {
			if (q.colorTW?.q?.mode === 'continuous') {
				if (dbSample) sample.category = dbSample[q.colorTW.$id].value
			} else processSample(dbSample, sample, q.colorTW, results[divideBy].colorMap, 'category')
		}

		if (q.shapeTW) processSample(dbSample, sample, q.shapeTW, results[divideBy].shapeMap, 'shape')
		else sample.shape = 'Ref'
		results[divideBy].samples.push(sample)
	}
	if (fCount) console.log(fCount + ' samples not in the database or filtered')
	//To choose a color scheme we pass the max number of categories
	let max = 0
	// eslint-disable-next-line
	for (const [_, result] of Object.entries(results)) max = Math.max(max, Object.keys(result.colorMap).length)
	const k2c = getColors(max)
	const scheme = schemeCategory20
	// eslint-disable-next-line
	for (const [_, result] of Object.entries(results)) {
		if (q.colorTW && q.colorTW.q.mode !== 'continuous') {
			let i = 20
			for (const [category, value] of Object.entries(result.colorMap)) {
				delete value['sampleIds'] //set used to count samples

				let tvalue
				if (q.colorTW.term.values?.[value.key]) {
					tvalue = q.colorTW.term.values?.[value.key]
				}

				if (tvalue && 'color' in tvalue) {
					value.color = tvalue.color
				} else if (isNumericTerm(q.colorTW.term)) {
					const bins = data.refs.byTermId[q.colorTW.$id].bins
					const bin = bins.find(bin => bin.label == category)
					if (bin?.color) value.color = bin.color
					else {
						value.color = scheme[i - 1] //no bin or custom bin without color
						i--
					}
				} else if (!(q.colorTW.term.type == 'geneVariant' && q.colorTW.q.type == 'values')) {
					value.color = k2c(category)
				}
			}
		}
		let i = 0

		const shapes = Object.entries(result.shapeMap).sort((a, b) => a[0].localeCompare(b[0]))

		// eslint-disable-next-line
		for (const [_, value] of shapes) {
			delete value['sampleIds'] //Set used to count samples
			if ('shape' in value) continue
			if (q.shapeTW.term.values?.[(value as any).key]?.shape != undefined)
				(value as any).shape = q.shapeTW.term.values?.[(value as any).key].shape
			else (value as any).shape = i
			i++
		}
		result.colorLegend = q.colorTW
			? order(result.colorMap, q.colorTW, data.refs)
			: ([['Default', { sampleCount: cohortSamples.length, color: 'blue', key: 'Default' }]] as ColorLegendEntry[])
		result.colorLegend!.push([
			'Ref',
			{
				sampleCount: refSamples.length,
				color: q.colorTW?.term.values?.['Ref'] ? q.colorTW.term.values?.['Ref'].color : (refColor as string),
				key: 'Ref'
			}
		])
		result.shapeLegend = shapes
		result.shapeLegend!.push(['Ref', { sampleCount: refSamples.length, shape: 0, key: 'Ref' }])
	}
	return results
}

function hasValue(dbSample: { sample: any; value: any }, tw: TermWrapper) {
	const key = tw && tw.$id !== undefined ? dbSample?.[tw.$id]?.key : undefined
	const hasKey = key !== undefined
	// a sample is allowed to be missing value for a term. no need to log out
	//if (!hasKey) console.log(JSON.stringify(dbSample) + ' missing value for the term ' + JSON.stringify(tw))
	return hasKey
}

function processSample(
	dbSample: { sample: any; value: any },
	sample: any,
	tw: TermWrapper,
	categoryMap: any,
	category: string
) {
	let value: any = null
	if (tw.term.type == 'geneVariant' && tw.q['type'] == 'values')
		assignGeneVariantValue(dbSample, sample, tw, categoryMap, category)
	else {
		value = dbSample?.[tw.$id!]?.key
		if (value == null) return
		if (tw.term.values?.[value]?.label) {
			value = tw.term.values?.[value]?.label
			sample.hidden[category] = tw.q.hiddenValues ? value! in tw.q.hiddenValues : false
		} else sample.hidden[category] = tw.q.hiddenValues ? dbSample?.[tw.$id!]?.key in tw.q.hiddenValues : false
		if (value) {
			sample[category] = value.toString()
			if (categoryMap[value] == undefined) categoryMap[value] = { sampleCount: 1, key: dbSample?.[tw.$id!]?.key }
			else categoryMap[value].sampleCount++
		}
	}
}

function assignGeneVariantValue(
	dbSample: { sample: any; value: any },
	sample: any,
	tw: TermWrapper,
	categoryMap: any,
	category: string
) {
	if (tw.term.type == 'geneVariant') {
		const mutations = dbSample?.[tw.$id!]?.values
		sample.cat_info[category] = []

		for (const mutation of mutations) {
			const class_info = mclass[mutation.class]
			const value = getCategory(mutation)
			sample.cat_info[category].push(mutation)

			let mapValue
			if (categoryMap[value] == undefined) {
				const sampleIds = new Set()
				sampleIds.add(dbSample.sample)
				mapValue = { color: class_info.color, sampleCount: 1, mutation, key: value, sampleIds }
				categoryMap[value] = mapValue
			} else {
				mapValue = categoryMap[value]
				mapValue.sampleIds.add(dbSample.sample)
				mapValue.sampleCount = mapValue.sampleIds.size
			}
		}
		sample[category] = getMutation(true, dbSample, tw) || getMutation(false, dbSample, tw)
		//all hidden, will take any
		if (!sample[category]) sample[category] = getCategory(mutations[0])
		sample.hidden[category] = tw.q.hiddenValues ? sample[category] in tw.q.hiddenValues : false
	}
}

function getMutation(strict: boolean, dbSample: { sample: any; value: any }, tw: TermWrapper) {
	const mutations = dbSample?.[tw.$id!]?.values
	//eslint-disable-next-line
	for (const [dt, _] of Object.entries(dt2label)) {
		const mutation = mutations.find(mutation => {
			const value = getCategory(mutation)
			const visible = !(tw.q.hiddenValues && value in tw.q.hiddenValues)
			return mutation.dt == dt && visible
		})
		if (!mutation) continue
		const notImportant = mutation.class == 'WT' || mutation.class == 'Blank'
		if (strict && notImportant) continue
		const value = getCategory(mutation)
		return value
	}
}

function getCategory(mutation: { dt: string; class: string; origin: string }) {
	const dt = mutation.dt
	const class_info = mclass[mutation.class]
	const origin = morigin[mutation.origin]?.label
	const dtlabel = origin ? `${origin[0]} ${dt2label[dt]}` : dt2label[dt]
	return `${class_info.label}, ${dtlabel}`
}

function order(map: any, tw: TermWrapper, refs: any) {
	const hasOrder = tw?.term?.values
		? Object.keys(tw.term.values).some(key => tw.term.values![key].order != undefined)
		: false
	let entries: any = []
	if (!tw || map.size == 0) return entries
	entries = Object.entries(map)

	if (hasOrder) {
		entries.sort((a, b) => {
			let v1, v2
			for (const key in tw.term.values) {
				const value = tw.term.values[key]
				if (value.label && a[0] == value.label) v1 = value
				else if (key == a[0]) v1 = value
				if (value.label && b[0] == value.label) v2 = value
				else if (key == b[0]) v2 = value
			}
			if (v1?.order < v2?.order) return -1
			else if (v1?.order > v2?.order) return 1
			else if (v1 > v2) return 1
			else if (v1 < v2) return -1
			return 0
		})
	} else if (refs?.byTermId[tw.$id!]?.bins) {
		const bins = refs.byTermId[tw.$id!].bins
		entries.sort((a, b) => {
			const binA = bins.findIndex(bin => bin.label == a[0])
			const binB = bins.findIndex(bin => bin.label == b[0])
			if (binA == -1) return 1 // put unknown values at the end
			if (binB == -1) return -1 // put unknown values at the end
			return binA - binB
		})
	} else {
		entries.sort((a, b) => a[0].localeCompare(b[0]))
	}
	return entries
}

async function getSampleCoordinatesByTerms(
	req: any,
	q: TermdbSampleScatterRequest,
	ds: any,
	data: ValidGetDataResponse
) {
	if (!q.coordTWs || q.coordTWs.length == 0) return [[], data]
	const canDisplay = authApi.canDisplaySampleIds(req, ds)
	const samples: any = []
	for (const sampleId in data.samples) {
		const values = data.samples[sampleId]
		const x = values[q.coordTWs[0].$id]?.value
		const y = values[q.coordTWs[1]?.$id]?.value || 0 //Event scatter only provides x and calculates y
		const z = q.divideByTW ? values[q.divideByTW?.$id]?.value : 0

		if (x == undefined || y == undefined || z == undefined) continue

		if (
			!isComputable(q.coordTWs[0].term, x) ||
			!isComputable(q.coordTWs[1]?.term, y) ||
			!isComputable(q.divideByTW?.term, z)
		) {
			// any one of the coord value is uncomputable category, do not use this sample
			continue
		}

		const sample: any = { sampleId, x: Number(x), y: Number(y), z: Number(z) } // TODO do not pass z when no divideByTW
		if (canDisplay) {
			sample.sample = data.refs.bySampleId[sampleId]?.label || sampleId
		}
		samples.push(sample)
	}
	return [samples, data]
}

function isComputable(term: Term, value: number) {
	if (!term) return true
	return !term.values?.[value]?.uncomputable
}

// load a file for a plot
async function loadFile(p: any, ds: any) {
	const lines = (await read_file(path.join(serverconfig.tpmasterdir, p.file))).trim().split('\n')
	const xColumn = p.coordsColumns?.x || 1
	const yColumn = p.coordsColumns?.y || 2
	const headerFields = lines[0].split('\t')

	p.filterableSamples = [] // array to keep filterable samples
	p.referenceSamples = [] // optional array to keep reference samples

	let invalidXY = 0
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i].trim().split('\t')
		// sampleName \t x \t y ...

		const x = Number(l[xColumn]),
			y = Number(l[yColumn])
		if (Number.isNaN(x) || Number.isNaN(y)) {
			invalidXY++
			continue
		}
		const sample: Partial<ScatterSample> = { sample: l[0], x, y }
		if (p.colorColumn) {
			sample['sampleId'] = l[0] //deleted later
			sample.category = l[p.colorColumn.index]
			sample.shape = 'Ref'
			sample.z = 0
		}
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
			p.referenceSamples.push(sample)
		} else {
			// sample id can be undefined, e.g. reference samples
			sample['sampleId'] = id
			p.filterableSamples.push(sample)
		}
	}

	console.log(
		p.name + ' (prebuilt scatter):',
		p.filterableSamples.length,
		'lines,',
		p.referenceSamples.length,
		'reference cases,',
		invalidXY,
		'lines with invalid X/Y values'
	)
}

// called in mds3.init
export async function mayInitiateScatterplots(ds) {
	if (!ds.cohort.scatterplots) return
	if (!Array.isArray(ds.cohort.scatterplots.plots)) throw 'cohort.scatterplots.plots is not array'
	for (const p of ds.cohort.scatterplots.plots) {
		if (!p.name) throw '.name missing from one of scatterplots.plots[]'
		if (p.file) {
			// file is potentially big and can slow down server launch. only load it the first time the plot is accessed
		} else {
			throw 'unknown data source of one of scatterplots.plots[]'
		}
	}
}

export async function trigger_getLowessCurve(q, res) {
	const data = q.coords
	const result = JSON.parse(await run_R('lowess.R', JSON.stringify(data)))
	const lowessCurve: any = []
	for (const [i, x] of Object.entries(result.x)) lowessCurve.push([x, result.y[i]])
	return res.send(lowessCurve)
}
