import * as d3 from "d3";
import SnvArc from "../viewmodel/SnvArc";
import {Menu} from "#dom/menu";
import IRenderer from "./IRenderer";
import FullArcRenderer from "./FullArcRenderer";
import Arc from "../viewmodel/Arc";


export default class SnvRenderer implements IRenderer{

    private svnInnerRadius: number;
    private svnWidth: number;
    private fullArcRenderer: FullArcRenderer;
    constructor(svnInnerRadius: number, svnWidth: number) {
        this.svnInnerRadius = svnInnerRadius
        this.svnWidth = svnWidth
        this.fullArcRenderer = new FullArcRenderer(this.svnInnerRadius, this.svnWidth, "#6464641A")
    }
    render(holder: any, elements: Array<SnvArc>, collisions?: Array<Arc>) {
        this.fullArcRenderer.render(holder)

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