import * as rx from '../rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { TVSInit } from './tvs'
import { appInit } from './app'
import * as client from '../client'

class TdbFilter {
	constructor(app, opts) {
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }

		// see rx.core getComponentApi().main() on
		// how these key-values are used
		this.reactsTo = {
			prefix: ['filter'],
			type: ['app_refresh']
		}
		setRenderers(this)

		this.categoryData = {}
		this.initHolder()
		this.components = {
			tvs: TVSInit(app, {
				holder: opts.holder,
				modifiers: opts.modifiers
			})
		}

		this.bus = new rx.Bus('filter', ['postInit', 'postRender'], app.opts.callbacks, this.api)
		// TODO: check if this is required
		// this.bus.emit('postInit')
	}

	async main(action) {
		this.bus.emit('postRender')
		this.render(action)
	}

	render(action) {
		this.components.tvs.main(action)
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
			.style('display', 'block')
			.style('border', 'solid 1px #ddd')

		div.append('div')
			.style('display', 'inline-block')
			.style('text-transform', 'uppercase')
			.style('color', '#bbb')
			.style('margin-right', '10px')
			.html('Filter')

		// div to display all tvs bluepills
		div.append('div')
			.attr('class', 'terms_div')
			.style('display', 'inline-block')
	}
}