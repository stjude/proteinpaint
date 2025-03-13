import type { Elem } from 'types/d3'

export type TabsOpts = {
	/** optional: if not provided, create new under opts.holder */
	contentHolder?: Elem
	holder: any
	/**  Optional: Gap between tabs. Must be = '[number]px'
	 * Only applies to vertical position. Default = '' */
	gap?: string
	/** Optional: Determines the position for the blue border */
	linePosition?: 'top' | 'bottom' | 'right' | 'left'
	/** optional: voids creating a content div */
	noContent?: boolean
	/** optional: removes the padding-top and margin-top required for SVGs.
	 * Intented to remove the excess white space that appears for non-SVG content
	 * between the tabs and content div */
	noTopContentStyle?: boolean
	tabs: TabsInputEntry[]
	/**  Optional: Show tabs inline horizonally or vertical stack. Default: 'horizontal'*/
	tabsPosition?: 'vertical' | 'horizontal'
}

export type TabsInputEntry = {
	/** Define which tab renders first. Default: tabs[0].active = true*/
	active?: boolean
	/** Blue text shown in tab */
	label?: string
	/** Width of the tab in pixels */
	width?: number
	/** Callback when the tab is clicked
	 * Do not set tab arg to RenderedTab.
	 * Caller may have separate tab type. */
	callback?: (event: any, tab: any) => any
	/** Condition for disabling click events. Default is false. */
	disabled?: (f: any) => boolean
	/** Condition for showing the tab. Default is true */
	isVisible?: (f: any) => void
	/** Support for key navigation (ADA usage)
	 * Callback for keydown event.
	 * Do not set tab arg to RenderedTab.
	 * Caller may have separate tab type.*/
	keydownCallback?: (event: any, tab: any) => any
}

export type RenderedTab = TabsInputEntry & {
	id: string
	contentHolder: any
}
