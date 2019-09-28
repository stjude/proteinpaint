import * as rx from '../rx.core'
import { select, selectAll, event } from 'd3-selection'
import { dofetch2 } from '../client'
import { plotInit, plotConfig } from './plot'

const childterm_indent = '30px'

class TdbTree {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.notifyComponents = rx.notifyComponents
		this.app = app
		this.dom = { holder: opts.holder }
		// set closure methods to handle conflicting "this" contexts
		this.notThis(this)

		this.components = {
			plots: {}
		}

		const rootTerm = {
			id: 'root',
			isroot: true // hardcoded attribute only introduced here
		}

		this.termsById = { root: rootTerm }
		this.app
			.dispatch({
				type: 'tree_expand',
				termId: 'root',
				term: rootTerm,
				holder: this.dom.holder
			})
			.then(() => {
				// wait after dispatch before emitting postInit
				// console.log(36, 'tree postInit')
				this.bus = new rx.Bus('tree', ['postInit', 'postNotify', 'postRender'], app.opts.callbacks, this.api)
				this.bus.emit('postInit')
			})
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
			term.terms = await this.requestTerm(term)
			this.updateTree(term, action.holder)
		}
	}

	async requestTerm(term) {
		if (this.termsById[term.id].terms) return this.termsById[term.id].terms
		const state = this.app.state()
		const lst = ['genome=' + state.genome + '&dslabel=' + state.dslabel]
		const args = [term.isroot ? 'default_rootterm=1' : 'get_children=1&tid=' + term.id]
		// maybe no need to provide term filter at this query
		const data = await dofetch2('/termdb?' + lst.join('&') + '&' + args.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) throw 'no children term for ' + term.id
		const terms = []
		for (const t of data.lst) {
			//console.log(t.id)
			const copy = Object.assign({}, t)
			this.termsById[copy.id] = copy
			terms.push(copy)
		}
		for (const t of terms) {
			// rehydrate expanded terms as needed
			if (state.tree.expandedTerms.includes(t.id)) {
				t.terms = await this.requestTerm(t)
			}
		}
		return terms
	}

	updateTree(term, div) {
		if (!term || !term.terms) return
		if (!(term.id in this.termsById)) return
		const expanded = this.app.state().tree.expandedTerms.includes(term.id)
		if (!expanded) {
			div.style('display', 'none')
			// do not update hidden child termdiv's
			return
		}
		div.style('display', 'block')

		const cls = 'termdiv'
		const childTermIds = term.terms.map(this.bindKey)
		const divs = div
			.selectAll('.' + cls)
			.filter(t => childTermIds.includes(t.id))
			.data(term.terms, this.bindKey)

		divs.exit().each(this.hideTerm)

		divs.each(this.updateTerm)

		divs
			.enter()
			.append('div')
			.attr('class', cls)
			.each(this.addTerm)
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
			const show = action.type == 'plot_add' || action.type == 'plot_show'
			this.dom.holder
				.selectAll('.termchilddiv')
				.filter(term => term.id == action.id)
				.style('overflow', show ? '' : 'hidden')
				.style('height', show ? '' : 0)
				.style('opacity', show ? 1 : 0)
		}
	}

	notThis(self) {
		// cannot use arrow function since the
		// alternate "this" context is needed

		// this == the d3 selected DOM node
		self.hideTerm = function(term) {
			//console.log(138, 'hideTerm', term.id)
			if (self.app.state().tree.expandedTerms.includes(term.id)) return
			select(this).style('display', 'none')
		}

		self.updateTerm = function(term) {
			//console.log(143, 'updateTerm', term.id)
			const div = select(this)
			div.datum(term)
			const expanded = self.app.state().tree.expandedTerms.includes(term.id)
			const divs = selectAll(this.childNodes).filter(function() {
				return !this.className.includes('termchilddiv')
			})

			divs
				.select('.termbtn')
				.datum(term)
				.html(!expanded ? '+' : '-')

			divs
				.select('.termlabel')
				.datum(term)
				.html(term.name)

			divs
				.select('.termview')
				.datum(term)
				.html('VIEW')

			const plot = self.app.state({ type: 'plot', id: term.id })
			const isVisible = expanded || (plot && plot.isVisible)
			const childdiv = divs
				.select('.termchilddiv')
				.datum(term)
				.style('display', expanded ? 'block' : 'none')
				.style('overflow', isVisible ? '' : 'hidden')
				.style('height', isVisible ? '' : 0)
				.style('opacity', isVisible ? 1 : 0)
		}

		self.addTerm = function(term) {
			//console.log(176, 'addTerm', term.id)
			const div = select(this)
			div
				.datum(term)
				.style('display', 'block')
				.style('margin', term.isleaf ? '' : '2px')
				.style('padding', '0px 5px')
				.style('padding-left', term.isleaf ? 0 : '')
				.style('cursor', 'pointer')

			if (!term.isleaf) {
				div
					.append('div')
					.datum(term)
					.html('+')
					.attr('class', 'sja_menuoption termbtn')
					.style('display', 'inline-block')
					.style('padding', '4px 9px')
					.style('background', '#ececec')
					.style('font-family', 'courier')
					.on('click', self.toggleTerm)
			}

			div
				.append('div')
				.datum(term)
				.html(term.name)
				.attr('class', 'termlabel')
				.style('display', 'inline-block')
				.style('text-align', 'center')
				.style('padding', '5px 5px 5px 5px')
				.on('click', self.toggleTerm)

			if (term.isleaf) {
				div
					.append('div')
					.attr('class', 'termview')
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
				.attr('class', 'termchilddiv')
				.style('padding-left', childterm_indent)
				.style('transition', '0.3s ease')

			const expanded = self.app.state().tree.expandedTerms.includes(term.id)
			if (expanded) self.updateTree(term, childdiv)
		}

		self.toggleTerm = function(term) {
			event.stopPropagation()
			if (term.isleaf) return
			const expanded = self.app.state().tree.expandedTerms.includes(term.id)
			const type = expanded ? 'tree_collapse' : 'tree_expand'
			const holder = selectAll(this.parentNode.childNodes).filter(function() {
				return this.className.includes('termchilddiv')
			})
			self.app.dispatch({ type, termId: term.id, term, holder })
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

	bindKey(term) {
		return term.id
	}
}

exports.treeInit = rx.getInitFxn(TdbTree)
