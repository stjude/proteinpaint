import * as rx from '../common/rx.core'
import * as client from '../client'

/*
opts{}
.holder
.term{}
	.id
	.name


emits "termUpdated" event after self.term is deleted, added, or replaced
*/

class termsetting {
	constructor(notused, opts) {
		this.validateOpts(opts)
		this.type = 'termsetting'
		this.api = rx.getComponentApi(this)
		setRenderers(this)
		setInteractivity(this)
		this.dom = {
			holder: opts.holder,
			tip: new client.Menu()
		}
		this.initUI()
		// one instance only manages one term
		this.term = opts.term
		this.eventTypes = ['termChanged']
		this.main()
	}
	main() {
		this.updateUI()
	}
	validateOpts(o) {
		if (!o.holder) throw 'no holder'
		if (o.term) {
			if (!o.term.id) throw 'term.id missing'
			if (!o.term.name) throw 'term.name missing'
		}
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
			.on('click', () => {
				self.dom.tip.clear().showunder(self.dom.plusbtn.node())
				self.showTree()
			})
	}
	self.updateUI = () => {
		if (!self.term) {
			self.dom.pilldiv.selectAll('*').remove()
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
			.style('padding', '3px 8px')
	}
}
function setInteractivity(self) {
	self.removeTerm = () => {
		self.term = null
		self.updateUI()
		self.bus.emit('termUpdated')
	}
	self.showTree = () => {
		// click_term callback should do
		//self.bus.emit('termUpdated', newterm)
	}
	self.showMenu = () => {}
}
