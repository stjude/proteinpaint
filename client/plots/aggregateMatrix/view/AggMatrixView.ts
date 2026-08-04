import { Menu, table2col } from '#dom'
import type { AggregateMatrix } from '../AggregateMatrix.ts'
import type { AggMatrixDotPosition, AggMatrixViewData } from '../viewModel/ViewModelDataTypes.ts'
import { LegendRender } from './LegendRender.ts'
import { PSEUDOBULK } from '#types' 

export class AggMatrixView {
    ag: AggregateMatrix
    legendRender: LegendRender
    dom!: any


    constructor(ag: AggregateMatrix) {
        this.ag = ag
        this.legendRender = new LegendRender(ag)
    }

    render(viewData: AggMatrixViewData) {
        this.initDom(viewData.plotDim)
        this.renderAxesLabels(
            viewData.colLabels,
            viewData.rowLabels,
            viewData.colSectionLabels,
            viewData.rowSectionLabels,
            viewData.colSectionLines,
            viewData.rowSectionLines
        )
        this.renderDots(viewData.dotPositions)
        this.legendRender.render(viewData, this.dom.legendDiv)
    }

    initDom(plotDim: AggMatrixViewData['plotDim']) {
        const mainDiv = this.ag.dom.mainDiv
        mainDiv.selectAll('*').remove()

        const svg = mainDiv.append('svg')
            .attr('width', plotDim.svg.width)
            .attr('height', plotDim.svg.height)
            .attr('data-testid', 'sjpp-ag-matrix-svg')
        
        const rowLabels = svg.append('g')
            .attr('class', 'sjpp-ag-matrix-row-labels')
            .attr('transform', `translate(${plotDim.rowLabels.x}, ${plotDim.rowLabels.y}) `)

        const colLabels = svg.append('g')
            .attr('class', 'sjpp-ag-matrix-col-labels')
            .attr('transform', `translate(${plotDim.colLabels.x}, ${plotDim.colLabels.y})`)
        
        const legendDiv = mainDiv.append('div')
            .attr('class', 'sjpp-ag-matrix-legend')
            .attr('data-testid', 'sjpp-ag-matrix-legend')
            .style('vertical-align', 'top')
            .style('display', 'inline-block')
            .style('padding', `${this.ag.viewModel.topPad}px ${this.ag.viewModel.hoziPad}px`)

        this.dom = {
            svg,
            rowLabels,
            colLabels,
            legendDiv,
            tip: new Menu({ padding: '' })
        }
    }

    renderAxesLabels(
        colLabels: AggMatrixViewData['colLabels'],
        rowLabels: AggMatrixViewData['rowLabels'],
        colSectionLabels: AggMatrixViewData['colSectionLabels'],
        rowSectionLabels: AggMatrixViewData['rowSectionLabels'],
        colSectionLines: AggMatrixViewData['colSectionLines'],
        rowSectionLines: AggMatrixViewData['rowSectionLines']
    ) {
        const { rowLabels: rowLabelsGroup, colLabels: colLabelsGroup } = this.dom

        rowLabelsGroup.selectAll('text')
            .data(rowLabels)
            .enter()
            .append('text')
            .attr('class', 'sjpp-ag-matrix-row-label')
            .attr('text-anchor', 'end')
            .attr('fill', '#3f3f46')
            .attr('font-size', 12)
            .attr('font-weight', 400)
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
            .text(d => d.label)

        rowLabelsGroup.selectAll('.sjpp-ag-matrix-row-section-label')
            .data(rowSectionLabels)
            .enter()
            .append('text')
            .attr('class', 'sjpp-ag-matrix-row-section-label')
            .attr('text-anchor', d => d.rotate ? 'middle' : 'end')
            .attr('fill', '#111827')
            .attr('font-size', 12)
            .attr('letter-spacing', '0.02em')
            .attr('transform', (d) =>
                d.rotate
                    ? `translate(${d.x}, ${d.y}) rotate(-90)`
                    : `translate(${d.x}, ${d.y})`
            )
            .text(d => d.label)

        rowLabelsGroup.selectAll('.sjpp-ag-matrix-row-section-line')
            .data(rowSectionLines)
            .enter()
            .append('line')
            .attr('class', 'sjpp-ag-matrix-row-section-line')
            .attr('stroke', '#6b7280')
            .attr('stroke-width', 1)
            .attr('opacity', 0.9)
            .attr('x1', d => d.x)
            .attr('x2', d => d.x)
            .attr('y1', d => d.y1)
            .attr('y2', d => d.y2)

        colLabelsGroup.selectAll('text')
            .data(colLabels)
            .enter()
            .append('text')
            .attr('class', 'sjpp-ag-matrix-col-label')
            .attr('text-anchor', 'end')
            .attr('fill', '#3f3f46')
            .attr('font-size', 12)
            .attr('font-weight', 400)
            .attr('transform', (d) => `translate(${d.x}, ${d.y}) rotate(-90)`)
            .text(d => d.label)

        colLabelsGroup.selectAll('.sjpp-ag-matrix-col-section-label')
            .data(colSectionLabels)
            .enter()
            .append('text')
            .attr('class', 'sjpp-ag-matrix-col-section-label')
            .attr('text-anchor', d => d.rotate ? 'end' : 'middle')
            .attr('dominant-baseline', d => d.rotate ? 'alphabetic' : 'middle')
            .attr('fill', '#111827')
            .attr('font-size', 12)
            .attr('letter-spacing', '0.02em')
            .attr('transform', (d) =>
                d.rotate
                    ? `translate(${d.x}, ${d.y}) rotate(-90)`
                    : `translate(${d.x}, ${d.y})`
            )
            .text(d => d.label)

        colLabelsGroup.selectAll('.sjpp-ag-matrix-col-section-line')
            .data(colSectionLines)
            .enter()
            .append('line')
            .attr('class', 'sjpp-ag-matrix-col-section-line')
            .attr('stroke', '#6b7280')
            .attr('stroke-width', 1)
            .attr('opacity', 0.9)
            .attr('x1', d => d.x1)
            .attr('x2', d => d.x2)
            .attr('y1', d => d.y)
            .attr('y2', d => d.y)
    }

    renderDots(dotPositions: AggMatrixDotPosition[]) {
        for (const dot of dotPositions) {
            this.dom.svg.append('circle')
                .attr('class', 'sjpp-ag-matrix-dot')
                .attr('data-testid', `sjpp-ag-matrix-dot-${dot.row}-${dot.column}`)
                .attr('cx', dot.x)
                .attr('cy', dot.y)
                .attr('r', dot.size)
                .attr('fill', dot.color)
                .on('mouseover', (event: MouseEvent) => {
                    this.dom.tip.clear().show(event.clientX, event.clientY)
                    const table = table2col({ holder: this.dom.tip.d })
                    for (const v of dot.tipData) {
                        addTableRow(table, v.label, v.value)
                    }
                })
                .on('mouseout', () => {
                    this.dom.tip.clear().hide()
                })
                .on('click', () => {
                    const config = this.ag.state.config
                    const colTerm = config.columns[dot.colSection].find(term => term.id === dot.column)
                    const tmp = structuredClone(colTerm)
                    if (tmp.type !== PSEUDOBULK) return

                    //TODO: Move this to interactions
                    const idName = `geneExpression ${dot.row} ${dot.column}`
                    tmp.gene = dot.row
                    tmp.category = dot.column
                    tmp.id = idName
                    tmp.name = idName
                    this.ag.app.dispatch({
                        type: 'plot_create',
                        config: {
                            chartType: 'summary',
                            term: {
                                term: tmp,
                                q: { mode: 'continuous'}
                            }
                        }
                    })
                })
        }
    }
}

function addTableRow(table: any, label: string, value: any) {
    const [td1, td2] = table.addRow()
    td1.text(label)
    td2.text(value)
}