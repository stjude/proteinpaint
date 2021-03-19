import * as rx from '../common/rx.core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch3, sayerror } from '../client'
import { debounce } from 'debounce'
import { root_ID } from './tree'
import { plotConfig } from './plot'
import { graphable } from '../common/termutils'

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
	constructor(app, opts) {
		this.type = 'search'
		this.opts = opts
		this.api = rx.getComponentApi(this)
		this.app = app
		setRenderers(this)
		setInteractivity(this)
		this.dom = { holder: opts.holder }
		this.initUI()
		this.eventTypes = ['postInit', 'postRender', 'postSearch']
		// currently postSearch is only used for testing
	}

	reactsTo(action) {
		return action.type.startsWith('search') || action.type.startsWith('cohort')
	}

	getState(appState) {
		return {
			cohortStr:
				appState.activeCohort == -1 || !appState.termdbConfig.selectCohort
					? ''
					: appState.termdbConfig.selectCohort.values[appState.activeCohort].keys
							.slice()
							.sort()
							.join(','),
			expandedTermIds: appState.tree.expandedTermIds,
			plots: appState.tree.plots
		}
	}

	async doSearch(str) {
		if (!str) {
			this.clear()
			this.bus.emit('postSearch', [])
			return
		}
		const data = await this.app.vocabApi.findTerm(str, this.state.cohortStr)
		if (!data.lst || data.lst.length == 0) {
			this.noResult()
		} else {
			// found terms
			this.showTerms(data)
		}
		this.bus.emit('postSearch', data)
	}
}

export const searchInit = rx.getInitFxn(TermSearch)

function setRenderers(self) {
	self.initUI = () => {
		self.dom.input = self.dom.holder
			.style('text-align', 'center')
			.append('input')
			.attr('type', 'search')
			.attr('class', 'tree_search')
			.attr('placeholder', 'Search')
			.style('width', '180px')
			.style('display', 'block')
			.on('input', debounce(self.onInput, 300))

		self.dom.resultDiv = self.opts.resultsHolder ? self.opts.resultsHolder : self.dom.holder.append('div')
		self.dom.resultDiv
			.style('border-left', self.opts.resultsHolder ? '' : 'solid 1px rgb(133,182,225)')
			.style('margin', '0px 0px 10px 10px')
			.style('padding-left', '5px')
	}
	self.noResult = () => {
		self.clear()
		self.dom.resultDiv
			.append('div')
			.text('No match')
			.style('padding', '3px 3px 3px 0px')
			.style('opacity', 0.5)
	}
	self.showTerms = data => {
		self.clear()
		self.dom.resultDiv
			.append('table')
			.selectAll()
			.data(data.lst)
			.enter()
			.append('tr')
			.each(self.showTerm)
	}
	self.showTerm = function(term) {
		const tr = select(this)
		const button = tr.append('td').text(term.name)

		if (self.opts.click_term && graphable(term)) {
			// to click a graphable term, show as blue button
			if (self.opts.disable_terms && self.opts.disable_terms.includes(term.id)) {
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
					.attr('class', 'sja_filter_tag_btn sja_tree_click_term')
					.style('display', 'block')
					.style('color', 'black')
					.style('padding', '5px 8px')
					.style('border-radius', '6px')
					.style('background-color', '#cfe2f3')
					.style('margin', '1px 0px')
					.on('click', () => {
						self.opts.click_term(term)
						self.clear()
						self.dom.input.property('value', '')
					})
			}
		} else {
			// as regular button, click to expand tree
			button.attr('class', 'sja_menuoption').on('click', () => {
				self.clear()
				self.dom.input.property('value', '')
				const expandedTermIds = [root_ID]
				if (term.__ancestors) {
					expandedTermIds.push(...term.__ancestors)
				}
				const plots = self.app.getState().tree.plots
				if (graphable(term)) {
					self.app.dispatch({
						type: 'app_refresh',
						state: {
							tree: {
								expandedTermIds,
								visiblePlotIds: [term.id],
								plots: {
									[term.id]:
										term.id in plots ? JSON.parse(JSON.stringify(plots[term.id])) : plotConfig({ term: { term } })
								}
							}
						}
					})
				} else {
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
			.text((term.__ancestors || []).join(' > '))
			.style('opacity', 0.5)
			.style('font-size', '.7em')
	}
	self.clear = () => {
		self.dom.resultDiv.selectAll('*').remove()
	}
}

function setInteractivity(self) {
	self.onInput = async () => {
		const str = self.dom.input.property('value')
		// do not trim space from input so that 'age ' will not match with 'agent'
		try {
			//await self.main({ str })
			await self.doSearch(str)
		} catch (e) {
			self.clear()
			sayerror(self.dom.resultDiv, 'Error: ' + (e.message || e))
			if (e.stack) console.log(e.stack)
		}
	}
}
