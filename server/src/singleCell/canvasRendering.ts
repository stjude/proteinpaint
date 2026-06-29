import type { ColorMap, FormattedCell2Sample, SingleCellRange } from '#types'
import { getCoordinate, calculatePadding, xAxisOffSet, yAxisOffSet } from '#shared'
import { createCanvas } from 'canvas'
import { scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'
//Note: use .js extension for imports on server side to avoid tsc error about "Cannot find module"
import { refColor } from '#routes/termdb.sampleScatter.js'
import { SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'

export async function makeCanvas(
	q /*:TermdbSingleCellPlotsRequest*/,
	samples: FormattedCell2Sample[],
	colorMap: ColorMap,
	range: SingleCellRange,
	termType: string
) {
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
			else if (sample.geneExp) return colorGenerator(sample.geneExp)
			else return settings.startColor //settings.noExpColor
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
