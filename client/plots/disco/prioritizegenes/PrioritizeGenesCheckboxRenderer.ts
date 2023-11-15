export default class PrioritizeGenesCheckboxRenderer {
	private checkBoxClickListener: (checked: boolean) => void

	constructor(checkBoxClickListener: (checked: boolean) => void) {
		this.checkBoxClickListener = checkBoxClickListener
	}

	render(
		holder: any,
		checked: boolean,
		showPrioritizeGenesCheckbox: boolean,
		elementsToDisplayCount: number,
		allElementsCount: number
	) {
		if (showPrioritizeGenesCheckbox) {
			const checkbox = holder
				.append('span')
				.append('input')
				.attr('type', 'checkbox')
				.attr('id', 'genes-checkbox')
				.property('checked', checked)

			holder
				.append('label')
				.attr('for', 'genes-checkbox')
				.text(`Prioritize Cancer Gene Census  ${elementsToDisplayCount} mutations out of ${allElementsCount} total`)

			checkbox.on('change', () => {
				this.checkBoxClickListener(checkbox.property('checked'))
			})
		}
	}
}
