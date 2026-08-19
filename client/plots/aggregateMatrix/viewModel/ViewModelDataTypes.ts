type AxisTermLabel = {
    x: number
    y: number
    label: string
}

type AxisSectionLabel = AxisTermLabel & {
    rotate: boolean
}

type RowSectionLine = {
    x: number
    y1: number
    y2: number
}

type ColSectionLine = {
    y: number
    x1: number
    x2: number
}

type DotTipEntry = {
    label: string
    value: string | number
}

export type AggMatrixDotPosition = {
    x: number
    y: number
    size: number
    color: string | number
    row: string
    rowSection: string
    column: string
    colSection: string
    tipData: DotTipEntry[]
    /** Flag to indicate whether data is available for both 
     * gradient and size. If false, tooltip is disabled. */
    hasData: boolean
}

type PlotDimensions = {
    svg: {
        width: number
        height: number
    }
    rowLabels: {
        x: number
        y: number
    }
    colLabels: {
        x: number
        y: number
    }
}

export type AggMatrixViewData = {
    plotDim: PlotDimensions
    rowLabels: AxisTermLabel[]
    colLabels: AxisTermLabel[]
    rowSectionLabels: AxisSectionLabel[]
    colSectionLabels: AxisSectionLabel[]
    rowSectionLines: RowSectionLine[]
    colSectionLines: ColSectionLine[]
    dotPositions: AggMatrixDotPosition[]
    colorScale: {
        scale: (value: number) => string | number
        absMin: number
        absMax: number
    }
}