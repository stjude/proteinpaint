/* on/off switch

******* required
.holder
.callback()
	async
	one boolean argument corresponding to whether the box is checked or not
******* optional
.divstyle{}
.labeltext
.title
.checked
	if set to true, box is checked by default
.id
.testid
    sets input data-testid="", for testing
*/
export function make_one_checkbox(arg) {
	const { holder, labeltext, title, callback, checked, divstyle, id, testid } = arg

	const div = holder.append('div')
	if (divstyle) {
		for (const k in divstyle) div.style(k, divstyle[k])
	}
	const label = div.append('label').on('mousedown', event => {
		// this fix allows clicking on a checkbox of a secondary menu not to hide the primary menu, e.g. in geneset edit ui "top mutated" submenu options
		event.stopPropagation()
	})
	const input = label
		.append('input')
		.attr('type', 'checkbox')
		.property('checked', checked)
		.on('input', async () => {
			input.property('disabled', true)
			await callback(input.property('checked'))
			input.property('disabled', false)
		})
	if (title) input.attr('title', title)
	if (id) input.attr('id', id)
	if (testid) input.attr('data-testid', testid)
	if (labeltext) label.append('span').html('&nbsp;' + labeltext)
	return input
}
