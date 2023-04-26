import IRenderer from "#plots/disco_new/renderer/IRenderer";
import ViewModel from "#plots/disco_new/viewmodel/ViewModel";
import { select } from 'd3-selection'
import Label from "#plots/disco_new/viewmodel/Label";

export default class LabelsRenderer implements IRenderer {
    render(holder: any, viewModel: ViewModel) {
        const labelsG = holder.append("g")

        const labels = viewModel.rings[0].labels;

        console.log("labels", labels)
        const labelsGroup = labelsG
            .selectAll('.group')
            .data(labels)
            .enter()
            .append('g')
            .attr('class', 'group')
            .each((d: Label, i: number, nodes: HTMLDivElement[]) => {
                select(nodes[i]).append("text").attr('class', 'chord-text')
                    .each(d=> {
                        d.angle = (d.startAngle + d.endAngle) / 2
                    })
                    .attr('dy', '.35em')
                    .attr('transform', function (d) {
                        return (
                            'rotate(' +
                            ((d.angle * 180) / Math.PI - 90) +
                            ')' +
                            'translate(' +
                            240 +
                            ')' +
                            (d.angle > Math.PI ? 'rotate(180)' : '')
                        )
                    }).style('text-anchor', 'middle')
                    .style('font-size', "12px")
                    .style('fill', d.labelFill)
                    .style('cursor', 'pointer')
                    .text(d.label)
            })
    }
}