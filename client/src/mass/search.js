import { getCompInit } from '../common/rx.core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch3, sayerror } from '../client'
import { debounce } from 'debounce'
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

class MassSearch {
	constructor(opts) {
		this.type = 'search'
		// currently postSearch is only used for testing
		this.customEvents = ['postSearch']
		setRenderers(this)
		setInteractivity(this)
	}

	async init(appState) {
		this.state = this.getState(appState)
		this.dom = { holder: this.opts.holder }
		this.initUI()
	}

	reactsTo(action) {
		return action.type.startsWith('search') || action.type.startsWith('cohort')
	}

	getState(appState) {
		console.log(44, appState)
		return {
			cohortStr:
				appState.activeCohort == -1 || !appState.termdbConfig.selectCohort
					? ''
					: appState.termdbConfig.selectCohort.values[appState.activeCohort].keys
							.slice()
							.sort()
							.join(','),
			search: appState.search
		}
	}

	async main() {
		// show/hide search input from the tree
		this.dom.holder.style('display', this.state.search.isVisible ? 'inline-block' : 'none')
	}

	async doSearch(str) {
		if (!str) {
			this.clear()
			this.bus.emit('postSearch', [])
			return
		}
		const data = await this.app.vocabApi.findTerm(str, this.state.cohortStr, this.state.exclude_types)
		if (!data.lst || data.lst.length == 0) {
			this.noResult()
		} else {
			// found terms
			this.showTerms(data)
		}
		this.bus.emit('postSearch', data)
	}
}

export const searchInit = getCompInit(MassSearch)

function setRenderers(self) {
	self.initUI = () => {
		self.dom.holder.style('display', self.search && self.search.isVisible == false ? 'none' : 'block')
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
		// add disabled terms to opts.disable_terms
		if (self.opts.disable_terms)
			data.lst.forEach(t => {
				if (t.disabled) self.opts.disable_terms.push(t.id)
			})
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
		const button = tr
			.append('td')
			.style('cursor', 'pointer')
			.text(term.name)
			.on('click', () => {
				console.log(129, term)
				self.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: term.type == 'survival' ? 'survival' : 'barchart',
						term: { id: term.id, term }
					}
				})
			})

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
