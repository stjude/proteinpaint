import { setNumericMethods as setDiscreteMethods } from './termsetting.discrete'
import { setNumericMethods as setContMethods } from './termsetting.continuous'
import { init_tabs, update_tabs } from '../dom/toggleButtons'

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

		const topBar = div.append('div').style('margin-left', '20px')
		topBar
			.append('div')
			.style('display', 'inline-block')
			.html('Use as')

		const tabDiv = topBar.append('div').style('display', 'inline-block')
		const cont = {
			//div: div.append('div')/*.style('display', 'none')*/,
			fxns: await setContMethods(self, 'non-closured')
		}
		const discrete = {
			//div: div.append('div')/*.style('display', 'none')*/.style('max-width', '500px'),
			fxns: await setDiscreteMethods(self, 'non-closured')
		}

		const tabs = [
			{
				active: self.q.mode && self.q.mode == 'discrete' ? false : true,
				label: 'Continuous',
				callback: async div => {
					self.q.mode = 'continuous'
					//discrete.div.style('display', 'none')
					//cont.div.style('display', 'block')
					cont.fxns.showEditMenu(self, div)
				}
			},
			{
				active: self.q.mode && self.q.mode == 'discrete' ? true : false,
				label: 'Discrete',
				callback: async div => {
					self.q.mode = 'discrete'
					discrete.fxns.showEditMenu(self, div)
				}
			}
		]

		init_tabs({ holder: tabDiv, contentHolder: div.append('div'), tabs })
	}
}
