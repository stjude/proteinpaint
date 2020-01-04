import * as rx from '../common/rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
// import { TVSInit } from './tvs'
import { filterInit } from '../common/filter'
//import { TvsLstBtnInit } from '../common/tvslstbtn'
import { appInit } from './app'
import * as client from '../client'
/*
for configuring filter; just a thin wrapper of blue filter UI
execution flow:
1. constructor builds and returns this.api{}
2. no state available for constructor so cannot do term-type specific things
3. upon getting state from app.js, call api.main() with latest state
4. then call this.initFilter() to initiate filter
*/
class TdbFilter {
	constructor(app, opts) {
		this.type = 'filter'
		this.app = app
		this.validateOpts(opts)
		setRenderers(this)
		this.categoryData = {}
		this.initHolder()
		this.api = rx.getComponentApi(this)
		this.eventTypes = ['postInit', 'postRender']
	}

	validateOpts(o) {
		// if (!('id' in o)) throw 'opts.id missing' // plot id?
		if (!o.holder) throw 'opts.holder missing'
		this.opts = o
		this.dom = { holder: o.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }
	}

	getState(appState) {
		return appState
	}

	main() {
		if (!this.filterUi) this.initFilter()
		this.render()
	}

	initFilter() {
		this.filterUi = filterInit({
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.filterTip.d, //  this.dom.filterDiv,
			debug: this.app.opts.debug,
			getData: () => this.state.termfilter.filter,
			callback: filter => {
				this.app.dispatch({
					type: 'filter_replace',
					filter
				})
			}
		})
	}
}

exports.filterInit = rx.getInitFxn(TdbFilter)

function setRenderers(self) {
	self.initHolder = function() {
		const div = this.dom.holder
			.attr('class', 'filter_div')
			.style('width', 'fit-content')
			.style('padding', '5px')
			.style('margin', '10px')
			.style('margin-top', '5px')
			.style('display', 'table')
			.style('border', 'solid 1px #ddd')

		// div
		// 	.append('div')
		// 	.style('display', 'table-cell')
		// 	.style('vertical-align','middle')
		// 	.style('text-transform', 'uppercase')
		// 	.style('color', '#bbb')
		// 	.style('margin-right', '10px')
		// 	.html('Filter')

		const filter_div = div.append('div').style('display', 'table-cell')
		this.setFilterBtn(filter_div, 'Filter', 'filter')
	}

	self.setFilterBtn = function(div, label, prefix) {
		const btnName = prefix + 'Btn'
		const tipName = prefix + 'Tip'
		const divName = prefix + 'Div'

		const filter_div = div.append('div').style('display', 'block')

		//Title for the div - Inclusion/Exclusion
		/*filter_div
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '10px 15px')
			.style('width', '70px')
			.style('text-transform', 'uppercase')
			.style('font-size', '.8em')
			.style('color', '#bbb')*/

		this.dom[btnName] = filter_div
			.append('div')
			.html(label)
			.attr('class', 'sja_filter_btn')
			.style('display', 'inline-block')
			.style('cursor', 'pointer')
			.on('click', () => {
				self.dom[tipName].showunder(btnElem)
			})

		const btnElem = this.dom[btnName].node()

		this.dom[tipName] = new client.Menu({ padding: '5px' })
		this.dom[divName] = this.dom[tipName].d
	}

	self.render = function() {
		const termfilter = self.state && self.state.termfilter
		if (termfilter && !termfilter.show_top_ui) {
			this.dom.holder.style('display', 'none')
			return
		}
		this.dom.holder.style('display', 'inline-block')

		self.filterUi.main(termfilter.filter)
	}
}
