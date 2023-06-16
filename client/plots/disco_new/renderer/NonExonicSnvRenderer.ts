import IRenderer from "./IRenderer";
import * as d3 from "d3";
import SnvArc from "#plots/disco_new/viewmodel/SnvArc";
import Arc from "#plots/disco_new/viewmodel/Arc";
import MenuProvider from "./MenuProvider";

export default class NonExonicSnvRenderer implements IRenderer {
    render(holder: any,  elements: Array<Arc>, collisions?: Array<Arc>) {
        const arcGenerator = d3.arc<SnvArc>();

        const arcs = holder.append("g")

        const menu = MenuProvider.create()

        arcs.selectAll("path")
            .data(elements)
            .enter()
            .append("path")
            .attr('d', (d: SnvArc) => arcGenerator(d))
            .attr("fill", (d: SnvArc) => d.color)
            .on('mouseover', (mouseEvent: MouseEvent, arc: SnvArc) => {
                menu.d.style("color", arc.color).html(`${arc.text} <br />${arc.mname} <br /> ${arc.dataClass} <br /> ${arc.chr}:${arc.pos}`)
                menu.showunder(mouseEvent.target)
            })
            .on('mouseout', (d) => {
                menu.hide()
            })
    }
}