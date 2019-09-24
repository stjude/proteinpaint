import * as rx from "../rx.core"
import {select, event} from "d3-selection"
import {dofetch2} from "../client"
//import {plotInit} from "./tdb.plot"

/*****************************
	Example Component Classes
*****************************/

/*
	The resulting instance properties and methods 
	will be fully private when created inside
	componentInit() or similar component generators
*/

class TdbTree {
	constructor(app, holder) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = {
			holder: holder.style("margin", "10px").style("border", "1px solid #aaa"),
		}
		// set closure methods to handle conflicting "this" contexts
		this.notThis(this)

		this.components = {
			plots: []
		}

		//this.bus = core.busInit(this.constructor.name, ["postRender"])
		this.currTerm = {id: 'root', level: 0}
		this.termsById = {root: this.currTerm}
		this.tree = [this.currTerm]
		this.app.dispatch({type: "tree_expand", termId: 'root'})
	}

	reactsTo(action, acty) {
		if (acty[0] == 'tree') return true
	}

	async main(action={}) {
		this.currTerm = this.termsById[action.termId]
		this.currTerm.terms = await this.requestTerm(this.currTerm)
		this.expand(this.termsById.root, this.dom.holder)
		//this.bus.emit("postRender")
		return this
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

		divs.exit().each(this._hideTerm)

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
			.on("click", this._toggle)

		div
			.select(".termlabel")
			.datum(term)
			.html(term.name)
			.style("display", "inline-block")
			.style("text-align", "center")
			.style("padding", "5px 5px 5px 5px")
			.on("click", this._toggle)

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

		div.select('.termsubdiv')
			.style("overflow", expanded ? '' : 'hidden')
			.style("height", expanded ? '' : 0)
			.style('opacity', expanded ? 1 : 0)
		
		this.expand(term, div.select(".termsubdiv"))
	}

	notThis(self) {
		// set methods that require both instance 
		// context and a different "this" context;
		// cannot use arrow function since the 
		// alternate "this" context is needed
		
		// this == the d3 selected DOM node
		self._hideTerm = function(){
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
		self._toggle = function(term) {
			event.stopPropagation()
			const expanded = self.app.state().tree.expandedTerms.includes(term.id)
			const type = expanded ? "tree_collapse" : "tree_expand"
			self.app.dispatch({type, termId: term.id})
		}
	}

	bindKey(term) {
		return term.id
	}
}

exports.treeInit = rx.getInitFxn(TdbTree)
