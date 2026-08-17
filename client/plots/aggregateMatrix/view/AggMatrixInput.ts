import { availableAggregateMethods } from '#types'
import { capitalizeFirstLetter } from '#dom'
import { appInit } from '../../../termdb/app.js'

export class AggMatrixInput {
    holder: any
    chartsInstance: any /*MassCharts instance*/
    rowSections: any[] = []
    colSections: any[] = []
    startOpt = '-- Select --'

    constructor(holder: any, chartsInstance: any) {
        this.holder = holder
        this.chartsInstance = chartsInstance
        this.render()
    }

    render() {
        const wrapper = this.holder.append('div').style('padding', '10px').attr('data-testid', 'sjpp-agg-matrix-input-wrapper')
        const sizeSelect = this.renderMethodDropdown(wrapper, 'size')
        const gradSelect = this.renderMethodDropdown(wrapper, 'gradient')

        const axisWrapper = wrapper.append('div').style('display', 'flex').style('margin-bottom', '10px')
        const rowWrapper = axisWrapper.append('div').style('margin-right', '10px').style('border-right', '1px solid #ddd')
        const rowHeader = rowWrapper.append('div').style('border-bottom', '0.5px solid #ddd').style('padding','5px')
        // .style('display', 'flex').style('align-items', 'center')
        rowHeader.append('span').style('margin-right', '5px').text('Row sections:')
        this.renderAddSectionBtn(rowHeader, rowWrapper, 'Row', this.chartsInstance)

        const colWrapper = axisWrapper.append('div')
        const colHeader = colWrapper.append('div').style('border-bottom', '0.5px solid #ddd').style('padding','5px')
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
            .style('padding', '5px 10px')
            .style('font-size', '0.9em')
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
            .style('margin', '5px')
            .style('display', 'inline-flex')
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
            .style('border-radius', '10px')
            .style('padding', '5px 10px')
            .style('background-color', '#cfe2f3')
            .text(`+`)
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
            // .style('border-left', '2px solid #ddd')

        const nameId = `sjpp-agg-matrix-${sectionType.toLowerCase()}-section-name-${Date.now()}-${Math.random()}`
        const nameRow = section.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '5px')
        nameRow.append('label').attr('for', nameId).text('Section name:')
        const nameInput = nameRow
            .append('input')
            .attr('id', nameId)
            .attr('data-testid', 'sjpp-agg-matrix-section-name-input')
            .attr('type', 'text')
            .attr('required', true)

        const termsHolder = section.append('div').attr('data-testid', 'sjpp-agg-matrix-section-terms').style('margin-left', '10px')
        let selectedTerms: any[] = []

        const renderSection = (sectionName: string) => {
            section.html('')
            const header = section.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '10px')
            header.append('strong').text(sectionName)
            header
                .append('button')
                .attr('type', 'button')
                .attr('data-testid', 'sjpp-agg-matrix-remove-section-btn')
                .text('×')
                .attr('aria-label', `Remove ${sectionName}`)
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
                        .style('margin', '5px')
                    row.append('span').text((term: any) => term.name || term.id)
                    //Disable for now. Visual clutter. Can be re-enabled if needed in the future.
                    // row
                    //     .append('button')
                    //     .attr('type', 'button')
                    //     .attr('aria-label', (term: any) => `Remove ${term.name || term.id}`)
                    //     .attr('data-testid', 'sjpp-agg-matrix-remove-term-btn')
                    //     .text('×')
                    //     .on('click', (_event: MouseEvent, term: any) => {
                    //         selectedTerms = selectedTerms.filter(t => t !== term)
                    //         renderSection(sectionName)
                    //     })
                    return row
                })
        }
        
        const disable_terms = this.rowSections.concat(this.colSections).flatMap(section => section.terms || [])

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
                // disable_terms,
                minTermsToSubmit: 1,
                submit_lst: termlst => {
                    selectedTerms = termlst
                    renderSection(nameInput.property('value') || `${sectionType} section`)
                }
            }
        })
    }
}
