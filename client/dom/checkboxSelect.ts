export type CheckboxOption = {
	value: string | number
	label: string
}

export type CheckboxSelectOpts = {
	className: string
	lastCheckedTitle: string
	onChange?: () => void
}

// Renders inline checkboxes that are checked by default and prevents the final
// checked option from being deselected.
export function renderCheckboxSelect(holder: any, options: CheckboxOption[], opts: CheckboxSelectOpts) {
	holder.selectAll('*').remove()
	if (options.length < 2) return

	const div = holder.append('div').attr('class', opts.className).style('margin-right', '8px')
	const checkboxes: any[] = []

	for (const option of options) {
		const label = div
			.append('label')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('margin-right', '10px')
		const input = label
			.append('input')
			.attr('type', 'checkbox')
			.attr('value', option.value)
			.property('checked', true)
			.on('click', event => {
				// The click has already toggled the box; cancelling it restores the box.
				if (!checkboxes.some(checkbox => checkbox.property('checked'))) event.preventDefault()
			})
			.on('change', () => {
				markLastChecked(checkboxes, opts.lastCheckedTitle)
				opts.onChange?.()
			})
		label.append('span').style('margin-left', '4px').text(option.label)
		checkboxes.push(input)
	}

	return checkboxes
}

function markLastChecked(checkboxes: any[], title: string) {
	const checked = checkboxes.filter(checkbox => checkbox.property('checked'))
	for (const checkbox of checkboxes) {
		const isLast = checked.length == 1 && checked[0] === checkbox
		const label = checkbox.node().parentNode
		label.title = isLast ? title : ''
		label.style.cursor = isLast ? 'not-allowed' : ''
	}
}

export function getSelectedCheckboxValues(checkboxes?: any[]): string[] | undefined {
	if (!checkboxes) return
	return checkboxes.filter(checkbox => checkbox.property('checked')).map(checkbox => String(checkbox.property('value')))
}
