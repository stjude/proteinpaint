import * as rx from '../rx.core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch2 } from '../client'
import { plotInit, plotConfig } from './plot'
import { searchInit } from './search'

const childterm_indent = '30px'
export const root_ID = 'root'
// class names
const cls_termdiv = 'termdiv',
	cls_termchilddiv = 'termchilddiv',
	cls_termbtn = 'termbtn',
	cls_termview = 'termview',
	cls_termlabel = 'termlabel',
	cls_termgraphdiv = 'termgraphdiv'

/*
Recommended Component Code Organization

(a) class (produces instance):
- all methods expected by rx.api (main, etc)
- all data processing code

(b) setRenderers(self): attaches renderer methods

(c) setInteractivity(self): attaches event handlers

******************** EXPORTED
treeInit()
graphable()
root_ID

********************
exit/update/enter
termsById{} is bound to the DOM tree, to provide:
- term label
- list of children terms for a parent term

may implement tree modifiers for:
- alter the term labels by adding n=?
- may cause to hide certain terms

any change of modifier should update termsById first, then call renderBranch() at the root term to update the current tree

*******************
special flags
root term does not exist in the termdb, but is synthesized upon initializing instance, has the "__tree_isroot" flag
"__tree_isloading" flag is added when a term is first clicked


*******************
< no modifier >
display all terms under a parent, just show name;
non-leaf terms will have a +/- button in the front
graphable terms will have a VIEW button at the back

< modifier_click_term >
display graphable terms as buttons, as in <search.js>
no VIEW button

< modifier_ssid_barchart >
todo

< modifier_barchart_selectbar >
todo

*/

class TdbTree {
	/*
	Termdb Tree Component
	- api-related and data processing code
	  within this class declaration 

	opts: {
		holder,
		callbacks // see bus below
	}
	*/
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.notifyComponents = rx.notifyComponents
		this.getComponents = rx.getComponents
		this.app = app
		this.dom = { holder: opts.holder }

		// attach instance-specific methods via closure
		setRenderers(this)
		setInteractivity(this)

		this.components = {
			search: searchInit(app, { holder: opts.holder }),
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
				holder: this.dom.holder
			})
			.then(() => {
				this.bus.emit('postInit')
				for (const termId in this.app.state().tree.plots) {
					this.togglePlot(this.termsById[termId])
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
			this.viewPlot(action)
			return
		}
		if (action.type == 'tree_update') {
			const root = this.termsById[root_ID]
			root.terms = await this.requestTerm(root)
			this.renderBranch(root, this.dom.holder)
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

	async viewPlot(action) {
		if (action.type == 'plot_hide') {
			action.holder.style('display', 'none')
			return
		}
		if (action.type == 'plot_show') {
			action.holder.style('display', 'block')
		}
		const plot = this.components.plots[action.id]
		if (plot) {
			await plot.main(action)
			return
		}
		// generate new plot
		const newPlot = plotInit(this.app, {
			id: action.id,
			holder: action.holder,
			term: action.term,
			callbacks: {
				postInit: () => {
					delete action.__plot_isloading
					action.loading_div.remove()
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

		self.updateTerms(divs)

		self.addTerms(divs)

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

	self.updateTerms = function(divs) {
		const expandedTerms = self.app.state().tree.expandedTerms
		divs.select('.' + cls_termbtn).text(d => (expandedTerms.includes(d.id) ? '-' : '+'))
		// update other parts if needed, e.g. label
		divs.select('.' + cls_termchilddiv).style('display', d => (expandedTerms.includes(d.id) ? 'block' : 'none'))
	}

	self.addTerms = function(divs) {
		const added = divs
			.enter()
			.append('div')
			.attr('class', cls_termdiv)
			.style('margin', d => (d.isleaf ? '' : '2px'))
			.style('padding', '0px 5px')

		added
			.filter(d => !d.isleaf)
			.append('div')
			.attr('class', 'sja_menuoption ' + cls_termbtn)
			.style('display', 'inline-block')
			.style('padding', '4px 9px')
			.style('font-family', 'courier')
			.text('+')
			.on('click', self.toggleTerm)

		added
			.append('div')
			.attr('class', cls_termlabel)
			.style('display', 'inline-block')
			.style('padding', '5px')
			.text(d => d.name)

		added
			.filter(graphable)
			.append('div')
			.attr('class', 'sja_menuoption ' + cls_termview)
			.style('display', 'inline-block')
			.style('border-radius', '5px')
			.style('margin-left', '20px')
			.style('font-size', '0.8em')
			.text('VIEW')
			.on('click', self.togglePlot)

		added
			.filter(graphable)
			.append('div')
			.attr('class', cls_termgraphdiv)

		added
			.filter(d => !d.isleaf)
			.append('div')
			.attr('class', cls_termchilddiv)
			.style('padding-left', childterm_indent)
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
	// use self to create properties

	self.toggleTerm = function(term) {
		event.stopPropagation()
		if (term.isleaf) return
		const t0 = self.termsById[term.id]
		if (!t0) throw 'invalid term id'

		const button = select(this)
		const holder = select(this.parentNode.getElementsByClassName(cls_termchilddiv)[0])
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

	self.togglePlot = function(term) {
		if (event) event.stopPropagation()
		if (!self.components.plots[term.id]) {
			// need to assess pros and cons of passing the holder via action versus alternatives
			const holder =
				this == self
					? self.dom.holder.selectAll('.' + cls_termgraphdiv).filter(_term => _term.id == term.id)
					: select(select(this).node().parentNode.lastChild)
			self.app.dispatch({
				type: 'plot_add',
				id: term.id,
				term,
				holder,
				config: plotConfig({ term })
			})
		} else {
			const plot = self.app.state().tree.plots[term.id]
			const type = !plot || !plot.isVisible ? 'plot_show' : 'plot_hide'
			self.app.dispatch({ type, id: term.id, term, holder })
			return
		}
		// add new plot
		term.__plot_isloading = true
		const loading_div = holder.append('div').text('Loading...')
		self.app.dispatch({
			type: 'plot_add',
			id: term.id,
			term,
			holder,
			loading_div,
			config: plotConfig({ term })
		})
		return
	}
}

export function graphable(term) {
	// terms with a valid type supports graph
	return term.iscategorical || term.isinteger || term.isfloat || term.iscondition
}
