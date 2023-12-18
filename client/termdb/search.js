import { getCompInit } from '#rx'
import { select, selectAll } from 'd3-selection'
import { sayerror } from '../dom/sayerror.ts'
import { debounce } from 'debounce'
import { root_ID } from './tree'
import { isUsableTerm, nonDictionaryTermTypes } from '#shared/termdb.usecase'
import { keyupEnter } from '#src/client'

/*
steps:
user input at <input> will call doSearch()
doSearch() lets app dispatch an action, type: search_
but the action will NOT update app state
app notifies all components with the action
only main() of the "search component" will responds to the action to perform querying and display result

opts{}
.holder
.click_term()
.disable_terms[]

TODO
allow to search categories, e.g. hodgkin lymphoma from diaggrp, how to act upon clicking?

 */

class TermSearch {
	constructor(opts) {
		this.type = 'search'
		// currently postSearch is only used for testing
		this.customEvents = ['postSearch']
		// set this.id, .app, .opts, .api
		setRenderers(this)
		setInteractivity(this)
		this.dom = { holder: opts.holder }

		this.isVisible = 'isVisible' in opts ? opts.isVisible : true
	}

	async init(appState) {
		this.initUI(this.getState(appState))
	}

	reactsTo(action) {
		if (action.type == 'app_refresh') return true
		const prefix = action.type.split('_')[0]
		return ['search', 'cohort', 'submenu'].includes(prefix)
	}

	getState(appState) {
		return {
			isVisible: !appState.submenu.term && this.isVisible,
			cohortStr:
				appState.activeCohort == -1 || !appState.termdbConfig.selectCohort
					? ''
					: appState.termdbConfig.selectCohort.values[appState.activeCohort].keys.slice().sort().join(','),
			allowedTermTypes: appState.termdbConfig.allowedTermTypes || [],
			expandedTermIds: appState.tree.expandedTermIds,
			selectedTerms: appState.selectedTerms,
			usecase: appState.tree.usecase,
			search: appState.search,
			isGeneSetTermdb: appState.termdbConfig.isGeneSetTermdb
		}
	}

	async main() {
		// show/hide search input from the tree
		this.dom.holder.style('display', this.state.isVisible ? 'block' : 'none')
		this.renderSelectedNonDictTerms()
	}

	// targetType optional, see vocab.findTerm()
	async doSearch(str, targetType) {
		if (!str) {
			this.clear()
			this.bus.emit('postSearch', [])
			return
		}
		const data = await this.app.vocabApi.findTerm(str, this.state.cohortStr, this.state.usecase, targetType)
		if (!data.lst || data.lst.length == 0) {
			this.noResult()
		} else {
			// found terms
			this.showTerms(data)
		}
		this.bus.emit('postSearch', data)
	}
}

export const searchInit = getCompInit(TermSearch)

function setRenderers(self) {
	self.initUI = state => {
		self.dom.holder.style('display', self.search && self.search.isVisible == false ? 'none' : 'block')

		self.dom.input = self.dom.holder
			.style('text-align', 'left')
			.append('input')
			.attr('type', 'search')
			.attr('class', 'tree_search')
			.attr('placeholder', 'Search' + self.getPrompt(state))
			.style('width', '220px')
			.style('margin', '10px')
			.style('display', 'block')
			.on('input', debounce(self.onInput, 300))
			.on('keyup', self.onKeyup)

		self.dom.input.node().focus()

		// a holder to contain two side-by-side divs for genes and dictionary term hits
		self.dom.resultDiv = (self.opts.resultsHolder || self.dom.holder)
			.append('div')
			.style('display', 'none')
			//div is hidden when no results to show, since an empty grid holder occupies white space and increase the distance between search box and tree
			// when showing, turn to "inline-grid", but not "grid", to show up nicely
			.style('grid-template-columns', 'auto auto')

		// left div to show gene hits
		const div_gene = self.dom.resultDiv.append('div')
		// right div to show term hits
		const div_term = self.dom.resultDiv.append('div')

		self.dom.resultDiv_genes = div_gene
			.append('div')
			.style('border-left', 'solid 1px rgb(133,182,225)')
			.style('margin', '0px 0px 10px 10px')
			.style('padding-left', '5px')
		self.dom.resultDiv_terms = div_term
			.append('div')
			.style('border-left', self.opts.resultsHolder ? '' : 'solid 1px rgb(133,182,225)')
			.style('margin', '0px 0px 10px 10px')
			.style('padding-left', '5px')

		self.dom.nonDictDiv = self.dom.holder.append('div').style('margin', '0px 0px 10px 10px').style('display', 'none')

		self.dom.nonDictDiv.append('div').style('font-weight', 600).html('Selected genes')
		self.dom.selectedNonDictDiv = self.dom.nonDictDiv.append('div')
	}

	self.getPrompt = state => {
		/* term search prompt is decided by two factors:
		1. if the term type exists in allowedTermTypes from the dataset
		   e.g. if geneVariant type does not exist in the dataset, do not show prompt (and no need to check usecase)
		2. termdb client app usecase, defines the context for using terms selected from the termdb app
		   e.g. if the usecase context does not allow geneVariant, even if geneVariant exists in ds, do not show "gene" in prompt
		*/
		const mayUseGeneVariant =
			state.allowedTermTypes.includes('geneVariant') && isUsableTerm({ type: 'geneVariant' }, state.usecase).has('plot')

		if (mayUseGeneVariant) return ' variables or genes' // if true, it should be "variables" but not gene set
		if (state.isGeneSetTermdb) return ' gene sets'
		return ' variables'
	}

	self.noResult = () => {
		self.clear()
		self.dom.resultDiv.style('display', 'inline-grid')
		self.dom.resultDiv_terms
			.append('div')
			.style('padding', '3px 3px 3px 0px')
			.style('opacity', 0.5)
			.text(
				'No match' + (self.app.vocabApi.termdbConfig?.queries?.snvindel?.allowSNPs ? '. Press ENTER to search SNP' : '')
			)
	}
	self.showTerms = data => {
		// add disabled terms to opts.disable_terms
		if (self.opts.disable_terms) {
			data.lst.forEach(t => {
				if (t.disabled) self.opts.disable_terms.push(t.id)
			})
		}
		self.clear()
		self.dom.resultDiv.style('display', 'inline-grid')

		const geneTerms = [],
			dictTerms = []
		for (const t of data.lst) {
			if (t.type == 'geneVariant') {
				geneTerms.push(t)
			} else {
				dictTerms.push(t)
			}
		}

		if (geneTerms.length) {
			self.dom.resultDiv_genes.append('table').selectAll().data(geneTerms).enter().append('tr').each(self.showTerm)
		}

		if (dictTerms.length) {
			self.dom.resultDiv_terms.append('table').selectAll().data(dictTerms).enter().append('tr').each(self.showTerm)
		}
	}
	self.showTerm = function (term) {
		const tr = select(this)
		const button = tr.append('td').text(term.name)
		const uses = isUsableTerm(term, self.state.usecase)

		/*
		below, both callbacks are made in app.js validateOpts()
		1. self.opts.click_term() is for selecting to tvs
		2. self.app.opts.tree.click_term_wrapper() is a wrapper for opts.tree.click_term()
		*/
		if ((self.opts.click_term || self.app.opts?.tree?.click_term_wrapper) && uses.has('plot')) {
			// to click a graphable term, show as blue button
			if ('id' in term && self.opts.disable_terms?.includes(term.id)) {
				// but it's disabled
				button
					.attr('class', 'sja_tree_click_term_disabled')
					.style('display', 'block')
					.style('padding', '5px 8px')
					.style('margin', '1px 0px')
					.style('opacity', 0.4)
			} else {
				// clickable button
				button
					.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
					.style('display', 'block')
					.style('color', 'black')
					.style('padding', '5px 8px')
					.style('border-radius', '6px')
					.style('background-color', term.type == 'geneVariant' ? 'rgba(251,171,96,0.5)' : '#cfe2f3')
					.style('margin', '1px 0px')
					.style('cursor', 'default')
					.on('click', () => {
						if (self.opts.click_term) {
							self.opts.click_term(term)
						} else {
							self.app.opts.tree.click_term_wrapper(term)
						}
						self.clear()
						self.dom.input.property('value', '')
					})
			}
			//show sample count for a term
			if (term.samplecount !== undefined) {
				tr.append('td')
					.append('div')
					.style('font-size', '.8em')
					.style('display', 'inline-block')
					.style('margin-left', '5px')
					.style('color', term.samplecount ? '#777' : '#ddd')
					.text('n=' + term.samplecount)
			}
		} else {
			// as regular button, click to expand tree
			button.attr('class', 'sja_menuoption').on('click', () => {
				self.clear()
				self.dom.input.property('value', '')
				const expandedTermIds = [root_ID]

				if (term.type == 'geneVariant' && self.opts.handleGeneVariant) {
					self.opts.handleGeneVariant(term)
				} else if (nonDictionaryTermTypes.has(term.type)) {
					self.app.dispatch({
						type: 'app_refresh',
						state: {
							selectedTerms: [...self.state.selectedTerms, term]
						}
					})
				} else {
					if (term.__ancestors) {
						expandedTermIds.push(...term.__ancestors)
					}
					// pre-expand non-selectable parent term
					if (!self.app.vocabApi.graphable(term)) expandedTermIds.push(term.id)
					self.app.dispatch({
						type: 'app_refresh',
						state: {
							tree: { expandedTermIds }
						}
					})
				}
			})
		}
		tr.append('td')
			.text(term.type == 'geneVariant' ? 'gene variant' : (term.__ancestorNames || []).join(' > '))
			.style('opacity', 0.5)
			.style('font-size', '.7em')
	}
	self.clear = () => {
		self.dom.resultDiv_genes.selectAll('*').remove()
		self.dom.resultDiv_terms.selectAll('*').remove()
		self.dom.resultDiv.style('display', 'none')
	}

	self.renderSelectedNonDictTerms = function () {
		// this is to show selected genes during multi-selection
		// FIXME no way to unselect a gene here
		const lst = self.state.selectedTerms.filter(t => nonDictionaryTermTypes.has(t.type))
		self.dom.nonDictDiv.style('display', lst.length ? '' : 'none')

		const genes = self.dom.selectedNonDictDiv.selectAll('div').data(lst, d => d.name)

		genes.exit().remove()
		genes
			.enter()
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '1px')
			.style('padding', '5px 8px')
			.style('background-color', 'rgba(255, 194, 10,0.5)')
			.style('border-radius', '6px')
			.html(d => d.name)
		/*.each(function(){
				const div = select(this)
				div.append('')
			})*/
	}
}

function setInteractivity(self) {
	self.onKeyup = event => {
		// to search snp upon hitting enter
		if (!keyupEnter(event)) return // not pressing enter
		if (!self.app.vocabApi.termdbConfig?.queries?.snvindel?.allowSNPs) return // snp search not enabled on this ds
		self.onInput(event, 'snp') // targetType=snp
	}

	self.onInput = async (event, targetType) => {
		const str = self.dom.input.property('value')
		// do not trim space from input so that 'age ' will not match with 'agent'
		try {
			//await self.main({ str })
			await self.doSearch(str, targetType)
		} catch (e) {
			self.clear()
			self.dom.resultDiv.style('display', 'inline-grid')
			sayerror(self.dom.resultDiv_terms, 'Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
	}
}
