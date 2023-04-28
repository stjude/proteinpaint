import IRenderer from "#plots/disco_new/renderer/IRenderer";
import ViewModel from "#plots/disco_new/viewmodel/ViewModel";
import {select} from 'd3-selection'
import {line} from 'd3-shape'
import Label from "#plots/disco_new/viewmodel/Label";

export default class LabelsRenderer implements IRenderer {
    render(holder: any, viewModel: ViewModel) {
        const labelsG = holder.append("g")

        const labels = viewModel.rings.labelsRing.elements

        const labelsGroup = labelsG
            .selectAll('.group')
            .data(labels)
            .enter()
            .append('g')
            .attr('class', 'group')
            .each((label: Label, i: number, nodes: HTMLDivElement[]) => {
                const g = select(nodes[i])
                g.append("text")
                    .attr('class', 'chord-text')
                    .attr('dy', '.35em')
                    .attr('transform', label.transform)
                    .style('text-anchor', label.textAnchor)
                    .style('font-size', "12px")
                    .style('fill', label.d.fill)
                    .style('cursor', 'pointer')
                    .text(label.label)

                g.append('path')
                    .attr('class', 'chord-tick')
                    .datum(label.line.points)
                    .style('stroke', label.d.fill)
                    .attr('d', line<{ x: number, y: number }>()
                        .x(point => point.x)
                        .y(point => point.y))

            })
    }
}