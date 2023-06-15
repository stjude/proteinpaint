import * as d3 from "d3";
import SnvArc from "#plots/disco_new/viewmodel/SnvArc";
import IRenderer from "./IRenderer";
import FullArcRenderer from "./FullArcRenderer";
import Arc from "#plots/disco_new/viewmodel/Arc";
import MenuProvider from "./MenuProvider";


export default class SnvRenderer implements IRenderer {

    private svnInnerRadius: number;
    private svnWidth: number;
    private fullArcRenderer: FullArcRenderer;

    constructor(svnInnerRadius: number, svnWidth: number) {
        this.svnInnerRadius = svnInnerRadius
        this.svnWidth = svnWidth
        this.fullArcRenderer = new FullArcRenderer(this.svnInnerRadius, this.svnWidth, "#6464641A")
    }

    render(holder: any, elements: Array<SnvArc>, collisions?: Array<Arc>) {
        if (elements.length) {
            this.fullArcRenderer.render(holder)
        }

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