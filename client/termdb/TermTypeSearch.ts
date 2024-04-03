import { getHandler as getSnpListHandler } from '../termsetting/handlers/snplst.ts'
import { Tabs } from '../dom/toggleButtons'
import { getCompInit } from '../rx'
import { TermTypes } from '../shared/common.js'
import { getHandler as getSnpLocusHandler } from '../termsetting/handlers/snplocus.ts'

type Dict = {
	[key: string]: any
}

//For each use case the corresponding tabs are shown
const useCases = {
	summary: [TermTypes.DICTIONARY_VARIABLES],
	barchart: [TermTypes.DICTIONARY_VARIABLES],
	sampleScatter: [TermTypes.DICTIONARY_VARIABLES],
	cuminc: [TermTypes.DICTIONARY_VARIABLES],
	survival: [TermTypes.DICTIONARY_VARIABLES],
	overlay: [TermTypes.DICTIONARY_VARIABLES],
	divideBy: [TermTypes.DICTIONARY_VARIABLES, TermTypes.MUTATION_CNV_FUSION],
	regression: [TermTypes.DICTIONARY_VARIABLES, TermTypes.SNP_LIST, TermTypes.SNP_LOCUS],
	dataDownload: [TermTypes.DICTIONARY_VARIABLES, TermTypes.SNP_LIST, TermTypes.SNP_LOCUS]
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
			categorical: TermTypes.DICTIONARY_VARIABLES,
			condition: TermTypes.DICTIONARY_VARIABLES,
			float: TermTypes.DICTIONARY_VARIABLES,
			integer: TermTypes.DICTIONARY_VARIABLES,
			survival: TermTypes.DICTIONARY_VARIABLES,
			geneVariant: TermTypes.MUTATION_CNV_FUSION,
			snplst: TermTypes.SNP_LIST,
			snplocus: TermTypes.SNP_LOCUS
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
			termType: appState.termType,
			usecase: appState.tree.usecase,
			isVisible: !appState.submenu.term,
			genome: appState.vocab?.genome
		}
	}

	addTabsAllowed(appState) {
		const state = this.getState(appState)
		for (const type of this.types) {
			const termType = this.typeDict[type]
			if (termType && !this.tabs.some(tab => tab.label == termType)) {
				//In regression snplocus and snplst are only allowed for the input variable
				if (state.usecase.target == 'regression' && (type == 'snplocus' || type == 'snplst')) {
					if (state.usecase.detail == 'independent')
						this.tabs.push({ label: termType, callback: () => this.setTermType(termType) })
					continue
				}
				//In sampleScatter geneVariant is only allowed if detail is not numeric, like the case of scaleBy
				if (state.usecase.target == 'sampleScatter' && type == 'geneVariant') {
					if (state.usecase.detail != 'numeric')
						this.tabs.push({ label: termType, callback: () => this.setTermType(termType) })
					continue
				}
				//In most cases the target is enough to know what terms are allowed
				if (!state.usecase.target || useCases[state.usecase.target]?.includes(termType))
					this.tabs.push({ label: termType, callback: () => this.setTermType(termType) })
			}
		}
	}

	setTermType(termType) {
		this.app.dispatch({ type: 'set_term_type', value: termType })
		const tab = this.tabs.find(tab => tab.label == termType)
		const holder = tab.contentHolder
		holder.selectAll('*').remove()
		if (tab.label == TermTypes.SNP_LOCUS) {
			this.q = { doNotRestrictAncestry: true }
			const genomeObj = { name: this.state.genome, hasSNP: true }
			this.opts = { genomeObj }
			this.vocabApi = this.app.vocabApi
			const handler = getSnpLocusHandler(this)
			handler.showEditMenu(holder)
		}
		if (tab.label == TermTypes.SNP_LIST) {
			this.q = { doNotRestrictAncestry: true }
			this.usecase = { target: 'TermTypeSearch' }

			const handler = getSnpListHandler(this)
			handler.showEditMenu(holder)
		}
	}
}

export const TermTypeSearchInit = getCompInit(TermTypeSearch)
