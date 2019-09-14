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

class Plot {
	constructor(opts) {
		this.cname = this.cname
		this.opts = opts
		this.state = {}
		this.bus = core.busInit("Plot", ["postRender"]) //, opts.callbacks.example)
	}

	main(state = {}, data = {}) {
		console.log("plot main()")
		this.bus.emit("postRender", this.sharedState)
	}
}

exports.init = core.componentInit(Plot)
