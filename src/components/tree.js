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

		this.clickedTerms = {}

		this.setHelpers()
	}

	main(state = {}, data = {}) {
		this.processData(state)
		const terms = this.opts.terms.filter(this.wasClicked)
		this.render(this, terms, 0, this.dom.holder)
		this.bus.emit("postRender")
		return this
	}

	processData(state) {
		if (!this.terms) this.setTerms(this, this.opts.terms)
		for (const termId in state) {
			this.clickedTerms[termId] = state[termId]
		}
	}

	setTerms(self, terms) {
		if (!terms) return
		console.log(terms.map(d => d.id))
		for (const term of terms) {
			if (!(term.id in self.clickedTerms)) {
				self.clickedTerms[term.id] = { clicked: true, expanded: true }
			} else {
				self.clickedTerms[term.id].expanded = !self.clickedTerms[term.id].expanded
			}
		}
	}

	setHelpers() {
		// quick arrow methods, helps preserve "this" context
		this.wasClicked = d => d.id in this.clickedTerms
		this.getLabel = d => d.name
		this.labelOpacity = d => (this.clickedTerms[termId] ? 1 : 0.2)
		this.bindKey = d => d.id
	}

	render(self, terms, level, div) {
		const divs = div.selectAll(".termbtn-" + level).data(terms, self.bindKey)

		//divs.style("opacity", this.labelOpacity)
		if (!divs) return

		divs.exit().each(() => d3s.select(this).style("display", "none"))

		divs.style("display", term => (self.clickedTerms[term.id].expanded ? "inline-block" : "none"))

		divs
			.enter()
			.append("div")
			.each(function(term) {
				self.addTerm(self, term, d3s.select(this))
			})
	}

	addTerm(self, term, div) {
		div
			.attr("class", "termbtn-" + term.level)
			.style("width", "180px")
			.style("margin", "5px")
			.style("padding", "5px 5px 5px 25px")
			.style("cursor", "pointer")
			.on("click", function(term) {
				d3s.event.stopPropagation()
				self.setTerms(self, term.terms)
				self.render(self, term.terms, term.level + 1, d3s.select(this))
			})

		div
			.append("div")
			.html("+")
			.style("display", "inline-block")
			.style("border", "1px solid #aaa")
			.style("padding", "2px 5px")
			.style("background", "#ececec")
			.datum(term)

		div
			.append("div")
			.html(self.getLabel)
			.style("display", "inline-block")
			.style("text-align", "center")
			.style("padding", "5px 5px 5px 5px")
			.datum(term)
	}
}

exports.init = core.componentInit(Tree)
