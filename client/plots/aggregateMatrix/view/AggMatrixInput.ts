import { availableAggregateMethods } from '#types'
import { capitalizeFirstLetter } from '#dom'
import { appInit } from '../../../termdb/app.js'

export class AggMatrixInput {
    holder: any
    chartsInstance: any /*MassCharts instance*/
    rowSections: any[] = []
    colSections: any[] = []
    startOpt = ''

    constructor(holder: any, chartsInstance: any) {
        this.holder = holder
        this.chartsInstance = chartsInstance
        this.render()
    }

    render() {
        const wrapper = this.holder.append('div').style('padding', '10px').attr('data-testid', 'sjpp-agg-matrix-input-wrapper')
        const sizeSelect = this.renderMethodDropdown(wrapper, 'size')
        const gradSelect = this.renderMethodDropdown(wrapper, 'gradient')

        const rowWrapper = wrapper.append('div').style('margin-bottom', '10px')
        const rowHeader = rowWrapper.append('div')
        // .style('display', 'flex').style('align-items', 'center')
        rowHeader.append('span').style('margin-right', '5px').text('Row sections:')
        this.renderAddSectionBtn(rowHeader, rowWrapper, 'Row', this.chartsInstance)

        const colWrapper = wrapper.append('div').style('margin-bottom', '10px')
        const colHeader = colWrapper.append('div')
        // .style('display', 'flex').style('align-items', 'center')
        colHeader.append('span').style('margin-right', '5px').text('Column sections:')
        this.renderAddSectionBtn(colHeader, colWrapper, 'Column', this.chartsInstance)

        /** Submit button */
        wrapper
            .append('button')
            .attr('data-testid', 'sjpp-agg-matrix-submit-btn')
            .style('border-width', 'medium')
            .style('border-style', 'none')
            .style('border-radius', '20px')
            .style('padding', '10px 15px')
            .text('Submit')
            .on('click', () => {
                const sizeMethod = sizeSelect.node().value
                const gradMethod = gradSelect.node().value
                if (!sizeMethod || !gradMethod || sizeMethod === this.startOpt || gradMethod === this.startOpt) {
                    alert('Please select both size and gradient methods')
                    return
                }
                if (sizeMethod === gradMethod) {
                    alert('Size and gradient methods must be different')
                    return
                }
            })
    }

    renderMethodDropdown(holder: any, method: string) {
        const opts = [this.startOpt].concat(availableAggregateMethods)
        const wrapper = holder
            .append('div')
            .style('margin-bottom', '5px')
            .style('display', 'flex')
            .style('align-items', 'center')
        wrapper
            .append('label')
            .attr('for', `sjpp-agg-matrix-${method}-method-select`)
            .style('margin-right', '5px')
            .text(`${capitalizeFirstLetter(method)} method:`)

        const selectMethod = wrapper
            .append('select')
            .attr('id', `sjpp-agg-matrix-${method}-method-select`)
            .attr('name', `sjpp-agg-matrix-${method}-method-select`)

        selectMethod
            .selectAll('option')
            .data(opts)
            .join('option')
            .attr('value', d => d)
            .text(d => d)

        return selectMethod
    }


    renderAddSectionBtn(holder: any, sectionsHolder: any, sectionType: string, chartsInstance: any) {
        holder
            .append('button')
            .attr('data-testid', 'sjpp-agg-matrix-add-section-btn')
            .style('border-width', 'medium')
            .style('border-style', 'none')
            .style('border-radius', '5px')
            .style('padding', '5px 10px')
            .text(`Add ${sectionType} Section`)
            .on('click', () => {
                this.addSection(sectionsHolder, sectionType, chartsInstance)
            })
    }
    addSection(holder: any, sectionType: string, chartsInstance: any) {
        const section = holder
            .append('div')
            .attr('data-testid', `sjpp-agg-matrix-${sectionType.toLowerCase()}-section`)
            .style('margin', '8px 0 0 15px')
            .style('padding', '8px')
            .style('border-left', '2px solid #ddd')

        const nameId = `sjpp-agg-matrix-${sectionType.toLowerCase()}-section-name-${Date.now()}-${Math.random()}`
        const nameRow = section.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '5px')
        nameRow.append('label').attr('for', nameId).text('Section name:')
        const nameInput = nameRow
            .append('input')
            .attr('id', nameId)
            .attr('data-testid', 'sjpp-agg-matrix-section-name-input')
            .attr('type', 'text')
            .attr('required', true)

        const termsHolder = section.append('div').attr('data-testid', 'sjpp-agg-matrix-section-terms')
        let selectedTerms: any[] = []

        const renderSection = (sectionName: string) => {
            section.html('')
            const header = section.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '10px')
            header.append('strong').text(sectionName)
            header
                .append('button')
                .attr('type', 'button')
                .attr('data-testid', 'sjpp-agg-matrix-remove-section-btn')
                .text('Delete section')
                .on('click', () => section.remove())

            section
                .append('div')
                .attr('data-testid', 'sjpp-agg-matrix-section-terms')
                .selectAll('div')
                .data(selectedTerms, (term: any) => term.id || term.name)
                .join(enter => {
                    const row = enter
                        .append('div')
                        .attr('data-testid', 'sjpp-agg-matrix-section-term')
                        .style('display', 'flex')
                        .style('align-items', 'center')
                        .style('gap', '5px')
                        .style('margin-top', '5px')
                    row.append('span').text((term: any) => term.name || term.id)
                    row
                        .append('button')
                        .attr('type', 'button')
                        .attr('aria-label', (term: any) => `Remove ${term.name || term.id}`)
                        .attr('data-testid', 'sjpp-agg-matrix-remove-term-btn')
                        .text('×')
                        .on('click', (_event: MouseEvent, term: any) => {
                            selectedTerms = selectedTerms.filter(t => t !== term)
                            renderSection(sectionName)
                        })
                    return row
                })
        }

        appInit({
            holder: termsHolder,
            vocabApi: chartsInstance.app.vocabApi,
            state: {
                activeCohort: chartsInstance.state.activeCohort,
                nav: {
                    header_mode: 'search_only'
                },
                tree: { usecase: { target: 'aggregateMatrix' } }
            },
            tree: {
                //TODO: may need to be two
                minTermsToSubmit: 1,
                submit_lst: termlst => {
                    selectedTerms = termlst
                    renderSection(nameInput.property('value') || `${sectionType} section`)
                }
            }
        })
    }
}
