import * as d3 from "d3";
import LohArc from "../viewmodel/LohArc";
import IRenderer from "./IRenderer";
import Arc from "../viewmodel/Arc";
import MenuProvider from "./MenuProvider";

export default class LohRenderer implements IRenderer {
    constructor() {
    }
    render(holder: any, elements: Array<LohArc>, collisions?: Array<Arc>) {
        const arcGenerator = d3.arc<LohArc>();

        const arcs = holder.append("g")

        const menu = MenuProvider.create()

        arcs.selectAll("path")
            .data(elements)
            .enter()
            .append("path")
            .attr('d', (d: LohArc) => arcGenerator(d))
            .attr("fill", (d: LohArc) => d.color)
            .on('mouseover', (mouseEvent: MouseEvent, arc: LohArc) => {
                menu.d.style("color", arc.color).html(`Loss of Heterozygosity  <br /> ${arc.chr}:${arc.start}-${arc.stop} <br /> segmean ${arc.value}`)
                menu.showunder(mouseEvent.target)
            })
            .on('mouseout', () => {
                menu.hide()
            })
    }
}