export type LegendItemAction = 'toggle' | 'only' | 'all'

export type LegendItemMenuOpts = {
	/** Called with the keys that are hidden after the user's choice */
	callback: (hiddenKeys: string[]) => void
}

export type LegendItemMenuShowOpts = {
	/** The legend item that was clicked. The menu is shown under it. */
	target: Element
	/** The key of the legend item */
	key: string
	/** The keys of every legend item */
	keys: string[]
	/** The keys that are hidden now */
	hiddenKeys: string[]
}
