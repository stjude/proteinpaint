// using CommonJS syntax only for testing
// may use typical import, export keyword
// when compiling with Webpack
const core = require("./core")
const d3s = require("d3-selection")
const controls = require("./tree.controls")
const plot = require("./tree.plot")

/*****************************
	Example Component Classes
*****************************/

/*
	The resulting instance properties and methods 
	will be fully private when created inside
	componentInit() or similar component generators
*/

/*
// prx = proteinpaint reactive
prx.core.js

src/termdb
	tdb.app.js
	tdb.tree.js
	tdb.tree.spec.js
	tdb.plot.js,  
	tdb.plot.spec.js

src/toy
 toy.app.js
 toy.app.spec.js 

*/

class Tree {
	constructor(opts) {
		this.opts = opts
		this.cname = this.constructor.name[0].toLowerCase + this.constructor.name[0].slice(1)
		this.bus = core.busInit(this.cname, ["postRender"])

		this.dom = {
			holder: opts.holder.style("margin", "10px").style("border", "1px solid #aaa"),
			cartdiv: opts.holder.append("div")
		}

		this.termfilter = {
			terms: []
		}

		this.components = {
			filterUi: controls.filterUiInit({}),
			plots: []
		}

		this.state = {}
		this.initTerm(opts.terms[0])

		// set closure methods to handle 
		// conflicting "this" contexts
		this.yesThis()
		this.notThis(this)
	}

	initTerm(term) {
		if (!term || term.id in this.state) return
		this.state[term.id] = { expanded: false }
	}

	main(state = {}) {
		this.updateState(state)
		this.expand(this.opts.terms[0], this.dom.holder)
		this.bus.emit("postRender")
		return this
	}

	updateState(state) {
		for (const termId in state) {
			Object.assign(this.state[termId], state[termId])
		}
	}

	expand(term, div) {
		if (!term || !term.terms) return
		if (!(term.id in this.state)) return

		const cls = "termdiv-" + (term.level + 1)
		const divs = div.selectAll("."+cls).data(term.terms, this.bindKey)

		divs.exit().each(this._hideTerm)

		divs.style("display", this._updateTerm)

		divs
			.enter()
			.append("div")
			.attr("class", cls)
			.each(this._printTerm)
	}

	printTerm(term, div, btn, label) {
		div
			.datum(term)
			.style('display', 'block')
			.style("width", "280px")
			.style("margin", "2px")
			.style("padding", "5px 5px 5px 25px")
			.style("cursor", "pointer")

		const expanded = term.id in this.state && this.state[term.id].expanded
		
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

		div.select('.termsubdiv').style("max-height", expanded ? '100%' : 0)
		
		this.expand(term, div.select(".termsubdiv"))
	}

	yesThis() {
		// set methods that maintain the instance context of "this"
		this.currValue = (value) => this.currValue = value
	}

	notThis(self) {
		// set methods that require both instance 
		// context and a different "this" context;
		// cannot use arrow function since the 
		// alternate "this" context is needed
		
		// this == the d3 selected DOM node
		self._hideTerm = function(){
			d3s.select(this).style("display", "none")
		}
		self._updateTerm = function(term) {
			if (!(term.id in self.state)) return
			self.printTerm(term, d3s.select(this))
		}
		self._printTerm = function(term) {
			const div = d3s.select(this)
			if (term.terms) div.append('div').attr('class', 'termbtn')
			div.append('div').attr('class', 'termlabel')
			if (!term.terms) div.append('div').attr('class', 'termview')
			div.append('div').attr('class', 'termsubdiv')
				.style('overflow', 'hidden')
				.style('transition', '0.25s ease')
			self.printTerm(term, div)
		}
		self._toggle = function(term) {
			d3s.event.stopPropagation()
			const d = d3s.event.target.__data__;
			if (term.id != d.id) return
			self.initTerm(term)
			self.main({[term.id]: {expanded: !self.state[term.id].expanded}})
		}
	}

	bindKey(term) {
		return term.id
	}
}

exports.treeInit = core.componentInit(Tree)
