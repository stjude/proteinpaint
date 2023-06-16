import * as d3 from "d3";
import LohArc from "#plots/disco_new/viewmodel/LohArc";
import IRenderer from "./IRenderer";
import MenuProvider from "./MenuProvider";

export default class LohRenderer implements IRenderer {
    render(holder: any, elements: Array<LohArc>) {
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
                menu.d.style("color", arc.color).html(`Loss of Heterozygosity  <br /> ${arc.chr}:${arc.start}-${arc.stop}`)
                menu.showunder(mouseEvent.target)
            })
            .on('mouseout', () => {
                menu.hide()
            })
    }
}