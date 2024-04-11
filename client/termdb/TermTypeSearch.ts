import { getHandler as getSnpListHandler } from '../termsetting/handlers/snplst.ts'
import { Tabs } from '../dom/toggleButtons'
import { getCompInit } from '../rx'
import { TermTypeGroups } from '../shared/common.js'
import { getHandler as getSnpLocusHandler } from '../termsetting/handlers/snplocus.ts'

type Dict = {
	[key: string]: any
}

//For each use case the corresponding tabs are shown
const useCases = {
	dictionary: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	summary: [TermTypeGroups.DICTIONARY_VARIABLES],
	barchart: [TermTypeGroups.DICTIONARY_VARIABLES],
	sampleScatter: [TermTypeGroups.DICTIONARY_VARIABLES],
	cuminc: [TermTypeGroups.DICTIONARY_VARIABLES],
	survival: [TermTypeGroups.DICTIONARY_VARIABLES],
	overlay: [TermTypeGroups.DICTIONARY_VARIABLES],
	divideBy: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.MUTATION_CNV_FUSION],
	regression: [TermTypeGroups.DICTIONARY_VARIABLES],
	dataDownload: [TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.SNP_LIST, TermTypeGroups.SNP_LOCUS]
}

export class TermTypeSearch {
	dom: any
	typeDict: Dict
	types: Array<string>
	app: any
	type: string
	tabs: Array<Dict>
	state: any

	constructor(opts) {
		this.type = 'termTypeSearch'
		this.dom = { holder: opts.holder }
		this.typeDict = {
			categorical: TermTypeGroups.DICTIONARY_VARIABLES,
			condition: TermTypeGroups.DICTIONARY_VARIABLES,
			float: TermTypeGroups.DICTIONARY_VARIABLES,
			integer: TermTypeGroups.DICTIONARY_VARIABLES,
			survival: TermTypeGroups.DICTIONARY_VARIABLES,
			geneVariant: TermTypeGroups.MUTATION_CNV_FUSION,
			snplst: TermTypeGroups.SNP_LIST,
			snplocus: TermTypeGroups.SNP_LOCUS
		}
		this.types = []
		this.tabs = []
	}

	init(appState) {
		this.types = this.app.vocabApi.termdbConfig?.allowedTermTypes
		if (!this.types) return
		this.addTabsAllowed(appState)
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
	}

	main() {
		if (!this.state.isVisible) this.dom.holder.style('display', 'none')
	}

	getState(appState) {
		return {
			termTypeGroup: appState.termTypeGroup,
			usecase: appState.tree.usecase,
			isVisible: !appState.submenu.term,
			genome: appState.vocab?.genome
		}
	}

	addTabsAllowed(appState) {
		const state = this.getState(appState)
		for (const type of this.types) {
			const termTypeGroup = this.typeDict[type]
			if (termTypeGroup && !this.tabs.some(tab => tab.label == termTypeGroup)) {
				//In regression snplocus and snplst are only allowed for the input variable
				if (state.usecase.target == 'regression' && (type == 'snplocus' || type == 'snplst' || type == 'geneVariant')) {
					if (state.usecase.detail == 'independent')
						this.tabs.push({ label: termTypeGroup, callback: () => this.setTermTypeGroup(termTypeGroup) })
					continue
				}
				//In sampleScatter geneVariant is only allowed if detail is not numeric, like the case of scaleBy
				if (state.usecase.target == 'sampleScatter' && type == 'geneVariant') {
					if (state.usecase.detail != 'numeric')
						this.tabs.push({ label: termTypeGroup, callback: () => this.setTermTypeGroup(termTypeGroup) })
					continue
				}
				//In most cases the target is enough to know what terms are allowed
				if (!state.usecase.target || useCases[state.usecase.target]?.includes(termTypeGroup))
					this.tabs.push({ label: termTypeGroup, callback: () => this.setTermTypeGroup(termTypeGroup) })
			}
		}
	}

	setTermTypeGroup(termTypeGroup) {
		this.app.dispatch({ type: 'set_term_type_group', value: termTypeGroup })
		const tab = this.tabs.find(tab => tab.label == termTypeGroup)
		const holder = tab.contentHolder
		holder.selectAll('*').remove()
		if (tab.label == TermTypeGroups.SNP_LOCUS) {
			this.q = { doNotRestrictAncestry: true }
			const genomeObj = { name: this.state.genome, hasSNP: true }
			this.opts = { genomeObj }
			this.vocabApi = this.app.vocabApi
			const handler = getSnpLocusHandler(this)
			handler.showEditMenu(holder)
		}
		if (tab.label == TermTypeGroups.SNP_LIST) {
			this.q = { doNotRestrictAncestry: true }
			this.usecase = { target: 'TermTypeSearch' }

			const handler = getSnpListHandler(this)
			handler.showEditMenu(holder)
		}
	}
}

export const TermTypeSearchInit = getCompInit(TermTypeSearch)
