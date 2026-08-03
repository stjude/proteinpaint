import type { AggregateMatrix } from '../AggregateMatrix.ts'

export class AggMatrixView {
    ag: AggregateMatrix
    dom!: any

    constructor(ag: AggregateMatrix) {
        this.ag = ag
    }

    render(viewData: any) {
        this.initDom(viewData.plotDim)
        this.renderAxesLabels(viewData.colLabels, viewData.rowLabels)
        this.renderDots(viewData.dotPositions)
    }

    initDom(plotDim: any) {
        const mainDiv = this.ag.dom.mainDiv
        mainDiv.selectAll('*').remove()

        const svg = mainDiv.append('svg')
            .attr('width', plotDim.svg.width)
            .attr('height', plotDim.svg.height)
            .attr('data-testid', 'sjpp-ag-matrix-svg')

        // const title = svg.append('text')
        //     .attr('class', 'sjpp-ag-matrix-title')
        //     .attr('text-anchor', 'middle')
        //     .attr('transform', `translate(${plotDim.title.x}, ${plotDim.title.y})`)
        //     .text('Aggregate Matrix TODO: CHANGE ME')
        
        const rowLabels = svg.append('g')
            .attr('class', 'sjpp-ag-matrix-row-labels')
            .attr('transform', `translate(${plotDim.rowLabels.x}, ${plotDim.rowLabels.y}) `)

        const colLabels = svg.append('g')
            .attr('class', 'sjpp-ag-matrix-col-labels')
            .attr('transform', `translate(${plotDim.colLabels.x}, ${plotDim.colLabels.y})`)
  
        this.dom = {
            svg,
            // title, 
            rowLabels, 
            colLabels
        }
    }

    renderAxesLabels(colLabels: any, rowLabels: any) {
        const { rowLabels: rowLabelsGroup, colLabels: colLabelsGroup } = this.dom

        rowLabelsGroup.selectAll('text')
            .data(rowLabels)
            .enter()
            .append('text')
            .attr('class', 'sjpp-ag-matrix-row-label')
            .attr('text-anchor', 'end')
            .attr('transform', (d) => `translate(0, ${d.y})`)
            .text(d => d.label)

        colLabelsGroup.selectAll('text')
            .data(colLabels)
            .enter()
            .append('text')
            .attr('class', 'sjpp-ag-matrix-col-label')
            .attr('text-anchor', 'end')
            .attr('transform', (d) => `translate(${d.x}, 0) rotate(-90)`)
            .text(d => d.label)
    }

    renderDots(dotPositions: any) {
        for (const dot of dotPositions) {
            this.dom.svg.append('circle')
                .attr('class', 'sjpp-ag-matrix-dot')
                .attr('data-testid', `sjpp-ag-matrix-dot-${dot.row}-${dot.column}`)
                .attr('cx', dot.x)
                .attr('cy', dot.y)
                .attr('r', dot.size)
                .attr('fill', dot.color)
        }
    }
}