/* makes radio buttons */

type RadioButtonOpts = {
	/** Fires .oninput. Intended for general use. */
	callback?: (f?: any) => void
	/** Required.  */
	holder: any
	/** common Name of <input>, use random number if not given */
	inputName?: string | number
	/** Optional callback methods for non oninput events
	 * Intended to address needs for assistive techology
	 */
	listeners?: {
		/** Fires on onmouseup and onkeyup for the button and text label */
		input: () => void
	}
	/** arr of objs defining the radio buttons and properties */
	options: OptionEntry[]
	/** css to be applied to each <div> of the options
	 * e.g. { "padding":"5px", "display":"inline-block" }
	 */
	styles?: { [index: string]: string | number }
}

type OptionEntry = {
	/** only set for only *one* option */
	checked?: boolean | number
	/** Text shown in the span to the right of the radio button */
	label: string
	/** Text shown in tooltip */
	title?: string
	/** Should correspond to 'currValue' in callbacks */
	value: string | number
}

let nameSuffix = 0

export function make_radios(opts: RadioButtonOpts) {
	if (!opts.callback && !opts.listeners) throw `Missing event callback for radios [#dom/radiobutton.js]`
	if (opts.callback && opts.listeners)
		throw `Both callback() and .listeners defined [#dom/radiobutton.js]. Only supply one.`
	const inputName = opts.inputName || 'pp-dom-radio-' + nameSuffix++

	const divs = opts.holder
		.selectAll('div')
		.style('display', 'block')
		.data(opts.options, (d: any) => d.value)

	const labels = divs
		.enter()
		.append('div')
		.attr('aria-label', d => d.title || '')
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
			if (!opts.callback) return //So ts doesn't complain
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
		main(currValue: string | number) {
			radio['currValue'] = currValue
			inputs.property('checked', d => d.value == radio['currValue'])
		}
	}

	return radio
}
