import IRenderer from "./IRenderer";
import * as d3 from "d3";
import {Menu} from "#dom/menu";
import SnvArc from "../viewmodel/SnvArc";
import Arc from "../viewmodel/Arc";

export default class NonExonicSnvRenderer implements IRenderer {
    constructor() {
    }
    render(holder: any,  elements: Array<Arc>, collisions?: Array<Arc>) {
        const arcGenerator = d3.arc<SnvArc>();

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
            .attr('d', (d: SnvArc) => arcGenerator(d))
            .attr("fill", (d: SnvArc) => d.cssClass)
            .on('mouseover', (mouseEvent: MouseEvent, arc: SnvArc) => {
                menu.d.style("color", arc.cssClass).html(`${arc.label} <br />${arc.mname} <br /> ${arc.dataClass} <br /> ${arc.chr}:${arc.pos}`)
                menu.showunder(mouseEvent.target)
            })
            .on('mouseout', (d) => {
                menu.hide()
            })
    }
}