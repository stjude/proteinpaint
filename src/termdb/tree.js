import * as rx from '../rx/core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch2 } from '../client'
import { plotInit } from './plot'
import { searchInit } from './search'

const childterm_indent = '25px'
export const root_ID = 'root'
// class names
const cls_termdiv = 'termdiv',
	cls_termchilddiv = 'termchilddiv',
	cls_termbtn = 'termbtn',
	cls_termview = 'termview',
	cls_termlabel = 'termlabel',
	cls_termgraphdiv = 'termgraphdiv',
	cls_termloading = 'termloading'

/*
******************** EXPORTED
treeInit()
graphable()
root_ID

******************** Plot
separate functions are designed to handle different things so that logic won't mix
- clickViewButton( term )
  called by clicking button, will toggle graph div visibility
  setup measures to prevent multi-clicking
- newPlot(term)

******************** exit/update/enter
termsById{} is bound to the DOM tree, to provide:
- term label
- list of children terms for a parent term

may implement tree modifiers for:
- alter the term labels by adding n=?
- may cause to hide certain terms

any change of modifier should update termsById first, then call renderBranch() at the root term to update the current tree

******************* special flags
root term does not exist in the termdb, but is synthesized upon initializing instance, has the "__tree_isroot" flag



******************* Recommended Component Code Organization

(a) class (produces instance):
- all methods expected by rx.api (main, etc)
- all data processing code
(b) setRenderers(self): attaches renderer methods
(c) setInteractivity(self): attaches event handlers

*/

class TdbTree {
	/*
	Termdb Tree Component
	- api-related and data processing code
	  within this class declaration 

	opts: {
		holder,
		callbacks, // see bus below
		modifiers
	}
	*/
	constructor(app, opts) {
		this.type = 'tree'
		this.api = rx.getComponentApi(this)
		this.app = app
		this.modifiers = opts.modifiers
		this.dom = {
			holder: opts.holder,
			searchDiv: opts.holder.append('div').style('margin', '10px'),
			treeDiv: opts.holder.append('div')
		}

		// attach instance-specific methods via closure
		setRenderers(this)
		setInteractivity(this)

		this.components = {
			search: searchInit(app, {
				holder: this.dom.searchDiv,
				modifiers: opts.modifiers
			}),
			plots: {}
		}

		// privately defined root term
		const _root = {
			id: root_ID,
			__tree_isroot: true // must not delete this flag
		}

		// for terms waiting for server response for children terms, transient, not state
		this.loadingTermSet = new Set()
		this.loadingPlotSet = new Set()

		this.termsById = {}
		this.termsById[root_ID] = _root
		this.bus = new rx.Bus('tree', ['postInit', 'postNotify', 'postRender'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	async main() {
		const root = this.termsById[root_ID]
		root.terms = await this.requestTermRecursive(root)
		this.renderBranch(root, this.dom.treeDiv)

		let updatePlotsState = false
		for (const termId of this.state.visiblePlotIds) {
			if (!this.components.plots[termId]) {
				// rehydrate here when the term information is available,
				// in constructor the termsById are not filled in yet
				await this.app.save({ type: 'plot_rehydrate', id: termId, config: { term: this.termsById[termId] } })
				this.newPlot(this.termsById[termId])
				updatePlotsState = true
			}
		}
		if (updatePlotsState) this.state = this.app.getState(this.api)
	}

	async requestTermRecursive(term) {
		/* will request child terms for this entire branch recursively

		must synthesize request string (dataName) for every call
		and get cached result for the same dataName which has been requested before
		this is to support future features
		e.g. to show number of samples for each term that can change based on filters
		where the same child terms already loaded must be re-requested with the updated filter parameters to update

		TODO determine when to re-request cached server response as needed

		CAUTION
		will be great if tree_collapse will not trigger this function
		but hard to do given that main() has no way of telling what action was dispatched
		to prevent previously loaded .terms[] for the collapsing term from been wiped out of termsById,
		need to add it back TERMS_ADD_BACK
		*/
		const lst = ['genome=' + this.state.genome + '&dslabel=' + this.state.dslabel]
		lst.push(term.__tree_isroot ? 'default_rootterm=1' : 'get_children=1&tid=' + term.id)
		const data = await dofetch2('/termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			// do not throw exception; its children terms may have been filtered out
			return []
		}
		const terms = []
		for (const t of data.lst) {
			const copy = Object.assign({}, t)
			terms.push(copy)
			// rehydrate expanded terms as needed
			// fills in termsById, for recovering tree
			if (this.state.expandedTermIds.includes(copy.id)) {
				copy.terms = await this.requestTermRecursive(copy)
			} else {
				// not an expanded term
				// if it's collapsing this term, must add back its children terms for toggle button to work
				// see flag TERMS_ADD_BACK
				if (this.termsById[copy.id]) {
					copy.terms = this.termsById[copy.id].terms
				}
			}
			this.termsById[copy.id] = copy
		}
		return terms
	}

	newPlot(term) {
		const holder = select(
			this.dom.treeDiv
				.selectAll('.' + cls_termgraphdiv)
				.filter(t => t.id == term.id)
				.node()
		)
		const loading_div = holder
			.append('div')
			.attr('class', cls_termloading)
			.text('Loading...')
		const plot = plotInit(this.app, {
			id: term.id,
			holder: holder,
			term: term,
			modifiers: this.modifiers,
			callbacks: {
				plot: {
					// must use namespaced eventType otherwise will be rewritten..
					'postRender.viewbtn': plot => {
						this.loadingPlotSet.delete(term.id)
						if (loading_div) loading_div.remove()
						plot.on('postRender.viewbtn', null)
					}
				}
			}
		})
		this.components.plots[term.id] = plot
	}

	bindKey(term) {
		return term.id
	}
}

export const treeInit = rx.getInitFxn(TdbTree)

function setRenderers(self) {
	/*
		Set static renderer code here for HTML, SVGs, etc 

		Closured reference to object instance as self
		versus alternative "this" context such as DOM element

		self: a TdbTree instance
	*/
	// !!! no free-floating variable declarations here !!!
	// set properties within the class declarations

	self.renderBranch = (term, div, button) => {
		/*
		term must be from termsById
		div is the childdiv of this term
		button, optional, the toggle button
		*/
		if (!term || !term.terms) return
		if (!(term.id in self.termsById)) return

		if (self.loadingTermSet.has(term.id)) {
			self.loadingTermSet.delete(term.id)
			div.select('.' + cls_termloading).remove()
		}

		const expandedTermIds = self.state.expandedTermIds
		if (!expandedTermIds.includes(term.id)) {
			div.style('display', 'none')
			if (button) button.text('+')
			return
		}
		div.style('display', 'block')
		if (button) button.text('-')

		const childTermIds = new Set(term.terms.map(self.bindKey))
		const divs = div
			.selectAll('.' + cls_termdiv)
			.filter(t => childTermIds.has(t.id))
			.data(term.terms, self.bindKey)

		divs.exit().each(self.hideTerm)

		divs.each(self.updateTerm)

		divs
			.enter()
			.append('div')
			.each(self.addTerm)

		for (const child of term.terms) {
			if (expandedTermIds.includes(child.id)) {
				self.renderBranch(
					child,
					div.selectAll('.' + cls_termchilddiv).filter(i => i.id == child.id),
					div.selectAll('.' + cls_termbtn).filter(i => i.id == child.id)
				)
			}
		}
	}

	// this == the d3 selected DOM node
	self.hideTerm = function(term) {
		if (self.tree.expandedTermIds.includes(term.id)) return
		select(this).style('display', 'none')
	}

	self.updateTerm = function(term) {
		const div = select(this)
		const isExpanded = self.state.expandedTermIds.includes(term.id)
		div.select('.' + cls_termbtn).text(isExpanded ? '-' : '+')
		// update other parts if needed, e.g. label
		div.select('.' + cls_termchilddiv).style('display', isExpanded ? 'block' : 'none')
		// when clicking a search term, it will focus on that term view
		// and hide other visible terms
		const plotIsVisible = self.state.visiblePlotIds.includes(term.id)
		div.select('.' + cls_termgraphdiv).style('display', plotIsVisible ? 'block' : 'none')
	}

	self.addTerm = function(term) {
		const div = select(this)
			.attr('class', cls_termdiv)
			.style('margin', term.isleaf ? '' : '2px')
			.style('padding', '0px 5px')

		if (!term.isleaf) {
			div
				.append('div')
				.attr('class', 'sja_menuoption ' + cls_termbtn)
				.style('display', 'inline-block')
				.style('padding', '4px 9px')
				.style('font-family', 'courier')
				.text('+')
				.on('click', self.toggleTerm)
		}

		const labeldiv = div
			.append('div')
			.attr('class', cls_termlabel)
			.style('display', 'inline-block')
			.style('padding', '5px')
			.text(term.name)

		if (graphable(term)) {
			if (self.modifiers.click_term) {
				labeldiv
					// need better css class
					.attr('class', 'sja_filter_tag_btn add_term_btn ' + cls_termlabel)
					.style('padding', '5px 8px')
					.style('border-radius', '6px')
					.style('background-color', '#4888BF')
					.style('margin', '1px 0px')
					.on('click', () => {
						self.modifiers.click_term(term)
					})
			} else {
				// no modifier, show view button and graph div
				div
					.append('div')
					.attr('class', 'sja_menuoption ' + cls_termview)
					.style('display', 'inline-block')
					.style('border-radius', '5px')
					.style('margin-left', '20px')
					.style('font-size', '0.8em')
					.text('VIEW')
					.on('click', self.clickViewButton)

				div.append('div').attr('class', cls_termgraphdiv)
			}
		}

		if (!term.isleaf) {
			div
				.append('div')
				.attr('class', cls_termchilddiv)
				.style('padding-left', childterm_indent)
		}
	}
}

function setInteractivity(self) {
	/*
		Set interactivity code here, for mouseovers, clicks, etc.

		Closured reference to object instance as self
		versus alternative "this" context such as DOM element

		self: a TdbTree instance
	*/
	// !!! no free-floating variable declarations here !!!
	// use self in TdbTree constructor to create properties

	self.toggleTerm = function(term) {
		event.stopPropagation()
		if (term.isleaf) return
		const t0 = self.termsById[term.id]
		if (!t0) throw 'invalid term id'

		if (!t0.terms) {
			// to load child term with request, guard against repetitive clicking
			// TERMS_ADD_BACK
			// this requires .terms[] to be added back when updated by requestTermRecursive()
			if (self.loadingTermSet.has(t0.id)) return
			self.loadingTermSet.add(t0.id)
			select(this.parentNode)
				.selectAll('.' + cls_termchilddiv)
				.filter(d => d.id === t0.id)
				.style('display', 'block')
				.append('div')
				.text('Loading...')
				.attr('class', cls_termloading)
				.style('opacity', 0.5)
				.style('padding', '5px')
		}

		const expanded = self.state.expandedTermIds.includes(term.id)
		const type = expanded ? 'tree_collapse' : 'tree_expand'
		self.app.dispatch({ type, termId: term.id })
	}

	self.clickViewButton = function(term) {
		if (self.loadingPlotSet.has(term.id)) {
			// don't respond to repetitive clicking
			return
		}
		event.stopPropagation()
		event.preventDefault()
		const isVisible = self.state.visiblePlotIds.includes(term.id)
		const holder = select(this.parentNode.getElementsByClassName(cls_termgraphdiv)[0])
		holder.style('display', isVisible ? 'none' : 'block')
		// plot_show is expected to also plot_add as needed
		const type = isVisible ? 'plot_hide' : 'plot_show'
		if (!self.components.plots[term.id]) self.loadingPlotSet.add(term.id)
		self.app.dispatch({ type, id: term.id, term })
	}
}

export function graphable(term) {
	// terms with a valid type supports graph
	return term.iscategorical || term.isinteger || term.isfloat || term.iscondition
}
