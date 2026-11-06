import type { LegendItemAction, LegendItemMenuOpts, LegendItemMenuShowOpts } from './types/LegendItemMenu'
import { Menu } from '#dom'

/** The keys that are hidden after an action on a legend item.
 * - toggle: hides the item if it is shown, shows it if it is hidden.
 * - only: shows the item and hides all others.
 * - all: shows every item.
 * Only the keys of the legend are kept, so a key that is not there anymore is dropped. */
export function getHiddenKeys(action: LegendItemAction, key: string, keys: string[], hiddenKeys: string[]): string[] {
	const hidden = new Set(keys.filter(k => hiddenKeys.includes(k)))
	if (action == 'all') return []
	if (action == 'only') return keys.filter(k => k != key)
	if (hidden.has(key)) hidden.delete(key)
	else hidden.add(key)
	return keys.filter(k => hidden.has(k))
}

/** Menu of a legend item to show or hide the item, show only that item, or show all items.
 * The caller decides what hiding means, such as hiding a slice of a pie. */
export class LegendItemMenu {
	readonly tip = new Menu({ padding: '' })
	callback: LegendItemMenuOpts['callback']

	constructor(opts: LegendItemMenuOpts) {
		this.callback = opts.callback
	}

	show(opts: LegendItemMenuShowOpts) {
		const { target, key, keys, hiddenKeys } = opts
		const hiddenCount = keys.filter(k => hiddenKeys.includes(k)).length
		const isHidden = hiddenKeys.includes(key)
		if (isHidden && hiddenCount == 1) {
			//show the hidden item and skip the menu
			this.choose('toggle', opts)
			return
		}

		this.tip.clear()
		const div = this.tip.d.append('div')
		this.addOption(div, isHidden ? 'Show' : 'Hide', () => this.choose('toggle', opts))
		this.addOption(div, 'Show only', () => this.choose('only', opts))
		if (hiddenCount > 1) this.addOption(div, 'Show all', () => this.choose('all', opts))
		this.tip.showunder(target)
	}

	addOption(div, label: string, onClick: () => void) {
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(label)
			.on('click', () => {
				this.tip.hide()
				onClick()
			})
	}

	choose(action: LegendItemAction, opts: LegendItemMenuShowOpts) {
		this.callback(getHiddenKeys(action, opts.key, opts.keys, opts.hiddenKeys))
	}
}
