import type { AppApi } from '#rx'
import { TermTypeGroups } from '#shared/terms.js'
import { Tabs, type TabsInputEntry, make_radios, type OptionEntry, sayerror } from '#dom'

/** Human readable labels */
const labelMap = {
    geneExpression: 'Gene Expression',
    cellType: 'Cell Type',
}

export class SearchHandler {
    callback!: (f?: any) => void
    app?: AppApi
    map?: Map<string, Map<string, any[]>>
    selectedTerms: Set<string>

    constructor() {
        this.selectedTerms = new Set()
    }

    async init(opts) {
        const pseudobulkTerms = this.validateOpts(opts)
        this.callback = opts.callback
        this.app = opts.app
        const holder = opts.holder.append('div').style('padding', '10px 0px')

        this.map = this.buildRenderingDataMap(pseudobulkTerms)
        this.renderPseudobulkSearch(holder)
    }

    validateOpts(opts): any[] {
        if (!opts) throw new Error('opts is required')
        if (!opts.app) throw new Error('opts.app is required')
        if (!opts.holder) throw new Error('opts.holder is required')
        if (!opts.callback) throw new Error('opts.callback is required')
        const pseudobulkTerms = opts.app.vocabApi.termdbConfig?.termType2terms?.[TermTypeGroups.PSEUDOBULK]
        if (!pseudobulkTerms) {
            throw new Error(`termType2terms[${TermTypeGroups.PSEUDOBULK}]:[] is required in termdbConfig for pseudobulk handler`)
        }
        return pseudobulkTerms
    }

    /** Builds a map from assay to memberId to terms */
    buildRenderingDataMap(pseudobulkTerms): Map<string, Map<string, any[]>> {
        const map = new Map()
        for (const term of pseudobulkTerms) {
            const { assay, memberId } = term
            if (!map.has(assay)) map.set(assay, new Map())
            const assayMap = map.get(assay)
            if (!assayMap.has(memberId)) assayMap.set(memberId, [])
            assayMap.get(memberId).push(term)
        }
        return map
    }

    /** If more than one assay, render tabs for each assay. If only one, 
     * renders the radio selection for the memberIds. If only one memberId, 
     * renders the categories terms directly. Categories appear as checkboxes. 
     * One than one checkbox is required to be selected and submitted. */
    renderPseudobulkSearch(holder) {
        if (!this.map || this.map.size < 1) throw new Error('map is not initialized')
        if (this.map.size === 1) {
            const label = labelMap[this.map.keys().next().value!] || this.map.keys().next().value
            this.renderMemberIdsByAssay(holder, this.map, label)
            return
        }
        const tabs = this.buildTabsOpts(this.map)
        new Tabs({ holder, tabs, linePosition: 'right', tabsPosition: 'vertical' }).main()
    }

    buildTabsOpts(map) {
        const tabs: TabsInputEntry[] = []
        for (const [key, valuesMap] of map.entries()) {
            const label = labelMap[key] || key
            tabs.push({
                label,
                active: false,
                callback: (_, tab) => {
                    this.renderMemberIdsByAssay(tab.contentHolder, new Map([[key, valuesMap]]), label)
                }
            })
        }
        return tabs
    }

    renderMemberIdsByAssay(holder, map, assayLabel) {
        const memberIdMap = map.values().next().value
        if (memberIdMap.size === 1) {
            this.renderTermdByMemberId(holder, memberIdMap)
            return
        }
        const options: OptionEntry[] = Array.from(memberIdMap.keys()).map(memberId => ({
            label: memberId,
            value: memberId,
            checked: false,
            testid: `sjpp-pseudobulk-${assayLabel}-${memberId}`
        })) as any

        holder.append('div')
            .style('padding', '5px')
            .style('opacity', 0.7)
            .text(`${assayLabel} selection:`)

        make_radios({
            holder,
            inputName: `sjpp-pseudobulk-radios-${assayLabel}`,
            options,
            styles: { display: 'block', padding: '3px 5px' },
            callback: (value) => {
                const terms = memberIdMap.get(value)
                this.renderTermdByMemberId(holder, new Map([[value, terms]]))
            }
        })
    }

    renderTermdByMemberId(holder, memberIdMap) {
        holder.selectAll('*').remove()
        this.renderBackButton(holder)
        this.renderPseudobulkTerms(holder, memberIdMap)
        this.renderSumbitButton(holder)
    }

    renderBackButton(holder) {
        holder.append('button')
            .html('&#171; Back')
            .style('margin', '5px 0px')
            .style('border', 'none')
            .style('background', 'none')
            .on('click', () => {
                holder.selectAll('*').remove()
                this.renderPseudobulkSearch(holder)
            })
    }

    renderPseudobulkTerms(holder, memberIdMap) {
        const terms = memberIdMap.values().next().value
        if (!terms || terms.length < 1) throw new Error('No terms found for memberId')
        holder.append('div')
            .style('padding', '5px')
            .style('opacity', 0.7)
            .text(`Select two or more ${memberIdMap.keys().next().value} terms:`)

        const wrapper = holder.append('div')
        this.renderSelectAllBtn(wrapper, terms, this.selectedTerms)

        const selectedTerms = this.selectedTerms
        for (const term of terms) {
            const checkboxWrapper = wrapper.append('div').style('padding', '3px 0px')
            const input = this.appendCheckbox(checkboxWrapper, term.name)
            input.on('change', function (this: HTMLInputElement) {
                if (this.checked) {
                    selectedTerms.add(term)
                } else {
                    selectedTerms.delete(term)
                }
            })
            this.appendLabel(checkboxWrapper, term.name, term.name)
        }
    }

    renderSelectAllBtn(wrapper, terms, selectedTerms) {
        const checkboxWrapper = wrapper.append('div').style('padding', '3px 0px')
        const input = this.appendCheckbox(checkboxWrapper, 'selectAll')
        input.on('change', function (this: HTMLInputElement) {
            const inputs = wrapper.selectAll('input[type="checkbox"]').nodes() as HTMLInputElement[]
            if (this.checked) {
                inputs.forEach(input => { input.checked = true })
                selectedTerms.clear()
                for (const term of terms) {
                    selectedTerms.add(term)
                }
            } else {
                inputs.forEach(input => { input.checked = false })
                selectedTerms.clear()
            }
        })
        this.appendLabel(checkboxWrapper, 'Select All', 'selectAll')
    }

    appendCheckbox(wrapper, value) {
        const input = wrapper.append('input')
            .attr('type', 'checkbox')
            .attr('id', `sjpp-pseudobulk-checkbox-${value}`)
            .attr('data-testid', `sjpp-pseudobulk-checkbox-${value}`)
            .attr('value', value)
            .property('checked', false)
            .style('margin', '3px 5px')
        return input
    }

    appendLabel(wrapper, text, attrSuffix) {
        wrapper.append('label')
            .attr('for', `sjpp-pseudobulk-checkbox-${attrSuffix}`)
            .attr('data-testid', `sjpp-pseudobulk-label-${attrSuffix}`)
            .style('margin-right', '10px')
            .text(text)
    }

    renderSumbitButton(holder) {
        holder.append('button')
            .text('Submit')
            .style('margin', '10px 0px')
            .style('padding', '5px 10px')
            .style('border', '1px solid #ccc')
            .style('background', '#f9f9f9')
            .style('cursor', 'pointer')
            .on('click', () => {
                if (this.selectedTerms.size < 2) {
                    sayerror(holder, 'Please select at least two categories.')
                    return
                }
                this.callback({
                    type: 'termCollection',
                    isCustom: true,
                    memberType: 'numeric',
                    termlst: Array.from(this.selectedTerms),
                    name: 'Pseudobulk Selection',
                    propsByTermId: {},
                    isleaf: true
                })
            })
    }
}