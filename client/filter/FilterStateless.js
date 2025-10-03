import { getInitFxn, Bus } from '#rx'
import { Filter } from './FilterClass'
import { getNormalRoot } from './filter.utils'

// use this in a non-rx-based apps,
// and for simple filter data shapes where there are no tags like filterUiRoot
class FilterStateless extends Filter {
	constructor(opts) {
		super(opts)
		this.api = {
			// make sure to bind the 'this' context to the filter instance
			// instead of to the this.api object
			main: this.main.bind(this),
			/*
				WARNING!!!
				When using this filter.api.getNormalRoot(),
				make sure this instance has been updated before the caller,
				otherwise the normalized root will be stale

				or for reliability, import getNormalRoot() directly 
				from the common/filter.js component and supply the 
				caller's known raw filter state
			*/
			getNormalRoot: () => getNormalRoot(this.rawFilter),
			getPromise: name => this.promises[name],
			destroy: () => this.destroy()
		}

		if (opts.callbacks) {
			this.events = ['postInit', 'postRender', 'firstRender']
			this.bus = new Bus(this.api, this.events, opts.callbacks)
		}
	}

	async main(rawFilter, opts = {}) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const activeCohort = 'activeCohort' in opts ? opts.activeCohort : this.activeCohort
		const rawCopy = JSON.stringify(rawFilter)
		// if the filter data and active cohort has not changed, do not trigger a re-render
		if (this.rawCopy == rawCopy && JSON.stringify(this.activeCohort) == JSON.stringify(activeCohort)) return
		await super.main(rawCopy, opts)
	}
}

export const filterInit = getInitFxn(FilterStateless)
