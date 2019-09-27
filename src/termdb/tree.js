import * as rx from '../rx.core'
import { select, event } from 'd3-selection'
import { dofetch2 } from '../client'
import { plotInit, plotConfig } from './plot'

const childterm_indent = '30px'

class TdbTree {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = { holder: opts.holder }
		// set closure methods to handle conflicting "this" contexts
		this.yesThis()
		this.notThis(this)

		this.components = {
			plots: {}
		}

		this.currTerm = {
			id: 'root',
			level: 0,
			isroot: true // hardcoded attribute only introduced here
		}

		this.termsById = { root: this.currTerm }
		this.tree = [this.currTerm]
		this.app.dispatch({ type: 'tree_expand', termId: 'root', term: this.currTerm })

		this.bus = new rx.Bus('tree', ['postInit', 'postNotify', 'postRender'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'tree' || acty[0] == 'plot') return true
	}

	async main(action = {}) {
		if (action.type.startsWith('plot_')) {
			this.viewPlot(action)
		} else {
			this.action = action
			this.currTerm = this.termsById[action.termId]
			this.currTerm.terms = await this.requestTerm(this.currTerm)
			this.expand(this.termsById.root, this.dom.holder)
		}
	}

	async requestTerm(term) {
		const state = this.app.state()
		const lst = ['genome=' + state.genome + '&dslabel=' + state.dslabel]
		const args = [term.isroot ? 'default_rootterm=1' : 'get_children=1&tid=' + term.id]
		// maybe no need to provide term filter at this query
		const data = await dofetch2('/termdb?' + lst.join('&') + '&' + args.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) throw 'no children term for ' + term.id
		const terms = []
		for (const t of data.lst) {
			const copy = Object.assign({}, t)
			copy.level = term.level + 1
			this.termsById[copy.id] = copy
			terms.push(copy)
		}
		return terms
	}

	expand(term, div) {
		if (!term || !term.terms) return
		if (!(term.id in this.termsById)) return

		const cls = 'termdiv-' + (term.level + 1)
		const divs = div.selectAll('.' + cls).data(term.terms, this.bindKey)

		divs.exit().each(this.hideTerm)

		divs.each(this._updateTerm)

		divs
			.enter()
			.append('div')
			.attr('class', cls)
			.each(this._addTerm)
	}

	addTerm(term, div) {
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
				.attr('class', 'sja_menuoption termbtn-' + term.level)
				.style('display', 'inline-block')
				//.style('margin-left', term.level > 1 ? childterm_indent : '')
				.style('padding', '4px 9px')
				.style('background', '#ececec')
				.style('font-family', 'courier')
				.on('click', this.toggleTerm)
		}

		div
			.append('div')
			.datum(term)
			.attr('class', 'termlabel-' + term.level)
			.style('display', 'inline-block')
			.style('text-align', 'center')
			.style('padding', '5px 5px 5px 5px')
			.on('click', this.toggleTerm)

		if (term.isleaf) {
			div
				.append('div')
				.attr('class', 'termview-' + term.level)
				.datum(term)
				.style('display', 'inline-block')
				.style('display', 'inline-block')
				.style('border', '1px solid #aaa')
				.style('padding', '2px 5px')
				.style('margin-left', '50px')
				.style('background', '#ececec')
				.style('font-size', '0.8em')
				.on('click', this.togglePlot)
		}

		div
			.append('div')
			.datum(term)
			.attr('class', 'termchilddiv-' + term.level)
			.style('padding-left', childterm_indent)
			//.style('overflow', 'hidden')
			//.style('opacity', 0)
			.style('transition', '0.3s ease')

		this.updateTerm(term, div)
	}

	updateTerm(term, div) {
		div.datum(term)

		const expanded = this.app.state().tree.expandedTerms.includes(term.id)

		div
			.select('.termbtn-' + term.level)
			.datum(term)
			.html(!expanded ? '+' : '-')

		div
			.select('.termlabel-' + term.level)
			.datum(term)
			.html(term.name)

		div
			.select('.termview-' + term.level)
			.datum(term)
			.html('VIEW')

		const plot = this.app.state({ type: 'plot', id: term.id })
		const isVisible = expanded || (plot && plot.isVisible)
		const childdiv = div
			.select('.termchilddiv-' + term.level)
			.datum(term)
			.style('overflow', isVisible ? '' : 'hidden')
			.style('height', isVisible ? '' : 0)
			.style('opacity', isVisible ? 1 : 0)

		if (expanded) this.expand(term, childdiv)
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
		const show = action.type == 'plot_add' || action.type == 'plot_show'
		this.dom.holder
			.selectAll('.termchilddiv-' + action.term.level)
			.filter(term => term.id == action.id)
			.style('overflow', show ? '' : 'hidden')
			.style('height', show ? '' : 0)
			.style('opacity', show ? 1 : 0)
	}

	yesThis() {
		this.toggleTerm = term => {
			event.stopPropagation()
			if (term.isleaf) return
			const expanded = this.app.state().tree.expandedTerms.includes(term.id)
			const type = expanded ? 'tree_collapse' : 'tree_expand'
			this.app.dispatch({ type, termId: term.id, term })
		}
	}

	notThis(self) {
		// cannot use arrow function since the
		// alternate "this" context is needed

		// this == the d3 selected DOM node
		self.hideTerm = function() {
			select(this).style('display', 'none')
		}
		self._updateTerm = function(term) {
			//if (!(term.id in self.termsById)) return
			self.updateTerm(term, select(this))
		}
		self._addTerm = function(term) {
			self.addTerm(term, select(this))
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
