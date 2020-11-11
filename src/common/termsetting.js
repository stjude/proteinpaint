import * as rx from '../common/rx.core'
import * as client from '../client'
import { select, event } from 'd3-selection'
import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, brushX, drag as d3drag, transform } from 'd3'
import { setNumericMethods } from './termsetting.numeric2'
import { setCategoricalMethods } from './termsetting.categorical'
import { setConditionalMethods } from './termsetting.conditional'
import { appInit } from '../termdb/app'

/*

************** opts{} of constructor
.holder
.genome
.dslabel
.use_bins_less
	boolean. if true, to initiate q{} of newly selected numeric term with bins.less (if available)
.placeholder
.callback( data )
	.term{} // optional
	.q{}


************** this.api, exposed!!
.main( data )
	.term{} // optional
	.q{}
	.disable_terms
.showTree()


************** instance private properties
.opts{}
.term{}
.q{}
.disable_terms[]


************** introducing the atypical API
-- this.api{} is self-made, not generated by getComponentApi
-- api not registered in caller.components{}, not in the notify-cycle
-- no bus
-- upon init, termsetting constructor does not accept initial value of term/q
   term/q/disable_terms will only be set/updated through api.main()
-- termsetting opts.callback() will send caller updated term/q via user fiddling


************** explain behavior here:

*/

class TermSetting {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.activeCohort = opts.activeCohort
		this.placeholder = opts.placeholder || 'Select term&nbsp;'
		this.durations = { exit: 500 }

		this.dom = {
			holder: opts.holder,
			tip: new client.Menu({ padding: '0px' })
		}
		setInteractivity(this)
		setRenderers(this)
		this.initUI()

		// this api will be frozen and returned by termsettingInit()
		this.api = {
			main: async (data = {}) => {
				// console.log(data)
				this.validateMainData(data)
				// term is read-only if it comes from state, let it remain read-only
				this.term = data.term
				this.q = rx.fromJson(rx.toJson(data.q)) // q{} will be altered here and must not be read-only
				this.disable_terms = data.disable_terms
				this.filter = data.filter
				if ('activeCohort' in data) this.activeCohort = data.activeCohort
				// reset methods by term type
				if (this.term) this.setMethodsByTermType[this.term.type](this)
				this.updateUI()
			},
			showTree: this.showTree
		}
	}

	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.vocab) {
			if (!o.genome) throw '.genome missing'
			if (!o.dslabel) throw '.dslabel missing'
		}
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}
	validateMainData(d) {
		if (d.term) {
			// term is optional
			if (!d.term.id) throw 'data.term.id missing'
			if (!d.term.name) throw 'data.term.name missing'
		}
		if (!d.q) d.q = {}
		if (typeof d.q != 'object') throw 'data.q{} is not object'
		if (d.disable_terms) {
			if (!Array.isArray(d.disable_terms)) throw 'data.disable_terms[] is not array'
		}
	}
}

exports.termsettingInit = rx.getInitFxn(TermSetting)

function setRenderers(self) {
	self.initUI = () => {
		// toggle the display of pilldiv and nopilldiv with availability of this.term
		self.dom.nopilldiv = self.dom.holder
			.append('div')
			.style('cursor', 'pointer')
			.on('click', self.showTree)
		self.dom.pilldiv = self.dom.holder.append('div')

		// nopilldiv - placeholder label
		self.dom.nopilldiv
			.append('div')
			.html(self.placeholder)
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')

		// nopilldiv - plus button
		self.dom.nopilldiv
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.text('+')

		self.setMethodsByTermType = {
			integer: setNumericMethods,
			float: setNumericMethods,
			categorical: setCategoricalMethods,
			condition: setConditionalMethods
		}
	}

	self.updateUI = () => {
		if (!self.term) {
			// no term
			self.dom.nopilldiv.style('display', 'block')
			self.dom.pilldiv.style('display', 'none')
			return
		}
		self.dom.nopilldiv.style('display', 'none')
		self.dom.pilldiv.style('display', 'block')

		const pills = self.dom.pilldiv.selectAll('.ts_pill').data([self.term], d => d.id)

		// this exit is really nice
		pills.exit().each(self.exitPill)

		pills
			.transition()
			.duration(200)
			.each(self.updatePill)

		pills
			.enter()
			.append('div')
			.attr('class', 'ts_pill')
			.style('cursor', 'pointer')
			.style('margin', '2px')
			.on('click', self.showMenu)
			.transition()
			.duration(200)
			.each(self.enterPill)
	}

	self.enterPill = async function() {
		const one_term_div = select(this)

		// left half of blue pill
		self.dom.pill_termname = one_term_div
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'term_name_btn  sja_filter_tag_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '6px')
			.html(self.term_name_gen)

		self.updatePill.call(this)
	}

	self.updatePill = async function() {
		// only modify right half of the pill
		const one_term_div = select(this)
		if (self.term.type == 'condition' && !self.q.bar_by_children && !self.q.bar_by_grade) {
			self.q.bar_by_grade = true
			self.q.value_by_max_grade = true
			self.q.groupsetting = {}
		}

		// if using group setting, will show right half
		// allow more than 1 flags for future expansion
		const grpsetting_flag = self.q.groupsetting && self.q.groupsetting.inuse

		const status_msg = self.get_status_msg()

		self.dom.pill_termname.style(
			'border-radius',
			grpsetting_flag || self.term.type == 'condition' ? '6px 0 0 6px' : '6px'
		)

		const pill_settingSummary = one_term_div
			.selectAll('.ts_summary_btn')
			// bind d.txt to dom, is important in making sure the same text label won't trigger the dom update
			.data(status_msg ? [{ txt: status_msg }] : [], d => d.txt)

		// because of using d.txt of binding data, exitPill cannot be used here as two different labels will create the undesirable effect of two right halves
		pill_settingSummary.exit().remove()

		pill_settingSummary
			.enter()
			.append('div')
			.attr('class', 'ts_summary_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('font-style', 'italic')
			.html(d => d.txt)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)
	}

	self.exitPill = function() {
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}
}

function setInteractivity(self) {
	self.removeTerm = () => {
		self.opts.callback(null)
	}

	self.showTree = holder => {
		self.dom.tip.clear().showunder(holder || self.dom.holder.node())

		appInit(null, {
			vocab: self.opts.vocab, // could be null if genome + dslabel are provided
			genome: self.genome, // could be null if vocab is provided
			dslabel: self.dslabel, // could be null if vocab is provided
			holder: self.dom.tip.d,
			state: {
				activeCohort: 'activeCohort' in self ? self.activeCohort : -1,
				nav: {
					header_mode: 'search_only'
				}
			},
			tree: {
				disable_terms: self.disable_terms,
				click_term: term => {
					self.dom.tip.hide()
					const data = { id: term.id, term, q: {} }
					let _term = term
					if (self.opts.use_bins_less && (term.type == 'integer' || term.type == 'float') && term.bins.less) {
						// instructed to use bins.less which is present
						// make a decoy term replacing bins.default with bins.less
						_term = JSON.parse(JSON.stringify(term))
						_term.bins.default = _term.bins.less
					}
					termsetting_fill_q(data.q, _term)
					self.opts.callback(data)
				}
			}
		})
	}

	self.showMenu = () => {
		self.dom.tip.clear().showunder(self.dom.holder.node())
		if (self.opts.showFullMenu) {
			self.showEditReplaceRemoveMenu(self.dom.tip.d)
		} else {
			self.showEditMenu(self.dom.tip.d)
		}
	}

	self.showEditReplaceRemoveMenu = async function(div) {
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'block')
			.style('padding', '7px 15px')
			.style('margin', '2px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('edit')
			.on('click', () => {
				self.dom.tip.clear()
				self.showEditMenu(self.dom.tip.d)
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'block')
			.style('padding', '7px 15px')
			.style('margin', '2px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Replace')
			.on('click', () => {
				self.dom.tip.clear()
				self.showTree()
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'block')
			.style('padding', '7px 15px')
			.style('margin', '2px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Remove')
			.on('click', () => {
				self.dom.tip.hide()
				self.removeTerm()
			})
	}
}

function termsetting_fill_q(q, term) {
	// to-do: delete this code block when all term.is* has been removed from code
	if (!term.type) {
		term.type = term.iscategorical
			? 'categorical'
			: term.isfloat
			? 'float'
			: term.isinteger
			? 'integer'
			: term.iscondition
			? 'condition'
			: ''
	}

	if (term.type == 'integer' || term.type == 'float') {
		if (!valid_binscheme(q)) {
			/*
			if q is already initiated, do not overwrite
			to be tested if can work with partially declared state
			always copies from .bins.default
			*/
			rx.copyMerge(q, term.bins.default)
		}
		set_hiddenvalues(q, term)
		return
	}
	if (term.type == 'categorical' || term.type == 'condition') {
		set_hiddenvalues(q, term)
		if (!q.groupsetting) q.groupsetting = {}
		if (term.groupsetting.disabled) {
			q.groupsetting.disabled = true
			return
		}
		delete q.groupsetting.disabled
		if (!('inuse' in q.groupsetting)) q.groupsetting.inuse = false // do not apply by default

		if (term.type == 'condition') {
			/*
			for condition term, must set up bar/value flags before quiting for inuse:false
			*/
			if (q.value_by_max_grade || q.value_by_most_recent || q.value_by_computable_grade) {
				// need any of the three to be set
			} else {
				// set a default one
				q.value_by_max_grade = true
			}
			if (q.bar_by_grade || q.bar_by_children) {
			} else {
				q.bar_by_grade = true
			}
		}

		if (!q.groupsetting.inuse) {
			// inuse:false is either from automatic setup or predefined in state
			// then no need for additional setup
			return
		}
		// if to apply the groupsetting
		if (term.groupsetting.lst && term.groupsetting.useIndex >= 0 && term.groupsetting.lst[term.groupsetting.useIndex]) {
			q.groupsetting.predefined_groupset_idx = term.groupsetting.useIndex
		}
		return
	}
	throw 'unknown term type'
}
exports.termsetting_fill_q = termsetting_fill_q

function set_hiddenvalues(q, term) {
	if (!q.hiddenValues) {
		q.hiddenValues = {}
	}
	if (term.values) {
		for (const k in term.values) {
			if (term.values[k].uncomputable) q.hiddenValues[k] = 1
		}
	}
}

function valid_binscheme(q) {
	if (Number.isFinite(q.bin_size) && q.first_bin) {
		if (q.first_bin.startunbounded) {
			if (Number.isInteger(q.first_bin.stop_percentile) || Number.isFinite(q.first_bin.stop)) {
				return true
			}
		} else {
			if (Number.isInteger(q.first_bin.start_percentile) || Number.isFinite(q.first_bin.start)) {
				return true
			}
		}
	}
	return false
}
