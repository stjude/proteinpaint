import { select, selectAll } from 'd3-selection'

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
	linePosition, 
		optional: if not provided, default = 'bottom'
		values:  top, bottom, right, left
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
	opts.tabHolder = opts.holder
		.append('div')
		//add light grey border underneath the buttons
		.style('border-bottom', '0.5px solid lightgrey')
		.style('width', 'fit-content')

	if (!opts.contentHolder) {
		if (!opts.noContent) opts.contentHolder = opts.holder.append('div')
	}

	const has_active_tab = tabs.some(i => i.active)
	if (!has_active_tab) tabs[0].active = true

	for (const [i, tab] of tabs.entries()) {
		// const toggle_btn_class = i == 0 ? ' sj-left-toggle' : i < tabs.length - 1 ? ' sj-center-toggle' : ' sj-right-toggle'

		const linePosition = opts.linePosition || 'bottom'
		const textAlign = linePosition == 'bottom' || linePosition == 'top' ? 'center' : linePosition

		tab.wrapper = opts.tabHolder
			.append('button')
			.attr('type', 'button')
			.attr('class', 'sj-toggle-button')
			//Padding here overrides automatic styling for all pp buttons
			.style('padding', '0px')
			// .attr('class', 'sj-toggle-button' + toggle_btn_class)
			.classed('sjpp-active', tab.active ? true : false)
			.style('border', 'none')
			.style('background-color', 'transparent')

		if (linePosition == 'top' || linePosition == 'left') {
			//create the line div before the tab text
			tab.line = tab.wrapper.append('div').style('display', linePosition == 'left' ? 'inline-flex' : 'block')
			tab.tab = tab.wrapper.append('div').style('display', linePosition == 'left' ? 'inline-flex' : 'block')
		} else {
			//create the line div after the tab text
			tab.tab = tab.wrapper.append('div').style('display', linePosition == 'right' ? 'inline-flex' : 'block')
			tab.line = tab.wrapper.append('div').style('display', linePosition == 'right' ? 'inline-flex' : 'block')
		}

		tab.tab
			.style('color', tab.active ? '#1575ad' : '#757373')
			.style('text-align', textAlign)
			.style('padding', '5px')
			.html(tab.label)

		tab.line
			.style('color', '#1575ad')
			.style('background-color', '#1575ad')
			.style('visibility', tab.active ? 'visible' : 'hidden')

		if (linePosition == 'top' || linePosition == 'bottom') {
			tab.line.style('height', '8px')
		} else {
			tab.line
				.style('width', '8px')
				//Trick div into appearing the full height of the parent
				.style('padding', '5px 0px')
				.html('l')
		}

		if (tab.width) {
			// fixed
			tab.wrapper.style('width', tab.width + 'px')
		} else {
			// automatically decide based on default width
			let width = defaultTabWidth
			tab.wrapper.each(function() {
				width = Math.max(width, this.getBoundingClientRect().width)
			})
			tab.wrapper.style('width', width + 'px')
		}

		tab.wrapper.on('click', async () => {
			for (const tab_ of tabs) {
				tab_.active = tab_ === tab
				tab_.wrapper.classed('sjpp-active', tab_.active ? true : false)
				tab_.holder.style('display', tab_.active ? 'block' : 'none')
				tab_.tab.style('color', tab_.active ? '#1575ad' : '#757373')
				tab_.line.style('visibility', tab_.active ? 'visible' : 'hidden')
			}
			if (tab.callback) await tab.callback(tab.holder)
		})

		if (opts.contentHolder) {
			tab.holder = opts.contentHolder
				.append('div')
				.style('padding-top', '10px')
				.style('margin-top', '10px')
				.style('display', tab.active ? 'block' : 'none')
		}

		if (tab.active) {
			if (tab.callback) await tab.callback(tab.holder)
		}
	}
}

export function update_tabs(tabs) {
	const has_active_tab = tabs.some(i => i.active)
	if (!has_active_tab) tabs[0].active = true

	for (const tab of tabs) {
		tab.tab.classed('sjpp-active', tab.active ? true : false)
		tab.holder.style('display', tab.active ? 'block' : 'none')
	}
}

/*
	alternative tabbed component,
	where the tab data is bound to the rendered tab elements/content holder
	and vice-versa, for easier debugging in the console using 
	inspect element > styles > properties > __data__

	opts{}
	- same argument as for init_tabs
*/
export async function init_tabs_1(opts) {
	if (!opts.holder) throw `missing opts.holder for toggleButtons()`
	if (!Array.isArray(opts.tabs)) throw `invalid opts.tabs for toggleButtons()`

	let tabs = opts.tabs
	opts.tabHolder = opts.holder.append('div')
	if (!opts.contentHolder) {
		opts.contentHolder = opts.holder.append('div')
	}

	const has_active_tab = tabs.find(tab => tab.active)
	tabs.forEach((tab, i) => {
		tab.btnPosition = i == 0 ? 'left' : i < tabs.length - 1 ? 'center' : 'right'
		if (!has_active_tab && i === 0) tab.active = true
	})

	await opts.tabHolder
		.selectAll(':scope>div')
		// will bind each tab data to the correpsonding rendered element
		.data(tabs)
		.enter()
		.append('div')
		.attr('class', (tab, i) => `sj-toggle-button sj-${tab.btnPosition}-toggle`)
		.style('width', tab => (tab.width ? `${tab.width}px` : 'fit-content'))
		.style('min-width', tab => (tab.width ? null : Math.max(defaultTabWidth)))
		.style('padding', '5px')
		.style('display', 'inline-block')
		.html(tab => tab.label)
		.on('click', async (event, tab) => {
			for (const t of tabs) {
				t.active = t === tab
			}
			updateTabs()
			if (tab.callback) await tab.callback(tab.holder)
		})
		.each(async function(tab) {
			tab.tab = select(this)
			tab.holder = opts.contentHolder
				.append('div')
				.style('padding-top', '10px')
				.style('margin-top', '10px')
				.style('display', tab.active ? 'block' : 'none')

			if (tab.active && tab.callback) await tab.callback(tab.holder)
		})

	updateTabs()

	function updateTabs() {
		opts.tabHolder
			.selectAll(':scope>div')
			.data(tabs)
			.classed('sjpp-active', tab => tab.active)
			.each(tab => {
				tab.holder.style('display', tab.active ? 'block' : 'none')
			})
	}
}
