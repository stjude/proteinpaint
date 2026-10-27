import type { AggregateMatrix } from '../AggregateMatrix.ts'
import { getMaxLabelWidth, capitalizeFirstLetter } from '#dom'
import { scaleLinear } from 'd3-scale'
import { arc, pie } from 'd3-shape'
import type { AggMatrixDot, AggMatrixPie, AxisLayoutColumns, AxisLayoutRows, ValidAggMatrixResponse } from '#types'
import { GENE_VARIANT } from '#types'
import { mclass } from '#shared/common.js'
import type { AggregateMatrixSettings } from '../settings/Settings.ts'
import { roundValue } from '#shared/roundValue.js'
import type {
	AggMatrixViewData,
	AggMatrixDotPosition,
	AggMatrixPiePosition,
	PieLegendEntry
} from './ViewModelDataTypes.ts'

export class AggMatrixViewModel {
	ag: AggregateMatrix
	viewData!: AggMatrixViewData
	maxRowLabelLgth!: number
	maxColLabelLgth!: number
	rowTermLabelLgth!: number
	colTermLabelLgth!: number
	maxRowSectionLabelWdth!: number
	maxColSectionLabelHght!: number
	totalRowHght!: number
	totalColWdth!: number
	lastX!: number
	lastY!: number
	rowSectionRotateFlags: boolean[] = []
	colSectionRotateFlags: boolean[] = []
	sizeScale!: (value: number) => number

	readonly topPad = 20
	readonly hoziPad = 20
	readonly bottomPad = 20
	readonly sectionGap = 8
	readonly colSectionGap = 4
	readonly minColSectionLineInset = 2
	readonly colSectionLabelLineGap = 3
	readonly colSectionLabelGap = 8
	readonly labelFontPx = 12

	constructor(ag: AggregateMatrix) {
		this.ag = ag
		this.sizeScale = (value: number) => value
	}

	processData(data: ValidAggMatrixResponse) {
		this.viewData = this.getDefaultViewData()

		const settings = this.ag.state.config.settings.aggregateMatrix
		// padding for either top/bottom or left/right of the dot
		const dotPadding = settings.maxDotSize * 1.5
		const cellSize = settings.maxDotSize + dotPadding
		const measureSvg = this.ag.dom.mainDiv.append('svg') as any

		/** Must determine the maximum amount of space needed for the rows.
		 * If there isn't enough space to show the row section label above the
		 * relevant terms, the section label is shown horizontally. This extra
		 * space is taken into account here. */
		const rowData = data.axesLayout.rows
		this.rowTermLabelLgth = getMaxLabelWidth(measureSvg, [rowData.longestLabel])
		const rowSectionLayout = this.getSectionLabelLayout(rowData.sections, cellSize, measureSvg, true)
		this.rowSectionRotateFlags = rowSectionLayout.rotateFlags
		this.maxRowSectionLabelWdth = rowSectionLayout.maxCrossAxisSpace
		this.maxRowLabelLgth =
			this.rowTermLabelLgth + (this.maxRowSectionLabelWdth ? this.sectionGap + this.maxRowSectionLabelWdth : 0)
		this.totalRowHght = cellSize * rowData.rowCount

		/** Same as the rows above. Takes into account the extra space needed if >=1 col
		 * labels is rotated to be shown. */
		const colData = data.axesLayout.columns
		this.colTermLabelLgth = getMaxLabelWidth(measureSvg, [colData.longestLabel])
		const colSectionLayout = this.getSectionLabelLayout(colData.sections, cellSize, measureSvg, false)
		this.colSectionRotateFlags = colSectionLayout.rotateFlags
		this.maxColSectionLabelHght = colSectionLayout.maxCrossAxisSpace
		this.maxColLabelLgth =
			this.colTermLabelLgth + (this.maxColSectionLabelHght ? this.colSectionGap + this.maxColSectionLabelHght : 0)
		this.totalColWdth = cellSize * colData.colCount
		measureSvg.remove()

		this.getPlotDimensions()
		this.getAxisLabelPositions(rowData, colData, cellSize)
		this.setColorScale(settings, data.colorScale)
		this.sizeScale = scaleLinear()
			.domain([data.sizeScale.min, data.sizeScale.max])
			.range([settings.minDotSize, settings.maxDotSize])
			.clamp(true)
		this.getDotPositions(data.data, cellSize, settings, data.sampleType)
		this.viewData.pieLegend = this.getPieLegend(data.data)
	}

	getSectionLabelLayout(sections: AxisLayoutRows['sections'], cellSize: number, measureSvg, isYaxis: boolean) {
		const rotateFlags: boolean[] = []
		const widthCache = new Map<string, number>()
		let maxCrossAxisSpace = 0

		for (const section of sections) {
			const label = section.id || ''
			let labelWidth = 0
			if (label) {
				if (!widthCache.has(label)) widthCache.set(label, getMaxLabelWidth(measureSvg, [label]))
				labelWidth = widthCache.get(label) || 0
			}
			const sectionSpan = section.terms.length * cellSize

			// If a section label cannot fit in the term span on its preferred orientation,
			// flip orientation per axis: Y-axis becomes horizontal, X-axis becomes vertical.
			const rotate = isYaxis ? labelWidth <= sectionSpan : labelWidth > sectionSpan
			rotateFlags.push(rotate)

			const crossAxisSpace = rotate
				? isYaxis
					? this.labelFontPx
					: labelWidth
				: isYaxis
				? labelWidth
				: this.labelFontPx
			maxCrossAxisSpace = Math.max(maxCrossAxisSpace, crossAxisSpace)
		}

		return { rotateFlags, maxCrossAxisSpace }
	}

	getPlotDimensions() {
		const plotDim = {
			svg: {
				width: this.hoziPad + this.maxRowLabelLgth + this.totalColWdth + this.hoziPad,
				height: this.topPad + this.totalRowHght + this.maxColLabelLgth + this.bottomPad
			},
			rowLabels: {
				x: this.hoziPad + this.maxRowLabelLgth,
				y: this.topPad
			},
			colLabels: {
				x: 0,
				y: this.topPad + this.totalRowHght
			}
		}
		this.viewData.plotDim = plotDim
	}

	getDefaultViewData(): AggMatrixViewData {
		return {
			plotDim: {
				svg: { width: 0, height: 0 },
				rowLabels: { x: 0, y: 0 },
				colLabels: { x: 0, y: 0 }
			},
			rowLabels: [],
			colLabels: [],
			rowSectionLabels: [],
			colSectionLabels: [],
			rowSectionLines: [],
			colSectionLines: [],
			dotPositions: [],
			pieLegend: { title: '', entries: [] },
			colorScale: {
				//TODO: If the user cannot set the min and max for color values,
				// revert to colorScale = scale
				scale: () => '',
				absMin: 0,
				absMax: 0
			}
		}
	}

	getAxisLabelPositions(rowData: AxisLayoutRows, colData: AxisLayoutColumns, cellSize: number) {
		const rowSectionLineX = -(this.rowTermLabelLgth + this.sectionGap / 2)
		const rowSectionLabelGap = this.sectionGap / 2
		const rowSectionRotateExtraGap = this.labelFontPx / 2 + 1
		// Rotated term labels are end-anchored so their last letter sits on one reference line.
		const colTermY = this.labelFontPx
		const colTermBandDepth = colTermY + this.colTermLabelLgth
		const colSectionBandStart = colTermBandDepth + (this.maxColSectionLabelHght ? this.colSectionGap : 0)
		const colSectionLineY = Math.max(0, colSectionBandStart - this.colSectionLabelLineGap)
		const colSectionLineInset = Math.max(this.minColSectionLineInset, cellSize * 0.06)

		this.lastY = 0
		this.lastX = this.hoziPad + this.maxRowLabelLgth

		this.viewData.rowLabels = []
		this.viewData.colLabels = []
		this.viewData.rowSectionLabels = []
		this.viewData.colSectionLabels = []
		this.viewData.rowSectionLines = []
		this.viewData.colSectionLines = []

		for (const [rowSectionIndex, section] of rowData.sections.entries()) {
			const sectionStartY = this.lastY
			for (const term of section.terms) {
				const row = {
					x: 0,
					y: this.lastY + cellSize / 2,
					label: term.label || term.id
				}
				this.viewData.rowLabels.push(row)
				this.lastY += cellSize
			}

			const sectionCenterY = sectionStartY + (section.terms.length * cellSize) / 2
			const sectionEndY = sectionStartY + section.terms.length * cellSize
			const rotate = this.rowSectionRotateFlags[rowSectionIndex]
			this.viewData.rowSectionLabels.push({
				x: rowSectionLineX - rowSectionLabelGap - (rotate ? rowSectionRotateExtraGap : 0),
				y: sectionCenterY,
				label: section.id,
				rotate
			})
			this.viewData.rowSectionLines.push({
				x: rowSectionLineX,
				y1: sectionStartY + cellSize / 2,
				y2: sectionEndY - cellSize / 2
			})
		}

		for (const [colSectionIndex, section] of colData.sections.entries()) {
			const sectionStartX = this.lastX
			for (const term of section.terms) {
				const col = {
					x: this.lastX + cellSize / 2,
					y: colTermY,
					label: term.label || term.id
				}
				this.viewData.colLabels.push(col)
				this.lastX += cellSize
			}

			const sectionCenterX = sectionStartX + (section.terms.length * cellSize) / 2
			const rotate = this.colSectionRotateFlags[colSectionIndex]
			const colSectionLabelY = colSectionLineY + this.colSectionLabelGap + (rotate ? 0 : this.labelFontPx / 2)
			this.viewData.colSectionLabels.push({
				x: sectionCenterX,
				y: colSectionLabelY,
				label: section.id,
				rotate
			})
			this.viewData.colSectionLines.push({
				y: colSectionLineY,
				x1: sectionStartX + colSectionLineInset,
				x2: this.lastX - colSectionLineInset
			})
		}
	}

	setColorScale(settings: AggregateMatrixSettings, colorScaleData: ValidAggMatrixResponse['colorScale']) {
		const domain =
			colorScaleData.min === colorScaleData.max
				? /** Instances, like count, may return identical min and max values.
				   * Slightly adjust the domain to avoid having identical min and max values.
				   * Circumvents ColorScale requirement for unique values.
				   * If reverted, reinstate check in agg matrix route. */
				  [
						colorScaleData.min - Math.max(Math.abs(colorScaleData.min) * 0.01, 1e-12),
						colorScaleData.max + Math.max(Math.abs(colorScaleData.max) * 0.01, 1e-12)
				  ]
				: [colorScaleData.min, colorScaleData.max]
		const scale = scaleLinear()
			.domain(domain)
			.range([settings.startColor as any, settings.stopColor as any])
		this.viewData.colorScale = {
			scale,
			absMin: colorScaleData.min,
			absMax: colorScaleData.max
		}
	}

	getDotPositions(
		data: AggMatrixDot[][],
		cellSize: number,
		settings: AggregateMatrixSettings,
		sampleType?: ValidAggMatrixResponse['sampleType']
	) {
		const startX = this.hoziPad + this.maxRowLabelLgth
		const startY = this.topPad

		this.lastY = startY
		this.lastX = startX

		for (const [i, row] of data.entries()) {
			for (const dot of row) {
				const hasData = dot.colorValue !== null && dot.sizeValue !== null
				const dotPos = {
					x: this.lastX + cellSize / 2,
					y: this.lastY + cellSize / 2,
					/** Regardless if the size and color value are available, the dot will render.
					 * This will allow the tooltip to appear, displaying the data or lack thereof
					 * to the user. */
					size: hasData ? this.sizeScale(dot.sizeValue!) : settings.maxDotSize,
					color: hasData ? this.viewData.colorScale.scale(dot.colorValue!) : 'transparent',
					hasData,
					row: dot.row,
					rowSection: dot.rowSection,
					column: dot.column,
					colSection: dot.colSection,
					pie: dot.pie ? this.getPiePosition(dot.pie, settings) : undefined,
					tipData: [
						{
							label: dot.rowSection,
							value: dot.row
						},
						{
							label: dot.colSection,
							value: dot.column
						},
						{
							// Show the color value
							label: capitalizeFirstLetter(settings.gradientMethod),
							value: dot.colorValue === null ? 'No available data' : roundValue(dot.colorValue, 2)
						},
						{
							// Show the size value
							label: capitalizeFirstLetter(settings.sizeMethod),
							value: dot.sizeValue === null ? 'No available data' : roundValue(dot.sizeValue, 2)
						}
					]
				} satisfies AggMatrixDotPosition
				if (dot.pie) this.getPieTipData(dot.pie, sampleType).forEach(entry => dotPos.tipData.push(entry))
				this.viewData.dotPositions.push(dotPos)
				this.lastX += cellSize
			}
			this.lastX = startX
			this.lastY = startY + (i + 1) * cellSize
		}
	}

	/** Server sends default labels and colors for variant classes. The mclass of the client has the
	 * mclassOverride of the launch arguments applied, so a variant class is described by it instead. */
	describeSlice(slice: AggMatrixPie['slices'][number], termType?: string) {
		if (termType == GENE_VARIANT && Object.prototype.hasOwnProperty.call(mclass, slice.key)) {
			const { label, color } = mclass[slice.key]
			return { label, color }
		}
		return { label: slice.label, color: slice.color }
	}

	/** Pie area is proportional to the number of samples. A pie is never smaller than the smallest dot. */
	getPiePosition(data: AggMatrixPie, settings: AggregateMatrixSettings): AggMatrixPiePosition {
		const radius = Math.max(settings.minDotSize, data.radius * settings.maxDotSize)
		const arcs = pie<AggMatrixPie['slices'][number]>()
			.sort(null)
			.value(slice => slice.count)(data.slices)
		const makePath = arc<any>().innerRadius(0).outerRadius(radius)
		return {
			radius,
			n: data.n,
			slices: arcs.map(a => ({
				key: a.data.key,
				count: a.data.count,
				...this.describeSlice(a.data, data.termType),
				path: makePath(a) || ''
			}))
		}
	}

	getPieTipData(data: AggMatrixPie, sampleType?: ValidAggMatrixResponse['sampleType']) {
		const entries: AggMatrixDotPosition['tipData'] = [
			{ label: capitalizeFirstLetter(sampleType?.plural_name || 'samples'), value: data.n }
		]
		for (const slice of data.slices) {
			entries.push({ label: this.describeSlice(slice, data.termType).label, value: slice.count })
		}
		return entries
	}

	/** One entry for every slice that is in a pie, in order of first appearance */
	getPieLegend(data: AggMatrixDot[][]): AggMatrixViewData['pieLegend'] {
		const entries = new Map<string, PieLegendEntry>()
		let termType: string | undefined
		for (const row of data) {
			for (const dot of row) {
				if (!dot.pie) continue
				termType ??= dot.pie.termType
				for (const slice of dot.pie.slices) {
					if (!entries.has(slice.key)) {
						entries.set(slice.key, { key: slice.key, ...this.describeSlice(slice, dot.pie.termType) })
					}
				}
			}
		}
		return { title: termType == GENE_VARIANT ? 'Variant class' : 'Category', entries: [...entries.values()] }
	}
}
