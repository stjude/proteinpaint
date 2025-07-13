import { renderTable } from '#dom'
import { select } from 'd3-selection'

export default class InvalidDataUI {
        static render(container: any, invalidInfo: { count: number; entries: { dataType: string; reason: string }[] }) {
                const expandableContainer = container.append('div').style('margin-top', '12px')

                const expandableHeader = expandableContainer
                        .append('div')
                        .style('display', 'flex')
                        .style('align-items', 'center')
                        .style('gap', '8px')
                        .style('cursor', 'pointer')
                        .style('padding', '8px')
                        .style('border-radius', '4px')
                        .style('transition', 'background-color 0.2s')
                        .style('background-color', 'rgba(220, 53, 69, 0.1)')
                        .style('border', '1px solid rgba(220, 53, 69, 0.2)')
                        .on('mouseenter', function (this: HTMLElement) {
                                select(this).style('background-color', 'rgba(220, 53, 69, 0.15)')
                        })
                        .on('mouseleave', function (this: HTMLElement) {
                                select(this).style('background-color', 'rgba(220, 53, 69, 0.1)')
                        })

                const expandIcon = expandableHeader
                        .append('span')
                        .style('font-size', '12px')
                        .style('color', '#dc3545')
                        .style('transition', 'transform 0.2s')
                        .text('▶')

                expandableHeader
                        .append('span')
                        .style('color', '#dc3545')
                        .style('text-decoration', 'underline')
                        .style('font-size', '13px')
                        .style('font-weight', '500')
                        .text(`View ${invalidInfo.count} invalid entries`)

                const expandableContent = expandableContainer
                        .append('div')
                        .style('display', 'none')
                        .style('margin-top', '12px')
                        .style('padding', '12px')
                        .style('background-color', '#fff')
                        .style('border', '1px solid #f5c6cb')
                        .style('border-radius', '4px')
                        .style('box-shadow', 'inset 0 1px 3px rgba(0, 0, 0, 0.1)')

                const tableContainer = expandableContent
                        .append('div')
                        .style('max-height', '300px')
                        .style('overflow-y', 'auto')
                        .style('border', '1px solid #dee2e6')
                        .style('border-radius', '4px')

                renderTable({
                        div: tableContainer,
                        columns: [
                                { label: 'Data Type', sortable: true },
                                { label: 'Reason', sortable: true }
                        ],
                        rows: invalidInfo.entries.map(e => [{ value: e.dataType }, { value: e.reason }]),
                        showLines: true,
                        striped: true,
                        showHeader: true,
                        maxHeight: '280px',
                        resize: false,
                        header: {
                                allowSort: true,
                                style: {
                                        'background-color': '#f8f9fa',
                                        'font-weight': 'bold',
                                        'border-bottom': '2px solid #dee2e6'
                                }
                        }
                })

                expandableContent
                        .append('div')
                        .style('margin-top', '12px')
                        .style('padding', '8px')
                        .style('background-color', '#f8f9fa')
                        .style('border-radius', '4px')
                        .style('font-size', '12px')
                        .style('color', '#495057')
                        .style('line-height', '1.4')
                        .text('Entries listed above were skipped due to invalid or unsupported chromosome information.')

                let isExpanded = false
                expandableHeader.on('click', function () {
                        isExpanded = !isExpanded
                        if (isExpanded) {
                                expandableContent.style('display', 'block')
                                expandIcon.style('transform', 'rotate(90deg)').text('▼')
                        } else {
                                expandableContent.style('display', 'none')
                                expandIcon.style('transform', 'rotate(0deg)').text('▶')
                        }
                })
        }
}
