// using CommonJS syntax only for testing
// may use typical import, export keyword
// when compiling with Webpack
const core = require("./core")
const d3s = require("d3-selection")

/*****************************
	Example Component Classes
*****************************/

/*
	The resulting instance properties and methods 
	will be fully private when created inside
	componentInit() or similar component generators
*/

class FilterUi {
	constructor(opts) {
		this.cname = this.cname
		this.opts = opts
		this.bus = core.busInit("FilterUi", ["postRender"]) //, opts.callbacks.example)
		this.state = {
			//term: opts.term
		}
	}

	main(state = {}, data = {}) {
		console.log("filterUi main()")
		this.bus.emit("postRender")
	}

	render() {}
}

exports.filterUiInit = core.componentInit(FilterUi)
