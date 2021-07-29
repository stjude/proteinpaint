/*
********************** EXPORTED
init_tabs
update_tabs

tabs[ tab{} ]
	.label:
		required
	.callback()
		required

this function attaches .holder (d3 dom) to each tab of tabs[]
*/

export function init_tabs(holder, tabs) {
	tabs.holder = holder
		.append('div')
		.style('padding', '10px 10px 0 10px')

	const has_active_tab = tabs.some(i => i.active)
	if (!has_active_tab) tabs[0].active = true

	for (const [i, tab] of tabs.entries()) {
		tab.tab = tabs.holder
			.append('div')
			.attr('class', 'sj-toggle-button' + (i == 0 ? ' sj-left-toggle' : ' sj-right-toggle'))
			.classed('active', tab.active ? true : false)
			.style('padding', '5px')
			.style('display', 'inline-block')
			.html(tab.label)
			.on('click', async () => {
				const last_active_tab = tabs.find(t => t.active == true)
				delete last_active_tab.active
				tab.active = true
				for (const tab_ of tabs) {
					tab_.tab.classed('active', tab_.active ? true : false)
					tab_.holder.style('display', tab_.active ? 'block' : 'none')
				}
				if (tab.callback) {
					await tab.callback(tab.holder)
					delete tab.callback
				}
			})

		tab.holder = holder
			.append('div')
			.style('padding-top', '10px')
			.style('display', tab.active ? 'block' : 'none')

		if (i == 0 && tab.callback) {
			tab.callback(tab.holder)
			delete tab.callback
		}
	}
}

export function update_tabs(tabs) {
	const has_active_tab = tabs.some(i => i.active)
	if (!has_active_tab) tabs[0].active = true

	for (const tab of tabs) {
		tab.tab.classed('active', tab.active ? true : false)
		tab.holder.style('display', tab.active ? 'block' : 'none')
	}
}
