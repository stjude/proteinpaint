/*
	How to write a reactive component

	See toy.table.js for a working example
*/

import {Component, getInitFxn} from "../rx.core"
// import ... other modules



class ToyTable extends Component {
	constructor(app, holder) {
		// required call to parent class constructor
		super()
		
		// save a reference to app 
		this.app = app
		
		// usual stuff
		this.opts = holder
		this.dom = {
			holder,
			table: holder.append('table')
		}
		
		// Optional: set up reusable closured
		// functions to handle "this" conflicts
		this.yesThis()
		// notThis(): use function(){} to refer to
		//         DOM or non-instance "this" context
		this.notThis(this)
	}

	// as a convenience, 
	// instance.reactsTo() will be called before
	// instance.main() in the inherited 
	// Component api.main() method
	// 
	// acty = action.type.split("_")
	reactsTo(action, acty) {
		if (acty[0] == "term") return true
	}
	
	// wrapped by Component api.main()
	main(action) {
		// Create a local reference to the state
		// property that affects this component
		const terms = this.app.state().terms
		// pass the reference to downstream methods 
		this.render(terms)

		// - OR - 
		// process some kind of action result
		this.processData(action.result)

		// - OR -
		// dereference result data
		const src = action.result.src // "serverData"
		const key = action.result.key // "/termdb-barsql?term=diaggrp"
		const serverData = this.app[src][key]
		this.processData(serverData)
	}

	render(terms) {
		// re-render from scratch
		this.dom.holder.selectAll('*').remove()
		// or use d3 enter, update, exit pattern
	}

	// use arrow functions to refer
	// to component instance as "this"
	yesThis() {
		this.getTerm = id => this.app.state().termsById[id]  	
	}

	// use function keyword to ensure that the
	// DOM or non-instance "this" context is preserved
	notThis(self) {
		self._addDiv = function(term) {
			self.addDiv(term, select(this))
		}
	}
}

/*
	Hide a table inside the Component class api
	see rx.core.js getInitFxn() for details
*/
export const tableInit = getInitFxn(ToyTable)
