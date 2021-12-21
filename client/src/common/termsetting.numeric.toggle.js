import { init_tabs } from '../dom/toggleButtons'
import { getHandler as getNumericDiscreteHandler } from './termsetting.numeric.discrete'
import { getHandler as getNumericContHandler } from './termsetting.numeric.continuous'
import { getHandler as getNumericSplineHandler } from './termsetting.numeric.spline'

// self is the termsetting instance
export function getHandler(self) {
	if (!self.handlerByType['numeric.discrete']) {
		self.handlerByType['numeric.discrete'] = getNumericDiscreteHandler(self)
	}
	if (!self.handlerByType['numeric.continuous']) {
		self.handlerByType['numeric.continuous'] = getNumericContHandler(self)
	}
	if (!self.handlerByType['numeric.spline']) {
		self.handlerByType['numeric.spline'] = getNumericSplineHandler(self)
	}

	return {
		get_term_name(d) {
			if (!self.opts.abbrCutoff) return d.name
			return d.name.length <= self.opts.abbrCutoff + 2
				? d.name
				: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
		},

		get_status_msg() {
			return ''
		},

		async showEditMenu(div) {
			div.style('padding', '5px 10px')

			const topBar = div.append('div').style('margin-left', '20px')
			topBar
				.append('div')
				.style('display', 'inline-block')
				.html('Use as')

			const tabDiv = topBar.append('div').style('display', 'inline-block')

			const tab_options = {
				continuous: {
					active: !self.q.mode || (self.q.mode != 'discrete' && self.q.mode != 'cubic-spline'),
					label: 'Continuous',
					callback: async div => {
						self.q.mode = 'continuous'
						if (tabs[0].isRendered) return
						tabs[0].isRendered = true
						self.handlerByType['numeric.continuous'].showEditMenu(div)
					}
				},
				discrete: {
					active: self.q.mode && self.q.mode == 'discrete',
					label: 'Discrete',
					callback: async div => {
						self.q.mode = 'discrete'
						if (!self.q.type || self.q.type != 'custom') self.q.type = 'regular'
						if (tabs[1].isRendered) return
						tabs[1].isRendered = true
						await self.handlerByType['numeric.discrete'].showEditMenu(div)
					}
				},
				'cubic-spline': {
					active: self.q.mode && self.q.mode == 'cubic-spline',
					label: 'Cubic spline',
					callback: async div => {
						self.q.mode = 'cubic-spline'
						if (tabs[2].isRendered) return
						tabs[2].isRendered = true
						self.handlerByType['numeric.spline'].showEditMenu(div)
					}
				}
			}
			const tabs = []
			self.opts.numericEditMenuVersion.forEach(e => {
				tabs.push(tab_options[e])
			})

			init_tabs({ holder: tabDiv, contentHolder: div.append('div'), tabs })
		}
	}
}
