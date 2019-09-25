import * as rx from "../rx.core"
import {select, event} from "d3-selection"
import {dofetch2} from "../client"
import {plotInit} from "./tdb.plot"

class TdbTree {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = {holder: opts.holder}
		// set closure methods to handle conflicting "this" contexts
		this.yesThis()
		this.notThis(this)

		this.components = {
			plots: {}
		}

		//this.bus = core.busInit(this.constructor.name, ["postRender"])
		this.currTerm = {id: 'root', level: 0}
		this.termsById = {root: this.currTerm}
		this.tree = [this.currTerm]
		this.app.dispatch({type: "tree_expand", termId: 'root'})

		this.bus = new rx.Bus('tree', ['postInit', 'postNotify'], app.opts.callbacks, this.api)
		this.bus.emit('postInit')
	}

	reactsTo(action, acty) {
		if (acty[0] == 'tree' || acty[0] == 'plot') return true
	}

	async main(action={}) {
		if (action.type.startsWith("plot_")) {
			this.viewPlot(action)
		} else {
			this.currTerm = this.termsById[action.termId]
			this.currTerm.terms = await this.requestTerm(this.currTerm)
			this.expand(this.termsById.root, this.dom.holder)
		}
	}

	async requestTerm(term) {
		const lst = ["genome=" + this.app.opts.genome + "&dslabel=" + this.app.opts.dslabel]
		const args = [term.id=="root" ? "default_rootterm=1" : "get_children=1&tid=" + term.id]
		// maybe no need to provide term filter at this query
		const data = await dofetch2("/termdb?" + lst.join("&") + "&" + args.join("&"), {}, this.app.opts.fetchOpts)
		const terms = []
		if (data && data.lst) {
			for(const t of data.lst) {
				const copy = Object.assign({}, t)
				copy.level = term.level + 1
				this.termsById[copy.id] = copy
				terms.push(copy)
			}
		}
		return terms
	}

	expand(term, div) {
		if (!term || !term.terms) return
		if (!(term.id in this.termsById)) return

		const cls = "termdiv-" + (term.level + 1)
		const divs = div.selectAll("."+cls).data(term.terms, this.bindKey)

		divs.exit().each(this.hideTerm)

		divs.style("display", this.updateTerm)

		divs
			.enter()
			.append("div")
			.attr("class", cls)
			.each(this.addTerm)
	}

	printTerm(term, div, btn, label) {
		div
			.datum(term)
			.style('display', 'block')
			//.style("width", "280px")
			.style("margin", "2px")
			.style("padding", "0px 5px 5px 25px")
			.style("cursor", "pointer")

		const expanded = this.app.state().tree.expandedTerms.includes(term.id)
		
		div
			.select(".termbtn")
			.datum(term)
			.html(!expanded ? "+" : "-")
			.style("display", "inline-block")
			.style("border", "1px solid #aaa")
			.style("padding", "2px 5px")
			.style("background", "#ececec")
			.style("font-family", "courier")
			.on("click", this.toggleTerm)

		div
			.select(".termlabel")
			.datum(term)
			.html(term.name)
			.style("display", "inline-block")
			.style("text-align", "center")
			.style("padding", "5px 5px 5px 5px")
			.on("click", this.toggleTerm)

		div
			.select(".termview")
			.datum(term)
			.html('VIEW')
			.style("display", "inline-block")
			.style("display", "inline-block")
			.style("border", "1px solid #aaa")
			.style("padding", "2px 5px")
			.style("margin-left", "50px")
			.style("background", "#ececec")
			.style("font-size", "0.8em")
			.on('click', this.togglePlot)

		div.select('.termsubdiv')
			.style("overflow", expanded ? '' : 'hidden')
			.style("height", expanded ? '' : 0)
			.style('opacity', expanded ? 1 : 0)
		
		this.expand(term, div.select(".termsubdiv"))
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
		const show = action.type == "plot_add" || action.type == "plot_show"
		this.dom.holder.selectAll(".termsubdiv")
			.filter(term=>term.id == action.id)
			.style("overflow", show ? '' : 'hidden')
			.style("height", show ? '' : 0)
			.style('opacity', show ? 1 : 0)
	}

	yesThis() {
		this.toggleTerm = term => {
			event.stopPropagation()
			const expanded = this.app.state().tree.expandedTerms.includes(term.id)
			const type = expanded ? "tree_collapse" : "tree_expand"
			this.app.dispatch({type, termId: term.id})
		}
	}

	notThis(self) {
		// cannot use arrow function since the 
		// alternate "this" context is needed
		
		// this == the d3 selected DOM node
		self.hideTerm = function(){
			select(this).style("display", "none")
		}
		self.updateTerm = function(term) {
			if (!(term.id in self.termsById)) return
			self.printTerm(term, select(this))
		}
		self.addTerm = function(term) {
			const div = select(this)
			if (!term.isleaf) div.append('div').attr('class', 'termbtn')
			div.append('div').attr('class', 'termlabel')
			if (term.isleaf) div.append('div').attr('class', 'termview')
			div.append('div').attr('class', 'termsubdiv')
				//.style('overflow', 'hidden')
				//.style('opacity', 0)
				.style('transition', '0.3s ease')
			self.printTerm(term, div)
		}
		self.togglePlot = function(term) {
			event.stopPropagation()
			const plot = self.app.state().tree.plots[term.id]
			if (!plot) {
				// need to assess pros and cons of passing the holder via action versus alternatives
				const holder = select(select(this).node().parentNode.lastChild)
				self.app.dispatch({type: "plot_add", id: term.id, term, holder})
			} else {
				const type = !plot || !plot.isVisible ? "plot_show" : "plot_hide"
				self.app.dispatch({type, id: term.id})
			}
		}
	}

	bindKey(term) {
		return term.id
	}
}

exports.treeInit = rx.getInitFxn(TdbTree)
