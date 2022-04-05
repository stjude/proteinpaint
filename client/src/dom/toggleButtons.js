/*
********************** EXPORTED
init_tabs(opts)
update_tabs(tabs)

opts: {
	holder,
	tabHolder,
		d3 DOM created by this script
	contentHolder,
		optional; if not provided, create new under opts.holder
	tabs[ tab{} ]
		.label:
			required
		.callback()
			optional
		.width
			optional tab width
			TODO do not hardcode width, use auto width e.g. grid-template-columns='auto auto'
		.tab, .holder
			d3 DOM elements created by this script
}

Note: 
- newly created dom elements are attached to opts{} and tabs for exnternal code to access
- if everthing should be rendered in single holder, supply just `holder`
- if top tabs and div containing tab specific ui should be in different tabs, 
	define them sepeartely as holder and contentholder

*/

const defaultTabWidth = 90

export async function init_tabs(opts) {
	if (!opts.holder) throw `missing opts.holder for toggleButtons()`
	if (!Array.isArray(opts.tabs)) throw `invalid opts.tabs for toggleButtons()`

	const tabs = opts.tabs
	opts.tabHolder = opts.holder.append('div') //.style('padding', '10px')

	if (!opts.contentHolder) {
		opts.contentHolder = opts.holder.append('div')
	}

	const has_active_tab = tabs.some(i => i.active)
	if (!has_active_tab) tabs[0].active = true

	for (const [i, tab] of tabs.entries()) {
		const toggle_btn_class = i == 0 ? ' sj-left-toggle' : i < tabs.length - 1 ? ' sj-center-toggle' : ' sj-right-toggle'
		tab.tab = opts.tabHolder
			.append('div')
			.attr('class', 'sj-toggle-button' + toggle_btn_class)
			.classed('active', tab.active ? true : false)
			.style('padding', '5px')
			.style('display', 'inline-block')
			.html(tab.label)

		if (tab.width) {
			// fixed
			tab.tab.style('width', tab.width + 'px')
		} else {
			// automatically decide based on default width
			let width = defaultTabWidth
			tab.tab.each(function() {
				width = Math.max(width, this.getBoundingClientRect().width)
			})
			tab.tab.style('width', width + 'px')
		}

		tab.tab.on('click', async () => {
			for (const tab_ of tabs) {
				tab_.active = tab_ === tab
				tab_.tab.classed('active', tab_.active ? true : false)
				tab_.holder.style('display', tab_.active ? 'block' : 'none')
			}
			if (tab.callback) await tab.callback(tab.holder)
		})

		tab.holder = opts.contentHolder
			.append('div')
			.style('padding-top', '10px')
			.style('margin-top', '10px')
			.style('display', tab.active ? 'block' : 'none')

		if (tab.active) {
			if (tab.callback) await tab.callback(tab.holder)
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
