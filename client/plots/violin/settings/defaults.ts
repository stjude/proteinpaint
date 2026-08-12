import { plotColor } from '#shared/common.js'
import type { ViolinSettings } from './Settings'

export function getDefaultViolinSettings(app, overrides = {}): ViolinSettings {
    const defaults = {
        orientation: 'horizontal',
        rowlabelw: 250,
        brushRange: null, //object with start and end if there is a brush selection
        svgw: 500, // span length of a plot/svg, not including margin
        datasymbol: 'rug',
        radius: 10,
        axisHeight: 60,
        rightMargin: 50,
        lines: [],
        isLogScale: false, // false: linear scale, true: log scale
        rowSpace: 10,
        medianLength: 7,
        medianColor: '#FF0000',
        medianThickness: 3,
        ticks: 15,
        defaultColor: plotColor,
        method: 0,
        orderByMedian: false,
        showStats: true,
        showAssociationTests: true
    }
    return Object.assign(defaults, overrides)
}