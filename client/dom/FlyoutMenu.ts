import { Menu } from '#dom'

/** Tentative implementation of a reusable flyout menu
 * Intended to support nested submenus
 *
 * Notes:
 * - .options is nested for easier implementation of submenus
 * All the options for one submenu can be kept together instead of one flat list
 *
 * - the final callback is responsible for closing the active menus
 */

type FlyoutMenuOptions = {
	tip?: Menu
	header?: string
	options: FlyoutMenuOption[]
}

export type FlyoutMenuOption = {
	label: string
	callback: (...args: any[]) => void
	isSubmenu?: boolean
	options?: FlyoutMenuOption[]
	text?: string
	html?: string
}

export class FlyoutMenu {
	opts: FlyoutMenuOptions
	mainTip: Menu
	options: FlyoutMenuOption[]
	activeMenus: Map<number, Menu>
	level: number

	constructor(opts: FlyoutMenuOptions) {
		this.opts = opts
		this.mainTip = opts.tip || new Menu({ padding: '0px' })
		this.options = opts.options
		this.level = 0
		this.activeMenus = new Map([[this.level, this.mainTip]])

		if (this.opts.header) {
			this.mainTip.d.append('div').style('font-weight', 'bold').style('padding', '5px').text(this.opts.header)
		}
		this.render(this.mainTip, this.options)
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
			.on('click', () => {
				if (opt?.options?.length || opt.isSubmenu) {
					this.level = level + 1
					const submenuTip = this.newFlyoutMenu(optDiv, tip)
					if (opt?.options) {
						this.render(submenuTip.d, opt.options)
						return
					}
					opt.callback(submenuTip.d)
					return
				}
				opt.callback()
				return
			})
		if (opt.isSubmenu) optDiv.insert('div').html('›').style('float', 'right')
	}

	newFlyoutMenu(div: any, tip: Menu) {
		let submenuTip
		if (this.activeMenus.has(this.level)) {
			submenuTip = this.activeMenus.get(this.level)
			submenuTip.clear()
		} else {
			submenuTip = new Menu({ padding: '0px', parent_menu: tip.d.node() })
			this.activeMenus.set(this.level, submenuTip)
		}
		const rect = div.node().getBoundingClientRect()
		submenuTip.show(rect.width, rect.y)
		return submenuTip
	}

	closeMenus(): void {
		for (const [level, tip] of this.activeMenus) {
			if (level > 0) {
				// Don't close the main tip
				tip.hide()
				tip.destroy?.() // If Menu has cleanup method
			}
		}
		// Keep only the main menu
		this.activeMenus.clear()
		this.activeMenus.set(0, this.mainTip)
		this.level = 0
	}
}
