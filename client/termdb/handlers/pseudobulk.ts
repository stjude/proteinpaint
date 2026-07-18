import type { AppApi } from '#rx'
import { TermTypeGroups, termType2label } from '#shared/terms.js'
import { Tabs, type TabsInputEntry, make_radios, type OptionEntry, Menu, addGeneSearchbox } from '#dom'
import type { ClientGenome } from 'types/clientGenome'
import type { PseudobulkTerm } from '#types'

/** Human readable labels */

type PseudobulkSelection = Omit<PseudobulkTerm, 'category' | 'gene'> & {
	id: string
	category?: string
}

export class SearchHandler {
	callback!: (f?: any) => void
	app!: AppApi
	genome!: ClientGenome
	map?: Map<string, Map<string, any[]>>
	selectedTerm?: PseudobulkSelection

	constructor() {}

	async init(opts) {
		const pseudobulkTerms = this.validateOpts(opts)
		this.callback = opts.callback
		this.app = opts.app
		this.genome = opts.genomeObj
		const holder = opts.holder.append('div').style('padding', '10px 0px')

		this.map = this.buildRenderingDataMap(pseudobulkTerms)
		this.renderPseudobulkSearch(holder)
	}

	validateOpts(opts): any[] {
		if (!opts) throw new Error('opts is required')
		if (!opts.app) throw new Error('opts.app is required')
		if (!opts.holder) throw new Error('opts.holder is required')
		if (opts.genomeObj == null || typeof opts.genomeObj !== 'object') throw new Error('genomeObj is required')
		if (!opts.callback) throw new Error('opts.callback is required')
		const pseudobulkTerms = opts.app.vocabApi.termdbConfig?.termType2terms?.[TermTypeGroups.PSEUDOBULK]
		if (!pseudobulkTerms) {
			throw new Error(
				`termType2terms[${TermTypeGroups.PSEUDOBULK}]:[] is required in termdbConfig for pseudobulk handler`
			)
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

	/** If more than one assay, render tabs for each assay. Member IDs within
	 * an assay are rendered as tabs when there is more than one. */
	renderPseudobulkSearch(holder) {
		if (!this.map || this.map.size < 1) throw new Error('map is not initialized')
		if (this.map.size === 1) {
			// only one assay
			const label = termType2label(this.map.keys().next().value!)
			holder.append('div').text('Single-cell pseudobulk ' + label)
			this.renderMemberIdsByAssay(holder.append('div'), this.map)
			return
		}
		const tabs = this.buildTabsOpts(this.map)
		new Tabs({ holder, tabs, linePosition: 'right', tabsPosition: 'vertical' }).main()
	}

	buildTabsOpts(map) {
		const tabs: TabsInputEntry[] = []
		for (const [key, valuesMap] of map.entries()) {
			const label = termType2label(key)
			tabs.push({
				label,
				active: false,
				callback: (_, tab) => {
					this.renderMemberIdsByAssay(tab.contentHolder, new Map([[key, valuesMap]]))
				}
			})
		}
		return tabs
	}

	renderMemberIdsByAssay(holder, map) {
		const memberIdMap = map.values().next().value
		holder.selectAll('*').remove()
		this.renderTermdByMemberId(holder, memberIdMap)
	}

	renderTermdByMemberId(holder, memberIdMap) {
		const layout = holder.append('div').style('display', 'flex').style('align-items', 'flex-start').style('gap', '30px')
		const pseudoTermsWrapper = layout.append('div').attr('data-testid', 'sjpp-pseudobulk-terms-wrapper')
		const geneSearchWrapper = layout.append('div').attr('data-testid', 'sjpp-pseudobulk-gene-search-wrapper')
		this.renderPseudobulkTerms(pseudoTermsWrapper, memberIdMap, geneSearchWrapper)
	}

	renderPseudobulkTerms(holder, memberIdMap, geneSearchHolder) {
		if (memberIdMap.size === 1) {
			const [memberId, terms] = memberIdMap.entries().next().value
			this.renderCategoryRadios(holder, memberId, terms, geneSearchHolder)
			return
		}

		const memberEntries = Array.from(memberIdMap.entries()) as [string, any[]][]
		const tabs: TabsInputEntry[] = memberEntries.map(([memberId, terms]) => ({
			label: memberId,
			active: false,
			testid: `sjpp-pseudobulk-member-${memberId}`,
			callback: (_, tab) => {
				this.selectedTerm = undefined
				geneSearchHolder.selectAll('*').remove()
				tab.contentHolder.selectAll('*').remove()
				this.renderCategoryRadios(tab.contentHolder, memberId, terms, geneSearchHolder)
			}
		}))
		new Tabs({ holder, tabs }).main()
	}

	renderCategoryRadios(holder, memberId, terms, geneSearchHolder) {
		if (!terms || terms.length < 1) throw new Error('No terms found for memberId')
		holder.append('div').style('opacity', 0.7).text(`Select from ${memberId}:`)

		const options: OptionEntry[] = terms.map(term => ({
			label: term.name,
			value: term.id,
			checked: false,
			testid: `sjpp-pseudobulk-category-${term.id}`
		}))
		make_radios({
			holder,
			inputName: `sjpp-pseudobulk-category-radios-${memberId}`,
			options,
			styles: { display: 'block', padding: '3px 5px' },
			callback: value => {
				const term = terms.find(term => term.id == value)
				if (!term) throw new Error(`No pseudobulk term found for category ${value}`)
				this.selectedTerm = term
				this.renderGeneSelection(geneSearchHolder)
			}
		})
	}

	renderGeneSelection(holder) {
		holder.selectAll('*').remove()
		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.genome,
			row: holder,
			searchOnly: 'gene',
			callback: () => {
				if (!geneSearch.geneSymbol) throw new Error('No gene selected')
				if (!this.selectedTerm) throw new Error('No pseudobulk cell type selected')
				this.callback(createPseudobulkTerm(this.selectedTerm, geneSearch.geneSymbol))
			}
		})
	}
}

/** Create a pseudobulk term for the selected cell type and gene. */
export function createPseudobulkTerm(selectedTerm: PseudobulkSelection, gene: string): PseudobulkTerm {
	const category = selectedTerm.category || selectedTerm.id
	const name = `${selectedTerm.assay} ${category} ${gene}`
	return { ...selectedTerm, id: name, category, gene, name }
}
