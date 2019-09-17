const storeInit = require("./core").storeInit

// one store for the whole tdb app
class TdbStore {
	/*
	opts {}
	.state {
		termfilter: {
			terms: []
		},
		plots: []
	}
	*/
	constructor(opts) {
		this.defaultState = {
			termfilter: {
				terms: [{term: "ALL", }]
			},
			plots: [{
				term: 'diaggrp',
				term2: 'sex',
				settings: {
					bar: {
						orientation: 'horizontal',

					}
				}
			}, {
				term: 'agedx'
			}]
		}
		this.state = opts.state; //deepAssign(this.defaults, opts.state;
		this.app = opts.app
		this.async = ["dofetch"]
		this.serverData = {}
	}

	// {type == method_name, ... payload}
	termfilter_add(action) {
		// {terms}
		// term.validate
		if (Array.isArray(action.terms)) this.state.termfilter.terms.push(...action.terms)
		else this.state.termfilter.terms.push(action.terms)

		//main()
/*
		app.main()
		- filter.main()
		- cart.main()
		- [
			 plot.main( 
				notify plot.controls.main( 
					plot.controls.orientationInput 
				)
			 ), 
			 
			 plot.main(), ...
			]
*/
	}

	termfilter_del(action) {
		// {pos}
		if (!Number.isInteger(action.pos)) throw `invalid termfilter_del {pos:${action.pos}}`
		this.state.termfilter.terms.splice(action.pos, 1)
	}

	async getData(action) {
		const url = "..."
		if (url in this.serverData) {
			return Promise.resolve(this.serverData[url])
		} else {
			return fetch(url)
				.then(data=>data.json())
				.catch(console.log)
		}
	}
}

exports.tdbStoreInit = storeInit(TdbStore)
