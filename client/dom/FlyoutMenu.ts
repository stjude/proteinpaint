import { Menu } from '#dom'

/** Tentative implementation of a reusable flyout menu
 * Intended to support nested flyouts, e.g., for submenus.
 *
 * Notes:
 * - .options is nested for easier implementation of submenus.
 * All the options for one submenu can be separate into a nested
 * list or const instead of one, difficult to maintain, flat list.
 *
 * - the final callback is responsible for closing the active menus
 *
 * - Not all scenarios are tested. Prototype implementation.
 */

type FlyoutMenuOptions = {
	/** Either provide an existing Menu
	 * or one will be created on init. */
	tip?: Menu
	/** Bolder header above the menu options */
	header?: string
	options: FlyoutMenuOption[]
}

export type FlyoutMenuOption = {
	label: string
	callback: (...args: any[]) => void
	/** Set to enable a flyout submenu*/
	isSubmenu?: boolean
	options?: FlyoutMenuOption[]
	/** Creates a span */
	text?: string
	html?: string
}

export class FlyoutMenu {
	/** Parent menu */
	mainTip: Menu
	/** Map of active menus by their depth level */
	activeMenus: Map<number, Menu>
	/** Current menu depth level */
	level: number

	constructor(opts: FlyoutMenuOptions) {
		this.validateOpts(opts)
		this.mainTip = opts?.tip || new Menu({ padding: '0px' })
		this.level = 0
		this.activeMenus = new Map([[this.level, this.mainTip]])

		if (opts.header) {
			this.mainTip.d.append('div').style('font-weight', 'bold').style('padding', '5px').text(opts.header)
		}
		this.render(this.mainTip, opts.options)
	}

	validateOpts(opts: FlyoutMenuOptions) {
		if (!opts.options || !opts?.options?.length) {
			throw new Error('FlyoutMenu requires at least one option.')
		}
		for (const opt of opts.options) {
			if (!opt.label || !opt.callback) {
				throw new Error('Each FlyoutMenuOption requires a label and callback function.')
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

	render(tip: Menu, options: FlyoutMenuOption[]) {
		for (const opt of options) {
			if (opt.text) tip.d.append('span').style('opacity', '0.7').text(opt.text)
			else if (opt.html) tip.d.append('div').html(opt.html)
			else this.addMenuItem(opt, tip, this.level)
		}
	}

	addMenuItem(opt: FlyoutMenuOption, tip: Menu, level: number) {
		const optDiv = tip.d
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(opt.label)
			.on('click', event => {
				event.stopPropagation()

				if (opt?.options?.length || opt.isSubmenu) {
					this.level = level + 1
					const flyoutTip = this.getFlyout(optDiv, tip)
					if (opt?.options) {
						this.render(flyoutTip.d, opt.options)
						return
					}
					opt.callback(flyoutTip.d)
					return
				}
				opt.callback()
				return
			})
		if (opt.isSubmenu) optDiv.insert('div').html('›').style('float', 'right')
	}

	/** When possible, reuse existing flyout */
	getFlyout(div: any, tip: Menu) {
		let flyoutTip
		if (this.activeMenus.has(this.level)) {
			flyoutTip = this.activeMenus.get(this.level)
			flyoutTip.clear()
		} else {
			flyoutTip = new Menu({ padding: '0px', parent_menu: tip.d.node() })
			this.activeMenus.set(this.level, flyoutTip)
		}
		const rect = div.node().getBoundingClientRect()
		flyoutTip.show(rect.width, rect.y)
		return flyoutTip
	}

	closeMenus(): void {
		for (const [level, tip] of this.activeMenus) {
			if (level > 0) {
				// Don't close the main tip
				tip.hide()
				tip.destroy?.() // If Menu has cleanup method
			}
		}
		this.activeMenus.clear()
		this.activeMenus.set(0, this.mainTip)
		this.level = 0
	}
}
