import * as rx from '../common/rx.core'
//import { dofetch, getOneGenome } from '../common/dofetch'
//import { getPlotConfig, validatePlot } from '../mass/plot.utils'

const defaultState = {
	nav: {
		show_tabs: false,
		activeTab: 0
	},
	plots: [],
	termfilter: {
		filter: {
			type: 'tvslst',
			in: true,
			join: '',
			lst: []
		}
	}
	//autoSave: true
}

/*
in block constructor, will call rehydrate (async) to build up initial state,
based on user configs from app.opts.state
*/
class Store {
	constructor(app) {
		// app is Block instance api
		this.api = rx.getStoreApi(this)
		this.app = app
		this.copyMerge = rx.copyMerge
		this.deepFreeze = rx.deepFreeze
		this.toJson = rx.toJson
		this.fromJson = rx.fromJson
	}
}

export const storeInit = rx.getInitFxn(Store)

Store.prototype.actions = {
	plot_edit(action) {
		const plot = this.state.plots[action.id]
		if (plot) {
			rx.copyMerge(plot, action.config, action.opts ? action.opts : {}, this.replaceKeyVals)
			validatePlot(plot)
		}
	}
}

Store.prototype.rehydrate = async function() {
	const sto = this.app.opts.state
	// sto contains arbitrary customizations, must validate before apply
	const state = {
		genome: {} //await getOneGenome(sto.genome)
	}
	// done rehydrating
	this.state = rx.copyMerge(this.toJson(defaultState), sto)
	for (const plot of this.state.plots) {
		rx.copyMerge(plot, getPlotConfig(plot))
	}
}

//////////////////////// helpers
