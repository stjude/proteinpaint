/*
	How to write a reactive component

	See toy.table.js for a working example
*/

import * as rx from "../rx.core"
// import ... other modules

class HowTo {
	constructor(opts) {
		this.type = ''
		// indicate whether this class is an 
		// app, store, or component by the type
		// of api that is uses
		this.api = rx.getComponentApi(this)

		// save a reference to app 
		this.app = opts.app
		this.opts = rx.getOpts(opts, this)
		// usual stuff
		this.opts = rx.getOpts(opts, this)
		this.dom = {
			holder: opts.holder,
			table: opts.holder.append('table')
		}

		setRenderers(this)
		setInteractivity(this)

		// this.components = { ... }

		// optional event bus
		// this.bus = new rx.Bus('howto', ['postInit', 'postNotify'], opts.callbacks, this.api)
		// this.bus.emit('postInit')
	}
	
	// wrapped by Component api.main()
	main() {
		// this.state is set in component.api.update()
		// process new state, potentially including server requests
		this.currData = this.requestData()
		this.processData()
		this.render()
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
}

function setRenderers(self) {
	// DOM related functions
	self.render = function (data) {
		const div = select(this)
		// ...
	}
}

function setInteractivity(self) {
	// event handlers
	self.toggleVisibility = function(data) {
		// "component_" could be any 
		const action = data.isVisible ? 'component_hide' : 'component_show'
		self.dispatch({
			type: ''
		})
	}
}


/*
	Hide a table inside the Component class api
	see rx.core.js getInitFxn() for details
*/
export const howInit = rx.getInitFxn(HowTo)
