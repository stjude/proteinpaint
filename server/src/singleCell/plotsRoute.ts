import type {
	Cell,
	ColorLegendEntry,
	ColorMap,
	Filter,
	FormattedCell2Sample,
	ShapeLegendEntry,
	SingleCellRange,
	TermdbSingleCellPlotsRequest,
	Plot,
	RouteApi,
	RoutePayload,
	ValidSingleCellPlotsResponse
} from '#types'
import { TermdbSingleCellPlotsExample } from '#types'
import { validGenomeDs, validString, validNumber } from '#routes/common.ts'
import { getColors, getCoordinate, calculatePadding, xAxisOffSet, yAxisOffSet } from '#shared'
//Note: use .js extension for imports on server side to avoid tsc error about "Cannot find module"
import { isSingleCellTerm, SINGLECELL_GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'
//Note: use .js extension for imports on server side to avoid tsc error about "Cannot find module"
import { refColor } from '#routes/termdb.sampleScatter.js'

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
	return {
		...validGenomeDs(input),
		singleCellPlot: {
			name: validString(input.singleCellPlot?.name),
			sample: input.singleCellPlot?.sample
		},
		filter: input.filter ? (input.filter as Filter) : undefined, // TODO: use a filter validator
		filter0: input.filter0 as any,
		canvasSettings: {
			cutoff: validNumber(input.canvasSettings?.cutoff) || 1000,
			width: validNumber(input.canvasSettings?.width) || 800,
			height: validNumber(input.canvasSettings?.height) || 600,
			radius: validNumber(input.canvasSettings?.radius) || 3,
			minXScale: input.canvasSettings?.minXScale != null ? validNumber(input.canvasSettings.minXScale) : null,
			maxXScale: input.canvasSettings?.maxXScale != null ? validNumber(input.canvasSettings.maxXScale) : null,
			minYScale: input.canvasSettings?.minYScale != null ? validNumber(input.canvasSettings.minYScale) : null,
			maxYScale: input.canvasSettings?.maxYScale != null ? validNumber(input.canvasSettings.maxYScale) : null,
			opacity: input.canvasSettings?.opacity != null ? validNumber(input.canvasSettings.opacity) : 1,
			startColor: validString(input.canvasSettings?.startColor) || '#d3d3d3',
			stopColor: validString(input.canvasSettings?.stopColor) || '#ff0000',
			devicePixelRatio:
				input.canvasSettings?.devicePixelRatio != null ? validNumber(input.canvasSettings.devicePixelRatio) : undefined
		},
		colorTW: input.colorTW || undefined,
		coordTWs: input.coordTWs || undefined
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
	const { name, sample } = q.singleCellPlot
	try {
		const tw = q.colorTW as any // not using "TermWrapper" due to tsc err
		if (!tw || !isSingleCellTerm(tw.term))
			throw new Error('colorTW must be provided and be a single cell term for single cell scatter plot')
		const terms = [tw]
		const arg: any = { plots: [name], sample, terms, filter: q.filter, filter0: q.filter0 }

		if (tw.term.type == SINGLECELL_GENE_EXPRESSION) arg.gene = tw.term.gene
		else if (tw.term.type == SINGLECELL_CELLTYPE) arg.colorBy = tw.term.name
		else throw new Error(`unsupported single cell term type: ${tw.term.type}`)

		const data: { plots: Plot[] } = await ds.queries.singleCell.data.get(arg)

		const plot = data.plots[0]
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
		const samples: FormattedCell2Sample[] = []
		const categoryCounts = new Map<string, number>()
		let xMin = Infinity,
			xMax = -Infinity,
			yMin = Infinity,
			yMax = -Infinity,
			geMin = Infinity,
			geMax = -Infinity
		let totalCellCount = 0
		let filteredSamples: Set<string> = new Set()

		if (q.filter?.lst?.length || q.filter0) {
			filteredSamples = await ds.queries.singleCell.samples.getFilteredSingleCellSamples(q)
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

async function makeCanvas(q, samples, colorMap: ColorMap, range: SingleCellRange, termType: string) {
	const settings = q.canvasSettings
	const dpr = settings.devicePixelRatio || 1
	const extraSpaceX = calculatePadding(settings.minXScale, settings.maxXScale, range.xMin, range.xMax) //extra space added to avoid clipping the particles on the X axis
	const extraSpaceY = calculatePadding(settings.minYScale, settings.maxYScale, range.yMin, range.yMax) //extra space added to avoid clipping the particles on the Y axis
	const width = settings.width + xAxisOffSet + extraSpaceX + 20
	const height = settings.height + yAxisOffSet + extraSpaceY + 20

	const canvas = createCanvas(width * dpr, height * dpr)
	const ctx = canvas.getContext('2d')
	if (dpr > 1) ctx.scale(dpr, dpr)

	//This accounts for user defined min and max scales values
	const xScale = scaleLinear()
		.domain([range.xMin - extraSpaceX, range.xMax + extraSpaceX])
		.range([xAxisOffSet, settings.width + xAxisOffSet])
	const yScale = scaleLinear()
		.domain([range.yMax + extraSpaceY, range.yMin - extraSpaceY])
		.range([yAxisOffSet, settings.height + yAxisOffSet])

	let colorGenerator
	if (Number.isFinite(range.geMin) && Number.isFinite(range.geMax)) {
		colorGenerator = scaleLinear().domain([range.geMin, range.geMax]).range([settings.startColor, settings.stopColor])
	}
	const color = (sample: FormattedCell2Sample) => {
		if (termType == SINGLECELL_GENE_EXPRESSION) {
			if (!Number.isFinite(sample.geneExp)) return settings.startColor //settings.noExpColor
			else if (sample.geneExp! > range.geMax!) return settings.stopColor //settings.expColor
			else return colorGenerator(sample.geneExp)
		}
		return colorMap[sample.category] ? colorMap[sample.category].color : refColor
	}
	const x = (sample: FormattedCell2Sample) => {
		const tmp = getCoordinate(sample.x, settings.minXScale, settings.maxXScale)
		return xScale(tmp)
	}
	const y = (sample: FormattedCell2Sample) => {
		const tmp = getCoordinate(sample.y, settings.minYScale, settings.maxYScale)
		return yScale(tmp)
	}
	for (const sample of samples) {
		// Draw each sample on the canvas
		const c = rgb(color(sample))
		c.opacity = settings.opacity
		ctx.fillStyle = c.toString()
		ctx.beginPath()
		ctx.arc(x(sample), y(sample), settings.radius, 0, Math.PI * 2)
		ctx.fill()
	}

	return { src: canvas.toDataURL(), canvasWidth: width, canvasHeight: height }
}
