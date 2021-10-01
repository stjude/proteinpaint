import { setNumericMethods as setDiscreteMethods } from './termsetting.discrete'
import { setNumericMethods as setContMethods } from './termsetting.continuous'
import { init_tabs, update_tabs } from '../common/dom/toggleButtons'

const tsInstanceTracker = new WeakMap()
let i = 0

export async function setNumericTabs(self) {
	if (!tsInstanceTracker.has(self)) {
		tsInstanceTracker.set(self, i++)
	}

	self.get_term_name = function(d) {
		if (!self.opts.abbrCutoff) return d.name
		return d.name.length <= self.opts.abbrCutoff + 2
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
	}

	self.get_status_msg = () => ''

	self.showEditMenu = async function(div) {
		div.style('padding', '5px 10px')

		div
			.append('div')
			.style('display', 'inline-block')
			.html('Use as')

		const tabDiv = div.append('div').style('display', 'inline-block')
		const cont = {
			div: div.append('div').style('display', 'none'),
			fxns: await setContMethods(self, 'non-closured')
		}
		const discrete = {
			div: div.append('div').style('display', 'none'),
			fxns: await setDiscreteMethods(self, 'non-closured')
		}

		const tabs = [
			{
				label: 'Continuous',
				callback: async div => {
					discrete.div.style('display', 'none')
					cont.div.style('display', 'block')
					cont.fxns.showEditMenu(self, cont.div)
				}
			},
			{
				active: true, // for testing only, will default to continuous later
				label: 'Discrete',
				callback: async div => {
					cont.div.style('display', 'none')
					discrete.div.style('display', 'block')
					discrete.fxns.showEditMenu(self, discrete.div)
				}
			}
		]

		init_tabs(tabDiv, tabs)
		//discrete.fxns.showEditMenu(self, discrete.div.style('display', 'block'))
	}
}
