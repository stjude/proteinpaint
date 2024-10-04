/* makes radio buttons

******* Required
.holder
.options[ {} ]
	.label
	.value
	.checked
		only set for only *one* option


******* Optional
.styles{}
	css to be applied to each <div> of the options
	e.g. { "padding":"5px", "display":"inline-block" }
.inputName
	common Name of <input>, use random number if not given
.callback
	async
.listeners: {}
	.input(), applied as
*/

let nameSuffix = 0

export function make_radios(opts) {
	console.log(opts)
	if (!opts.callback || !opts.listeners) throw `Missing event callback for radios [#dom/radiobutton.js]`

	const inputName = opts.inputName || 'pp-dom-radio-' + nameSuffix++

	const divs = opts.holder
		.selectAll('div')
		.style('display', 'block')
		.data(opts.options, d => d.value)

	const labels = divs
		.enter()
		.append('div')
		.attr('aria-label', d => d.title)
		.style('display', opts.styles && 'display' in opts.styles ? opts.styles.display : 'block')
		.style('padding', opts.styles && 'padding' in opts.styles ? opts.styles.padding : '5px')
		.append('label')

	if (opts.styles) {
		for (const k in opts.styles) {
			labels.style(k, opts.styles[k])
		}
	}

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', inputName)
		.attr('value', d => d.value)
		.style('vertical-align', 'top')
		.style('margin-top', '2px')
		.style('margin-right', 0)
		.property('checked', d => d?.checked)
	if (opts.callback) {
		inputs.on('input', async (event, d) => {
			inputs.property('disabled', true)
			await opts.callback(d.value)
			inputs.property('disabled', false)
		})
	}

	const radioText = labels
		.append('span')
		.style('vertical-align', 'top')
		.html(d => '&nbsp;' + d.label)

	if (opts?.listeners?.input) {
		inputs.on('mouseup', opts.listeners.input).on('keyup', opts.listeners.input)
		radioText.on('mouseup', opts.listeners.input).on('keyup', opts.listeners.input)
	}

	const radio = {
		divs,
		labels,
		inputs,
		main(currValue) {
			radio.currValue = currValue
			inputs.property('checked', d => d.value == radio.currValue)
		}
	}

	return radio
}
