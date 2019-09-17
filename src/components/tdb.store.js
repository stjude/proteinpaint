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
		this.state = opts.state;
		this.app = opts.app
		this.async = ["dofetch"]
		this.serverData = {}
	}

	termfilter_add(action) {
		// {terms}
		if (Array.isArray(action.terms)) this.state.termfilter.terms.push(...action.terms)
		else this.state.termfilter.terms.push(action.terms)
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
