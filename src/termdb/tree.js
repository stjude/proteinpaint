import * as rx from '../rx.core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch2 } from '../client'
import { plotInit, plotConfig } from './plot'

const childterm_indent = '30px'
// class names
const cls_termdiv = 'termdiv',
	cls_termchilddiv = 'termchilddiv',
	cls_termbtn = 'termbtn',
	cls_termview = 'termview',
	cls_termlabel = 'termlabel'

/*
Recommended Component Code Organization

(a) class (produces instance):
- all methods expected by rx.api (main, etc)
- all data processing code

(b) setRenderers(self): attaches renderer methods

(c) setInteractivity(self): attaches event handlers

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
			plots: {}
		}

		const rootTerm = {
			id: 'root',
			__tree_isroot: true
		}

		this.termsById = { root: rootTerm }
		this.bus = new rx.Bus('tree', ['postInit', 'postNotify', 'postRender'], app.opts.callbacks, this.api)
		this.app.dispatch({
			type: 'tree_expand',
			termId: 'root',
			term: rootTerm,
			holder: this.dom.holder
		})
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'tree' || acty[0] == 'plot' || acty[0] == 'filter') return true
	}

	async main(action = {}) {
		if (action.type.startsWith('filter_')) {
			return this.notifyComponents(action)
		} else if (action.type.startsWith('plot_')) {
			this.viewPlot(action)
		} else {
			const term = this.termsById[action.termId]
			if (!term.terms) {
				term.terms = await this.requestTerm(term)
				delete term.__tree_isloading
				if (action.loading_div) {
					action.loading_div.remove()
				}
			}
			this.renderBranch(term, action.holder, action.button)
		}
		// for a tree modifier, will issue one query and update termsById{}, then renderBranch from root
		this.bus.emit('postRender')
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

	viewPlot(action) {
		const plot = this.components.plots[action.id]
		if (plot) plot.main(action)
		else {
			// need to assess pros and cons of passing the holder via action versus alternatives
			const newPlot = plotInit(this.app, {
				id: action.id,
				holder: action.holder,
				term: action.term
			})
			this.components.plots[action.id] = newPlot
		}
		if (action.type != 'plot_edit') {
			this.updatePlotView(action)
		}
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
		const expanded = self.app.state().tree.expandedTerms.includes(term.id)
		if (!expanded) {
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
			.attr('class', cls_termdiv)
			.each(self.addTerm)
	}

	// this == the d3 selected DOM node
	self.hideTerm = function(term) {
		if (self.app.state().tree.expandedTerms.includes(term.id)) return
		select(this).style('display', 'none')
	}

	self.updateTerm = function(term) {
		const div = select(this)
		div.datum(term)
		const expanded = self.app.state().tree.expandedTerms.includes(term.id)
		const divs = selectAll(this.childNodes).filter(function() {
			return !this.className.includes(cls_termchilddiv)
		})

		divs
			.select('.' + cls_termbtn)
			.datum(term)
			.html(!expanded ? '+' : '-')

		divs
			.select('.' + cls_termlabel)
			.datum(term)
			.html(term.name)

		divs
			.select('.' + cls_termview)
			.datum(term)
			.html('VIEW')

		const plot = self.app.state({ type: 'plot', id: term.id })
		const isVisible = expanded || (plot && plot.isVisible)
		const childdiv = divs
			.select('.' + cls_termchilddiv)
			.datum(term)
			.style('display', expanded ? 'block' : 'none')
			.style('overflow', isVisible ? '' : 'hidden')
			.style('height', isVisible ? '' : 0)
			.style('opacity', isVisible ? 1 : 0)
	}

	self.addTerm = function addTerm(term) {
		//console.log('addTerm', term.id)
		const div = select(this)
		div
			.datum(term)
			.style('display', 'block')
			.style('margin', term.isleaf ? '' : '2px')
			.style('padding', '0px 5px')
			.style('padding-left', term.isleaf ? 0 : '')
			.style('cursor', 'pointer')

		let button
		if (!term.isleaf) {
			button = div
				.append('div')
				.datum(term)
				.html('+')
				.attr('class', 'sja_menuoption ' + cls_termbtn)
				.style('display', 'inline-block')
				.style('padding', '4px 9px')
				.style('font-family', 'courier')
				.on('click', self.toggleTerm)
		}

		div
			.append('div')
			.datum(term)
			.html(term.name)
			.attr('class', cls_termlabel)
			.style('display', 'inline-block')
			.style('text-align', 'center')
			.style('padding', '5px')

		if (term.isleaf) {
			div
				.append('div')
				.attr('class', cls_termview)
				.datum(term)
				.html('VIEW')
				.style('display', 'inline-block')
				.style('display', 'inline-block')
				.style('border', '1px solid #aaa')
				.style('padding', '2px 5px')
				.style('margin-left', '50px')
				.style('background', '#ececec')
				.style('font-size', '0.8em')
				.on('click', self.togglePlot)
		}

		const childdiv = div
			.append('div')
			.datum(term)
			.attr('class', cls_termchilddiv)
			.style('padding-left', childterm_indent)
			.style('transition', '0.3s ease')

		const expanded = self.app.state().tree.expandedTerms.includes(term.id)
		if (expanded) self.renderBranch(term, childdiv, button)
	}

	self.updatePlotView = function(action) {
		const show = action.type == 'plot_add' || action.type == 'plot_show'
		self.dom.holder
			.selectAll('.' + cls_termchilddiv)
			.filter(term => term.id == action.id)
			.style('overflow', show ? '' : 'hidden')
			.style('height', show ? '' : 0)
			.style('opacity', show ? 1 : 0)
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

		const holder = selectAll(this.parentNode.childNodes).filter(function() {
			return this.className.includes(cls_termchilddiv)
		})
		const button = select(this)
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
		event.stopPropagation()
		const plot = self.app.state().tree.plots[term.id]
		if (!plot) {
			// need to assess pros and cons of passing the holder via action versus alternatives
			const holder = select(select(this).node().parentNode.lastChild)
			self.app.dispatch({
				type: 'plot_add',
				id: term.id,
				term,
				holder,
				config: plotConfig({ term })
			})
		} else {
			const type = !plot || !plot.isVisible ? 'plot_show' : 'plot_hide'
			self.app.dispatch({ type, id: term.id, term })
		}
	}
}
