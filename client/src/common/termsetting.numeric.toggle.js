import { init_tabs } from '../dom/toggleButtons'

// self is the termsetting instance
export async function getHandler(self) {
	async function callback(div) {
		const tab = this // since this function gets attached to a tab{} entry in tabs[]
		self.q.mode = tab.subType
		const typeSubtype = `numeric.${tab.subType}`
		if (!self.handlerByType[typeSubtype]) {
			const _ = await import(`./termsetting.${typeSubtype}.js`)
			self.handlerByType[typeSubtype] = await _.getHandler(self)
		}
		tab.isRendered = true
		await self.handlerByType[typeSubtype].showEditMenu(div)
	}

	// set numeric toggle tabs data here as a closure,
	// so that the data is not recreated each time that showEditMenu() is called;
	// also, do not trigger `await import(handler_code)` until needed
	// *** ASSUMES that the numericEditMenuVersion[] remains the same
	//     after pill initialization and throughout its lifetime ***
	const tabs = []
	if (self.opts.numericEditMenuVersion.includes('continuous')) {
		tabs.push({
			subType: 'continuous',
			label: 'Continuous',
			callback
		})
	}

	if (self.opts.numericEditMenuVersion.includes('discrete')) {
		tabs.push({
			subType: 'discrete',
			label: 'Discrete',
			callback
		})
	}

	if (self.opts.numericEditMenuVersion.includes('spline')) {
		tabs.push({
			subType: 'spline',
			label: 'Cubic spline',
			callback
		})
	}

	if (self.opts.numericEditMenuVersion.includes('binary')) {
		tabs.push({
			subType: 'binary',
			label: 'Binary',
			callback
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
