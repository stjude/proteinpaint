import { Menu } from '#dom'
import type { Div } from '../types/d3'

/** Tentative implementation of a reusable flyout menu
 * Intended to support nested flyouts, e.g., for submenus.
 *
 ******** USAGE ********:
 * Multiple ways to code up the menu options.
 * - use .text to add opaque text (e.g. section header, small note)
 * - use .html to add custom html content (e.g. list groups with color span)
 * - use .label and .callback to add a clickable menu option. This
 * is the base menu item. Allows for the flyout menu to include menu
 * options with and without flyout submenus.
 * - use .isSubmenu to add a flyout submenu. If .options[] is provided,
 * a new flyout submenu will be created with those options. Otherwise,
 * provide a callback(holder) to populate the flyout div dynamically.
 *
 * ******* the final callback() is responsible for closing the
 * active menus. Include flyout.closeMenus() in the callback(s). *******
 *
 ******** NOTES ********:
 * - a flyout is the div itself
 * - the submenu is a nested menu within the flyout div
 *
 * - .options is nested for easier implementation of submenus.
 * All the options for one submenu can be separated into a nested
 * list or const instead of one, difficult to maintain, flat list.
 *
 * - Not all scenarios are tested. Prototype implementation.
 */

type FlyoutMenuOptions = {
	/** Either provide an existing Menu
	 * or one will be created on init. */
	tip?: Menu
	/** Bolded header above the menu options */
	header?: string
	options: FlyoutMenuOption[]
}

export type FlyoutMenuOption = {
	/** Menu item text */
	label?: string
	/** Click event callback */
	callback?: (...args: any[]) => void
	/** Set to enable a flyout div for populating either custom
	 * html content set in the callback or a submenu from .options[] */
	isSubmenu?: boolean
	options?: FlyoutMenuOption[]
	/** Shows slightly opaque text.
	 * Best for section headings.*/
	text?: string
	/** Allows for custom HTML content. */
	html?: string
}

type MenuPosition = {
	rect: DOMRect
	/** If the center of the menu is less than half the viewport width,
	 * it's considered left. */
	side: 'left' | 'right'
	spaceOnRight: boolean
	spaceOnLeft: boolean
}

type MenuLevel = {
	menu: Menu
	position?: MenuPosition
}

export class FlyoutMenu {
	/** Root parent menu */
	mainTip: Menu
	/** Map of active menus by their depth level with position info */
	private menuLevels: Map<number, MenuLevel>
	/** Current menu depth level */
	level: number

	constructor(opts: FlyoutMenuOptions) {
		this.validateOpts(opts)
		this.mainTip = opts?.tip || new Menu({ padding: '0px' })
		this.level = 0
		this.menuLevels = new Map([[this.level, { menu: this.mainTip }]])

		if (opts.header) {
			this.addText(this.mainTip.d, opts.header)
		}
		this.renderMenu(this.mainTip, opts.options)
	}

	private validateOpts(opts: FlyoutMenuOptions): FlyoutMenuOptions {
		if (!opts.options || !opts?.options?.length) {
			throw new Error('FlyoutMenu requires at least one option.')
		}
		for (const opt of opts.options) {
			if ((opt.label && !opt.callback) || (!opt.label && opt.callback)) {
				throw new Error('If label or callback is provided in FlyoutMenuOption, both must be provided.')
			}
			if (opt.isSubmenu && !opt.callback && !opt.options) {
				throw new Error('FlyoutMenuOption with isSubmenu=true must provide either a callback or options array.')
			}
			if (opt.isSubmenu && opt.callback && opt.options) {
				throw new Error('FlyoutMenuOption with isSubmenu=true cannot have both callback and options properties.')
			}
			if (opt.text && opt.html) {
				throw new Error('FlyoutMenuOption cannot have both text and html properties.')
			}
			if ((opt.text || opt.html) && (opt.isSubmenu || opt.options)) {
				throw new Error('FlyoutMenuOption with text or html cannot have submenu properties.')
			}
		}
		return opts
	}

	/** Centralize styling for header and text options  */
	private addText(div: Div, text: string): void {
		div.append('div').style('padding', '5px').style('opacity', '0.75').text(text)
	}

	/** Starting with the root parent menu, will recursively render
	 * all menu options and submenus in tandem with addMenuItem(). */
	private renderMenu(tip: Menu, options: FlyoutMenuOption[]): void {
		let currentMenu = this.menuLevels.get(this.level)
		if (!currentMenu) {
			currentMenu = { menu: tip }
		}

		// Pass the position info to all menu items for consistent styling
		const menuItems: { div: any; opt: FlyoutMenuOption }[] = []

		for (const opt of options) {
			if (opt.text) this.addText(tip.d, opt.text)
			else if (opt.html) tip.d.append('div').html(opt.html)
			else {
				const optDiv = this.addMenuItem(opt, tip, this.level)
				menuItems.push({ div: optDiv, opt })
			}
		}
		//Allow all the elements to render then analyze position once
		if (!currentMenu.position) {
			currentMenu.position = this.analyzeMenuPosition(tip.dnode!)
			this.menuLevels.set(this.level, currentMenu)
		}
		for (const { div, opt } of menuItems) {
			this.updateMenuText(div, opt, currentMenu.position)
		}
	}

	private addMenuItem(opt: FlyoutMenuOption, tip: Menu, level: number): Div {
		const optionCallback = () => {
			if (opt?.options?.length || opt.isSubmenu) {
				this.level = level + 1
				const flyoutTip = this.getFlyout(optDiv, tip)
				if (opt?.options) {
					this.renderMenu(flyoutTip, opt.options)
					return
				}
				opt.callback!(flyoutTip.d)!
				return
			}
			opt.callback!()
			return
		}
		const optDiv = tip.d
			.append('div')
			.text(opt.label!)
			.attr('class', 'sja_menuoption sja_sharp_border')
			.attr('tabindex', 0)
			.attr('role', 'button')
			.on('click', event => {
				event.stopPropagation()
				optionCallback()
			})
			/** Allows users tabbing through menu options to
			 * activate the callback with either Enter or Space keys.*/
			.on('keydown', event => {
				if (event.key !== 'Enter' || event.key !== ' ') return
				event.preventDefault()
				optionCallback()
			})

		return optDiv
	}

	private updateMenuText(div: Div, opt: FlyoutMenuOption, position: MenuPosition) {
		const side = position.side
		div.style('text-align', side)

		if (opt.isSubmenu) {
			div
				.insert('div')
				.html(side === 'left' ? '›' : '‹')
				.style('float', side === 'left' ? 'right' : 'left')
		}
	}

	/** If the menu appears less than half the viewport width, it's considered left.
	 * The available space is calculated for both sides. Nested submenus will
	 * take advantage of the available space when possible. */
	private analyzeMenuPosition(menuElement: HTMLElement): MenuPosition {
		const rect = menuElement.getBoundingClientRect()
		const vpWidth = window.innerWidth

		const centerX = rect.left + rect.width / 2
		const isLeft = centerX < vpWidth / 2

		const spaceRight = vpWidth - (rect.left + rect.width)
		const spaceLeft = rect.left

		// Minimum space needed for a submenu (estimate)
		// May adjust later based on actual submenu width
		const minSubmenuWidth = 200
		const hasSpaceRight = spaceRight >= minSubmenuWidth
		const hasSpaceLeft = spaceLeft >= minSubmenuWidth

		return {
			rect,
			side: isLeft ? 'left' : 'right',
			spaceOnRight: hasSpaceRight,
			spaceOnLeft: hasSpaceLeft
		}
	}

	private calculateFlyoutPosition(
		triggerElem: HTMLElement, //The element that triggered the flyout on click
		parentMenu: Menu //The entire parent menu containing the trigger
	): { x: number; y: number; side: 'left' | 'right' } {
		//Both of these are estimates for calculation purposes
		//May calculate more precisely later
		const flyoutWth = 250
		const flyoutHth = 300

		const triggerRect = triggerElem.getBoundingClientRect()

		const parentMenuLevel = this.menuLevels.get(this.level - 1)
		if (!parentMenuLevel) {
			throw new Error(`Parent menu level ${this.level - 1} not found`)
		}
		// Get or calculate parent position
		if (!parentMenuLevel.position) {
			if (!parentMenu.dnode) throw new Error('Parent menu DOM node is not available.')
			parentMenuLevel.position = this.analyzeMenuPosition(parentMenu.dnode)
		}

		const parentPos = parentMenuLevel.position
		const vpWidth = window.innerWidth

		let side: 'left' | 'right'

		if (this.level === 1) {
			// First level submenu - base decision on root menu position
			if (parentPos.side === 'left' && parentPos.spaceOnRight) {
				side = 'right'
			} else if (parentPos.side === 'right' && parentPos.spaceOnLeft) {
				side = 'left'
			} else {
				// Fallback: choose side with more space
				const spaceRight = vpWidth - parentPos.rect.right
				const spaceLeft = parentPos.rect.left
				side = spaceRight > spaceLeft ? 'right' : 'left'
			}
		} else {
			/** Nested submenus continue in the opposite direction
			 * until space runs out. When space runs out, switch to the other side.
			 */
			const parentSide = parentPos.side
			const spaceRight = vpWidth - parentPos.rect.right
			const spaceLeft = parentPos.rect.left

			if (parentSide === 'right' && spaceLeft >= flyoutWth) {
				side = 'left'
			} else if (parentSide === 'left' && spaceRight >= flyoutWth) {
				side = 'right'
			} else {
				side = spaceRight > spaceLeft ? 'right' : 'left'
			}
		}

		let x: number, y: number

		if (side === 'right') x = parentPos.rect.right + 10
		else x = parentPos.rect.left - flyoutWth - 2
		y = triggerRect.top + 10

		// Adjust x and y to keep within viewport
		const maxY = window.innerHeight - flyoutHth
		if (y > maxY) y = maxY
		if (y < 0) y = 0

		if (x < 0) x = 10
		else if (x + flyoutWth > vpWidth) {
			x = vpWidth - flyoutWth - 10
		}

		return { x, y, side }
	}

	/** When possible, reuse existing flyout */
	private getFlyout(div: any, tip: Menu): Menu {
		let flyoutTip: Menu

		/** Purpose is to find an existing menu instance at this level
		 * from a different menu option, clear it, and later reposition. */
		const existingLevel = this.menuLevels.get(this.level)
		if (existingLevel) {
			flyoutTip = existingLevel.menu
			flyoutTip.clear()
			//Clear the position to recalculate in calculateFlyoutPosition()
			existingLevel.position = undefined
		} else {
			flyoutTip = new Menu({
				padding: '0px',
				parent_menu: tip.d.node(),
				ancestor_menus: Array.from(this.menuLevels.values()).map(level => level.menu.dnode)
			})
			this.menuLevels.set(this.level, { menu: flyoutTip })
		}
		const position = this.calculateFlyoutPosition(div.node(), tip)
		flyoutTip.show(position.x, position.y, false, true, false)

		// setTimeout(() => {
		//     if (!flyoutTip.dnode) throw new Error('FlyoutTip DOM node is not available.')
		//     const position = this.analyzeMenuPosition(flyoutTip.dnode)
		//     const menuLevel = this.menuLevels.get(this.level)
		//     if (menuLevel) {
		//         menuLevel.position = position
		//     }
		// }, 0)

		requestAnimationFrame(() => {
			if (!flyoutTip.dnode) throw new Error('FlyoutTip DOM node is not available.')
			const position = this.analyzeMenuPosition(flyoutTip.dnode)
			const menuLevel = this.menuLevels.get(this.level)
			if (menuLevel) {
				menuLevel.position = position
			}
		})

		return flyoutTip
	}

	/** Close all active menus
	 * This method should be called within the final callback
	 * in .options[] */
	public closeMenus(): void {
		for (const [, menuLevel] of this.menuLevels) {
			menuLevel.menu.hide()
		}
		// Clear all except main menu
		this.menuLevels.clear()
		this.menuLevels.set(0, { menu: this.mainTip })
		this.level = 0
	}
}
