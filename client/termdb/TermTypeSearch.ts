import { Tabs } from '#dom'
import { getCompInit } from '../rx'
import { TermTypeGroups, TermTypes, typeGroup, numericTypes } from '#shared/terms.js'
import type { Term } from '#types'
import { select } from 'd3-selection'

type Dict = {
	[key: string]: any
}

/*
When searching for terms, depending on the use case, only certain types of terms are allowed.
The tree target is used to determine the allowed term types.
NOTE: dataset-specific overrides may be applied when the TermTypeSearch is initialized
 */

const useCasesExcluded = {
	matrix: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	filter: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	dictionary: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	summary: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	barchart: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	violin: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	sampleScatter: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	cuminc: [
		TermTypeGroups.SNP_LOCUS,
		TermTypeGroups.SNP_LIST,
		TermTypeGroups.MUTATION_CNV_FUSION,
		TermTypeGroups.METABOLITE_INTENSITY
	],
	dataDownload: [
		//TermTypeGroups.SNP_LOCUS, //this tabs require that the handler for this term type to be implemented
		//TermTypeGroups.SNP_LIST, //this tabs require that the handler for this term type to be implemented
		TermTypeGroups.MUTATION_CNV_FUSION
	], //Later on can support other term types like snplocus, snplst, geneVariant, non dictionary terms
	survival: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	//Used from the termsetting when searching for a term, as any term with categories is allowed
	default: [TermTypeGroups.SNP_LOCUS, TermTypeGroups.SNP_LIST],
	regression: [TermTypeGroups.SNP_LIST, TermTypeGroups.SNP_LOCUS],
	metaboliteIntensity: [
		TermTypeGroups.SNP_LOCUS,
		TermTypeGroups.SNP_LIST,
		TermTypeGroups.MUTATION_CNV_FUSION,
		TermTypeGroups.DICTIONARY_VARIABLES,
		TermTypeGroups.GENE_EXPRESSION
	],
	geneExpression: [
		TermTypeGroups.SNP_LOCUS,
		TermTypeGroups.SNP_LIST,
		TermTypeGroups.MUTATION_CNV_FUSION,
		TermTypeGroups.DICTIONARY_VARIABLES,
		TermTypeGroups.METABOLITE_INTENSITY
	],
	numericDictTermCluster: [
		TermTypeGroups.SNP_LOCUS,
		TermTypeGroups.SNP_LIST,
		TermTypeGroups.MUTATION_CNV_FUSION,
		TermTypeGroups.GENE_EXPRESSION,
		TermTypeGroups.METABOLITE_INTENSITY,
		TermTypeGroups.SSGSEA
	]
}

export class TermTypeSearch {
	dom: any
	types: Array<string>
	app: any
	type: string
	tabs: {
		label: string // required by Tabs
		termTypeGroup: string // required for comparing
		contentHolder?: any // added by Tabs
		callback: (any) => void
	}[]
	state: any
	genomeObj: any
	handlerByType: Dict
	click_term: (term: Term) => void
	submit_lst?: (terms: Array<Term>) => void
	useCasesExcluded: {
		[useCaseTarget: string]: string[]
	}

	constructor(opts) {
		this.type = 'termTypeSearch'
		this.genomeObj = opts.genome
		this.click_term = opts.click_term
		this.submit_lst = opts.submit_lst
		const selectedTermsDiv = opts.topbar
			.append('div')
			.append('div')
			.style('width', '99%')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('gap', '5px')
			.style('min-height', '20px')
			.style('border', 'solid 1px #aaa')
			.style('margin', '10px 0px')
			.style('padding', '6px 2px')
			.style('min-height', '30px')
		this.types = []
		this.tabs = []
		this.handlerByType = {}
		this.dom = { holder: opts.holder, topbar: opts.topbar, selectedTermsDiv, submitDiv: opts.submitDiv }
		// do not overwrite the original copy; may apply overrides in init()
		this.useCasesExcluded = structuredClone(useCasesExcluded)
	}

	async init(appState) {
		this.types = this.app.vocabApi.termdbConfig?.allowedTermTypes || ['categorical'] //if no types it is a custom vocab for testing
		if (!this.types) return

		if (this.app.vocabApi.termdbConfig?.useCasesExcluded)
			Object.assign(this.useCasesExcluded, this.app.vocabApi.termdbConfig?.useCasesExcluded)

		const state = this.getState(appState)
		await this.addTabsAllowed(state)
		if (this.submit_lst) {
			//multiple terms can be selected
			this.dom.clearbt = this.dom.submitDiv
				.append('button')
				.style('margin-left', '5px')
				.text('Clear')
				.on('click', () => this.selectTerms([]))
		}

		if (this.tabs.length == 0) throw 'No term types allowed for this use case'
		this.app.dispatch({ type: 'set_term_type_group', value: this.tabs[0].termTypeGroup })

		if (this.tabs.length == 1 && this.tabs[0].termTypeGroup == TermTypeGroups.DICTIONARY_VARIABLES) return

		new Tabs({
			holder: this.dom.holder,
			tabsPosition: 'vertical',
			linePosition: 'right',
			tabs: this.tabs
		}).main()

		for (const t of this.tabs) {
			const holder = t.contentHolder.style('padding-left', '20px')
			holder.append('div')
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('submenu_')) return true //may change tree visibility
		if (action.type == 'set_term_type_group') return true
		if (action.type == 'app_refresh') return true
	}

	main() {
		this.dom.holder.style('display', this.state.isVisible ? 'inline-block' : 'none')
		this.dom.topbar.style('display', this.state.isVisible ? 'inline-block' : 'none')
		if (this.submit_lst) {
			this.renderTermsSelected()
			this.dom.selectedTermsDiv.style('display', this.state.selectedTerms.length > 0 ? 'inline-block' : 'none')
		} else this.dom.selectedTermsDiv.style('display', 'none')
		this.renderTermsSelected()
		if (this.dom.clearbt) this.dom.clearbt.property('disabled', this.state.selectedTerms.length == 0)
	}

	renderTermsSelected() {
		this.dom.selectedTermsDiv.selectAll('*').remove()
		this.dom.selectedTermsDiv
			.selectAll('div')
			.data(this.state.selectedTerms)
			.enter()
			.append('div')
			.attr('aria-label', 'Click to delete')
			.attr('class', 'sja_menuoption')
			.attr('tabindex', 0)
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('padding', '5px 16px 5px 9px')
			.style('margin-left', '5px')
			.each(renderTerm)
			.on('click', (e, t) => this.deleteTerm(e, t))
			.on('mouseover', function (event) {
				const deleteSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-x-lg" viewBox="0 0 16 16">
				<path stroke='#f00' d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
				</svg>`
				const div = select(event.target)
				div
					.append('div')
					.style('margin-left', '4px')
					.classed('sjpp_deletebt', true)
					.style('display', 'inline-block')
					.style('position', 'absolute')
					.style('right', '0px')
					.style('top', '0px')

					.style('transform', 'scale(0.6)')
					.style('pointer-events', 'none')
					.html(deleteSvg)
			})
			.on('mouseout', function (event) {
				select(event.target).select('.sjpp_deletebt').remove()
			})

		function renderTerm(this: any, term) {
			const div = select(this).style('border-radius', '5px')
			div
				.insert('div')
				.style('display', 'inline-block')
				.html(term.gene || term.name)
		}
	}

	deleteTerm(e, t) {
		const i = this.state.selectedTerms.findIndex(term => term.name === t.name)
		if (i != -1) {
			const selectedTerms = [...this.state.selectedTerms]
			selectedTerms.splice(i, 1)
			this.app.dispatch({
				type: 'app_refresh',
				state: { selectedTerms }
			})
		}
	}

	getState(appState) {
		return {
			dslabel: appState.dslabel,
			termTypeGroup: appState.termTypeGroup,
			usecase: appState.tree.usecase,
			isVisible: !appState.submenu.term,
			selectedTerms: appState.selectedTerms,
			termfilter: appState.termfilter
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
				if (labels.length == 0) continue
				label = labels.join('/')
			}
			if (type == TermTypes.SNP_LIST || type == TermTypes.SNP_LOCUS) {
				// do not create tabs for snplst/snplocus terms as these
				// terms do not have termdb search handlers
				continue
			}

			if (termTypeGroup && !this.tabs.some(tab => tab.label == termTypeGroup)) {
				//regression snplst/snplocus cases will be handled when the search handler is added
				if (state.usecase.target == 'regression') {
					if (type == TermTypes.SNP) continue // same funcationality is covered by snplst/snplocus terms
					if (type == TermTypes.GENE_VARIANT && state.usecase.detail != 'independent') continue
				}

				if (state.usecase.target == 'sampleScatter') {
					if (state.usecase.detail == 'numeric' && !numericTypes.has(type)) continue
				}

				if (
					(state.usecase.target == 'survival' || state.usecase.target == 'cuminc') &&
					termTypeGroup != TermTypeGroups.DICTIONARY_VARIABLES
				) {
					if (state.usecase.detail == 'term') continue
				}

				if (state.usecase.target == 'dataDownload') {
					if (type == TermTypes.SNP) continue // same funcationality is covered by snplst/snplocus terms
				}

				if (state.usecase.target && this.useCasesExcluded[state.usecase.target]?.includes(termTypeGroup)) continue

				try {
					if (!this.usesDefaultSearch(termTypeGroup)) {
						const _ = await import(`./handlers/${type}.ts`)
						this.handlerByType[type] = await new _.SearchHandler()
						if (!this.handlerByType[type].init) throw 'init not implemented'
					}
					this.addLoadTopTerms(type)
				} catch (e) {
					throw `error with handler='./handlers/${type}.ts': ${e}`
				}
				this.tabs.push({ label, callback: () => this.setTermTypeGroup(type, termTypeGroup), termTypeGroup })
			}
		}
	}

	usesDefaultSearch(termTypeGroup) {
		return termTypeGroup == TermTypeGroups.DICTIONARY_VARIABLES || termTypeGroup == TermTypeGroups.METABOLITE_INTENSITY
	}

	async addLoadTopTerms(type) {
		if (type == TermTypes.METABOLITE_INTENSITY)
			//maybe later other types are supported
			this.dom.submitDiv
				.append('button')
				.style('margin-left', '5px')
				.text('Load top terms')
				.on('click', async () => {
					const args = {
						filter0: this.state.termfilter.filter0,
						filter: this.state.termfilter.filter,
						type
					}
					const result = await this.app.vocabApi.getTopTermsByType(args)
					this.selectTerms(result.terms)
				})
	}

	selectTerms(terms) {
		this.app.dispatch({
			type: 'app_refresh',
			state: {
				selectedTerms: terms
			}
		})
	}
	async setTermTypeGroup(type, termTypeGroup) {
		await this.app.dispatch({ type: 'set_term_type_group', value: termTypeGroup })
		const tab = this.tabs.find(tab => tab.termTypeGroup == termTypeGroup)
		if (!tab) return
		const holder = tab.contentHolder
		holder.selectAll('*').remove()

		if (
			tab.termTypeGroup != TermTypeGroups.DICTIONARY_VARIABLES &&
			tab.termTypeGroup != TermTypeGroups.METABOLITE_INTENSITY
		) {
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
		else if (this.submit_lst) {
			const t = term.term || term
			this.app.dispatch({
				type: 'app_refresh',
				state: {
					selectedTerms: [...this.state.selectedTerms, t]
				}
			})
		} else {
			this.app.dispatch({
				type: 'submenu_set',
				submenu: {
					type: 'tvs',
					term: term.term?.type == 'geneVariant' ? this.getDtTerm(term) : term
				}
			})
		}
	}

	// get child dt term from geneVariant term to use for tvs
	getDtTerm(tw) {
		if (tw.term.type != 'geneVariant') throw 'term.type is not geneVariant'
		if (tw.q.type != 'predefined-groupset') throw 'q.type must be predefined-groupset'
		const dtTerm = tw.term.childTerms[tw.q.predefined_groupset_idx]
		if (!dtTerm) throw 'dtTerm not found'
		return dtTerm
	}
}

export const TermTypeSearchInit = getCompInit(TermTypeSearch)
