import type { Cell, ColorLegendEntry, RouteApi, ShapeLegendEntry } from '#types'
import { termdbSingleCellPlotsPayload } from '#types/checkers'
import { getColors } from '#shared'
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
			const q = req.query
			if (!q.genome || !q.dslabel) {
				throw new Error('Genome and dataset label are required for termdb/singleCellPlots request.')
			}
			const g = genomes[q.genome]
			const ds = g.datasets[q.dslabel]

			return getSingleCellScatter(req, res, ds)
		} catch (err) {
			console.error(err)
			res.status(500).json({ error: 'Internal server error' })
		}
	}
}

async function getSingleCellScatter(req, res, ds) {
	const q = req.query
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
		const samples = cells.map(cell => {
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
				'geneExp' in d ? (d.geneExp! < s[4]! ? d.geneExp! : s[4]) : Number.POSITIVE_INFINITY,
				'geneExp' in d ? (d.geneExp! > s[5]! ? d.geneExp! : s[5]) : Number.NEGATIVE_INFINITY
			],
			[samples[0].x, samples[0].x, samples[0].y, samples[0].y, samples[0].geneExp, samples[0].geneExp]
		)
		const categories: any = new Set(samples.map(s => s.category))
		const colorMap = {}

		if (tw.term.type != SINGLECELL_GENE_EXPRESSION) {
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

		const resp: any = {
			range: { xMin, xMax, yMin, yMax, geMin, geMax },
			result: { Default: { colorLegend, shapeLegend } }
		}

		if (samples.length >= q.canvasSettings.cutoff) {
			const src = await makeCanvas(q, samples, colorMap, { xMin, xMax, yMin, yMax, geMin, geMax }, tw.term.type)
			resp.result.Default.src = src
		} else {
			resp.result.Default.samples = samples
		}

		res.send(resp)
	} catch (e: any) {
		console.log(e)
		res.send({ error: e.message || e })
	}
}

async function makeCanvas(q, samples, colorMap, range, termType) {
	const settings = q.canvasSettings

	const offsetX = 80
	const offsetY = 30
	//extra space added to avoid clipping the particles on the X axis
	const extraSpaceX = settings.minXScale != null || settings.maxXScale != null ? 0 : (range.xMax - range.xMin) * 0.01
	//extra space added to avoid clipping the particles on the Y axis
	const extraSpaceY = settings.minYScale != null || settings.maxYScale != null ? 0 : (range.yMax - range.yMin) * 0.01
	const width = settings.width + offsetX + extraSpaceX + 20
	const height = settings.height + offsetY + extraSpaceY + 20

	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext('2d')

	//This accounts for user defined min and max scales values
	function getCoordinate(val: number, min: number | null, max: number | null) {
		if (min != null && val < min) return min
		if (max != null && val > max) return max
		return val
	}

	const xScale = scaleLinear()
		.domain([range.xMin - extraSpaceX, range.xMax + extraSpaceX])
		.range([offsetX, settings.width + offsetX])
	const yScale = scaleLinear()
		.domain([range.yMin + extraSpaceY, range.yMax - extraSpaceY])
		.range([offsetY, settings.height + offsetY])
	//This will need to be changed to accomodate user changes from the color scale
	const colorGenerator = scaleLinear()
		.domain([range.geMin, range.geMax])
		.range([settings.noExpColor, settings.expColor])

	for (const sample of samples) {
		const color = () => {
			if (termType == SINGLECELL_GENE_EXPRESSION) {
				if (!sample.geneExp) return settings.noExpColor
				else if (sample.geneExp > range.geMax) return settings.expColor
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
