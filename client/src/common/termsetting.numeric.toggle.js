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

			const tabs = [
				{
					active: self.q.mode && (self.q.mode == 'discrete' || self.q.mode == 'cubic-spline') ? false : true,
					label: 'Continuous',
					callback: async div => {
						self.q.mode = 'continuous'
						self.handlerByType['numeric.continuous'].showEditMenu(div)
						// example of deleting the callback here instead of in toggleButtons
						delete tabs[0].callback
					}
				},
				{
					active: self.q.mode && self.q.mode == 'discrete' ? true : false,
					label: 'Discrete',
					callback: async div => {
						self.q.mode = 'discrete'
						if (!self.q.type || self.q.type != 'custom') self.q.type = 'regular'
						// example of using a boolean attribute to track whether to exit early
						// if (tabs[1].isRendered) return
						// tabs[1].isRendered = true
						await self.handlerByType['numeric.discrete'].showEditMenu(div)
						// delete tabs[1].callback
					}
				},
				{
					active: self.q.mode && self.q.mode == 'cubic-spline' ? true : false,
					label: 'Cubic spline',
					callback: async div => {
						self.q.mode = 'cubic-spline'
						if (!self.q.type || self.q.type != 'custom-knots') self.q.type = 'auto-knots'
						// if (tabs[2].isRendered) return
						// tabs[2].isRendered = true
						self.handlerByType['numeric.spline'].showEditMenu(div)
						// delete tabs[2].callback
					}
				}
			]

			init_tabs({ holder: tabDiv, contentHolder: div.append('div'), tabs })
		}
	}
}
