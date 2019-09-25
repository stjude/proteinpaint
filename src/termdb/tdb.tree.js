import * as rx from '../rx.core'
import { select, event } from 'd3-selection'
import { plotInit, plotConfig } from './tdb.plot'

const childterm_indent = '20px'

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

		//this.bus = core.busInit(this.constructor.name, ["postRender"])
		this.currTerm = {
			id: 'root',
			__isroot: true // hardcoded attribute only introduced here
		}
		this.termsById = { root: this.currTerm }
		this.tree = [this.currTerm]
		this.app.dispatch({ type: 'tree_getchildterm', term: this.currTerm })

		this.bus = new rx.Bus('tree', ['postInit', 'postNotify'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'tree' || acty[0] == 'plot') return true
	}

	async main(action = {}) {
		if (action.type.startsWith('plot_')) {
			this.viewPlot(action)
			return
		}
		// clicking +/- button of term
		delete action.term.__loadingchild
		this.termsById[action.term.id].terms = action.childterms
		action.childterms.forEach(t => (this.termsById[t.id] = t))
		this.addTerms(
			action.childterms,
			action.term.__isroot
				? this.dom.holder
				: this.dom.holder
						.selectAll('.termdiv')
						.filter(d => d.id == action.term.id)
						.select('.termchilddiv')
		)
	}

	addTerms(terms, div) {
		// got a list of children terms from one parent
		// print them inside a div under the parent
		div.select('.loading').remove() // remove the loading word
		// row for a term
		const selection = div
			.selectAll()
			.data(terms)
			.enter()
			.append('div')
			.attr('class', 'termdiv')
			.style('padding', '0px 5px')
		// fold/expand button, only for non-leaf
		selection
			.filter(d => !d.isleaf)
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			.style('padding', '4px 9px')
			.style('font-family', 'courier')
			.text(d => (this.app.state().tree.expandedTerms.includes(d.id) ? '-' : '+'))
			.on('click', d => {
				const childdiv = selection.filter(i => i.id == d.id).select('.termchilddiv')
				if (this.app.state().tree.expandedTerms.includes(d.id)) {
					// term is expanded, hide
					event.target.innerHTML = '+'
					childdiv.style('display', 'none')
					this.app.dispatch({ type: 'tree2_hideterm', termid: d.id })
					// only to modify store.state, no further action needed from this component
					// has to use tree2 to not pass reactsTo()
					return
				}
				// term is hidden, expand
				event.target.innerHTML = '-'
				childdiv.style('display', 'block')
				if (d.terms) {
					// children already loaded
					this.app.dispatch({ type: 'tree2_expandterm', termid: d.id })
					return
				}
				// load children
				if (d.__loadingchild) return
				d.__loadingchild = true
				this.app.dispatch({ type: 'tree_getchildterm', term: d })
			})
		// label
		selection
			.append('div')
			.style('display', 'inline-block')
			.style('text-align', 'center')
			.style('padding', '5px 5px 5px 5px')
			.text(d => d.name)
		// view button
		selection
			.filter(d => d.iscategorical || d.isinteger || d.isfloat || d.iscondition)
			.append('div')
			.style('display', 'inline-block')
			.style('border', '1px solid #aaa')
			.style('padding', '2px 5px')
			.style('margin-left', '50px')
			.style('background', '#ececec')
			.style('font-size', '0.8em')
			.text('VIEW')
			.on('click', this.togglePlot)
		// children holder
		selection
			.filter(d => !d.isleaf)
			.append('div')
			.attr('class', 'termchilddiv')
			.style('margin-left', childterm_indent)
			.style('display', 'none')
			.append('div')
			.attr('class', 'loading')
			.style('margin', '4px 0px')
			.style('font-size', '.8em')
			.style('opacity', '.5')
			.text('Loading...')
		// for recovering tree, to be tested
		terms.forEach(term => {
			if (this.app.state().tree.expandedTerms.includes(term.id)) {
				this.app.dispatch({ type: 'tree_getchildterm', term })
			}
		})
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
			.selectAll('.termsubdiv')
			.filter(term => term.id == action.id)
			.style('overflow', show ? '' : 'hidden')
			.style('height', show ? '' : 0)
			.style('opacity', show ? 1 : 0)
	}

	yesThis() {}

	notThis(self) {
		// cannot use arrow function since the
		// alternate "this" context is needed

		// this == the d3 selected DOM node
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
				self.app.dispatch({ type, id: term.id })
			}
		}
	}
}

exports.treeInit = rx.getInitFxn(TdbTree)
