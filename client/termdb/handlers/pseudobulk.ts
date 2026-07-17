import type { AppApi } from '#rx'
import { TermTypeGroups } from '#shared/terms.js'
import { Tabs, type TabsInputEntry, make_radios, type OptionEntry, sayerror, GeneSetEditUI } from '#dom'
import type { ClientGenome } from 'types/clientGenome'
import type { PseudobulkTerm } from '#types'

/** Human readable labels */
const labelMap = {
	geneExpression: 'Gene Expression',
	cellType: 'Cell Type'
}

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

	/** If more than one assay, render tabs for each assay. If only one,
	 * renders the radio selection for the memberIds. If only one memberId,
	 * renders the cell types directly as radio buttons. */
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

		holder.append('div').style('padding', '5px').style('opacity', 0.7).text(`${assayLabel} selection:`)

		make_radios({
			holder,
			inputName: `sjpp-pseudobulk-radios-${assayLabel}`,
			options,
			styles: { display: 'block', padding: '3px 5px' },
			callback: value => {
				const terms = memberIdMap.get(value)
				this.renderTermdByMemberId(holder, new Map([[value, terms]]))
			}
		})
	}

	renderTermdByMemberId(holder, memberIdMap) {
		holder.selectAll('*').remove()
		const pseudoTermsWrapper = holder.append('div').attr('data-testid', 'sjpp-pseudobulk-terms-wrapper')
		this.renderPseudobulkTerms(pseudoTermsWrapper, memberIdMap, holder)
	}

	renderBackButton(holder, callback) {
		holder
			.append('button')
			.html('&#171; Back')
			.style('margin', '5px 0px')
			.style('border', 'none')
			.style('background', 'none')
			.on('click', () => {
				holder.selectAll('*').remove()
				callback()
			})
	}

	renderPseudobulkTerms(holder, memberIdMap, searchHolder) {
		const terms = memberIdMap.values().next().value
		if (!terms || terms.length < 1) throw new Error('No terms found for memberId')
		holder
			.append('div')
			.style('padding', '5px')
			.style('opacity', 0.7)
			.text(`Select one from ${memberIdMap.keys().next().value}:`)

		const options: OptionEntry[] = terms.map(term => ({
			label: term.name,
			value: term.id,
			checked: false,
			testid: `sjpp-pseudobulk-category-${term.id}`
		}))
		make_radios({
			holder,
			inputName: 'sjpp-pseudobulk-category-radios',
			options,
			styles: { display: 'block', padding: '3px 5px' },
			callback: value => {
				const term = terms.find(term => term.id == value)
				if (!term) throw new Error(`No pseudobulk term found for category ${value}`)
				this.selectedTerm = term
				this.renderGeneSelection(searchHolder, memberIdMap)
			}
		})
	}

	renderGeneSelection(holder, memberIdMap) {
		holder.selectAll('*').remove()
		this.renderBackButton(holder, () => {
			this.selectedTerm = undefined
			this.renderTermdByMemberId(holder, memberIdMap)
		})
		new GeneSetEditUI({
			holder: holder.append('div'),
			genome: this.genome,
			mode: 'geneExpression',
			vocabApi: this.app.vocabApi,
			callback: arg => {
				if (!arg.geneList || arg.geneList.length < 1) {
					sayerror(holder, 'Please select at least one gene.')
					return
				}
				if (!this.selectedTerm) throw new Error('No pseudobulk cell type selected')
				const termlst = createPseudobulkTerms(this.selectedTerm, arg.geneList)
				if (termlst.length === 1) {
					this.callback(termlst[0])
					return
				}
				this.callback({
					type: 'termCollection',
					isCustom: true,
					memberType: 'numeric',
					termlst,
					name: 'Pseudobulk Selection',
					propsByTermId: {},
					isleaf: true
				})
			}
		})
	}
}

/** Create one pseudobulk term for each gene in the selected cell type. */
export function createPseudobulkTerms(
	selectedTerm: PseudobulkSelection,
	geneList: { gene: string }[]
): PseudobulkTerm[] {
	return geneList.map(({ gene }) => {
		const category = selectedTerm.category || selectedTerm.id
		const name = `${selectedTerm.assay} ${category} ${gene}`
		return { ...selectedTerm, id: name, category, gene, name }
	})
}
