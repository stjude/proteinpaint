import * as rx from '../rx/core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch2, sayerror } from '../client'
import { debounce } from 'debounce'
import { graphable, root_ID } from './tree'
import { plotConfig } from './plot'

// class names

/*
steps:
user input at <input> will call doSearch()
doSearch() lets app dispatch an action, type: search_
but the action will NOT update app state
app notifies all components with the action
only main() of the "search component" will responds to the action to perform querying and display result


TODO
allow to search categories, e.g. hodgkin lymphoma from diaggrp, how to act upon clicking?

 */

class TermSearch {
	/*
	 */
	constructor(app, opts) {
		this.type = 'search'
		this.api = rx.getComponentApi(this)
		this.app = app
		this.state = Object.assign({}, app.getState(this.api))
		this.modifiers = opts.modifiers
		// see rx.core getComponentApi().main() on
		// how these key-values are used
		this.reactsTo = {
			prefix: ['search']
		}
		setRenderers(this)
		setInteractivity(this)
		this.dom = { holder: opts.holder }
		this.initUI()
		this.bus = new rx.Bus('search', ['postInit', 'postRender'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	async doSearch(str) {
		if (!str) {
			this.clear()
			return
		}
		const lst = ['genome=' + this.state.genome, 'dslabel=' + this.state.dslabel, 'findterm=' + encodeURIComponent(str)]
		const data = await dofetch2('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			this.noResult()
		} else {
			// found terms
			this.showTerms(data)
		}
		this.bus.emit('postRender')
	}
}

export const searchInit = rx.getInitFxn(TermSearch)

function setRenderers(self) {
	self.initUI = () => {
		self.dom.input = self.dom.holder
			.append('input')
			.attr('type', 'search')
			.attr('class', 'tree_search')
			.attr('placeholder', 'Search')
			.style('width', '120px')
			.style('display', 'block')
			.on('input', debounce(self.onInput, 300))
		self.dom.resultDiv = self.dom.holder
			.append('div')
			.style('border-left', 'solid 1px rgb(133,182,225)')
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
		if (self.modifiers.click_term && graphable(term)) {
			// has modifier and is graphable, show as blue button
			// click to feed to callback
			// improve css class
			button
				.attr('class', 'sja_filter_tag_btn add_term_btn')
				.style('display', 'block')
				.style('padding', '5px 8px')
				.style('border-radius', '6px')
				.style('background-color', '#4888BF')
				.style('margin', '1px 0px')
				.on('click', () => {
					self.modifiers.click_term(term)
				})
		} else {
			// as regular button, click to expand tree
			button.attr('class', 'sja_menuoption').on('click', () => {
				self.clear()
				const expandedTermIds = [root_ID]
				if (term.__ancestors) {
					expandedTermIds.push(...term.__ancestors)
				}

				if (graphable(term)) {
					self.app.dispatch({
						type: 'app_refresh',
						state: {
							tree: {
								expandedTermIds,
								plots: {
									[term.id]: plotConfig({ term })
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
	self.selectTerm = term => {
		console.log('selected', term)
	}
}
