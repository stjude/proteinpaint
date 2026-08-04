import type { AggregateMatrix } from '../AggregateMatrix.ts'
import { getMaxLabelWidth} from '#dom'
import { scaleLinear } from 'd3-scale'
import type { AggMatrixDot, AxisLayoutColumns, AxisLayoutRows, ValidAggMatrixResponse } from '#types'
import type { AggregateMatrixSettings } from '../settings/Settings.ts'
import { roundValueAuto } from '#shared/roundValue.js'

export class AggMatrixViewModel {
    ag: AggregateMatrix
    viewData!: any
    maxRowLabelLgth!: number
    maxColLabelLgth!: number
    totalRowHght!: number
    totalColWdth!: number

    readonly topPad = 20
    readonly hoziPad = 20
    readonly bottomPad = 20
    readonly offset = 10

    constructor(ag: AggregateMatrix){
        this.ag = ag
    }

    processData(data: ValidAggMatrixResponse) {
        this.viewData = {}

        const settings = this.ag.state.config.settings.aggregateMatrix
        const cellSize = settings.maxDotSize + 40 //20px padding on either top/bottom or left/right of the dot

        const rowData = data.axesLayout.rows
        this.maxRowLabelLgth = getMaxLabelWidth(this.ag.dom.mainDiv.append('svg'), [rowData.longestLabel])
        this.totalRowHght = cellSize * rowData.rowCount

        const colData = data.axesLayout.columns
        this.maxColLabelLgth = getMaxLabelWidth(this.ag.dom.mainDiv.append('svg'), [colData.longestLabel])
        this.totalColWdth = cellSize * colData.colCount

        this.getPlotDimensions()
        this.getAxisLabelPositions(rowData, colData, cellSize)
        this.setColorScale(settings, data.colorScale)
        this.getDotPositions(data.data, cellSize, settings)
    }

    getPlotDimensions() {
        const plotDim = {
            svg: {
                width: this.hoziPad + this.maxRowLabelLgth + this.totalColWdth + this.hoziPad,
                height: this.topPad + this.totalRowHght + + this.maxColLabelLgth + this.bottomPad 
            },
            // title: {
            //     x: this.hoziPad + this.maxRowLabelLgth + this.totalColWdth / 2,
            //     y: this.topPad
            // },
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

    getAxisLabelPositions(rowData: AxisLayoutRows, colData: AxisLayoutColumns, cellSize: number){
        let lastRowY = 0
        let lastColX = this.hoziPad + this.maxRowLabelLgth
        for (const section of rowData.sections){
            for (const term of section.terms) {
                const row = {
                    x: this.hoziPad + this.maxRowLabelLgth / 2,
                    y: lastRowY + (cellSize / 2),
                    label: term.label || term.id
                }
                if (!this.viewData.rowLabels) this.viewData.rowLabels = []
                this.viewData.rowLabels.push(row)
                lastRowY += cellSize
            }
        }
        for (const section of colData.sections){
            for (const term of section.terms) {
                const col = {
                    x: lastColX + (cellSize / 2),
                    y: this.topPad + this.totalRowHght + (this.bottomPad / 2),
                    label: term.label || term.id
                }
                if (!this.viewData.colLabels) this.viewData.colLabels = []
                this.viewData.colLabels.push(col)
                lastColX += cellSize
            }        
        }
    }

    setColorScale(settings: AggregateMatrixSettings, colorScaleData) {
        const scale = scaleLinear()
            .domain([colorScaleData.min, colorScaleData.max])
            .range([(settings.startColor as any), (settings.stopColor as any)])
        this.viewData.colorScale = scale
    }

    getDotPositions(data: AggMatrixDot[][], cellSize: number, settings: AggregateMatrixSettings) {
        const startX = this.hoziPad + this.maxRowLabelLgth
        const startY = this.topPad

        let lastY = startY
        let lastX = startX

        for (const [i, row] of data.entries()) {
            for (const dot of row) {
              const dotPos = {
                x: lastX + (cellSize / 2),
                y: lastY + (cellSize / 2),
                size: dot.dotSize,
                color: this.viewData.colorScale(dot.colorValue),
                tipData: [
                    {
                        label: 'Row',
                        value: dot.row
                    },
                    {
                        label: 'Column',
                        value: dot.column
                    },
                    {
                        //Color value
                        label: capitalizeFirstLetter(settings.gradientMethod),
                        value: roundValueAuto(dot.colorValue)
                    },
                    { 
                        //Size value
                        label: capitalizeFirstLetter(settings.sizeMethod),
                        value: roundValueAuto(dot.sizeValue)
                    },
                ]
              }
              if (!this.viewData.dotPositions) this.viewData.dotPositions = []
              this.viewData.dotPositions.push(dotPos)
              lastX += cellSize
            }
            lastX = startX
            lastY = startY + (i + 1) * cellSize
          }
    }
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}