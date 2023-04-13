import IRenderer from "./IRenderer";
import * as d3 from "d3";
import ViewModel from "./viewmodel/ViewModel";

export class DiscoRenderer implements IRenderer {
    render(holder: any, viewModel: ViewModel) {
        const svg = holder.append('svg')
            .attr('width', viewModel.width)
            .attr('height', viewModel.height)
            .append('g')
            .attr('transform', `translate(${viewModel.width/2},${viewModel.height/2})`);

        const ring = viewModel.rings[0]

        const data = ring.elements

        const pie = d3.pie<number>()
            .padAngle(0.01)
            .value(d => d)
            .sort(null);

        const arcData = pie(data);


        const arc = d3.arc<d3.PieArcDatum<number>>()
            .innerRadius(ring.innerRadius)
            .outerRadius(ring.outerRadius);


        svg.selectAll("path")
            .data(arcData)
            .enter()
            .append("path")
            .attr("d", arc)
            .attr("fill", "#000");
    }
}

// TODO remove to other file
function degrees_to_radians(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
}