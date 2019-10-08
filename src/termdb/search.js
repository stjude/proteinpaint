import * as rx from '../rx.core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch2 } from '../client'
import { debounce } from 'debounce'
import { graphable } from './tree'

// class names

/*
steps:
user input at <input> will call doSearch()
doSearch() lets app dispatch an action, type: search_
but the action will NOT update app state
app notifies all components with the action
only main() of the "search component" will responds to the action to perform querying and display result


< no modifier >
native in termdb tree
display found terms as regular-looking buttons
clicking will reform tree to only expand to reveal this term, and show its plot

< modifier_click_term >
display found terms as different-looking blue buttons;
clicking a term will run a callback with the term as argument


TODO
allow to search categories, e.g. hodgkin lymphoma from diaggrp, how to act upon clicking?

 */

class TermSearch {
	/*
	 */
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app

		setRenderers(this)
		setInteractivity(this)
		this.dom = { holder: opts.holder }
		this.initUI()
		this.bus = new rx.Bus('search', ['postInit'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'search') return true
	}

	async main(action) {
		const state = this.app.state()
		const lst = ['genome=' + state.genome, 'dslabel=' + state.dslabel, 'findterm=' + encodeURIComponent(action.str)]
		const data = await dofetch2('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			this.noResult()
			return
		}
		// found terms
		/*
		if(state.modifier_click_term) {
			this.showTermsForSelect(data.lst)
			return
		}
		*/
		// display terms with view and tree button
		this.showTerms(data.lst)
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
			.on('input', debounce(self.doSearch, 300))
		self.dom.resultDiv = self.dom.holder
			.append('div')
			.style('border-left', 'solid 1px rgb(133,182,225)')
			.style('margin', '0px 0px 10px 10px')
			.style('padding-left', '10px')
	}
	self.noResult = () => {
		self.clear()
		self.dom.resultDiv
			.append('div')
			.text('No match')
			.style('padding', '3px 3px 3px 0px')
			.style('opacity', 0.5)
	}
	self.showTermsForSelect = terms => {
		// show terms as buttons, upon clicking, may ask app to emit 'gotTerm', possible?
		self.dom.resultDiv
			.selectAll()
			.data(terms)
			.enter()
			.append('div')
			.attr('sja_menuoption')
			.text(d => d.name)
			.on('click', self.selectTerm)
	}
	self.showTerms = terms => {
		self.clear()
		const tr = self.dom.resultDiv
			.append('table')
			.selectAll()
			.data(terms)
			.enter()
			.append('tr')
			.attr('class', 'sja_tr2')
		tr.append('td')
			.text(d => d.name)
			.style('opacity', 0.5)
		tr.append('td')
			.filter(d => graphable(d))
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('VIEW')
			.style('zoom', 0.8)
			.on('click', self.showplot)
		tr.append('td')
			.append('span')
			.text('TREE')
			.style('font-size', '.8em')
			.style('class', 'sja_clbtext')
			.on('click', self.viewInTree)
	}
	self.clear = () => {
		self.dom.resultDiv.selectAll('*').remove()
	}
}

function setInteractivity(self) {
	self.doSearch = () => {
		const str = self.dom.input.property('value')
		// do not trim space from input so that 'age ' will not match with 'agent'
		if (str == ' ' || str == '') {
			self.clear()
			return
		}
		self.app.dispatch({ type: 'search_', str })
	}
	self.selectTerm = term => {
		console.log('selected', term)
	}
	self.showplot = () => {}
	self.viewInTree = () => {}
}
