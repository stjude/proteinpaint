import { Tabs } from '../dom/toggleButtons'
import { getCompInit } from '../rx'
import { TermTypeGroups, TermTypes } from '../shared/common.js'

type Dict = {
	[key: string]: any
}

/*
When searching for terms, depending on the use case, only certain types of terms are allowed.
The tree target is used to determine the allowed term types.
 */

const useCases = {
	matrix: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	filter: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	dictionary: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	summary: [TermTypeGroups.DICTIONARY_VARIABLES],
	barchart: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	violin: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	sampleScatter: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.GENE_EXPRESSION], //This case covers scaleBy and dynamic scatters with coordinates from numeric terms
	cuminc: [TermTypeGroups.DICTIONARY_VARIABLES],
	dataDownload: [TermTypeGroups.DICTIONARY_VARIABLES], //Later on can support other term types like snplocus, snplst, geneVariant
	survival: [TermTypeGroups.DICTIONARY_VARIABLES],
	//Used from the termsetting when searching for a term, as any term with categories is allowed
	default: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	regression: [TermTypeGroups.DICTIONARY_VARIABLES]
}

//The dataset provides the allowed term types that are then mapped to the term type groups
//Depending on the dataset types and the use case only certain term type groups/tabs are allowed
export const typeGroup = {
	categorical: TermTypeGroups.DICTIONARY_VARIABLES,
	condition: TermTypeGroups.DICTIONARY_VARIABLES,
	float: TermTypeGroups.DICTIONARY_VARIABLES,
	integer: TermTypeGroups.DICTIONARY_VARIABLES,
	survival: TermTypeGroups.DICTIONARY_VARIABLES,
	geneVariant: TermTypeGroups.MUTATION_CNV_FUSION,
	snplst: TermTypeGroups.SNP_LIST,
	snplocus: TermTypeGroups.SNP_LOCUS,
	geneExpression: TermTypeGroups.GENE_EXPRESSION
}

export class TermTypeSearch {
	dom: any
	types: Array<string>
	app: any
	type: string
	tabs: Array<Dict>
	state: any
	genomeObj: any
	handlerByType: Dict
	click_term: any

	constructor(opts) {
		this.type = 'termTypeSearch'
		this.genomeObj = opts.genome
		this.click_term = opts.click_term

		this.dom = { holder: opts.holder, topbar: opts.topbar }

		this.types = []
		this.tabs = []
		this.handlerByType = {}
	}

	async init(appState) {
		this.types = this.app.vocabApi.termdbConfig?.allowedTermTypes
		if (!this.types) return

		const state = this.getState(appState)
		await this.addTabsAllowed(state)
		if (this.tabs.length == 1) return
		new Tabs({
			holder: this.dom.holder,
			tabsPosition: 'vertical',
			linePosition: 'right',
			tabs: this.tabs
		}).main()

		for (const [i, d] of this.tabs.entries()) {
			const holder = this.tabs[i].contentHolder.style('padding-left', '20px')
			holder.append('div')
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('submenu_')) return true //may change tree visibility
		if (action.type == 'set_term_type_group') return true
	}

	main() {
		this.dom.holder.style('display', this.state.isVisible ? 'inline-block' : 'none')
		this.dom.topbar.style('display', this.state.isVisible ? 'inline-block' : 'none')
	}

	getState(appState) {
		return {
			termTypeGroup: appState.termTypeGroup,
			usecase: appState.tree.usecase,
			isVisible: !appState.submenu.term
		}
	}

	async addTabsAllowed(state) {
		for (const type of this.types) {
			const termTypeGroup = typeGroup[type]
			let label = termTypeGroup
			if (type == TermTypes.GENE_VARIANT) {
				const labels: string[] = []
				if (this.app.vocabApi.termdbConfig.queries.snvindel) labels.push('Mutation')
				if (this.app.vocabApi.termdbConfig.queries.cnv) labels.push('CNV')
				if (this.app.vocabApi.termdbConfig.queries.svfusion) labels.push('Fusion')
				label = labels.join('/')
			}
			try {
				if (termTypeGroup != TermTypeGroups.DICTIONARY_VARIABLES) {
					const _ = await import(`./handlers/${type}.ts`)
					this.handlerByType[type] = await new _.SearchHandler()
				}
			} catch (e) {
				throw `error with handler='./handlers/${type}.ts': ${e}`
			}
			if (termTypeGroup && !this.tabs.some(tab => tab.label == termTypeGroup)) {
				//In regression snplocus and snplst are only allowed for the input variable, disabled for now
				// if (state.usecase.target == 'regression' && (type == 'snplocus' || type == 'snplst' || type == TermTypes.GENE_VARIANT)) {
				// 	if (state.usecase.detail == 'independent')
				// 		this.tabs.push({ label, callback: () => this.setTermTypeGroup(termTypeGroup), termTypeGroup })
				// 	continue
				// }
				if (state.usecase.target == 'regression' && type == TermTypes.GENE_VARIANT) {
					if (state.usecase.detail == 'independent')
						this.tabs.push({ label, callback: () => this.setTermTypeGroup(type, termTypeGroup), termTypeGroup })
					continue
				}
				//In sampleScatter geneVariant is only allowed if detail is not numeric, like when building a dynamic scatter
				if (state.usecase.target == 'sampleScatter' && type == TermTypes.GENE_VARIANT) {
					if (state.usecase.detail != 'numeric')
						this.tabs.push({ label, callback: () => this.setTermTypeGroup(type, termTypeGroup), termTypeGroup })
					continue
				}
				if (state.usecase.target == 'matrix' && state.usecase.detail == 'termgroups' && type == TermTypes.GENE_VARIANT)
					continue //Not supported yet to select multiple geneVariants
				//In most cases the target is enough to know what terms are allowed
				if (!state.usecase.target || useCases[state.usecase.target]?.includes(termTypeGroup))
					this.tabs.push({ label, callback: () => this.setTermTypeGroup(type, termTypeGroup), termTypeGroup })
			}
		}
	}

	async setTermTypeGroup(type, termTypeGroup) {
		await this.app.dispatch({ type: 'set_term_type_group', value: termTypeGroup })
		const tab = this.tabs.find(tab => tab.termTypeGroup == termTypeGroup)
		const holder = tab.contentHolder
		holder.selectAll('*').remove()

		if (tab.termTypeGroup != TermTypeGroups.DICTIONARY_VARIABLES) {
			const handler = this.handlerByType[type]
			await handler.init({
				holder,
				app: this.app,
				genomeObj: this.genomeObj,
				callback: term => this.selectTerm(term)
			})
		}
	}
	//This callback will be called by the handlers when a term is selected
	selectTerm(term) {
		if (this.click_term) this.click_term(term)
		else
			this.app.dispatch({
				type: 'submenu_set',
				submenu: { term, type: 'tvs' }
			})
	}
}

export const TermTypeSearchInit = getCompInit(TermTypeSearch)
