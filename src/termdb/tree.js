import * as rx from '../rx.core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch2 } from '../client'
import { plotInit, plotConfig } from './plot'
import { searchInit } from './search'

const childterm_indent = '25px'
export const root_ID = 'root'
// class names
const cls_termdiv = 'termdiv',
	cls_termchilddiv = 'termchilddiv',
	cls_termbtn = 'termbtn',
	cls_termview = 'termview',
	cls_termlabel = 'termlabel',
	cls_termgraphdiv = 'termgraphdiv'

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
- addPlot( term, holder, loading_div )
  add new plot by dispatching action
  also called when recreating tree from saved state
- plotActions( action )
  to deal with plot-related actions

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
term.__tree_isloading is added when a term is first clicked
  removed in this script when action finishes
term.__plot_isloading is added when loading plot for a term
  removed by plot postRender callback
these transient flags are created and removed only within this script, and not to be handled outside, to avoid confusion


******************* modifiers
< no modifier >
display all terms under a parent, just show name;
non-leaf terms will have a +/- button in the front
graphable terms will have a VIEW button at the back

< click_term >
display graphable terms as buttons for selecting, no VIEW button
as in selecting term2 in barchart

< ssid_barchart >
TODO

< barchart_selectbar >
TODO

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
		this.api = rx.getComponentApi(this)
		this.notifyComponents = rx.notifyComponents
		this.getComponents = rx.getComponents
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
			search: searchInit(app, { holder: this.dom.searchDiv }),
			plots: {}
		}

		// privately defined root term
		const _root = {
			id: root_ID,
			__tree_isroot: true // must not delete this flag
		}

		this.termsById = {}
		this.termsById[root_ID] = _root
		this.bus = new rx.Bus('tree', ['postInit', 'postNotify', 'postRender'], app.opts.callbacks, this.api)
		this.app
			.dispatch({
				type: 'tree_expand',
				termId: root_ID,
				term: _root,
				holder: this.dom.treeDiv
			})
			.then(() => {
				this.bus.emit('postInit')
				for (const termId in this.app.state().tree.plots) {
					this.addPlot(
						this.termsById[termId],
						this.dom.treeDiv.selectAll('.' + cls_termgraphdiv).filter(i => i.id == termId)
					)
				}
			})
	}

	reactsTo(action, acty) {
		if (acty[0] == 'tree' || acty[0] == 'filter' || acty[0] == 'search') return true
		if (acty[0] == 'plot') {
			if (action.type == 'plot_edit') return false
			return true
		}
	}

	async main(action = {}) {
		await this.main2(action)
		this.bus.emit('postRender')
	}

	async main2(action) {
		const t0 = action.type.split('_')[0]
		if (t0 == 'filter' || t0 == 'search') {
			await this.notifyComponents(action)
			return
		}
		if (t0 == 'plot') {
			this.plotActions(action)
			return
		}
		if (action.type == 'tree_update') {
			const root = this.termsById[root_ID]
			root.terms = await this.requestTerm(root)
			this.renderBranch(root, this.dom.treeDiv)
			return
		}
		const term = this.termsById[action.termId]
		if (!term.terms) {
			term.terms = await this.requestTerm(term)
			delete term.__tree_isloading
			if (action.loading_div) {
				action.loading_div.remove()
			}
		}
		this.renderBranch(term, action.holder, action.button)
		// for a tree modifier, will issue one query and update termsById{}, then renderBranch from root
	}

	async requestTerm(term) {
		const state = this.app.state()
		const lst = ['genome=' + state.genome + '&dslabel=' + state.dslabel]
		lst.push(term.__tree_isroot ? 'default_rootterm=1' : 'get_children=1&tid=' + term.id)
		// future: may add in tree modifier
		const data = await dofetch2('/termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			// do not throw exception; its children terms may have been filtered out
			return []
		}
		const terms = []
		for (const t of data.lst) {
			const copy = Object.assign({}, t)
			this.termsById[copy.id] = copy
			terms.push(copy)
			// rehydrate expanded terms as needed
			// fills in termsById, for recovering tree
			if (state.tree.expandedTerms.includes(copy.id)) {
				copy.terms = await this.requestTerm(copy)
			}
		}
		return terms
	}

	async plotActions(action) {
		if (action.type == 'plot_hide') {
			// no further actions needed
			return
		}
		const plot = this.components.plots[action.id]
		if (plot) {
			await plot.main(action)
			return
		}
		// generate new plot
		const newPlot = plotInit(this.app, {
			action,
			id: action.id,
			holder: action.holder,
			term: action.term,
			callbacks: {
				plot: {
					// must use namespaced eventType otherwise will be rewritten..
					'postRender.viewbtn': () => {
						// may be risky, if action.term is altered outside
						delete action.term.__plot_isloading
						if (action.loading_div) action.loading_div.remove()
					}
				}
			}
		})
		this.components.plots[action.id] = newPlot
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
		const expandedTerms = self.app.state().tree.expandedTerms
		if (!expandedTerms.includes(term.id)) {
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
			if (expandedTerms.includes(child.id)) {
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
		if (self.app.state().tree.expandedTerms.includes(term.id)) return
		select(this).style('display', 'none')
	}

	self.updateTerm = function(term) {
		const div = select(this)
		const isExpanded = self.app.state().tree.expandedTerms.includes(term.id)
		div.select('.' + cls_termbtn).text(isExpanded ? '-' : '+')
		// update other parts if needed, e.g. label
		div.select('.' + cls_termchilddiv).style('display', isExpanded ? 'block' : 'none')
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
					.attr('class', 'sja_menuoption ' + cls_termlabel)
					.style('border-radius', '5px')
					.style('padding', '5px 8px')
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

		const button = select(this)
		const holder = select(this.parentNode)
			.selectAll('.' + cls_termchilddiv)
			.filter(d => d.id === term.id)
		let loading_div
		if (!t0.terms) {
			// to load child term with request, guard against repetitive clicking
			if (term.__tree_isloading) return
			term.__tree_isloading = true
			loading_div = holder
				.append('div')
				.text('Loading...')
				.style('opacity', 0.5)
				.style('padding', '5px')
		}

		const expanded = self.app.state().tree.expandedTerms.includes(term.id)
		const type = expanded ? 'tree_collapse' : 'tree_expand'
		self.app.dispatch({ type, termId: term.id, term, holder, button, loading_div })
	}

	self.clickViewButton = function(term) {
		if (term.__plot_isloading) {
			// prevent multiple clicking while loading new plot
			return
		}
		event.stopPropagation()
		event.preventDefault()
		const holder = select(this.parentNode.getElementsByClassName(cls_termgraphdiv)[0])
		const plotConfig = self.app.state().tree.plots[term.id]
		if (plotConfig) {
			// plot already made
			holder.style('display', plotConfig.isVisible ? 'none' : 'block')
			const type = plotConfig.isVisible ? 'plot_hide' : 'plot_show'
			self.app.dispatch({ type, id: term.id, term })
			return
		}
		// add new plot
		term.__plot_isloading = true
		const loading_div = holder.append('div').text('Loading...')
		self.addPlot(term, holder, loading_div)
	}

	self.addPlot = (term, holder, loading_div) => {
		self.app.dispatch({
			type: 'plot_add',
			id: term.id,
			term,
			holder,
			loading_div,
			config: plotConfig({ term })
		})
	}
}

export function graphable(term) {
	// terms with a valid type supports graph
	return term.iscategorical || term.isinteger || term.isfloat || term.iscondition
}
