import Legend from "../viewmodel/Legend";
import svgLegend from "#dom/svg.legend"
import LegendJSONMapper from "../mapper/LegendJSONMapper";

export default class LegendRenderer {
    private legendJSONMapper: LegendJSONMapper;

    constructor(capped: number, onClickCallback: (d: any, t: any) => void) {
        this.legendJSONMapper = new LegendJSONMapper(capped, onClickCallback)
    }

    render(holder: any, legend: Legend) {
        const svgLegendRenderer = svgLegend({
            holder: holder.append('g'),
            rectFillFxn: d => d.color,
            iconStroke: '#aaa'
        })

        // TODO calculate legend dimensions

        const d =  {
            xOffset : -360
        }

        const data = this.legendJSONMapper.map(legend)

        svgLegendRenderer(data, {
            settings: Object.assign({},{
                svgw:1200,
                svgh: 300,
                dimensions: d,
                fontsize: 9,
            })
        })
    }
}