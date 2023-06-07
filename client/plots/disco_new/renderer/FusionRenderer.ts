import * as d3 from 'd3';
import FullArcRenderer from "./FullArcRenderer";
import {Menu} from "#dom/menu";
import Fusion from "../viewmodel/Fusion";
import {getColors} from "../../../shared/common";

export default class FusionRenderer {
    private fullArcRenderer: FullArcRenderer;

    constructor() {
        this.fullArcRenderer = new FullArcRenderer(80, 2, "#6464641A")
    }

    render(holder: any, fusions: Array<Fusion>) {
        this.fullArcRenderer.render(holder)
        // Use of d3.ribbon() function
        const ribboon = d3.ribbon().radius(80);
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        const ribbons = holder.selectAll('.chord').data(fusions)

        // TODO add 5 to defaults
        const menu = new Menu({padding: 5})
        menu.d.style('border', '1px solid #FFF')
            .style('position', 'absolute')
            .style('z-index', 1001)

        ribbons
            .enter()
            .append('path')
            .attr('class', 'chord')
            .attr('d', ribboon)
            .attr('fill', (fusion: Fusion) => {
                return this.getColor(fusion)
            })
            .on('mouseover', (mouseEvent: MouseEvent, fusion: Fusion) => {
                menu.d.style("color", "#000").html(`${fusion.source.gene}<br />${fusion.target.gene}`)
                menu.showunder(mouseEvent.target)
            })
            .on('mouseout', (d) => {
                menu.hide()
            })
    }

    getColor(fusion: Fusion) {
        const c = fusion.source.chromosomes;
        return c.size < 2 ? "#1B9E77" : "#6A3D9A";
    }

}