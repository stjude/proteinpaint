import type {
	Cell,
	ColorLegendEntry,
	ColorMap,
	FormattedCell2Sample,
	RouteApi,
	ShapeLegendEntry,
	SingleCellRange,
	TermdbSingleCellPlotsRequest,
	ValidSingleCellPlotsResponse
} from '#types'
import { termdbSingleCellPlotsPayload } from '#types/checkers'
import { getColors, getCoordinate, calculatePadding, xAxisOffSet, yAxisOffSet } from '#shared'
//Note: use .js extension for imports on server side to avoid tsc error about "Cannot find module"
import { isSingleCellTerm, SINGLECELL_GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'
//Note: use .js extension for imports on server side to avoid tsc error about "Cannot find module"
import { refColor } from './termdb.sampleScatter.js'

export const api: RouteApi = {
	endpoint: 'termdb/singleCellPlots',
	methods: {
		get: {
			...termdbSingleCellPlotsPayload,
			init
		},
		post: {
			...termdbSingleCellPlotsPayload,
			init
		}
	}
}

function init({ genomes }) {
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
		} catch (err) {
			console.error(err)
			res.status(500).json({ error: 'Internal server error' })
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
		const arg: any = { plots: [name], sample }

		if (tw.term.type == SINGLECELL_GENE_EXPRESSION) arg.gene = tw.term.gene
		else if (tw.term.type == SINGLECELL_CELLTYPE) arg.colorBy = tw.term.name
		else throw new Error(`unsupported single cell term type: ${tw.term.type}`)

		const data = await ds.queries.singleCell.data.get(arg)

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
		const samples: FormattedCell2Sample[] = cells.map(cell => {
			/** Since getData() from termdb.matrix is not called again for single cell scatter,
			 * the groups formatting logic for category (i.e. value) is recreated here. */
			let category = cell.category
			const groupName = cat2GrpName.get(category)
			if (groupName !== undefined) category = groupName
			const hidden = {
				category: tw?.q?.hiddenValues ? category in tw.q.hiddenValues : false
			}
			return {
				sample: cell.cellId,
				sampleId: cell.cellId,
				x: cell.x,
				y: cell.y,
				z: 0,
				category,
				shape: 'Ref',
				hidden,
				geneExp: cell.geneExp
			}
		})
		const [xMin, xMax, yMin, yMax, geMin, geMax] = samples.reduce(
			(s, d) => [
				d.x < s[0] ? d.x : s[0],
				d.x > s[1] ? d.x : s[1],
				d.y < s[2] ? d.y : s[2],
				d.y > s[3] ? d.y : s[3],
				Number.isFinite(d.geneExp!) && d.geneExp! < s[4]! ? d.geneExp! : s[4],
				Number.isFinite(d.geneExp!) && d.geneExp! > s[5]! ? d.geneExp! : s[5]
			],
			/** geneExp maybe null. Use Number.POSITIVE_INFINITY and
			 * Number.NEGATIVE_INFINITY in case the initial values are null. */
			[samples[0].x, samples[0].x, samples[0].y, samples[0].y, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
		)
		const categories: any = new Set(samples.map(s => s.category))
		const colorMap = {}

		if (tw.term.type == SINGLECELL_CELLTYPE) {
			const defaultK2c = getColors(categories.size)
			const k2c = category => {
				/** Only assign default color after checking term.values
				 * and ds defined colors. */
				const dsTerm = ds.queries.singleCell?.terms
					? ds.queries.singleCell.terms.find(t => t.name == tw.term.name)
					: undefined
				return tw.term.values?.[category]?.color || dsTerm?.values?.[category]?.color || defaultK2c(category)
			}

			for (const category of categories) {
				const color = k2c(category)
				colorMap[category] = {
					sampleCount: samples.filter((s: any) => s.category == category).length,
					color,
					key: category
				}
			}
		}
		const shapeLegend: ShapeLegendEntry[] = [['Ref', { sampleCount: samples.length, shape: 0, key: 'Ref' }]]
		const colorLegend: ColorLegendEntry[] = Object.entries(colorMap)

		const output: ValidSingleCellPlotsResponse = {
			range: { xMin, xMax, yMin, yMax, geMin, geMax },
			//There should only be one chart
			result: { Default: { colorLegend, shapeLegend } }
		}

		if (samples.length >= q.canvasSettings.cutoff) {
			const src = await makeCanvas(q, samples, colorMap, { xMin, xMax, yMin, yMax, geMin, geMax }, tw.term.type)
			output.result.Default.src = src
			/** Since the sample array is not returned, send the sample count for the legend */
			output.result.Default.totalSampleCount = samples.length
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
	const extraSpaceX = calculatePadding(settings.minXScale, settings.maxXScale, range.xMin, range.xMax) //extra space added to avoid clipping the particles on the X axis
	const extraSpaceY = calculatePadding(settings.minYScale, settings.maxYScale, range.yMin, range.yMax) //extra space added to avoid clipping the particles on the Y axis
	const width = settings.width + xAxisOffSet + extraSpaceX + 20
	const height = settings.height + yAxisOffSet + extraSpaceY + 20

	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext('2d')

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
	for (const sample of samples.filter(s => !s.hidden.category)) {
		const color = () => {
			if (termType == SINGLECELL_GENE_EXPRESSION) {
				if (!Number.isFinite(sample.geneExp)) return settings.startColor //settings.noExpColor
				else if (sample.geneExp > range.geMax!) return settings.stopColor //settings.expColor
				else return colorGenerator(sample.geneExp)
			}
			return colorMap[sample.category] ? colorMap[sample.category].color : refColor
		}
		const x = () => {
			const tmp = getCoordinate(sample.x, settings.minXScale, settings.maxXScale)
			return xScale(tmp)
		}
		const y = () => {
			const tmp = getCoordinate(sample.y, settings.minYScale, settings.maxYScale)
			return yScale(tmp)
		}
		// Draw each sample on the canvas
		const c = rgb(color())
		c.opacity = settings.opacity
		ctx.fillStyle = c.toString()
		ctx.beginPath()
		ctx.arc(x(), y(), settings.radius, 0, Math.PI * 2)
		ctx.fill()
	}

	return canvas.toDataURL()
}
