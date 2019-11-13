import * as rx from '../common/rx.core'
import * as client from '../client'
import { appInit } from '../termdb/app'

/*
opts{}
.holder
.genome
.dslabel
.term{} // optional
	.id
	.name
*/

class TermSetting {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.type = 'termsetting'
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.placeholder = opts.placeholder ? opt.placeholder : 'Select term&nbsp;'

		this.dom = {
			holder: opts.holder,
			tip: new client.Menu()
		}
		setInteractivity(this)
		setRenderers(this)
		this.initUI()

		// this api will be frozen inside the function returned by getInitFxn()
		this.api = {
			main: (data = {}) => {
				console.log(data)
				this.term = data.term
				this.q = data.q
				this.disable_terms = data.disable_terms
				this.updateUI()
			},
			showTree: this.showTree
		}
	}

	validateOpts(o) {
		if (!o.holder) throw 'no holder'
		if (o.term) {
			if (!o.term.id) throw 'term.id missing'
			if (!o.term.name) throw 'term.name missing'
		}
		if (!o.callback) throw 'missing callback'
		return o
	}
}

exports.termsettingInit = rx.getInitFxn(TermSetting)

function setRenderers(self) {
	self.initUI = () => {
		self.dom.pilldiv = self.dom.holder.append('div').style('display', 'inline-block')

		self.dom.labeldiv = self.dom.pilldiv
			.append('div')
			.html(self.placeholder)
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')
			.style('border-radius', '6px')
			.style('cursor', 'pointer')
			.on('click', self.term ? self.showMenu : self.showTree)

		self.dom.plusbtn = self.dom.holder
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.style('padding', '3px 6px 3px 6px')
			.style('display', 'inline-block')
			.style('border-radius', '6px')
			.style('background-color', '#4888BF')
			.html('&#43;')
			.on('click', self.showTree)
	}

	self.updateUI = () => {
		self.dom.plusbtn.style('display', self.term ? 'none' : 'inline-block')
		self.dom.labeldiv
			.html(self.term ? self.term.name : self.placeholder)
			.style('background', self.term ? '#4888BF' : 'transparent')
			.style('color', self.term ? 'white' : 'black')
			.style('padding', '3px 8px')
			.on('click', self.term ? self.showMenu : self.showTree)
	}
}

function setInteractivity(self) {
	self.removeTerm = () => {
		self.opts.callback(null)
	}

	self.showTree = () => {
		self.dom.tip.clear().showunder(self.dom.pilldiv.node())
		appInit(null, {
			holder: self.dom.tip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel
			},
			tree: {
				click_term: term => {
					self.dom.tip.hide()
					self.opts.callback(term) // main change
				},
				disable_terms: self.disable_terms
			}
		})
	}

	self.showMenu = () => {
		self.dom.tip.clear().showunder(self.dom.pilldiv.node())

		const term_option_div = self.dom.tip.d.append('div')
		const term_edit_div = self.dom.tip.d.append('div').style('text-align', 'center')

		const optsFxn = self.term.iscategorical
			? self.showCatOpts
			: self.term.isfloat || self.term.isinteger
			? self.showNumOpts
			: self.term.iscondition
			? self.showConditionOpts
			: null

		term_option_div
			.append('div')
			.style('margin', '5px 2px')
			.style('text-align', 'center')

		optsFxn(term_option_div)

		term_edit_div
			.append('div')
			.attr('class', 'replace_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '10px')
			.style('background-color', '#74b9ff')
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.text('Replace')
			.on('click', () => {
				self.dom.tip.clear()
				self.showTree()
			})
		term_edit_div
			.append('div')
			.attr('class', 'replace_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '10px')
			.style('background-color', '#ff7675')
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.text('Remove')
			.on('click', () => {
				self.dom.tip.hide()
				self.removeTerm()
			})
	}

	self.showCatOpts = async function(div) {
		const grpsetting_flag = self.q && self.q.groupsetting && self.q.groupsetting.inuse

		const default_btn_txt =
			(grpsetting_flag ? 'Using' : 'Use') +
			' default category' +
			(self.term.values ? '(n=' + Object.keys(self.term.values).length + ')' : '')

		// default (n=total) setting btn
		const default_btn = div
			.append('div')
			.attr('class', 'group_btn sja_filter_tag_btn')
			.style('display', 'block')
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '10px')
			.style('background-color', grpsetting_flag ? '#f8f8f8' : '#eee')
			.style('color', '#000')
			.style('pointer-events', grpsetting_flag ? 'none' : 'auto')
			.text(default_btn_txt)

		//show button/s for default groups
		if (self.term.groupsetting.lst) {
			for (const group of self.term.groupsetting.lst) {
				div
					.append('div')
					.attr('class', 'group_btn sja_filter_tag_btn')
					.style('display', 'block')
					.style('padding', '7px 6px')
					.style('margin', '5px')
					.style('text-align', 'center')
					.style('font-size', '.8em')
					.style('border-radius', '10px')
					.style('background-color', '#eee')
					.style('color', '#000')
					.html('Use <b>' + group.name + '</b>')
			}
		}

		// devide to grpups btn
		const devide_btn = div
			.append('div')
			.attr('class', 'group_btn sja_filter_tag_btn')
			.style('display', 'block')
			.style('padding', '7px 6px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('border-radius', '10px')
			.style('background-color', '#eee')
			.style('color', '#000')
			.html('Divide <b>' + self.term.name + '</b> to groups')

		if (self.term.groupsetting.disabled) devide_btn.style('display', 'none')
	}

	self.showNumOpts = async function(div) {}

	self.showConditionOpts = async function(div) {}
}
