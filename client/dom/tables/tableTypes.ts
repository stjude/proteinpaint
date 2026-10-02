import type { Td } from '../../types/d3'

export type TableBaseCell = {
	/** primary text/number content, rendered with .text() */
	value?: string | number
	/** renders the cell as an <a href>; used as the link text too when value is not set. Only http, https,
	 * mailto and relative urls become links; any other scheme (e.g. javascript:) is shown as plain text */
	url?: string
	/** raw html for the cell, rendered with .html(). caller is responsible for sanitizing */
	html?: string
	/** text color when value is set, else the cell's background color */
	color?: string
	dataTestId?: string
	/** attached after render so external/subclass code can reach the rendered <td> */
	__td?: Td
}

export type TableBaseRow = TableBaseCell[]

export type TableBaseColumn = {
	label: string
	width?: string
	align?: 'left' | 'center' | 'right'
	/** set white-space: nowrap on every <td> of this column */
	nowrap?: boolean
	headerTestId?: string
	tooltip?: string
	/** adds Sort ascending/descending to the column's header popup; the header icon shows the sort direction */
	sortable?: boolean
	/** adds a filter input to the column's header popup; rows are kept only if this column's text contains the
	 * input (case-insensitive). Number cells also accept >n, >=n, <n, <=n, =n and lo-hi */
	filterable?: boolean
	/** clicking a text cell in this column turns it into an input. Enter or blur commits, Escape cancels.
	 * Cells with a url or html are not editable. Changes are reported through opts.onEdit */
	editable?: boolean
	/** Allowlist check on edited text in an editable column, e.g. text => /^[\w .-]+$/.test(text).
	 * An edit it rejects is reverted and onEdit is not called. Cells that hold a number only accept numbers regardless */
	validate?: (text: string) => boolean
}

/** WARNING: cell.value is raw user input. The table rejects obviously bad edits (see TableBaseColumn.validate)
 * but cannot make a value safe for a query, file path or shell. If it is sent to a server, the server must
 * validate it and use parameterized queries. Never build SQL or commands by string concatenation. */
export type TableBaseEdit = {
	/** index of the edited row in the array the caller passed in, regardless of sort/filter */
	rowIdx: number
	colIdx: number
	/** the cell, with cell.value already updated */
	cell: TableBaseCell
}

export type TableBasePagination = {
	/** rows per page */
	pageSize: number
	/** choices offered in the rows-per-page <select>. Default [10, 25, 50, 100]; pageSize is added if missing */
	pageSizeOptions?: number[]
	/** 1-based page to show first. Default 1 */
	currentPage?: number
	/** called when the page or page size changes, whether the user changed it or a sort/filter reset it to page 1 */
	onChange?: (state: { currentPage: number; pageSize: number }) => void
}

/** Appearance only. Anything that changes how the table looks rather than what it does belongs here. */
export type TableBaseStyles = {
	/** alternate row background color. default true */
	striped?: boolean
	/** show a left-hand line-number column. default false */
	showLines?: boolean
	/** default 90vw */
	maxWidth?: string
	/** default 40vh */
	maxHeight?: string
	/** css for every column header <th>, e.g. { 'font-size': '1.1em' } */
	header?: Record<string, string>
	/** css for selected rows, e.g. { 'text-decoration': 'line-through' }. Each property is cleared when the row is deselected */
	selectedRow?: Record<string, string>
	/** which side of the table the buttons sit on. Default 'right' */
	buttonsAlign?: 'left' | 'right'
}

export type TableBaseSelection = {
	/** Called whenever the user selects or deselects a row, however they do it: the input, a click anywhere
	 * on the row, the header check-all, or Enter/Space on the focused row. There is one code path, so the
	 * callback is identical in single and multiple mode.
	 * idx is the row's index in the array the caller passed in, regardless of sort/filter/page.
	 * node is the row's <input>; read node.checked for the new state. */
	onSelect?: (idx: number, node: HTMLInputElement) => void
	/** radio buttons, one row selected at a time. Default is checkboxes, any number of rows */
	singleMode?: boolean
	/** Hide the radio/checkbox. Rows are still selected by click or keyboard, but screen readers get no
	 * selected state, so only use this when the selection is conveyed another way */
	hideInput?: boolean
	/** Rows selected on first render, as indexes into rows. Does not call onSelect */
	selectedRows?: number[]
	/** Select every row on first render. Not allowed with singleMode */
	selectAll?: boolean
	/** Scroll the first selectedRows row into view on first render. Default true */
	autoScroll?: boolean
}

export type TableBaseButton = {
	text: string
	/** Called on click with the selected rows' original indexes (including rows hidden by a filter or on
	 * other pages) and the button. */
	callback: (idxs: number[], button: HTMLButtonElement) => void
	/** Called whenever the selection changes, and once on render, so the button can reflect the selection,
	 * e.g. by changing its text. A button is disabled while nothing is selected. */
	onChange?: (idxs: number[], button: HTMLButtonElement) => void
	class?: string
	dataTestId?: string
}

export type TableBaseOpts = {
	/** d3 selection to render the table into */
	div: any
	columns: TableBaseColumn[]
	rows: TableBaseRow[]
	styles?: TableBaseStyles
	/** Show one page of rows at a time, with a pager at the bottom. Sort and filter apply to all rows, not just the page */
	pagination?: TableBasePagination
	dataTestId?: string
	/** accessible name for the table, read by screen readers. Recommended: say what the table contains */
	ariaLabel?: string
	/** called after the user commits an edit in an editable column */
	onEdit?: (edit: TableBaseEdit) => void
	/** Makes rows selectable: adds the selection column (checkboxes, or radios in singleMode). Without this
	 * or buttons, rows are not selectable */
	selection?: TableBaseSelection
	/** Action buttons below the table. Their presence also makes rows selectable */
	buttons?: TableBaseButton[]
}

/* ---- internal types, shared by the table modules but not part of the options ---- */

export type SortState = { colIdx: number; ascending: boolean }

export type ColumnFilter = {
	/** lowercased text the user typed */
	text: string
	/** set when the text is a numeric expression such as >30, <=5 or 20-30; applied to number cells only */
	test?: (n: number) => boolean
}

/** A sortable/filterable column's header button and the symbols inside it. */
export type ColumnControl = { button: any; indicator?: any; funnel?: any }

/** TableBaseSelection with its defaults filled in. */
export type ResolvedSelection = {
	onSelect?: TableBaseSelection['onSelect']
	singleMode: boolean
	hideInput: boolean
	autoScroll: boolean
}
