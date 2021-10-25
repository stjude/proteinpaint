/* makes radio buttons

******* Required
.holder
.options[ {} ]
	.label
	.value
	.checked
		only set for at most one option
.callback
	async

******* Optional
.styles{}
	css to be applied to each <div> of the options
	e.g. { "padding":"5px", "display":"inline-block" }
.inputName
	common Name of <input>, use random number if not given
*/
export function make_radios(arg) {
	const { holder, options, callback, styles } = arg
	let nameSuffix = 0
	const inputName = arg.inputName || 'dom-radio-' + nameSuffix++

	const divs = holder
		.selectAll()
		.data(options, d => d.value)
		.enter()
		.append('div')
		.style('margin', '5px')

	if (styles) {
		for (const k in styles) {
			divs.style(k, styles[k])
		}
	}

	const labels = divs.append('label')

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', inputName)
		.attr('value', d => d.value)
		.on('input', async d => {
			inputs.property('disabled', true)
			await callback(d.value)
			inputs.property('disabled', false)
		})
	inputs.filter(d => d.checked).property('checked', true)

	labels.append('span').html(d => '&nbsp;' + d.label)
	return { divs, labels, inputs }
}
