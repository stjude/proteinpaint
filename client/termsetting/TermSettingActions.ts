import type { TermSettingInner } from './TermSettingInner'
import { Menu } from '#dom'
import { TwRouter } from '#tw'
import { isNumericTerm } from '#shared/terms.js'
import { get$id } from './termsetting.ts'

export class TermSettingActions {
	self: TermSettingInner

	constructor(opts) {
		this.self = opts.self
	}

	removeTerm() {
		this.self.opts.callback(null)
	}

	async cancelGroupsetting() {
		const self = this.self
		self.opts.callback(
			await TwRouter.fill({
				id: self.term.id,
				term: self.term,
				q: { mode: 'discrete', type: 'values', isAtomic: true }
			})
		)
	}

	async clickNoPillDiv() {
		const self = this.self
		// support various behaviors upon clicking nopilldiv
		if (!self.noTermPromptOptions || self.noTermPromptOptions.length == 0) {
			// show tree to select a dictionary term
			await self.showTree(self.dom.nopilldiv.node())
			return
		}
		self.dom.tip.clear().showunder(self.dom.nopilldiv.node())
		// create small menu, one option for each ele in noTermPromptOptions[]
		const optionTip = new Menu()
		for (const option of self.noTermPromptOptions) {
			// {isDictionary, termtype, text, html, q{}}
			const item = self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.on('click', async event => {
					optionTip.clear().hide()
					if (option.invalid) {
						// invalid option, display message
						optionTip
							.show(event.clientX, event.clientY)
							.d.append('div')
							.text(option.invalidMsg || '')
						return
					}
					self.dom.tip.clear()
					if (option.isDictionary) {
						await self.showTree(self.dom.tip.d.node())
					} else if (option.termtype) {
						// pass in default q{} to customize settings in edit menu
						if (option.q) self.q = structuredClone(option.q)
						await self.setHandler(option.termtype)
						if (isNumericTerm(self.term) && !self.term.bins && self.term.type != 'survival') {
							const tw = { term: self.term, q: self.q, $id: '' }
							tw.$id = await get$id(tw)
							await self.vocabApi.setTermBins(tw)
						}
						if (!self.$id) self.$id = await get$id(self.vocabApi.getTwMinCopy({ term: self.term, q: self.q }))
						self.handler!.showEditMenu(self.dom.tip.d)
					} else {
						throw 'termtype missing'
					}
				})
			if (option.text) item.text(option.text)
			else if (option.html) item.html(option.html)
		}
		// load the input ui for this term type
	}
}
