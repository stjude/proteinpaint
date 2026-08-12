const orientation = ['horizontal' , 'vertical']

export type ViolinSettings = {
    orientation: typeof orientation[number]
    rowlabelw: number
    brushRange: { start: number; end: number } | null //object with start and end if there is a brush selection
    svgw: number // span length of a plot/svg, not including margin
    datasymbol: string
    radius: number
    axisHeight: number
    rightMargin: number
    lines: any[]
    isLogScale: boolean // false: linear scale, true: log scale
    rowSpace: number
    medianLength: number
    medianColor: string
    medianThickness: number
    ticks: number
    defaultColor: string
    method: number
    orderByMedian: boolean
    showStats: boolean
    showAssociationTests: boolean
}