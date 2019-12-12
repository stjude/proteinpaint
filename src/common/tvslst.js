import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import { TVSInit } from './tvs'
import * as client from '../client'

class TvsLst {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 500 }

		setRenderers(this)
		setInteractivity(this)

		this.categoryData = {}
		this.initUI()

		this.api = {
			main: async (data = {}) => {
				this.termfilter = data.termfilter
				this.updateUI()
			}
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}
}

exports.TvsLstInit = rx.getInitFxn(TvsLst)

function setRenderers(self) {
	self.initUI = function() {
		// add new term
		self.dom.addpilldiv = self.dom.holder
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '4px 6px 2px 6px')
			.style('display', 'inline-block')
			.style('margin-left', '7px')
			.style('border-radius', '6px')
			.style('color', '#000')
			.style('background-color', '#EEEEEE')
			.html('+ Click to add')
			.on('click', self.displayTreeMenu)

		self.dom.pilldiv = self.dom.holder.append('div')
	}

	self.updateUI = function() {
		if (!self.termfilter.terms.length) {
			// no term
			self.dom.addpilldiv.style('display', 'inline-block')
			self.dom.pilldiv.style('display', 'none')
		} else {
			self.dom.addpilldiv.style('display', 'none')
			self.dom.pilldiv.style('display', 'inline-block')
		}

		self.pills = []
		for (const [i, t] of self.termfilter.terms.entries()) {
			const pill = TVSInit({
				genome: self.genome,
				dslabel: self.dslabel,
				holder: self.dom.pilldiv,
				debug: self.opts.debug,
				callback: data => {
					self.opts.callback(data)
				}
			})
			pill.main(t)
			self.pills.push(pill)
		}
	}
}

function setInteractivity(self) {
	self.displayTreeMenu = holder => {
		self.dom.tip.clear().showunder(holder || self.dom.holder.node())
		appInit(null, {
			holder: self.dom.tip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
					// 	terms: terms
				}
			},
			modifiers: {
				//modifier to replace filter by clicking term btn
				tvs_select: tvs => {
					self.replaceFilter({ term: tvs })
				}
			},
			app: {
				callbacks: { 'postInit.test': () => {} }
			},
			barchart: {
				bar_click_override: tvslst => {
					self.dom.tip.hide()
					self.opts.callback({
						type: 'filter_replace',
						term: tvslst[0]
					})
				}
			}
		})
	}
}
