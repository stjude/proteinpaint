import { select as d3select } from 'd3-selection'
import 'd3-transition' // so that selection.transition would be defined
import { get_base_zindex } from '#common/globals'

/*
arg{}
---All are optional---
	parent_menu
		- define if menu is launched within another menu
	padding: STR
		- css value for menu.d.style.padding
	border: STR
		- css value for menu.d.style.border
	offsetX: INT 
		- default = 20
		- offset for left position (x = x + offsetX)
	offsetY: INT
		- default = 20
		- offset for top position (y = y + offsetY)
	hideXmute, hideYmute: INT
		- default = 0
		- cancel tip hiding if the cursor's X,Y movement is less than the corresponding 
		hide*mute value. See notes in constructor
	clearSelector: STR
		-clear only specific elems within menu.d, not all of menu.d
	onHide()
		- override default hide() with callback
*/
export class Menu {
	constructor(arg = {}) {
		this.typename = Math.random().toString()

		const body = d3select(document.body)
		this.d = body
			.append('div')
			.attr('class', 'sja_menu_div')
			.style('display', 'none')
			.style('position', 'absolute')
			.style('background-color', 'white')
			.on('mousedown.menu' + this.typename, event => {
				/* 
					When clicking on non-interactive elements within a menu, 
					it should trigger other menus to be hidden. For example,
					clicking on an empty spot in a parent menu should close 
					any submenu that are open, which is done by allowing the 
					mousedown event to propagate to the body (default behavior).
				*/
				const t = d3select(event.target)
				if (
					/*** 
						NOTE on interactive menu elements: 
						Any menu element (input, button, etc) that has event listeners
					  is expected to handle that event, including possibly closing any
					  associated menus, and thus no need to propagate the mousedown event 
						to the document body
					***/
					t.on('mousedown') ||
					t.on('click') ||
					// also assume that the following elements have event listeners by default,
					// so same logic of not wanting to propagate the event to the body
					['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName.toUpperCase())
				) {
					event.stopPropagation()
				} /* else {
					 // allow the bubbling of the mouse event to the document body
				}*/
			})
			.on('keyup', event => {
				if (event.key == 'Escape') this.hide()
			})

		this.dnode = this.d.node()

		// detect if this menu is launched from within another menu
		// (aka, the 'parent_menu'); this value may be empty (undefined, null)
		// check if this.d isn't empty before assigning parent_menu
		if (Object.values(this.d._groups[0]).length) this.dnode.parent_menu = arg.parent_menu //; console.log(74, this.dnode.parent_menu)

		if (arg.ancestor_menus) this.dnode.ancestor_menus = arg.ancestor_menus // attach property to DOM node, since other code does not know about any menu instance directly, but can detect properties of other menus by DOM node

		body.on('mousedown.menu' + this.typename, event => {
			// when pressing the mouse cursor on the menu itself or any of its submenu, it should stay open
			if (this.dnode.contains(event.target)) return
			// this assumes that the mousedown occured on the menu holder itself (not any of its child elements)
			if (event.target.parent_menu === this.dnode) return
			// detect in case the mousedown occurred on a menu's child element,
			// in which case the menu's parent should still be not hidden
			const menu = event.target.closest('.sja_menu_div')
			if (menu && (menu.parent_menu === this.dnode || menu.ancestor_menus?.includes(this.dnode))) return // the menu div that was clicked, does it have parent or ancestor menus, and is my DOM div one of them? if yes, I shouldn't hide myself
			// close a menu for all other mousedown events outside of its own div or submenu
			this.hide()
		})

		const base_zindex = get_base_zindex()
		if (base_zindex) {
			this.d.style('z-index', base_zindex + 1)
		}

		this.d.style('padding', 'padding' in arg ? arg.padding : '10px')
		if (arg.border) {
			this.d.style('border', arg.border)
		} else {
			this.d.style('box-shadow', '0px 2px 4px 1px #999')
		}
		this.offsetX = Number.isInteger(arg.offsetX) ? arg.offsetX : 20
		this.offsetY = Number.isInteger(arg.offsetY) ? arg.offsetY : 20
		// The hideXmute and hideYmute options would cancel tip hiding if the
		// cursor's X,Y movement is less than the corresponding hide*mute value.
		// This helps avoid flickering when the tooltip div blocks a stationary cursor,
		// which trigers an unwanted mouseout of the element that triggered a mouseover.
		// Also useful for decreasing the sensitivity of the mouseout behavior in general.
		this.hideXmute = Number.isInteger(arg.hideXmute) ? arg.hideXmute : 0
		this.hideYmute = Number.isInteger(arg.hideYmute) ? arg.hideYmute : 0
		this.prevX = -1
		this.prevY = -1
		// string selector option to limit clear()/removal of elements
		// so that other elements may persist within tip.d
		this.clearSelector = arg.clearSelector
	}

	clear() {
		if (this.clearSelector) this.d.select(this.clearSelector).selectAll('*').remove()
		else this.d.selectAll('*').remove()
		return this
	}
	/*
	 To note: if shift and scroll are true, shift sets x & y.
	 Set shift to false to use scroll
	*/
	show(_x, _y, shift = true, down = true, scroll = true) {
		let x = _x
		let y = _y
		this.prevX = _x
		this.prevY = _y

		// show around a given point
		document.body.appendChild(this.dnode)
		this.d.style('display', 'block')
		if (scroll) {
			x = x + window.scrollX
			y = y + window.scrollY
		}
		if (shift) {
			x = x + this.offsetX
			y = y + this.offsetY
		}
		const width = window.innerWidth
		const height = window.innerHeight
		const middlex = width / 2
		const middley = height / 2
		const p = this.dnode.getBoundingClientRect()

		//does not fit to the left
		if (width - x < middlex && x + p.width > width) this.d.style('left', null).style('right', width - x + 'px')
		else this.d.style('left', x + 'px').style('right', null)

		//does not fit to the bottom
		if (!down && height - y < middley && y - window.scrollY - p.height > 0)
			this.d.style('top', null).style('bottom', height - y + 'px')
		else this.d.style('top', y + 'px').style('bottom', null)
		this.d.transition().style('opacity', 1)
		return this
	}

	// simplified alternative to show(), with less arguments
	show2(_x, _y) {
		let x = _x
		let y = _y
		this.prevX = _x
		this.prevY = _y

		// show around a given point
		document.body.appendChild(this.dnode)
		this.d.style('display', 'block')

		// the event.clientX and event.clientY are already veiwport positions.
		// when position == absolute, (what we have now) the scroll position has to be considered.
		// when position == fixed, relative to the viewport, the scroll could be ignored, but the menu doesn't follow the scroll
		x = x + window.scrollX + this.offsetX // by adding the scroll, the postion of menu becomes relative to document.body
		y = y + window.scrollY + this.offsetY

		const width = window.innerWidth
		const height = window.innerHeight
		const middlex = width / 2
		const middley = height / 2
		const p = this.dnode.getBoundingClientRect()

		//does not fit to the right
		// "right" is relative to the right side of menu and window
		if (x + p.width > width) this.d.style('left', '').style('right', '5px')
		else this.d.style('left', x + 'px').style('right', '')

		// for now, the users have to scroll down to see the entire menu if there is not enough height for the menu
		// TODO: reposition the menu to make it at least partially visible.
		this.d.style('top', y + 'px').style('bottom', '')
		this.d.transition().style('opacity', 1)
		return this
	}

	// opts{}: can supply offsetX and offsetY
	// necessary because .showunder() uses .show(shift=false), which
	// ignores offsetY in the constructor option
	showunder(dom, _opts = {}) {
		// route to .show()
		const opts = Object.assign({ offsetX: 0, offsetY: 0 }, _opts)
		const p = dom.getBoundingClientRect()
		const x = p.left + window.scrollX + opts.offsetX
		const y = p.top + p.height + window.scrollY + 5 + opts.offsetY
		return this.show(x, y, false, true, false)

		/*
		this.d
			.style('display','block')
			.style('right',null)
			.style('bottom',null)
			.style('left', (p.left+window.scrollX)+'px')
			.style('top',  (p.top + p.height + window.scrollY + (yspace || 5) )+'px' )
			.transition().style('opacity',1)
		return this
		*/
	}

	showunderoffset(dom) {
		// route to .show()
		const p = dom.getBoundingClientRect()
		const y = p.top + p.height + window.scrollY + 5
		return this.show(p.left, y, true, true, false)

		/*
		this.d
			.style('display','block')
			.style('right',null)
			.style('bottom',null)
			.style('left', (p.left+window.scrollX)+'px')
			.style('top',  (p.top + p.height + window.scrollY + (yspace || 5) )+'px' )
			.transition().style('opacity',1)
		return this
		*/
	}

	// this hide() method may be overriden with a custom method by getCustomApi(overrides)
	hide(event) {
		if (event) {
			// event can be undefined
			// prevent flickering, decrease sensitivity of tooltip to movement on mouseout
			if (
				Math.abs(this.prevX - event.clientX) < this.hideXmute &&
				Math.abs(this.prevY - event.clientY) < this.hideYmute
			)
				return
		}
		if (!this.fadeTimeout) this.d.style('display', 'none').style('opacity', 0)
		if (this.onHide) this.onHide()
		return this
	}

	fadeout() {
		this.d
			.transition()
			.style('opacity', 0)
			.on('end', () => this.d.style('display', 'none'))
		return this
	}

	confirm({ html, timeout }) {
		this.d.selectAll('*').remove()
		this.d.append('div').style('padding', '5px').html(html)
		if (timeout)
			this.fadeTimeout = setTimeout(() => {
				this.fadeout()
				delete this.fadeTimeout
			}, 3000)
	}

	toggle() {
		if (!this.hidden) {
			this.hide()
			this.hidden = true
		} else {
			this.d.style('opacity', 1).style('display', 'block')
			this.hidden = false
		}
		return this
	}

	/*
		Create a custom instance API with method and/or property overrides;
		this will simplify sharing of the same tip instance among different
		components/code, such as a chart edit menu with an embedded termsetting
		edit menu, where the tip.hide() can be shared but tip.clear() will be
		applied only to a specific div in the overall menu div
		
		Example usage: 
		const tip = new Menu()
		const subsection = tip.d.append('div')
		const customTipApi = tip.getCustomApi({
			d: subsection, // expose only a subsection of the whole tip.d,
			show: () => {
				subsection.style('display', 'block')
			},
			hide: () => {
				subsection.style('display', 'none')
			},
			clear: () => {
				subsection.selectAll('*').remove() // clear only the subsection
				return customTipApi
			}
		})
	*/
	getCustomApi(overrides = {}) {
		// the current instance will be used as the api's prototype via Object.create(),
		// so that any property or method that is not overriden will
		// refer to this instance's original property or method
		const api = Object.create(this)
		Object.assign(api, overrides)
		return api
	}

	destroy() {
		//For testing to remove completely from the document.body without using d3select()
		this.d.remove()
	}
}
