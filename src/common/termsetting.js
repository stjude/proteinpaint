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
	constructor(app, opts) {
		this.opts = this.validateOpts(opts)
		this.type = 'termsetting'
		this.app = app
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
			main: (data={}) => { 
				this.data = data
				this.term = data.term
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
		self.dom.pilldiv = self.dom.holder.append('div')
			.style('display', 'inline-block')

		self.dom.labeldiv = self.dom.pilldiv.append('div')
			.html(self.placeholder)
			.style('cursor', 'pointer')
			.on('click', self.showTree)

		self.dom.plusbtn = self.dom.holder
			.append('div')
			.text('+')
			.style('display', 'inline-block')
			.style('cursor', 'pointer')
			.style('padding', '3px 5px')
			.style('background', 'blue')
			.style('color', 'white')
			.on('click', self.showTree)

		self.dom.removebtn = self.dom.holder
			.append('div')
			.text('-')
			.style('display', 'inline-block')
			.style('cursor', 'pointer')
			.style('padding', '3px 5px')
			.style('background', 'red')
			.style('color', 'white')
			.on('click', self.removeTerm)
	}

	self.updateUI = () => {
		self.dom.plusbtn.style('display', self.term ? 'none' : 'inline-block')
		self.dom.removebtn.style('display', self.term ? 'inline-block' : 'none')
		self.dom.labeldiv
			.html(self.term ? self.term.term.name : self.placeholder)
			.style('background', self.term ? 'blue' : 'transparent')
			.style('color', self.term ? 'white' : '')
			.style('padding', '3px 8px')
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
			modifiers: {
				click_term: term => {
					self.dom.tip.hide()
					self.opts.callback(term) // main change
				}
			}
		})
	}

	self.showMenu = () => {
		self.dom.tip.clear().showunder(pill.node())
		self.dom.tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('Replace')
			.on('click', () => {
				self.dom.tip.clear()
				self.showTree()
			})
		self.dom.tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.text('Remove')
			.on('click', () => {
				self.dom.tip.hide()
				self.removeTerm()
			})
	}
}
