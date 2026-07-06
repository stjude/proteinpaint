import type {
	Cell,
	ColorLegendEntry,
	Filter,
	FormattedCell2Sample,
	ShapeLegendEntry,
	TermdbSingleCellPlotsRequest,
	Plot,
	RouteApi,
	RoutePayload,
	ValidSingleCellPlotsResponse,
	ValidGetDataResponse,
	ScatterSample
} from '#types'
import { TermdbSingleCellPlotsExample, type TermWrapper } from '#types'
import { validGenomeDs, validString, validNumber } from '#routes/common.ts'
import { getColors, plotColor } from '#shared'
//Note: use .js extension for imports on server side to avoid tsc error about "Cannot find module"
import { isSingleCellTerm, SINGLECELL_GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import { makeCanvas } from './canvasRendering.ts'
import { getData } from '../termdb.matrix.js'
import { getSampleCoordinatesByTerms } from '../routes/termdb.sampleScatter.js'

const payload: RoutePayload = {
	init,
	request: {
		typeId: 'TermdbSingleCellPlotsRequest',
		checker: validTermdbSingleCellPlotsRequest
	},
	response: { typeId: 'TermdbSingleCellPlotsResponse' },
	examples: [TermdbSingleCellPlotsExample]
}

export const api: RouteApi = {
	endpoint: 'termdb/singleCellPlots',
	methods: {
		get: payload,
		post: payload
	}
}

function validTermdbSingleCellPlotsRequest(input): TermdbSingleCellPlotsRequest {
	if (!input.colorTW && (!input.coordTWs || input.coordTWs.length == 0)) {
		throw new Error('colorTW or coordTWs must be provided for single cell scatter plot')
	}
	return {
		...validGenomeDs(input),
		singleCellPlot: {
			name: validString(input.singleCellPlot?.name),
			sample: input.singleCellPlot?.sample
		},
		filter: input.filter ? (input.filter as Filter) : undefined, // TODO: use a filter validator
		filter0: input.filter0 as any,
		canvasSettings: {
			cutoff: validNumber(input.canvasSettings?.cutoff, 'cutoff must be a number') || 1000,
			width: validNumber(input.canvasSettings?.width, 'width must be a number') || 800,
			height: validNumber(input.canvasSettings?.height, 'height must be a number') || 600,
			radius: validNumber(input.canvasSettings?.radius, 'radius must be a number') || 3,
			minXScale:
				input.canvasSettings?.minXScale != null
					? validNumber(input.canvasSettings.minXScale, 'minXScale must be a number')
					: null,
			maxXScale:
				input.canvasSettings?.maxXScale != null
					? validNumber(input.canvasSettings.maxXScale, 'maxXScale must be a number')
					: null,
			minYScale:
				input.canvasSettings?.minYScale != null
					? validNumber(input.canvasSettings.minYScale, 'minYScale must be a number')
					: null,
			maxYScale:
				input.canvasSettings?.maxYScale != null
					? validNumber(input.canvasSettings.maxYScale, 'maxYScale must be a number')
					: null,
			opacity:
				input.canvasSettings?.opacity != null
					? validNumber(input.canvasSettings.opacity, 'opacity must be a number')
					: 1,
			startColor: validString(input.canvasSettings?.startColor, 'startColor must be a string') || '#d3d3d3',
			stopColor: validString(input.canvasSettings?.stopColor, 'stopColor must be a string') || '#ff0000',
			devicePixelRatio:
				input.canvasSettings?.devicePixelRatio != null
					? validNumber(input.canvasSettings.devicePixelRatio, 'devicePixelRatio must be a number')
					: undefined
		},
		colorTW: input.colorTW
			? (() => {
				if (!isSingleCellTerm(input.colorTW.term))
					throw new Error('colorTW must be a single cell term for single cell scatter plot')
				return input.colorTW as TermWrapper
			})()
			: undefined,
		coordTWs: input?.coordTWs?.length
			? (() => {
				if (!isSingleCellTerm(input.coordTWs[0].term))
					throw new Error('coordTWs must be an array of single cell terms for single cell scatter plot')
				return input.coordTWs as TermWrapper[]
			})()
			: undefined
	}
}

export function init({ genomes }) {
	return async function (req, res) {
		try {
			const q = req.query as TermdbSingleCellPlotsRequest
			if (!q.genome || !q.dslabel) {
				throw new Error('Genome and dataset label are required for termdb/singleCellPlots request.')
			}
			const g = genomes[q.genome]
			if (!g) throw new Error('Invalid genome name')
			const ds = g.datasets[q.dslabel]
			if (!ds) throw new Error('Invalid dataset label')
			if (!ds.queries?.singleCell) throw new Error('No single cell data on this dataset')

			return getSingleCellScatter(req, res, ds)
		} catch (err: any) {
			console.error(err)
			res.status(500).json({ error: err.message || String(err) })
		}
	}
}

async function getSingleCellScatter(req, res, ds) {
	const q = req.query as TermdbSingleCellPlotsRequest

	if (q.coordTWs?.length && q.colorTW) {
		throw new Error('Using coordTWs with colorTW is not implemented for single cell scatter plot')
	}

	const { name, sample, isMetaResult } = q.singleCellPlot

	try {
		const { arg, tw, genes } = getSingleCellDataArgs(q, name, sample)

		let coords: ScatterSample[] = [],
			colorData: { plots: Plot[] } = { plots: [] },
			filteredSamples: Set<string> = new Set()

		const data = await getData(arg, ds)
		if (!data) throw new Error('No data returned for single cell scatter plot')

		if (q.coordTWs && q.coordTWs.length > 0) {
			const tmp = await getSampleCoordinatesByTerms(req, q, ds, data as ValidGetDataResponse)
			coords = tmp[0]
		}
		if (isMetaResult && (q.filter?.lst?.length || q.filter0)) {
			filteredSamples = await ds.queries.singleCell.samples.getFilteredSingleCellSamples(q)
		}
		if (q.colorTW) {
			for (const gene of genes) {
				const tmpArg = { ...arg, gene}
				const tmpData = await ds.queries.singleCell.data.get(tmpArg)
				colorData = Object.assign(colorData, tmpData)
			}
		}

		const { samples, categoryCounts, xMin, xMax, yMin, yMax, geMin, geMax, totalCellCount } = processSamples(
			coords,
			colorData,
			filteredSamples,
			tw,
			sample,
			ds
		)
		const colorMap = {}

		if (tw.term.type == SINGLECELL_CELLTYPE) {
			const defaultK2c = getColors(categoryCounts.size)
			const dsTerm = ds.queries.singleCell?.terms
				? ds.queries.singleCell.terms.find(t => t.name == tw.term.name)
				: undefined
			for (const [category, count] of categoryCounts) {
				const color = tw.term.values?.[category]?.color || dsTerm?.values?.[category]?.color || defaultK2c(category)
				colorMap[category] = { sampleCount: count, color, key: category }
			}
		} else if (arg.terms.length > 0 && arg.terms[0].term.type == SINGLECELL_GENE_EXPRESSION) {
			/** Should only be 'default' category */
			colorMap['Default'] = { sampleCount: totalCellCount, color: plotColor, key: 'Default' }
		}
		const shapeLegend: ShapeLegendEntry[] = [['Ref', { sampleCount: totalCellCount, shape: 0, key: 'Ref' }]]
		const colorLegend: ColorLegendEntry[] = Object.entries(colorMap)

		const output: ValidSingleCellPlotsResponse = {
			range: { xMin, xMax, yMin, yMax, geMin, geMax },
			//There should only be one chart
			result: { Default: { colorLegend, shapeLegend } }
		}

		if (totalCellCount >= q.canvasSettings.cutoff) {
			const { src, canvasWidth, canvasHeight } = await makeCanvas(
				q,
				samples,
				colorMap,
				{ xMin, xMax, yMin, yMax, geMin, geMax },
				tw.term.type
			)
			output.result.Default.src = src
			output.result.Default.canvasWidth = canvasWidth
			output.result.Default.canvasHeight = canvasHeight
			/** Since the sample array is not returned, send the sample count for the legend */
			output.result.Default.totalSampleCount = totalCellCount
		} else {
			output.result.Default.samples = samples
		}

		res.send(output)
	} catch (e: any) {
		console.log(e)
		res.send({ error: e.message || e })
	}
}

function getSingleCellDataArgs(q, name, sample) {
	const arg: { [index: string]: any } = {
		plots: [name], 
		sample, 
		terms: [], 
		filter: q.filter, 
		filter0: q.filter0, 
		__protected__: q.__protected__,
		__abortSignal: q.__abortSignal
	}
	const genes: string[] = []
	if (q.colorTW) {
		if (isSingleCellTerm(q.colorTW.term)) {
			arg.terms.push(q.colorTW)
			if (q.colorTW.term.type === SINGLECELL_GENE_EXPRESSION) {
				genes.push(q.colorTW.term.gene)
			}
		} else throw new Error('colorTW must be a single cell term for single cell scatter plot')
	}
	if (q?.coordTWs?.length) {
		for (const tw of q.coordTWs) {
			arg.terms.push(tw)
			if (tw.term.type === SINGLECELL_GENE_EXPRESSION) {
				genes.push(tw.term.gene)
			}
			// else throw new Error('unsupported single cell term type for coordTWs: ' + tw.term.type)
		}
	}
	if (!arg.terms.length) throw new Error('At least one term must be provided for single cell scatter plot')

	const tw: any = arg.terms[0]
	if (tw.term.type == SINGLECELL_CELLTYPE) arg.colorBy = tw.term.name

	return { arg, tw, genes }
}

function processSamples(coords: any, colorData: { plots: Plot[] }, filteredSamples: Set<string>, tw, sample, ds) {
	const samples: FormattedCell2Sample[] = []
	const categoryCounts = new Map<string, number>()
	let xMin = Infinity,
		xMax = -Infinity,
		yMin = Infinity,
		yMax = -Infinity,
		geMin = Infinity,
		geMax = -Infinity
	let totalCellCount = 0

	if (coords?.length && !colorData.plots?.length) {
		const category = 'Default'
		for (const cell of coords) {
			if (filteredSamples.size > 0 && !filteredSamples.has(cell.sample)) continue

			if (cell.x < xMin) xMin = cell.x
			if (cell.x > xMax) xMax = cell.x
			if (cell.y < yMin) yMin = cell.y
			if (cell.y > yMax) yMax = cell.y
			if (Number.isFinite(cell.geneExp!) && cell.geneExp! < geMin) geMin = cell.geneExp!
			if (Number.isFinite(cell.geneExp!) && cell.geneExp! > geMax) geMax = cell.geneExp!

			const formattedCell = {
				sampleId: cell.sample,
				x: cell.x,
				y: cell.y,
				z: 0,
				hidden: { category: false },
				category,
				shape: cell.shape || 'Ref',
				geneExp: cell.geneExp
			}

			samples.push(formattedCell)
			totalCellCount++
			categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
		}
	} else if (!coords?.length && colorData.plots?.length) {
		const plot = colorData.plots[0]
		const cells: Cell[] = [...plot.expCells, ...plot.noExpCells]

		const groups = tw.q?.customset?.groups
		const cat2GrpName = new Map<any, string>()
		if (groups) {
			for (const group of groups) {
				for (const value of Object.values(group.values) as any[]) {
					cat2GrpName.set(value.key, group.name)
				}
			}
		}

		for (const cell of cells) {
			if (filteredSamples.size > 0) {
				const metaIdMap = ds.queries?.singleCell?.data?.metaIdMap?.get?.(sample!.sID)
				const sampleName = metaIdMap?.get?.(cell.cellId)
				if (sampleName && !filteredSamples.has(sampleName)) continue
			}

			/** Since getData() from termdb.matrix is not called again for single cell scatter,
			 * the groups formatting logic for category (i.e. value) is recreated here. */
			let category = cell.category
			const groupName = cat2GrpName.get(category)
			if (groupName !== undefined) category = groupName

			const isHidden = tw?.q?.hiddenValues ? category in tw.q.hiddenValues : false
			totalCellCount++
			categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)

			if (cell.x < xMin) xMin = cell.x
			if (cell.x > xMax) xMax = cell.x
			if (cell.y < yMin) yMin = cell.y
			if (cell.y > yMax) yMax = cell.y
			if (Number.isFinite(cell.geneExp!) && cell.geneExp! < geMin) geMin = cell.geneExp!
			if (Number.isFinite(cell.geneExp!) && cell.geneExp! > geMax) geMax = cell.geneExp!

			if (isHidden) continue

			samples.push({
				sampleId: cell.cellId,
				x: cell.x,
				y: cell.y,
				z: 0,
				category,
				shape: 'Ref',
				hidden: { category: false },
				geneExp: cell.geneExp
			})
		}
	}

	return { samples, categoryCounts, xMin, xMax, yMin, yMax, geMin, geMax, totalCellCount }
}
