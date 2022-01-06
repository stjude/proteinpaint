import { init_tabs } from '../dom/toggleButtons'

// self is the termsetting instance
export async function getHandler(self) {
	const handlerPromises = []
	// set handlerByType based on entries from numericEditMenuVersion
	for (const subType of self.opts.numericEditMenuVersion) {
		handlerPromises.push(
			(async () => {
				const type = 'numeric'
				const typeSubtype = `${type}.${subType}`
				const _ = await import(`./termsetting.${typeSubtype}.js`)
				self.handlerByType[typeSubtype] = _.getHandler(self)
			})()
		)
	}
	await Promise.all(handlerPromises)

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

			const tabs = []
			function get_default_tab(subType) {
				const type = 'numeric'
				let _subType = subType
				if (subType == 'cubic-spline') _subType = 'spline'
				const typeSubtype = `${type}.${_subType}`

				const default_tab_callback = async div => {
					self.q.mode = subType
					const tab = tabs.find(t => t.subType == subType)
					if (tab.isRendered) return
					tab.isRendered = true
					await self.handlerByType[typeSubtype].showEditMenu(div)
				}

				const default_tab = {
					active: self.q.mode && self.q.mode == subType,
					label: subType[0].toUpperCase() + subType.slice(1),
					subType,
					callback: default_tab_callback
				}
				return default_tab
			}

			// set tabs for numeric toggle menu based on entries from numericEditMenuVersion
			self.opts.numericEditMenuVersion.forEach(async subType => {
				let tab
				if (subType == 'continuous') {
					tab = get_default_tab(subType)
					// for toggle numeric menu, continuous will be default active tab
					tab.active =
						!self.q.mode || (self.q.mode != 'discrete' && self.q.mode != 'cubic-spline' && self.q.mode != 'binary')
				} else if (subType == 'discrete') {
					const typeSubtype = 'numeric.discrete'
					tab = get_default_tab(subType)
					tab.callback = async div => {
						self.q.mode = subType
						if (!self.q.type || self.q.type != 'custom-bin') self.q.type = 'regular'
						const tab = tabs.find(t => t.subType == subType)
						if (tab.isRendered) return
						tab.isRendered = true
						await self.handlerByType[typeSubtype].showEditMenu(div)
					}
				} else if (subType == 'cubic-spline') {
					tab = get_default_tab(subType)
					tab.label = 'Cubic spline'
				} else if (subType == 'binary') {
					tab = get_default_tab(subType)
				}
				tabs.push(tab)
			})

			init_tabs({ holder: tabDiv, contentHolder: div.append('div'), tabs })
		}
	}
}
