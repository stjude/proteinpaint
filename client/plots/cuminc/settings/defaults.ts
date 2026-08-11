export const defaultSettings = JSON.stringify({
    controls: {
        term2: null, // the previous overlay value may be displayed as a convenience for toggling
        term0: null
    },
    cuminc: {
        minSampleSize: 10, // sent to server-side
        minAtRisk: 10,
        atRiskVisible: true,
        atRiskLabelOffset: -10,
        seriesTipDecimals: 0,
        ciVisible: true,
        radius: 5,
        fill: '#fff',
        stroke: '#000',
        fillOpacity: 0,
        chartMargin: 10,
        svgw: 400,
        svgh: 300,
        svgPadding: {
            top: 20,
            left: 55,
            right: 20,
            bottom: 50
        },
        axisTitleFontSize: 16,
        xAxisOffset: 5,
        yAxisOffset: -5,
        defaultColor: '#2077b4'
    }
})