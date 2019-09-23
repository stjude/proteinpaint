/*
	How to write a reactive component

	See toy.table.js for a working example
*/

import * as rx from "../rx.core"
// import ... other modules

class HowTo {
	constructor(app, holder) {
		// indicate whether this class is an 
		// app, store, or component by the type
		// of api that is uses
		this.api = rx.getComponentApi(this)

		// borrow the following methods IF this class 
		// creates this.components = {}
		// this.notifyComponents = rx.notifyComponents
		// this.getComponents = rx.getComponents

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
		this.notThis(this)

		// this.components = { ... }

		// optional event bus
		// this.bus = new rx.Bus('howto', ['postInit', 'postMain'], opts.callbacks, this.api)
		// this.bus.emit('postInit')
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

		/*
			Refer to toy.store to see what kind
			of action results are provided, if any
		*/
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

		// if using loops
		for(const term of terms) {
			holder.append('div')
				.on('click', ()=>this.app.dispatch({type: 'term_add', termid: term.id}))
		}
		// -OR - if using d3 pattern with element-bound data
		.enter().append('div')
			.on('click', this.triggerAddTerm)
	}

	/* 
	yesThis()
	  use arrow functions to maintain the 
	  component instance context of "this"
	
	  while arrow functions may be inlined,
	  creating named reusable arrow functions
	  - makes the intent clearer 
	  - helps declutter a method by removing 
	    the nested functions inside it
	  - is more performant since the arrow function
	    only has to be parsed once
	*/ 
	yesThis() {
		this.getTerm = id => this.app.state().termsById[id]
		// assumes element-bound data from using d3.data()
		this.triggerAddTerm = term => this.app.dispatch({type: 'term_add', termid: term.id})
	}

	/* 
	notThis(self)
	  use function keyword to ensure that the
	  DOM or non-instance "this" context is preserved
	  !!! arrow functions will not work !!!
	
	  pass the instance as "self" argument to notThis(),
	  to distinguish that "self" is the component
	  instance while "this" refers to something else
	 
	  convention: 
	  use a _methodName prefix to indicate that
	  the method is simply passing arguments
	  to a similarly named class method
	*/ 
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
export const howInit = rx.getInitFxn(HowTo)
