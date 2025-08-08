import { getCompInit } from '#rx'
import { select, selectAll } from 'd3-selection'
import { sayerror } from '#dom'
import { debounce } from 'debounce'
import { root_ID } from './tree'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import { keyupEnter } from '#src/client'
import { TermTypeGroups, isNonDictionaryType, equals } from '#shared/terms.js'

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
		if (action.type == 'set_term_type_group') return true
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
			allowedTermTypes: appState.termdbConfig?.allowedTermTypes || [],
			expandedTermIds: appState.tree.expandedTermIds,
			selectedTerms: appState.selectedTerms,
			usecase: appState.tree.usecase,
			search: appState.search,
			isGeneSetTermdb: appState.termdbConfig.isGeneSetTermdb,
			termTypeGroup: appState.termTypeGroup
		}
	}

	isTermTypeSupported() {
		const termTypeGroup = this.state.termTypeGroup

		if (termTypeGroup == TermTypeGroups.DICTIONARY_VARIABLES) return true
		if (termTypeGroup == TermTypeGroups.METABOLITE_INTENSITY) return true

		return false
	}

	async main() {
		// show/hide search input from the tree
		if (!this.isTermTypeSupported()) {
			this.dom.holder.style('display', 'none') //These views will have their own UI
			return
		}
		this.dom.input.node().value = ''
		this.dom.input.attr('placeholder', 'Search ' + this.state.termTypeGroup)
		this.clear()
		this.dom.holder.style('display', this.state.isVisible ? 'block' : 'none')
	}

	// targetType optional, see vocab.findTerm()
	async doSearch(str) {
		if (!str || str.length < 3) {
			this.clear()
			this.bus.emit('postSearch', [])
			return
		}
		const data = await this.app.vocabApi.findTerm(
			str,
			this.state.cohortStr,
			this.state.usecase,
			this.state.termTypeGroup
		)
		this.currData = data
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

		const searchDiv = self.dom.holder.append('div').style('text-align', 'left')

		self.dom.input = searchDiv
			.append('input')
			.attr('type', 'search')
			.attr('class', 'tree_search')
			.style('width', '250px')
			.style('margin', '10px')
			.style('display', 'inline-block')
			.on('input', debounce(self.onInput, 300))
			.on('keyup', self.onKeyup)

		self.dom.resultCntDiv = searchDiv.append('div').style('display', 'none')

		if (self.opts.focus != 'off') self.dom.input.node().focus()

		/* a holder to contain two side-by-side divs 
		used to show genes on one side and dictionary term on another, but gene is no longer shown
		side-by-side holder is commented off but may be reused for new purpose
		*/
		self.dom.resultDiv = (self.opts.resultsHolder || self.dom.holder)
			.append('div')
			.attr('class', 'sjpp_show_scrollbar')
			.style('max-height', '35vh')
			.style('display', 'none')
			//div is hidden when no results to show, since an empty grid holder occupies white space and increase the distance between search box and tree
			// when showing, turn to "inline-grid", but not "grid", to show up nicely
			.style('grid-template-columns', 'auto auto')

		// left div to show gene hits
		//const div_gene = self.dom.resultDiv.append('div')
		// right div to show term hits
		const div_term = self.dom.resultDiv.append('div')

		/*
		self.dom.resultDiv_genes = div_gene
			.append('div')
			.style('border-left', 'solid 1px rgb(133,182,225)')
			.style('margin', '0px 0px 10px 10px')
			.style('padding-left', '5px')
			*/
		self.dom.resultDiv_terms = div_term
			.append('div')
			.style('border-left', self.opts.resultsHolder ? '' : 'solid 1px rgb(133,182,225)')
			.style('margin', '0px 0px 10px 10px')
			.style('padding-left', '5px')
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
				if (t.disabled) self.opts.disable_terms.push(t)
			})
		}
		self.clear()
		self.dom.resultDiv.style('display', 'inline-grid')

		if (data.lst.length) {
			self.dom.resultDiv_terms.append('table').selectAll().data(data.lst).enter().append('tr').each(self.showTerm)
			self.dom.resultCntDiv.style('display', 'inline-block').text(`${data.lst.length} results`)
		}

		self.focusableResults = [...self.dom.resultDiv.node().querySelectorAll('.sja_tree_click_term, .sja_menuoption')]
	}
	self.showTerm = function (term) {
		const tr = select(this)
		const button = tr.append('td').text(term.name)
		const uses = isUsableTerm(term, self.state.usecase, self.app.vocabApi.termdbConfig)
		/*
		below, both callbacks are made in app.js validateOpts()
		1. self.opts.click_term() is for selecting to tvs
		2. self.app.opts.tree.click_term_wrapper() is a wrapper for opts.tree.click_term()
		*/
		if ((self.opts.click_term || self.app.opts?.tree?.click_term_wrapper) && uses.has('plot')) {
			// to click a graphable term, show as blue button
			if (term && self.opts.disable_terms?.find(term2 => equals(term, term2))) {
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
					.attr('tabindex', 0)
					.style('display', 'block')
					.style('color', 'black')
					.style('padding', '5px 8px')
					.style('border-radius', '6px')
					.style('background-color', '#cfe2f3')
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
					.on('keyup', self.navInputValueByKeyboard)
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
			button
				.attr('class', 'sja_menuoption')
				.attr('tabindex', 0)
				.on('click', () => {
					self.clear()
					self.dom.input.property('value', '')
					const expandedTermIds = [root_ID]

					if (term.type && isNonDictionaryType(term.type)) {
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
				.on('keyup', self.navInputValueByKeyboard)
		}
		tr.append('td')
			.text((term.__ancestorNames || []).join(' > '))
			.style('opacity', 0.5)
			.style('font-size', '.7em')
	}
	self.clear = () => {
		//self.dom.resultDiv_genes.selectAll('*').remove()
		self.dom.resultDiv_terms.selectAll('*').remove()
		self.dom.resultDiv.style('display', 'none')
		self.dom.resultCntDiv.style('display', 'none')
	}
}

function setInteractivity(self) {
	self.onKeyup = event => {
		// to search snp upon hitting enter
		if (event.key == 'ArrowDown' && self.currData?.lst?.length) {
			self.dom.resultDiv.select('.sja_tree_click_term, .sja_menuoption').node().focus()
			return
		}
		if (!keyupEnter(event)) return // not pressing enter
		self.onInput(event)
	}

	self.onInput = async event => {
		const str = self.dom.input.property('value')
		// do not trim space from input so that 'age ' will not match with 'agent'
		try {
			//await self.main({ str })
			await self.doSearch(str)
		} catch (e) {
			self.clear()
			self.dom.resultDiv.style('display', 'inline-grid')
			sayerror(self.dom.resultDiv_terms, 'Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
	}

	self.navInputValueByKeyboard = event => {
		if (event.key == 'Enter') event.target.click()
		else if (event.key.startsWith('Arrow')) {
			const i = self.focusableResults.findIndex(r => r === event.target)
			if (event.key == 'ArrowDown') {
				if (i < self.focusableResults.length - 1) self.focusableResults[i + 1].focus()
				else self.focusableResults[0].focus()
			} else if (event.key == 'ArrowUp') {
				if (i != 0) self.focusableResults[i - 1].focus()
				else self.focusableResults[self.focusableResults.length - 1].focus()
			}
		}
	}
}
