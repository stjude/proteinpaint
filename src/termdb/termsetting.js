import * as rx from '../rx/core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from './app'
import * as client from '../client'

class TermSetting {
	constructor(app, opts) {
		this.type = 'termsetting'
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		this.app = app
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.plot = opts.plot
		this.term_index = opts.term_id
		this.durations = { exit: 500 }

		setRenderers(this)
		setInteractivity(this)

		this.categoryData = {}
		this.initHolder()
	}

	main() {
		const terms_div = this.dom.holder.selectAll('.terms_div')
		if (!terms_div.size()) return
		const pill_term =
			this.term_index == 'term0'
				? this.state.config.term0
				: this.term_index == 'term1'
				? this.state.config.term
				: this.term_index == 'term2'
				? this.state.config.term2
				: undefined
		const blue_pills = terms_div.selectAll('.tvs_pill').data(pill_term, d => d.term.id)

		blue_pills.exit().each(this.exitFilter)
		blue_pills.each(this.updateFilter)
		blue_pills
			.enter()
			.append('div')
			.attr('class', 'tvs_pill')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.style('padding', '2px')
			.transition()
			.duration(200)
			.each(this.addFilter)

		// when there are blue_pills to be removed, must account for the delayed
		// removal after opacity transition, as btn count will decrease only
		// after the transition and remove() is done
		this.bus.emit('postRender', null, blue_pills.exit().size() ? this.durations.exit + 100 : 0)
	}
}

exports.termSettingInit = rx.getInitFxn(TermSetting)

function setRenderers(self) {
	self.initHolder = function() {
		this.dom.holder.append('span').html(self.mainlabel ? self.mainlabel + '&nbsp;' : 'Select term&nbsp;')

		// add new term
		this.dom.holder
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.html('&#43;')
			.on('click', self.displayTreeMenu)
	}
}

function setInteractivity(self) {
	self.displayTreeMenu = async function(term) {
		const one_term_div = this
		self.dom.tip.clear().showunder(one_term_div)
		const treediv = self.dom.tip.d.append('div')
		// set termfilter terms to all filter-terms if '+' or all except current term if 'term_name_btn'
		const terms = select(one_term_div).classed('add_term_btn')
			? self.app.Inner.state.termfilter.terms
			: self.app.Inner.state.termfilter.terms.filter(t => t.id != term.termId)

		// a new object as init() argument for launching the tree with modifiers
		const opts = {
			holder: treediv,
			state: {
				dslabel: self.app.Inner.state.dslabel,
				genome: self.app.Inner.state.genome,
				termfilter: {
					show_top_ui: false,
					terms: terms
				}
			},
			modifiers: {
				//TODO: add tvs as new filter from '+' button
				click_term: self.addPill
			},
			callbacks: {}
		}
		appInit(null, opts)
	}

	self.addPill = function(ts) {
		self.app.dispatch({
			type: 'plot_edit',
			id: self.plot.config.id,
			config: {
				[self.term_index]: {
					id: ts.id,
					term: ts
				}
			}
		})
	}
}
