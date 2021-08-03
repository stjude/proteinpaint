import * as rx from '../common/rx.core'
import { event } from 'd3-selection'
import { dofetch } from '../common/dofetch'
import { storeInit } from './store'
import { sayerror } from '../common/dom/error'
//import { plotInit } from './plot.component'

/*
constructor opts{}:
*/

class Mass {
	constructor(opts) {
		this.type = 'app'
		this.opts = this.validateOpts(opts)
		this.initDom()
		this.api = rx.getAppApi(this)
		this.store = storeInit(this.api)
		this.eventTypes = ['postInit', 'postRender']
		this.store
			.copyState({ rehydrate: 1 })
			.then(state => {
				this.state = state
				if (this.state.genome.debug) {
					// debug should be solely defined by server; this requires genome obj to be always hydrated from server and not client-provided
					window.bb = this
				}
				this.components = { plots: [] }
				this.api.dispatch()
			})
			.catch(e => this.error(e))
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.state) throw '.state{} missing'
		if (!o.state.genome) throw '.state.genome missing'
		if (typeof o.state.genome != 'string') throw '.state.genome is not string'
		return o
	}
	error(e) {
		sayerror(this.dom.errordiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
	main() {
		const plots = this.dom.plotdiv.selectAll('.sjp4-plot-div').data(this.state.plots, d => d.id)

		plots.exit().remove()
		//plots.each(render)
		plots
			.enter()
			.append('div')
			.attr('class', 'sjp4-plot-div')
			.each(config => {
				const opts = {
					holder: this.dom.plotdiv.append('div'),
					config,
					callbacks: this.opts.plot?.callbacks || {}
				}
				//this.components.plots.push(plotInit(this.api, opts))
			})
	}
}

export const appInit = rx.getInitFxn(Mass)

Mass.prototype.initDom = function() {
	const holder = this.opts.holder
	this.dom = {
		errordiv: holder.append('div'),
		plotdiv: holder.append('div')
	}
}
