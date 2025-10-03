import { getCompInit } from '#rx'
import { Filter } from './FilterClass'
import { getNormalRoot } from './filter.utils'

// use this in rx-based apps
class FilterRxComp extends Filter {
	constructor(opts) {
		super(opts)
		this.type = 'filter'
		this.parentId = opts.parentId
		this.initHolder()
		// rx.getCompInit() will create this.opts, this.api
	}

	async preApiFreeze(api) {
		api.main = this.main.bind(this)
		api.getNormalRoot = () => getNormalRoot(this.rawFilter)
	}

	getState(appState) {
		const parentConfig = this.parentId && appState.plots.find(p => p.id === this.parentId)
		const defaultFilter = { type: 'tvslst', join: '', lst: [] }
		return {
			// if there is parentConfig, assume this is UI for a local filter,
			// otherwise this UI is for global app filter
			termfilter: parentConfig ? { filter: parentConfig.filter || defaultFilter } : appState.termfilter,
			activeCohort: appState.activeCohort
		}
	}

	async main(rawFilter = null) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const f = this.state && this.state.termfilter
		if (!f) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'inline-block')
		this.rawCopy = JSON.stringify(rawFilter || f?.filter)
		super.main(this.rawCopy, { activeCohort: this.state.activeCohort })
	}

	initHolder() {
		const div = this.dom.holder
			.attr('class', 'filter_div')
			.style('position', 'relative')
			.style('width', 'fit-content')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style('display', 'table')
			.style('border', this.opts.hideLabel ? 'none' : 'solid 1px #ddd')

		if (this.opts.hideLabel) {
			this.dom.filterDiv = div.style('display', 'inline-block').style('padding', '5px 10px')
		} else {
			div.append('span').text('Filter').style('padding', '0 10px')

			this.dom.filterDiv = div.append('div').style('display', 'inline-block').style('padding', '5px 10px')
		}
	}
}

export const filterRxCompInit = getCompInit(FilterRxComp)
