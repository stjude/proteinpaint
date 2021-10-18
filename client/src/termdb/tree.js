import * as rx from '../common/rx.core'
import { select, selectAll, event } from 'd3-selection'
import { graphable } from '../common/termutils'
import { getNormalRoot } from '../common/filter'
import { isUsableTerm } from '../../shared/termdb.usecase'
import { termInfoInit } from './termInfo'

const childterm_indent = '25px'
export const root_ID = 'root'

// class names TODO they should be shared between test/tree.spec.js
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
root_ID

******************** constructor opts{}
.holder
.click_term()
.disable_terms[]


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

	*/
	constructor(opts) {
		this.type = 'tree'
		// set this.id, .app, .opts, .api
		rx.prepComponent(this, opts)
		this.dom = {
			holder: opts.holder,
			treeDiv: opts.holder.append('div')
		}

		// attach instance-specific methods via closure
		setInteractivity(this)
		setRenderers(this)

		// track plots by term ID separately from components,
		// since active plots is dependent on the active cohort
		this.plots = {}
		// this.components.plots will point to only the termIds
		// that are applicable to the active cohort
		this.components = { plots: {} }
		// for terms waiting for server response for children terms, transient, not state
		this.loadingTermSet = new Set()
		this.loadingPlotSet = new Set()
		this.termsByCohort = {}
	}

	reactsTo(action) {
		if (action.type.startsWith('tree_')) return true
		if (action.type.startsWith('filter_')) return true
		if (action.type.startsWith('plot_')) return true
		if (action.type.startsWith('cohort_')) return true
		if (action.type.startsWith('info_')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState) {
		const filter = getNormalRoot(appState.termfilter.filter)
		const state = {
			activeCohort: appState.activeCohort,
			expandedTermIds: appState.tree.expandedTermIds,
			visiblePlotIds: appState.tree.visiblePlotIds,
			termfilter: { filter },
			bar_click_menu: appState.bar_click_menu,
			// TODO: deprecate "exclude_types" in favor of "usecase"
			exclude_types: appState.tree.exclude_types,
			usecase: appState.tree.usecase,
			infos: appState.infos
		}
		// if cohort selection is enabled for the dataset, tree component needs to know which cohort is selected
		if (appState.termdbConfig.selectCohort) {
			state.toSelectCohort = true
			const choice = appState.termdbConfig.selectCohort.values[appState.activeCohort]
			if (choice) {
				// a selection has been made
				state.cohortValuelst = choice.keys
			}
		}
		return state
	}

	async main() {
		if (this.state.toSelectCohort) {
			// dataset requires a cohort to be selected
			if (!this.state.cohortValuelst) {
				// a selection has not been made; do not render tree
				return
			}
		}
		// refer to the current cohort's termsById
		this.termsById = this.getTermsById()
		const root = this.termsById[root_ID]
		root.terms = await this.requestTermRecursive(root)
		this.renderBranch(root, this.dom.treeDiv)

		await this.mayCreateNewPlots()

		for (const termId in this.plots) {
			if (termId in this.termsById) {
				if (!(termId in this.components.plots)) {
					this.components.plots[termId] = this.plots[termId]
				}
			} else if (termId in this.components.plots) {
				delete this.components.plots[termId]
			}
		}
	}

	getTermsById() {
		if (!(this.state.activeCohort in this.termsByCohort)) {
			this.termsByCohort[this.state.activeCohort] = {
				[root_ID]: {
					id: root_ID,
					__tree_isroot: true // must not delete this flag
				}
			}
		}
		return this.termsByCohort[this.state.activeCohort]
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
		const data = await this.app.vocabApi.getTermChildren(
			term,
			this.state.toSelectCohort ? this.state.cohortValuelst : null
		)
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
				const t0 = this.termsById[copy.id]
				if (t0 && t0.terms) {
					copy.terms = t0.terms
				}
			}
			this.termsById[copy.id] = copy
		}
		return terms
	}

	async mayCreateNewPlots() {
		const newPlots = {}
		for (const termId of this.state.visiblePlotIds) {
			if (!this.plots[termId]) {
				// assume that the values are promises
				newPlots[termId] = this.newPlot(this.termsById[termId])
			}
		}

		if (Object.keys(newPlots).length) {
			await Promise.all(Object.values(newPlots))
			for (const termId in newPlots) {
				this.plots[termId] = await newPlots[termId]
			}
		}
	}

	async newPlot(term) {
		const holder = select(
			this.dom.treeDiv
				.selectAll('.' + cls_termgraphdiv)
				.filter(t => t.id == term.id)
				.node()
		)
		const loading_div = holder
			.append('div')
			.text('Loading...')
			.style('margin', '3px')
			.style('opacity', 0.5)

		const _ = await import('./plot')
		return _.plotInit({
			app: this.app,
			id: term.id,
			holder: holder,
			term,
			callbacks: {
				// must use namespaced eventType otherwise will be rewritten..
				'postRender.viewbtn': plot => {
					this.loadingPlotSet.delete(term.id)
					if (loading_div) loading_div.remove()
					plot.on('postRender.viewbtn', null)
				}
			}
		})
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
		// add disabled terms to opts.disable_terms
		if (self.opts.disable_terms)
			term.terms.forEach(t => {
				if (t.disabled) self.opts.disable_terms.push(t.id)
			})
		self.included_terms = []
		self.child_terms = [] // Fix for issue 606: Missing reference for child_types.
		if (self.state.usecase) {
			for (const t of term.terms) {
				if (isUsableTerm(t, self.state.usecase)) {
					if (
						(!self.state.exclude_types ||
							t.included_types.filter(type => !self.state.exclude_types.includes(type)).length,
						t.child_types.filter(type => !self.state.exclude_types.includes(type)).length)
					) {
						self.included_terms.push(t)
						self.child_terms.push(t)
					}
				}
			}
		} else if (!self.state.exclude_types.length) {
			// TODO: deprecate exclude_types in favor or tree.usecase
			self.included_terms.push(...term.terms)
		} else {
			for (const t of term.terms) {
				if (t.included_types.filter(type => !self.state.exclude_types.includes(type)).length) {
					self.included_terms.push(t)
				}
				if (t.child_types.filter(type => !self.state.exclude_types.includes(type)).length) {
					self.child_terms.push(t) //Now term.child_types is accessible.
				}
			}
		}

		if (!(term.id in self.termsById) || !self.included_terms.length) {
			div.style('display', 'none')
			return
		}

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

		const divs = div.selectAll('.' + cls_termdiv).data(self.included_terms, self.bindKey)

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
		if (term.id in self.termsById && self.state.expandedTermIds.includes(term.id)) return
		select(this).style('display', 'none')
	}

	self.updateTerm = function(term) {
		const div = select(this)
		if (!(term.id in self.termsById)) {
			div.style('display', 'none')
			return
		}
		div.style('display', '')
		const isExpanded = self.state.expandedTermIds.includes(term.id)
		div.select('.' + cls_termbtn).text(isExpanded ? '-' : '+')
		// update other parts if needed, e.g. label
		div.select('.' + cls_termchilddiv).style('display', isExpanded ? 'block' : 'none')
		// when clicking a search term, it will focus on that term view
		// and hide other visible terms
		const plotIsVisible = self.state.visiblePlotIds.includes(term.id)
		div.select('.' + cls_termgraphdiv).style('display', plotIsVisible ? 'block' : 'none')
	}

	self.addTerm = async function(term) {
		const termIsDisabled = self.opts.disable_terms && self.opts.disable_terms.includes(term.id)

		const div = select(this)
			.attr('class', cls_termdiv)
			.style('margin', term.isleaf ? '' : '2px')
			.style('padding', '0px 5px')

		//When Add fields is clicked, new tab with field name and div created for data
		if (!term.isleaf && term.child_types) {
			div
				.append('div')
				.attr('class', 'sja_menuoption ' + cls_termbtn)
				.style('display', 'inline-block')
				.style('padding', '4px 9px')
				.style('font-family', 'courier')
				.text('+')
				// always allow show/hide children even this term is already in use
				.on('click', self.toggleTerm)
		}

		const labeldiv = div
			.append('div')
			.attr('class', cls_termlabel)
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('opacity', termIsDisabled ? 0.4 : null)
			.text(term.name)

		let infoIcon_div //Empty div for info icon if termInfoInit is called
		if (term.hashtmldetail) {
			infoIcon_div = div.append('div').style('display', 'inline-block')
		}
		if (graphable(term)) {
			if (self.opts.click_term) {
				if (termIsDisabled) {
					labeldiv
						.attr('class', 'sja_tree_click_term_disabled ' + cls_termlabel)
						.style('padding', '5px 8px')
						.style('margin', '1px 0px')
						.style('opacity', 0.4)
				} else if (!self.state.exclude_types.includes(term.type)) {
					labeldiv
						// need better css class
						.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term ' + cls_termlabel)
						.style('color', 'black')
						.style('padding', '5px 8px')
						.style('border-radius', '6px')
						.style('background-color', '#cfe2f3')
						.style('margin', '1px 0px')
						.style('cursor', 'default')
						.on('click', () => {
							self.opts.click_term(term)
						})
				}

				//show sample count for a term
				if (term.samplecount !== undefined) {
					div
						.append('div')
						.style('font-size', '.8em')
						.style('display', 'inline-block')
						.style('margin-left', '5px')
						.style('color', term.samplecount ? '#777' : '#ddd')
						.text('n=' + term.samplecount)
				}
			} else if (self.opts.set_custombtns) {
				self.opts.set_custombtns(term, div.append('div').style('display', 'inline-block'), termIsDisabled, cls_termview)
				// div.append('div').attr('class', cls_termgraphdiv)
			} else {
				// no modifier, show view button and graph div
				div
					.append('div')
					.attr('class', termIsDisabled ? '' : 'sja_menuoption ' + cls_termview)
					.style('display', 'inline-block')
					.style('border-radius', '5px')
					.style('margin-left', '20px')
					.style('font-size', '0.8em')
					.style('opacity', termIsDisabled ? 0.4 : 1)
					.text('VIEW')
					.on('click', termIsDisabled ? null : self.clickViewButton)

				div.append('div').attr('class', cls_termgraphdiv)
			}
		}
		//Creates the info icon and description div from termInfo.js
		if (term.hashtmldetail) {
			termInfoInit({
				vocabApi: self.app.vocabApi,
				icon_holder: infoIcon_div,
				content_holder: div.append('div'),
				id: term.id,
				state: { term }
			})
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
		/*
		when loading a plot for the first time,
		"plot_show" is fired to add the term id to state.plots{}
		then, tree.main() detects the plot is not a component, will call newPlot() to render it
		*/
		if (self.loadingPlotSet.has(term.id)) {
			// don't respond to repetitive clicking
			return
		}
		event.stopPropagation()
		event.preventDefault()
		if (!self.plots[term.id]) {
			// no plot component for this term yet, first time loading this plot
			self.loadingPlotSet.add(term.id)
		}
		const type = self.state.visiblePlotIds.includes(term.id) ? 'plot_hide' : 'plot_show'
		self.app.dispatch({ type, id: term.id, term })
	}
}
