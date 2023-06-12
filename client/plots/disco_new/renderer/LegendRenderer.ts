import Legend from "../viewmodel/Legend";

import svgLegend from "#dom/svg.legend"
import LegendJSONMapper from "../mapper/LegendJSONMapper";

export default class LegendRenderer {
    private legendJSONMapper: LegendJSONMapper;

    constructor() {
        this.legendJSONMapper = new LegendJSONMapper()
    }

    render(holder: any, legend: Legend) {
        const svgLegendRenderer = svgLegend({
            holder: holder.append('g'),
            rectFillFxn: (d: any) => {
                return d.color;
            },
            iconStroke: '#aaa'
        })

        // TODO calculate legend dimensions

        const d = {
            xOffset: -280
        }

        const data = this.legendJSONMapper.map(legend)

        svgLegendRenderer(data, {
            settings: Object.assign({}, {
                svgw: 1200,
                svgh: 300,
                dimensions: d,
                padleft: 20 //+ d.xOffset
            })
        })
    }
}