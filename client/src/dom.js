/*
********************** EXPORTED
make_radios
*/

export function make_radios(arg) {
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
	const { holder, options, callback, styles } = arg
	const inputName = arg.inputName || Math.random().toString()

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

export function make_select_btn_pair(holder) {
	// a click button triggering a <select> menu
	const btn = holder
		.append('div')
		.attr('class', 'sja_filter_tag_btn')
		.style('position', 'absolute')
	const select = holder
		.append('select')
		.style('opacity', 0)
		.on('mouseover', () => {
			btn.style('opacity', '0.8').style('cursor', 'default')
		})
		.on('mouseout', () => {
			btn.style('opacity', '1')
		})
	return [select, btn]
}
