import IRenderer from "./IRenderer";
import {select} from 'd3-selection'
import {line} from 'd3-shape'
import Label from "../viewmodel/Label";

export default class LabelsRenderer implements IRenderer {
    constructor() {
    }
    render(holder: any, elements: Array<Label>, collisions?: Array<Label>) {
        const labelsG = holder.append("g")

        const lineFunction = line<{ x: number, y: number }>()
            .x(point => point.x)
            .y(point => point.y)

        const labelsGroup = labelsG
            .selectAll('.group')
            .data(elements)
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
                    .style('fill', label.cssClass)
                    .style('cursor', 'pointer')
                    .text(label.label)

                g.append('path')
                    .attr('class', 'chord-tick')
                    .datum(label.line.points)
                    .style('stroke', label.cssClass)
                    .style('fill', 'none')
                    .attr('d', lineFunction)
            })

        labelsG.selectAll('.group').each((label: Label, i: number, nodes: HTMLDivElement[]) => {
            const collision = collisions ? collisions.find(l => l.label === label.label) : undefined
            if (collision) {
                const g = select(nodes[i])
                // TODO put animation duration into consts
                g.selectAll(".chord-text").datum(collision)
                    .transition()
                    .duration(1000)
                    .attr('transform', collision.transform)
                    .style('text-anchor', collision.textAnchor)

                g.selectAll('.chord-tick')
                    .datum(collision.line.points)
                    .transition()
                    .duration(1000)
                    .style('fill', 'none')
                    .attr('d', lineFunction)
            }
        })
    }
}