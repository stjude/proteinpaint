import type { AggregateMatrix } from '../AggregateMatrix.ts'
import { getMaxLabelWidth, capitalizeFirstLetter } from '#dom'
import { scaleLinear } from 'd3-scale'
import type { AggMatrixDot, AxisLayoutColumns, AxisLayoutRows, ValidAggMatrixResponse } from '#types'
import type { AggregateMatrixSettings } from '../settings/Settings.ts'
import { roundValueAuto } from '#shared/roundValue.js'
import type { AggMatrixViewData, AggMatrixDotPosition } from './ViewModelDataTypes.ts'

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

    readonly topPad = 20
    readonly hoziPad = 20
    readonly bottomPad = 20
    readonly offset = 10
    readonly sectionGap = 8
    readonly colSectionGap = 4
    readonly minColSectionLineInset = 2
    readonly colSectionLabelLineGap = 3
    readonly labelFontPx = 12

    constructor(ag: AggregateMatrix) {
        this.ag = ag
    }

    processData(data: ValidAggMatrixResponse) {
        this.viewData = this.getDefaultViewData()

        const settings = this.ag.state.config.settings.aggregateMatrix
        const cellSize = settings.maxDotSize + 40 //20px padding on either top/bottom or left/right of the dot
        const measureSvg = this.ag.dom.mainDiv.append('svg')

        const rowData = data.axesLayout.rows
        this.rowTermLabelLgth = getMaxLabelWidth(measureSvg, [rowData.longestLabel])
        const rowSectionLayout = this.getSectionLabelLayout(rowData.sections, cellSize, measureSvg, true)
        this.rowSectionRotateFlags = rowSectionLayout.rotateFlags
        this.maxRowSectionLabelWdth = rowSectionLayout.maxCrossAxisSpace
        this.maxRowLabelLgth =
            this.rowTermLabelLgth +
            (this.maxRowSectionLabelWdth ? this.sectionGap + this.maxRowSectionLabelWdth : 0)
        this.totalRowHght = cellSize * rowData.rowCount

        const colData = data.axesLayout.columns
        this.colTermLabelLgth = getMaxLabelWidth(measureSvg, [colData.longestLabel])
        const colSectionLayout = this.getSectionLabelLayout(colData.sections, cellSize, measureSvg, false)
        this.colSectionRotateFlags = colSectionLayout.rotateFlags
        this.maxColSectionLabelHght = colSectionLayout.maxCrossAxisSpace
        this.maxColLabelLgth =
            this.colTermLabelLgth +
            (this.maxColSectionLabelHght ? this.colSectionGap + this.maxColSectionLabelHght : 0)
        this.totalColWdth = cellSize * colData.colCount
        measureSvg.remove()

        this.getPlotDimensions()
        this.getAxisLabelPositions(rowData, colData, cellSize)
        this.setColorScale(settings, data.colorScale)
        this.getDotPositions(data.data, cellSize, settings)
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
                y: this.topPad + this.offset
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
            rowSectionGuides: [],
            colSectionGuides: [],
            rowSectionLines: [],
            colSectionLines: [],
            dotPositions: [],
            colorScale: {
                scale: () => '',
                absMin: 0,
                absMax: 0
            }
        }
    }

    getAxisLabelPositions(rowData: AxisLayoutRows, colData: AxisLayoutColumns, cellSize: number) {
        const rowSectionLineX = -(this.rowTermLabelLgth + this.sectionGap / 2)
        const rowSectionLabelGap = this.sectionGap / 2
        // Rotated term labels use x-axis text width as vertical depth.
        // Keeping y at 0 makes terms occupy the first label band directly under the plot.
        const colTermY = 0
        const colSectionBandStart =
            this.colTermLabelLgth +
            (this.maxColSectionLabelHght ? this.colSectionGap : 0)
        const colSectionLineY = Math.max(0, colSectionBandStart - this.colSectionLabelLineGap)
        const colSectionLineInset = Math.max(this.minColSectionLineInset, cellSize * 0.06)

        this.lastY = 0
        this.lastX = this.hoziPad + this.maxRowLabelLgth

        this.viewData.rowLabels = []
        this.viewData.colLabels = []
        this.viewData.rowSectionLabels = []
        this.viewData.colSectionLabels = []
        this.viewData.rowSectionGuides = []
        this.viewData.colSectionGuides = []
        this.viewData.rowSectionLines = []
        this.viewData.colSectionLines = []

        for (const [rowSectionIndex, section] of rowData.sections.entries()) {
            const sectionStartY = this.lastY
            for (const term of section.terms) {
                const row = {
                    x: 0,
                    y: this.lastY + (cellSize / 2),
                    label: term.label || term.id
                }
                this.viewData.rowLabels.push(row)
                this.lastY += cellSize
            }

            const sectionCenterY = sectionStartY + (section.terms.length * cellSize) / 2
            const sectionEndY = sectionStartY + section.terms.length * cellSize
            this.viewData.rowSectionLabels.push({
                x: rowSectionLineX - rowSectionLabelGap,
                y: sectionCenterY,
                label: section.id,
                rotate: this.rowSectionRotateFlags[rowSectionIndex]
            })
            this.viewData.rowSectionLines.push({
                x: rowSectionLineX,
                y1: sectionStartY + cellSize / 2,
                y2: sectionEndY - cellSize / 2
            })
            if (rowSectionIndex < rowData.sections.length - 1) {
                this.viewData.rowSectionGuides.push({ y: this.lastY })
            }
        }

        for (const [colSectionIndex, section] of colData.sections.entries()) {
            const sectionStartX = this.lastX
            for (const term of section.terms) {
                const col = {
                    x: this.lastX + (cellSize / 2),
                    y: colTermY,
                    label: term.label || term.id
                }
                this.viewData.colLabels.push(col)
                this.lastX += cellSize
            }

            const sectionCenterX = sectionStartX + (section.terms.length * cellSize) / 2
            const rotate = this.colSectionRotateFlags[colSectionIndex]
            this.viewData.colSectionLabels.push({
                x: sectionCenterX,
                y: colSectionBandStart + (rotate ? 0 : 5),
                label: section.id,
                rotate
            })
            this.viewData.colSectionLines.push({
                y: colSectionLineY,
                x1: sectionStartX + colSectionLineInset,
                x2: this.lastX - colSectionLineInset
            })
            if (colSectionIndex < colData.sections.length - 1) {
                this.viewData.colSectionGuides.push({ x: this.lastX })
            }
        }
    }

    setColorScale(settings: AggregateMatrixSettings, colorScaleData: ValidAggMatrixResponse['colorScale']) {
        const scale = scaleLinear()
            .domain([colorScaleData.min, colorScaleData.max])
            .range([(settings.startColor as any), (settings.stopColor as any)])
        this.viewData.colorScale = {
            scale, 
            absMin: colorScaleData.min,
            absMax: colorScaleData.max
        }
    }

    getDotPositions(data: AggMatrixDot[][], cellSize: number, settings: AggregateMatrixSettings) {
        const startX = this.hoziPad + this.maxRowLabelLgth
        const startY = this.topPad

        this.lastY = startY
        this.lastX = startX

        for (const [i, row] of data.entries()) {
            for (const dot of row) {
                const dotPos = {
                    x: this.lastX + (cellSize / 2),
                    y: this.lastY + (cellSize / 2),
                    size: dot.dotSize,
                    color: this.viewData.colorScale.scale(dot.colorValue),
                    row: dot.row,
                    rowSection: dot.rowSection,
                    column: dot.column,
                    colSection: dot.colSection,
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
                            value: roundValueAuto(dot.colorValue)
                        },
                        {
                            // Show the size value
                            label: capitalizeFirstLetter(settings.sizeMethod),
                            value: roundValueAuto(dot.sizeValue)
                        }
                    ]
                } satisfies AggMatrixDotPosition
                this.viewData.dotPositions.push(dotPos)
                this.lastX += cellSize
            }
            this.lastX = startX
            this.lastY = startY + (i + 1) * cellSize
        }
    }
}