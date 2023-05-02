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

                console.log("label", label.line.points)

                g.append('path')
                    .attr('class', 'chord-tick')
                    .datum(label.line.points)
                    .style('stroke', label.d.fill)
                    .attr('d', line<{ x: number, y: number }>()
                        .x(point => point.x)
                        .y(point => point.y))

            })

        const collisions = viewModel.rings.labelsRing.collisions


        labelsGroup.select('.chord-text').each((label: Label, i: number, nodes: HTMLDivElement[]) => {
            const g = select(nodes[i])
            if (collisions.some(l => l.label === label.label)) {
                const g = select(nodes[i])

                g.datum(label)
                    .transition()
                    .duration(1000)
                    .attr('transform', function (d) {
                        return (
                            'rotate(' +
                            ((d.angle * 180) / Math.PI - 90) +
                            ')' +
                            'translate(' +
                            d.labelRadius +
                            ')' +
                            (d.angle > Math.PI ? 'rotate(180)' : '')
                        )
                    })
                    .style('text-anchor', function (d) {
                        return d.angle > Math.PI ? 'end' : ''
                    })

                g.selectAll('.chord-tick')
                    //.datum(d.lineData)
                    .datum(label.line.points)
                    .transition()
                    .duration(1000)
                    .attr(
                        'd',
                        line<{ x: number, y: number }>()
                            .x(point => point.x)
                            .y(point => point.y)
                    )
                    .style('fill', 'none')
            }
        })
    }
}