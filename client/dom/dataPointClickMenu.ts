import type { Menu } from './menu'
import { showResultsTable } from './resultsTable'

export type ActionMenuItem = {
	label: string
	onClick: () => void | Promise<void>
}

export interface OpenActionMenuOpts {
	/** Menu instance the caller owns — typically reused across hover/click flows. */
	menu: Menu
	/** Click event whose clientX/clientY position the menu. */
	event: { clientX: number; clientY: number }
	/** Action buttons rendered as a row at the top of the menu. */
	actions: ActionMenuItem[]
	/** Caller-rendered info section (table2col, custom layout, etc.) appended
	 * below the action buttons. */
	renderInfo: (container: any) => void
}

/** Opens an action menu at the click point: action buttons row at top, then
 * a caller-rendered info section. Used by single-hit clicks and as the
 * second step after picking a row from `openMultiHitClickMenu`. */
export function openActionMenu(opts: OpenActionMenuOpts): void {
	opts.menu.clear().show(opts.event.clientX, opts.event.clientY)
	const container = opts.menu.d.append('div').style('margin', '10px')
	if (opts.actions.length > 0) {
		const buttonRow = container.append('div').style('margin-bottom', '10px')
		for (const a of opts.actions) {
			buttonRow
				.append('button')
				.attr('class', 'sja_menuoption')
				.style('margin-right', '5px')
				.text(a.label)
				.on('click', async () => {
					opts.menu.hide()
					await a.onClick()
				})
		}
	}
	opts.renderInfo(container)
}

export interface OpenMultiHitClickMenuOpts<T> {
	menu: Menu
	event: { clientX: number; clientY: number }
	/** Hit list. Index into this drives `onRowClick`. */
	items: T[]
	columns: any[]
	rows: any[]
	getRowKey: (item: T) => string
	/** Optional header line above the table (e.g. "5 Cohorts"). */
	header?: string
	/** Invoked when the user picks a row — typically opens the action menu
	 * for that item via `openActionMenu`. The original click event is passed
	 * back so the action menu can stay anchored at the same click point. */
	onRowClick: (item: T, event: { clientX: number; clientY: number }) => void
}

/** Opens a click menu with a multi-row sortable table. Selecting a row
 * invokes `onRowClick`. Mirrors the volcano/manhattan multi-hit affordance
 * so plots with cluster-style hits all behave the same way. */
export function openMultiHitClickMenu<T>(opts: OpenMultiHitClickMenuOpts<T>): void {
	opts.menu.clear().show(opts.event.clientX, opts.event.clientY)
	const holder = opts.menu.d.append('div').style('margin', '10px')
	if (opts.header) {
		holder
			.append('div')
			.style('color', '#888')
			.style('font-weight', 'bold')
			.style('margin', '0 0 6px 0')
			.text(opts.header)
	}
	showResultsTable({
		tableDiv: holder,
		dataItems: opts.items as any[],
		columns: opts.columns,
		rows: opts.rows,
		getRowKey: opts.getRowKey as any,
		singleMode: true,
		noButtonCallback: (i: number) => opts.onRowClick(opts.items[i], opts.event)
	})
}
