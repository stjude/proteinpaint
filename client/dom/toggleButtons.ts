import { select } from 'd3-selection'

/*
********************** EXPORTED
Tabs(opts)

opts: {
	holder,
	tabsHolder,
		d3 DOM created by this script
	contentHolder,
		optional: if not provided, create new under opts.holder
	noTopContentStyle: BOOL
		optional: removes the padding-top and margin-top required for SVGs 
		- intented to remove the excess white space that appears for non-SVG content
		between the tabs and content div
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
		.disabled()
			optional: disables tab
			default = 'false'
		.isVisible()
			optional: displays tab
			default = false
		.active
			optional: define which tab renders first
			default: tabs[0].active = true
	noContent,
		optional: voids creating a content div
	linePosition, 
		optional: determines the blue border line position 
		default = 'bottom'
		values:  top, bottom, right, left
	tabsPosition, 
		optional: show tabs inline horizonally or vertical stack 
		default = 'horizonal'
		values:  vertical, horizontal
	gap,
		optional: only applies to vertical position
		default = ''
	
}

Note: 
- newly created dom elements are attached to opts{} and tabs for exnternal code to access
- if everthing should be rendered in single holder, supply just `holder`
- if top tabs and div containing tab specific ui should be in different tabs, 
	define them sepeartely as holder and contentholder
- tab data is bound to the rendered tab elements/content holder
	and vice-versa, for easier debugging in the console using 
	inspect element > styles > properties > __data__	
*/

export class Tabs {
	private opts: any
	private tabs: any
	private dom: {
		holder: any
		tabsHolder?: any
		contentHolder?: any
	}
	private defaultTabWidth: number
	render: any

	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.tabs = opts.tabs
		this.dom = {
			holder: opts.holder
		}
		this.defaultTabWidth = 90
		setRenderers(this)
	}

	validateOpts(opts) {
		if (!opts.holder) throw `missing opts.holder for Tabs()`
		if (!Array.isArray(opts.tabs)) throw `invalid opts.tabs array for Tabs()`
		if (!opts.linePosition) opts.linePosition = 'bottom'
		if (
			opts.linePosition != 'bottom' &&
			opts.linePosition != 'top' &&
			opts.linePosition != 'right' &&
			opts.linePosition != 'left'
		)
			throw `Invalid .linePosition arg. Must be either bottom, top, right, or left`
		if (!opts.tabsPosition) opts.tabsPosition = 'horizontal'
		if (opts.tabsPosition != 'horizontal' && opts.tabsPosition != 'vertical')
			throw `Invalid .tabsPosition arg. Must be either vertical or horizontal`
		return opts
	}

	async main() {
		try {
			await this.render()
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			else throw e
		}
	}
}

function setRenderers(self) {
	self.render = async () => {
		const has_active_tab = self.tabs.find(tab => tab.active)
		if (!has_active_tab) self.tabs[0].active = true

		const textAlign =
			self.opts.linePosition == 'bottom' || self.opts.linePosition == 'top' ? 'center' : self.opts.linePosition

		/* Implementation assumes the position of the tabs and content are not contiguous
		to accommodate all situations. If having troubles with rendering, try creating  
		a wrapper for the tabsHolder and contentHolder. */

		self.dom.tabsHolder = self.dom.holder
			.append('div')
			//add light blue border underneath the buttons
			.style(`border-${self.opts.linePosition}`, '0.5px solid #1575ad')

		if (!self.opts.contentHolder && !self.opts.noContent) {
			self.dom.contentHolder = self.dom.holder.append('div')
		} else self.dom.contentHolder = self.opts.contentHolder

		if (self.opts.tabsPosition == 'vertical') {
			self.dom.tabsHolder
				.style('display', 'inline-grid')
				.style('align-items', 'start')
				.style('gap', self.opts.gap || '')
			self.dom.contentHolder
				//First part of fix for svgs rendering inline, outside of the contentHolder
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
				.style('position', 'relative')
		} else self.dom.tabsHolder.style('display', 'inline-block')

		await self.dom.tabsHolder
			.selectAll('button')
			.data(self.tabs)
			.enter()
			.append('button')
			.attr('class', 'sj-toggle-button')
			.classed('sjpp-active', tab => (tab.active ? true : false))
			//Padding here overrides automatic styling for all pp buttons
			.style('padding', tab => tab.padding || 'Opx')
			.style('width', 'fit-content')
			.style('min-width', Math.max(self.defaultTabWidth))
			// .style('width', tab => (tab.width ? `${tab.width}px` : 'fit-content'))
			// .style('min-width', tab => (tab.width ? null : Math.max(self.defaultTabWidth)))
			.style('border', 'none')
			.style('background-color', 'transparent')
			.style('display', self.opts.tabsPosition == 'vertical' ? 'flex' : 'inline-grid')
			.property('disabled', tab => (tab.disabled ? tab.disabled() : false))
			.each(async function (this: any, tab) {
				/* The whole button is clickable (i.e. the white space where the blue, 'active' line
				is not visible). The event is on the button (i.e. tab.wrapper). The style changes 
				when the button is active/inactive are on the text (i.e. tab.tab) and line 
				(i.e. tab.line) */
				tab.wrapper = select(this)
				if (self.opts.linePosition == 'right') tab.wrapper.style('justify-self', 'end')
				if (self.opts.linePosition == 'left') tab.wrapper.style('justify-self', 'start')

				//Line position determines the order of appending divs
				if (self.opts.linePosition == 'top' || self.opts.linePosition == 'left') {
					//create the line div before the tab text
					tab.line = tab.wrapper
						.append('div')
						.style('display', self.opts.linePosition == 'left' ? 'inline-flex' : 'flex')
					tab.tab = tab.wrapper
						.append('div')
						.style('display', self.opts.linePosition == 'left' ? 'inline-block' : 'block')
				} else {
					//create the line div after the tab text
					tab.tab = tab.wrapper
						.append('div')
						.style('display', self.opts.linePosition == 'right' ? 'inline-block' : 'block')
					tab.line = tab.wrapper
						.append('div')
						.style('display', self.opts.linePosition == 'right' ? 'inline-flex' : 'flex')
				}

				if (tab.disabled && tab.isVisible) {
					tab.wrapper.style('cursor', tab.disabled() == true && tab.isVisible() == true ? 'not-allowed' : 'pointer')
				}

				tab.tab //Button text
					.style('color', tab.active ? '#1575ad' : '#757373')
					.style('text-align', textAlign)
					.style('padding', '5px')
					.html(tab.label)
				tab.line //Bolded, blue line indicating the active button
					.style('background-color', '#1575ad')
					.style('visibility', tab.active ? 'visible' : 'hidden')

				if (self.opts.linePosition == 'top' || self.opts.linePosition == 'bottom') {
					tab.line.style('height', '8px').style('padding', '0px 5px')
				} else {
					tab.line
						//stretch tricks div to expand to full height
						.style('align-self', 'stretch')
						.style('padding', '5px 0px')
						//inline width prevents width changing for long labels
						.html('<span style="width: 8px";>&nbsp</span>')
				}

				if (self.dom.contentHolder) {
					tab.contentHolder = self.dom.contentHolder
						/* Second part of svg rendering fix: Extra div prevents svgs from displaying 
					above contentHolder (i.e. inline at the beginning of the holder). 
					Div acts as a `viewBox`.*/
						.append('div')
						.style('display', tab.active ? 'block' : 'none')
					if (self.opts.tabsPosition == 'horizontal' && !self.opts.noTopContentStyle) {
						tab.contentHolder.style('padding-top', '10px').style('margin-top', '10px')
					}
				}

				if (tab.active && tab.callback) await tab.callback(event, tab)

				tab.wrapper
					.on('mouseenter', () => {
						tab.tab.style('color', tab.active ? '#757373' : '#1575ad')
					})
					.on('mouseleave', () => {
						tab.tab.style('color', tab.active ? '#1575ad' : '#757373')
					})
			})
			.on('click', async (event, tab) => {
				for (const t of self.tabs) {
					t.active = t === tab
				}
				const activeTabIndex = self.tabs.findIndex(t => t.active) //Fix for non-Rx implementations
				/*
				TODO: self.update() not required for non-RX components
				Idea is to create super class, then state and stateless components
				for rx and non-rx components, respectively.
				rx -> include app.dispatch() here. Maybe other intuitive methods to 
					allievate callback code in tabs array
				non-rx -> include self.update() here without activeTabIndex arg
				*/
				self.update(activeTabIndex)
				if (tab.callback) await tab.callback(event, tab)
			})
		const activeTabIndex = self.tabs.findIndex(t => t.active) //Fix for non-Rx implementations
		self.update(activeTabIndex)
	}
	self.update = (activeTabIndex = 0, config = {}) => {
		self.tabs.forEach((tab, i) => {
			tab.active = activeTabIndex === i
		})
		self.dom.tabsHolder
			.selectAll('button')
			.data(self.tabs)
			.classed('sjpp-active', tab => tab.active)
			.each(tab => {
				tab.wrapper.classed('sjpp-active', tab.active ? true : false)
				if (tab.isVisible) tab.wrapper.style('display', tab => (config && tab.isVisible() ? '' : 'none'))
				if (tab.contentHolder) tab.contentHolder.style('display', tab.active ? 'block' : 'none')
				tab.tab.style('color', tab.active ? '#1575ad' : '#757373')
				tab.line.style('visibility', tab.active ? 'visible' : 'hidden')
			})
	}
}
