import type { TableBaseCell } from './tableTypes'

/** Longest text an edit may commit. Keeps an oversized paste from reaching whatever handles onEdit */
export const MAX_EDIT_LENGTH = 500

/** Swaps a cell's text for an input. A number cell only accepts a number, so a numeric column cannot be
 * filled with arbitrary text and sorting keeps working. Enter or blur commits, Escape cancels. An invalid
 * edit reverts silently. `onCommit` runs after cell.value has been updated. The table is not redrawn. */
export function startCellEdit(
	td: any,
	cell: TableBaseCell,
	opts: { label: string; validate?: (text: string) => boolean; onCommit: () => void }
): void {
	if (!td.select('input').empty()) return
	const before = cell.value ?? ''
	const isNumber = typeof before === 'number'
	const isValid = (text: string) =>
		text.length <= MAX_EDIT_LENGTH &&
		(!isNumber || (text.trim() !== '' && Number.isFinite(+text))) &&
		(!opts.validate || opts.validate(text))

	let finished = false
	const input = td
		.text('')
		.append('input')
		.attr('type', 'text')
		.attr('class', 'sjpp-table-edit-input')
		.attr('aria-label', `Edit ${opts.label}`)
		.attr('maxlength', MAX_EDIT_LENGTH)
		.style('width', '100%')
		.property('value', before)

	const finish = (commit: boolean) => {
		if (finished) return
		finished = true
		const text = input.property('value') as string
		if (commit && text !== String(before) && isValid(text)) {
			cell.value = isNumber ? +text : text
			td.text(cell.value)
			opts.onCommit()
		} else td.text(before)
	}
	input
		.on('keydown', (event: KeyboardEvent) => {
			if (event.key != 'Enter' && event.key != 'Escape') return
			finish(event.key == 'Enter')
			// the input is gone, so hand focus back to the cell rather than dropping it on <body>
			;(td.node() as HTMLElement).focus()
		})
		.on('blur', () => finish(true))

	const node = input.node() as HTMLInputElement
	node.focus()
	node.select()
}
