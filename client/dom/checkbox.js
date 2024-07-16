/* on/off switch

******* required
.holder
.labeltext
.callback()
	async
	one boolean argument corresponding to whether the box is checked or not
******* optional
.divstyle{}
.checked
	if set to true, box is checked by default
*/
export function make_one_checkbox(arg) {
	const { holder, labeltext, callback, checked, divstyle, id } = arg

	const div = holder.append('div')
	if (divstyle) {
		for (const k in divstyle) div.style(k, divstyle[k])
	}
	const label = div.append('label')
	const input = label
		.append('input')
		.attr('type', 'checkbox')
		.property('checked', checked)
		.on('input', async () => {
			input.property('disabled', true)
			await callback(input.property('checked'))
			input.property('disabled', false)
		})
	if (id) input.attr('id', id)
	label.append('span').html('&nbsp;' + labeltext)
	return input
}
