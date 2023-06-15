import * as d3 from 'd3';
import FullArcRenderer from "./FullArcRenderer";
import Fusion from "#plots/disco_new/viewmodel/Fusion";
import MenuProvider from "./MenuProvider";
import {FusionLegend} from "#plots/disco_new/viewmodel/FusionLegend";

// TODO extract constants from this file.
export default class FusionRenderer {
    private fullArcRenderer: FullArcRenderer;

    constructor() {
        this.fullArcRenderer = new FullArcRenderer(80, 2, "#6464641A")
    }

    render(holder: any, fusions: Array<Fusion>) {
        if (fusions.length) {
            this.fullArcRenderer.render(holder)
        }

        const ribboon = d3.ribbon().radius(80);

        const ribbons = holder.selectAll('.chord').data(fusions)

        const menu = MenuProvider.create()

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
        return c.size < 2 ? FusionLegend.Intrachromosomal.valueOf() : FusionLegend.Interchromosomal.valueOf();
    }
}