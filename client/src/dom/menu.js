import { select as d3select, event as d3event } from 'd3-selection'
import { transition } from 'd3-transition'
import { base_zindex } from '../client'

/* TODO explain arg
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
			.style('font-family', 'Arial')
			.on('mousedown.menu' + this.typename, () => {
				/* 
					When clicking on non-interactive elements within a menu, 
					it should trigger other menus to be hidden. For example,
					clicking on an empty spot in a parent menu should close 
					any submenu that are open, which is done by allowing the 
					mousedown event to propagate to the body (default behavior).
				*/
				const t = d3select(d3event.target)
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
					['INPUT', 'SELECT', 'TEXTAREA'].includes(d3event.target.tagName.toUpperCase())
				) {
					d3event.stopPropagation()
				} /* else {
					 // allow the bubbling of the mouse event to the document body
				}*/
			})

		this.dnode = this.d.node()

		// detect if this menu is launched from within another menu
		// (aka, the 'parent_menu'); this value may be empty (undefined, null)
		// check if this.d isn't empty before assigning parent_menu
		if (Object.values(this.d._groups[0]).length) this.dnode.parent_menu = arg.parent_menu

		body.on('mousedown.menu' + this.typename, () => {
			/*** 
				Problem: A parent menu can close unexpectedly when clicking on a 
				non-interactive submenu element, leaving its submenu still visible
				but "floating" without context since its parent menu disappeared on 'body' click.

				Solution: Do not hide a menu if it happens to be a parent of a clicked menu
			***/
			// when pressing the mouse cursor on the menu itself or any of its submenu, it should stay open
			if (this.dnode.contains(d3event.target)) return
			// this assumes that the mousedown occured on the menu holder itself (not any of its child elements)
			if (d3event.target.parent_menu === this.dnode) return
			// detect in case the mousedown occurred on a menu's child element,
			// in which case the menu's parent should still be not hidden
			const menu = d3event.target.closest('.sja_menu_div')
			if (menu && menu.parent_menu === this.dnode) return
			// close a menu for all other mousedown events outside of its own div or submenu
			this.hide()
		})

		if (base_zindex) {
			this.d.style('z-index', base_zindex + 1)
		}

		this.d.style('padding', 'padding' in arg ? arg.padding : '20px')
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
		if (this.clearSelector)
			this.d
				.select(this.clearSelector)
				.selectAll('*')
				.remove()
		else this.d.selectAll('*').remove()
		return this
	}

	show(x, y) {
		// NOTE: getCustomApi() may have a different d property value than the original this.d
		// in that case, no need to adjust position
		if (this.dnode !== this.d.node()) return
		this.prevX = x
		this.prevY = y

		// show around a given point
		document.body.appendChild(this.dnode)

		this.d.style('display', 'block')
		const leftx = x + this.offsetX
		const topy = y + this.offsetY
		const p = this.dnode.getBoundingClientRect()

		// x adjust
		if (leftx + p.width > window.innerWidth) {
			//if(window.innerWidth-x > p.width)
			if (x > p.width) {
				this.d.style('left', null).style('right', window.innerWidth - x - window.scrollX + this.offsetX + 'px')
			} else {
				// still apply 'left', shift to left instead
				this.d.style('left', Math.max(0, window.innerWidth - p.width) + window.scrollX + 'px').style('right', null)
			}
		} else {
			this.d.style('left', leftx + window.scrollX + 'px').style('right', null)
		}

		if (topy + p.height > window.innerHeight) {
			//if(window.innerHeight-y > p.height)
			if (y > p.height) {
				this.d.style('top', null).style('bottom', window.innerHeight - y - window.scrollY + this.offsetY + 'px')
			} else {
				// still apply 'top', shift to top instead
				this.d.style('top', Math.max(0, window.innerHeight - p.height) + window.scrollY + 'px').style('bottom', null)
			}
		} else {
			this.d.style('top', topy + window.scrollY + 'px').style('bottom', null)
		}

		this.d.transition().style('opacity', 1)
		return this
	}

	showunder(dom, yspace) {
		// NOTE: getCustomApi() may have a different d property value than the original this.d
		// in that case, no need to adjust position
		if (this.dnode !== this.d.node()) return
		// route to .show()
		const p = dom.getBoundingClientRect()
		return this.show(p.left - this.offsetX, p.top + p.height + (yspace || 5) - this.offsetY)

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

	showunderoffset(dom, yspace) {
		// NOTE: getCustomApi() may have a different d property value than the original this.d
		// in that case, no need to adjust position
		if (this.dnode !== this.d.node()) return
		// route to .show()
		const p = dom.getBoundingClientRect()
		return this.show(p.left, p.top + p.height + (yspace || 5))

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
	hide() {
		if (d3event) {
			// d3event can be undefined
			// prevent flickering, decrease sensitivity of tooltip to movement on mouseout
			if (
				Math.abs(this.prevX - d3event.clientX) < this.hideXmute &&
				Math.abs(this.prevY - d3event.clientY) < this.hideYmute
			)
				return
		}
		this.d.style('display', 'none').style('opacity', 0)
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
			d: subsection, // expose only a subsection of the whole tip.d
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
}
