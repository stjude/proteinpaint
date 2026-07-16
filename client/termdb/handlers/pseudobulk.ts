import type { AppApi } from '#rx'
import { TermTypeGroups } from '#shared/terms.js'
import { Tabs, type TabsInputEntry, make_radios, type OptionEntry} from '#dom'

/** Human readable labels */
const labelMap = {
    geneExpression: 'Gene Expression',
    cellType: 'Cell Type',
}

export class SearchHandler {
    callback?: (f?: any) => void
    app?: AppApi

    async init(opts) {
        const pseudobulkTerms = this.validateOpts(opts)
        this.callback = opts.callback
        this.app = opts.app
        const holder = opts.holder.append('div').style('padding', '10px 0px')

        const map = this.buildRenderingDataMap(pseudobulkTerms)
        this.renderPseudobulkSearch(holder, map)

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
    renderPseudobulkSearch(holder, map) {
        if (map.size === 1) {
            const label = labelMap[map.keys().next().value] || map.keys().next().value
            this.renderMemberIdsByAssay(holder, map, label)
            return
        }
        const tabs = this.buildTabsOpts(map)
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
            value: memberId
        })) as any

        holder.append('div')
            .style('padding', '5px')
            .style('opacity', 0.7)
            .text(`Select a term for ${assayLabel}:`)

        const radios = make_radios({
            holder,
            inputName: `sjpp-pseudobulk-radios-${assayLabel}`,
            options,
            styles: { display: 'block', padding: '3px 5px' },
            callback: (value) => {
                const terms = memberIdMap.get(value)
                this.renderTermdByMemberId(holder, new Map([[value, terms]]))
            }
        })
        radios.main(Array.from(memberIdMap.keys())[0] as any)
    }

    renderTermdByMemberId(holder, memberIdMap) {
        console.log('renderTermdByMemberId', memberIdMap)
        holder.selectAll('*').remove()
    }
}