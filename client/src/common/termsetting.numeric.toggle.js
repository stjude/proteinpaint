import { init_tabs } from '../dom/toggleButtons'

// self is the termsetting instance
export async function getHandler(self) {
	function get_tab_callback(subType, maySetQtype = null) {
		return async div => {
			if (maySetQtype) maySetQtype()
			self.q.mode = subType
			const typeSubtype = `numeric.${subType}`
			const tab = tabs.find(t => t.subType == subType)
			if (tab.isRendered) return
			if (!self.handlerByType[typeSubtype]) {
				const _ = await import(`./termsetting.${typeSubtype}.js`)
				self.handlerByType[typeSubtype] = await _.getHandler(self)
			}
			tab.isRendered = true
			await self.handlerByType[typeSubtype].showEditMenu(div)
		}
	}

	// set numeric toggle tabs data here as a closure,
	// so that the data is not recreated each time that showEditMenu() is called;
	// also, do not trigger `await import(handler_code)` until needed
	const tabs = []
	if (self.opts.numericEditMenuVersion.includes('continuous')) {
		tabs.push({
			subType: 'continuous',
			label: 'Continuous',
			callback: get_tab_callback('continuous')
		})
	}

	if (self.opts.numericEditMenuVersion.includes('discrete')) {
		tabs.push({
			subType: 'discrete',
			label: 'Discrete',
			callback: get_tab_callback('discrete', () => {
				if (!self.q.type) self.q.type = 'regular'
				if (self.q.type != 'regular' && self.q.type != 'custom-bin') throw `invalid q.type='${self.q.type}'`
			})
		})
	}

	if (self.opts.numericEditMenuVersion.includes('spline')) {
		tabs.push({
			subType: 'spline',
			label: 'Cubic spline',
			callback: get_tab_callback('spline')
		})
	}

	if (self.opts.numericEditMenuVersion.includes('binary')) {
		tabs.push({
			subType: 'binary',
			label: 'Binary',
			callback: get_tab_callback('binary')
		})
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

			for (const t of tabs) {
				// reset the tracked state of each tab data on each call of showEditMenu();
				// NOTE: when clicking on a tab on the parent menu, showEditMenu() will not be called again,
				// so this loop will not be called and the tracked rendered state in the tab.callback will apply
				delete t.isRendered
				t.active = self.q.mode == t.subType || (t.subType == 'continuous' && !self.q.mode)
			}

			const tabDiv = topBar.append('div').style('display', 'inline-block')
			init_tabs({ holder: tabDiv, contentHolder: div.append('div'), tabs })
		}
	}
}
