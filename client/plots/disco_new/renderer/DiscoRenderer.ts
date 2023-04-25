import IRenderer from "#plots/disco_new/viewmodel/IRenderer";
import * as d3 from "d3";
import ViewModel from "#plots/disco_new/viewmodel/ViewModel";

export class DiscoRenderer implements IRenderer {
    render(holder: any, viewModel: ViewModel) {
        const svg = holder.append('svg')
            .attr('width', viewModel.width)
            .attr('height', viewModel.height)

        const mainG = svg.append('g')
            .attr('class', "mainG")
            .attr('transform', `translate(${viewModel.width / 2},${viewModel.height / 2})`);

        const ring = viewModel.rings[0]

        const data = ring.elements

        const pie = d3.pie<number>()
            .padAngle(0.002)
            .value(d => d.size)
            .sort(null);

        const arcData = pie(data);

        const arc = d3.arc<d3.PieArcDatum<number>>()
            .innerRadius(ring.innerRadius)
            .outerRadius(ring.outerRadius);

        const arcs = mainG.append("g")

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


        const labels = mainG.append("g")

        // labels.append("text").attr("x", 0)
        //     .attr("y", 0)
        //     .attr("fill", "#000000")
        //     .attr("font-size", "16")
        //     .attr("text-anchor", "middle")
        //     .text("Hello, world!")
    }
}

// TODO remove to other file
function degrees_to_radians(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
}