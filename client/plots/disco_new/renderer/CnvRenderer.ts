import * as d3 from "d3";
import {Menu} from "#dom/menu";
import IRenderer from "./IRenderer";
import CnvArc from "../viewmodel/CnvArc";
export default class CnvRenderer implements IRenderer {
    constructor() {
    }

    render(holder: any, elements: Array<CnvArc>, collisions?: Array<CnvArc>) {
        const arcGenerator = d3.arc<CnvArc>();

        const arcs = holder.append("g")

        // TODO add 5 to defaults
        const menu = new Menu({padding: 5})
        menu.d.style('border', '1px solid #FFF')
            .style('position', 'absolute')
            .style('z-index', 1001)

        arcs.selectAll("path")
            .data(elements)
            .enter()
            .append("path")
            .attr('d', (d: CnvArc) => arcGenerator(d))
            .attr("fill", (d: CnvArc) => d.cssClass)
            .on('mouseover', (mouseEvent: MouseEvent, arc: CnvArc) => {
                menu.d.style("color", arc.cssClass).html(`Copy Number Variation <br /> ${arc.chr}:${arc.start}-${arc.stop} <br /> log2 ratio: ${arc.value}  `)
                menu.showunder(mouseEvent.target)
            })
            .on('mouseout', (d) => {
                menu.hide()
            })
    }
}