export type CumincConfigSettings = {
    controls: {
        term2: string | null
        term0: string | null
    }
    cuminc: CumincSettings
}

export type CumincSettings = {
    minSampleSize: number
    minAtRisk: number
    atRiskVisible: boolean
    atRiskLabelOffset: number
    seriesTipDecimals: number
    ciVisible: boolean
    radius: number
    fill: string
    stroke: string
    fillOpacity: number
    chartMargin: number
    svgw: number
    svgh: number
    svgPadding: {
        top: number
        left: number
        right: number
        bottom: number
    }
    axisTitleFontSize: number
    xAxisOffset: number
    yAxisOffset: number
    defaultColor: string
    xTitleLabel?: string
}