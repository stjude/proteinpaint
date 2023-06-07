import * as d3 from "d3";
import {Menu} from "#dom/menu";
import LohArc from "../viewmodel/LohArc";
import IRenderer from "./IRenderer";
import Arc from "../viewmodel/Arc";

export default class LohRenderer implements IRenderer {
    constructor() {
    }
    render(holder: any, elements: Array<LohArc>, collisions?: Array<Arc>) {
        const arcGenerator = d3.arc<LohArc>();

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
            .attr('d', (d: LohArc) => arcGenerator(d))
            .attr("fill", (d: LohArc) => d.cssClass)
            .on('mouseover', (mouseEvent: MouseEvent, arc: LohArc) => {
                menu.d.style("color", arc.cssClass).html(`Loss of Heterozygosity  <br /> ${arc.chr}:${arc.start}-${arc.stop} <br /> segmean ${arc.value}  `)
                menu.showunder(mouseEvent.target)
            })
            .on('mouseout', (d) => {
                menu.hide()
            })
    }
}