import { MAX_FILTER_LENGTH } from './tableSortFilter'
import { plainButton } from './tableUtils'
import type { ColumnControl, TableBaseColumn } from './tableTypes'

/** color of a column's sort/filter button while a sort or filter is applied on the column */
const ACTIVE_COLOR = 'rgb(13, 110, 253)'

const FUNNEL_PATH = 'M1 2h14l-5.5 6.5V14l-3-1.5V8.5z'

/** One icon button per sortable/filterable column. It shows a sort symbol if the column is sortable (the
 * arrow that points the sort direction once sorted) and a filter funnel if it is filterable. Its click
 * opens the column's popup, which the caller fills with renderSortOptions() and renderFilterInput(). */
export function appendColumnMenuButton(
	th: any,
	column: TableBaseColumn,
	colIdx: number,
	menuId: string,
	onOpen: (button: any) => void
): ColumnControl {
	const action = column.sortable && column.filterable ? 'Sort and filter' : column.sortable ? 'Sort' : 'Filter'
	// a real <button> is focusable and answers Enter/Space without extra key handling
	const button: any = plainButton(th.append('button'))
		.attr('type', 'button')
		.attr('class', 'sjpp-table-column-menu-btn')
		.attr('data-testid', `sjpp-table-column-menu-btn-${colIdx}`)
		.attr('aria-label', `${action} ${column.label}`)
		.attr('aria-haspopup', 'true')
		.attr('aria-expanded', 'false')
		.attr('aria-controls', menuId)
		.style('padding', '0')
		.style('margin-left', '6px')
		.style('color', 'inherit')
		.on('click', () => onOpen(button))
	const control: ColumnControl = { button }

	if (column.sortable) {
		// the symbols are decorative: aria-sort on the <th> carries the sort state for screen readers
		control.indicator = button.append('span').attr('class', 'sjpp-table-sort-indicator').attr('aria-hidden', 'true')
	}
	if (column.filterable) {
		control.funnel = button
			.append('span')
			.attr('class', 'sjpp-table-filter-icon')
			.attr('aria-hidden', 'true')
			.style('margin-left', column.sortable ? '1px' : null)
		control.funnel
			.append('svg')
			// sized in em to follow the header text. The viewBox hugs the drawn shape, with just enough room
			// for the outline's stroke, so the funnel is as wide as the ▲/▼ glyph beside it
			.attr('width', '1em')
			.attr('height', '0.87em')
			.attr('viewBox', '0.25 1.25 15.5 13.5')
			.style('vertical-align', 'middle')
			.append('path')
			.attr('d', FUNNEL_PATH)
			// an empty outline until a filter is applied, see styleColumnControl()
			.attr('fill', 'none')
			.attr('stroke', 'currentColor')
			.attr('stroke-width', 1.4)
			.attr('stroke-linejoin', 'round')
	}
	return control
}

/** Each symbol shows its own state: the sort arrow turns blue while the column is sorted, and the funnel
 * turns blue and is filled (not an outline) while a filter is applied. */
export function styleColumnControl({ indicator, funnel }: ColumnControl, sorted: boolean, filtered: boolean): void {
	indicator?.classed('sjpp-table-sort-active', sorted).style('color', sorted ? ACTIVE_COLOR : null)
	funnel?.classed('sjpp-table-filter-active', filtered).style('color', filtered ? ACTIVE_COLOR : null)
	funnel?.select('path').attr('fill', filtered ? 'currentColor' : 'none')
}

/** "Sort ascending" and "Sort descending" in the popup. `current` is the column's sort direction, if sorted. */
export function renderSortOptions(
	menu: any,
	colIdx: number,
	current: boolean | undefined,
	onPick: (ascending: boolean) => void
): void {
	for (const ascending of [true, false]) {
		const isCurrent = current === ascending
		plainButton(menu.append('button'))
			.attr('type', 'button')
			.attr('class', 'sja_menuoption')
			.attr('data-testid', `sjpp-table-sort-${ascending ? 'asc' : 'desc'}-${colIdx}`)
			.attr('aria-current', isCurrent ? 'true' : null)
			.style('display', 'block')
			.style('width', '100%')
			.style('text-align', 'left')
			.style('font-weight', isCurrent ? 'bold' : 'normal')
			.text(`${ascending ? '▲' : '▼'} Sort ${ascending ? 'ascending' : 'descending'}`)
			.on('click', () => onPick(ascending))
	}
}

/** The filter input in the popup. Calls onInput on every keystroke (the caller debounces it), onCommit when
 * the field is committed (it loses focus, or its value is confirmed), and onEnter on Enter, which closes the popup. */
export function renderFilterInput(
	menu: any,
	opts: {
		colIdx: number
		label: string
		/** the filter text already applied */
		text: string
		/** true when sort options are above, to leave a gap */
		afterSort: boolean
		onInput: (text: string) => void
		onCommit: () => void
		onEnter: () => void
	}
): void {
	const section = menu.append('div').style('margin-top', opts.afterSort ? '8px' : null)
	section.append('div').text('Filter').style('font-size', '0.85em').style('color', '#555')
	section
		.append('input')
		.attr('type', 'text')
		.attr('aria-label', `Filter ${opts.label}`)
		.attr('placeholder', 'Filter')
		.attr('class', 'sjpp-table-filter-input')
		.attr('maxlength', MAX_FILTER_LENGTH)
		.attr('data-testid', `sjpp-table-filter-${opts.colIdx}`)
		.attr('value', opts.text)
		.style('width', '180px')
		.on('input', (event: Event) => opts.onInput((event.target as HTMLInputElement).value))
		// the browser's 'change' fires when the field loses focus, so clicking away never drops typed text
		.on('change', () => opts.onCommit())
		.on('keydown', (event: KeyboardEvent) => {
			if (event.key != 'Enter') return
			// onEnter() closes the popup and moves focus to the column button. Without this the same Enter
			// keypress is then delivered to that button, which is a click that opens the popup again.
			event.preventDefault()
			opts.onEnter()
		})
}
