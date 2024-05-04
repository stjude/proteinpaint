import { getCompInit } from '#rx'
import { Filter } from './FilterClass'
import { getNormalRoot } from './filter.utils'

// use this in rx-based apps
class FilterRxComp extends Filter {
	constructor(opts) {
		super(opts)
		this.type = 'filter'
		this.initHolder()
		// rx.getCompInit() will create this.opts, this.api
	}

	async preApiFreeze(api) {
		api.main = this.main.bind(this)
		api.getNormalRoot = () => getNormalRoot(this.rawFilter)
	}

	getState(appState) {
		return {
			termfilter: appState.termfilter,
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
		const rawCopy = JSON.stringify(rawFilter || f.filter)
		super.main(rawCopy, { activeCohort: this.state.activeCohort })
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
