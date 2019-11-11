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


emits "termChanged" event after self.term is deleted, added, or replaced
at bus.emit(), must use {term} as arg and wrap the term inside {}. otherwise bus will automatically use defaultArg
*/

class termsetting {
	constructor(app, opts) {
		this.opts = this.validateOpts(opts)
		this.type = 'termsetting'
		this.app = app
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.api = rx.getComponentApi(this)
		setRenderers(this)
		setInteractivity(this)
		this.dom = {
			holder: opts.holder,
			tip: new client.Menu()
		}
		this.initUI()
		this.eventTypes = ['termChanged']
		//this.main()
	}
	main({ data, term }) {
		this.term = term
		this.updateUI()
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

exports.termsettingInit = rx.getInitFxn(termsetting)

function setRenderers(self) {
	self.initUI = () => {
		self.dom.pilldiv = self.dom.holder.append('div').style('display', 'inline-block')
		self.dom.plusbtn = self.dom.holder
			.append('div')
			.style('display', 'inline-block')
			.text('+')
			.style('padding', '3px 5px')
			.style('background', 'blue')
			.style('color', 'white')
			.on('click', () => {
				self.dom.tip.clear().showunder(self.dom.plusbtn.node())
				self.showTree()
			})
	}
	self.updateUI = () => {
		self.dom.pilldiv.selectAll('*').remove()
		if (!self.term) {
			self.dom.plusbtn.style('display', 'inline-block')
			return
		}
		self.dom.plusbtn.style('display', 'none')
		const pill = self.dom.pilldiv.append('div').on('click', () => {
			self.dom.tip.clear().showunder(pill.node())
			self.showMenu()
		})
		pill
			.append('div')
			.style('display', 'inline-block')
			.text(self.term.name)
			.style('background', 'blue')
			.style('color', 'white')
			.style('padding', '3px 8px')
	}
}
function setInteractivity(self) {
	self.removeTerm = () => {
		self.term = null
		self.opts.callback(null)
	}
	self.showTree = () => {
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
