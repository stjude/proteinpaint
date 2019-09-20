import {Store, getInitFxn} from "../rx.core"
import {dofetch2} from "../client"

const defaultState = {
	dslabel:'SJLife',
	genome:'hg38',
	currViews: ["test"],
	terms: [],
	controls: {
		search: ""
	}
}

export class ToyStore extends Store {
	constructor(app) {
		super()
		this.app = app
		// need to convert from array to Set, Map as needed
		this.state = Object.assign({}, defaultState, app.opts.state)
		this.opts = JSON.parse(JSON.stringify(app.opts))
	}

	async term_add(action) {
		if (this.state.terms.find(d => d.id == action.termid)) {
			alert(`The termid='${action.termid}' is already printed.`)
			return
		}
		const lst = ["genome=" + this.state.genome.name + "&dslabel=" + this.state.dslabel]
		const url = "/termdb?genome=hg38&dslabel=SJLife&gettermbyid=" + action.termid
		const init = action.init ? action.init : {}
		const fetchOpts = this.opts.fetchOpts ? this.opts.fetchOpts : {}
		const data = await dofetch2(url, init, fetchOpts)
		if (data.term) this.state.terms.push(data.term)
		else alert(`Term not found for id=${action.termid}`) 

		// optional: maybe add a "result" key to action
		// In general, not needed since a component should
		// know where to look for relevant data in 
		// this.app.state, .opts, .serverData
		action.result = this.state.terms
	}

	term_rm(action) {
		const i = this.state.terms.findIndex(d => d.id == action.termid)
		if (i == -1) return
		this.state.terms.splice(i, 1)
	}
}

export const storeInit = getInitFxn(ToyStore)
