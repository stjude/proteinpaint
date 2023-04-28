import ViewModel from "#plots/disco_new/viewmodel/ViewModel";
import * as d3 from "d3";
import IRenderer from "#plots/disco_new/renderer/IRenderer";

export default class ArcRenderer implements IRenderer{

    render(holder: any, viewModel: ViewModel) {
        const ring = viewModel.rings.chromosomesRing

        const data = ring.elements

        const pie = d3.pie<number>()
            .padAngle(0.002)
            .value(d => d.size)
            .sort(null);

        const arcData = pie(data);

        const arc = d3.arc<d3.PieArcDatum<number>>()
            .innerRadius(ring.innerRadius)
            .outerRadius(ring.outerRadius);

        const arcs = holder.append("g")

        arcs.selectAll("path")
            .data(arcData)
            .enter()
            .append("path")
            .attr("d", arc)
            .attr("fill", "black")

        arcs.selectAll("text")
            .data(arcData)
            .enter()
            .append("text")
            .each(function (d) {
                d.angle = (d.startAngle + d.endAngle) / 2
                d.ccAngle = d.angle - Math.PI / 2
            })
            .attr("transform", (d) => `translate(${arc.centroid(<any>d)}) rotate(${(d.angle * 180) / Math.PI - 90})${d.angle > Math.PI ? 'rotate(180)' : ''}`)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(d => d.data.key)
            .style("fill", "white")
    }
}