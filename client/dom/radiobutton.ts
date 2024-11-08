import { Elem, Input } from '../types/d3'

/* makes radio buttons */

type RadioButtonOpts = {
	/** Fires .oninput. Intended for general use. */
	callback?: (f?: any) => void
	/** Required.  */
	holder: any
	/** common Name of <input>, use random number if not given */
	inputName?: string | number
	/** Mass ui specific logic. Optional callback methods for
	 * non oninput events. Intended to address needs for assistive techology
	 */
	listeners?: {
		/** Fires on onmouseup and onkeyup for the button and text label
		 */
		input: () => void
	}
	/** arr of objs defining the radio buttons and properties */
	options: OptionEntry[]
	/** css to be applied to each <div> of the options
	 * e.g. { "padding":"5px", "display":"inline-block" }
	 */
	styles?: { [index: string]: string | number }
	/** Legacy support for deprecated radio2 input option, will be mapped to wrapper div display */
	labelDisplay?: string
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

type RadioApi = {
	/** Divs containing the labels with the padding and display styles applied. */
	divs: Elem
	/** Divs encapsulating the radio buttons and text. All styles provided in opts
	 * applied here. */
	labels: Elem
	/** Radio buttons, corresponding to the .options[] opt. */
	inputs: Input
	/** Trigger changing the checked button from the cooresponding value,
	 * independent of user and other callbacks.  */
	main: (value: number) => void
}

let nameSuffix = 0

export function make_radios(opts: RadioButtonOpts): RadioApi {
	if (!opts.callback && !opts.listeners) throw `Missing event callback for radios [#dom/radiobutton.js]`
	if (opts.callback && opts.listeners)
		throw `Both callback() and .listeners defined [#dom/radiobutton.js]. Only supply one.`
	const inputName = opts.inputName || 'pp-dom-radio-' + nameSuffix++

	if (!opts.styles) opts.styles = {}
	if (!opts.styles.display) {
		if (opts.labelDisplay) opts.styles.display = opts.labelDisplay
		else {
			// no style specified. compute automatic style. if total length of all options is small,
			// show all options in one row; otherwise one row per option. this allows to limit width in 2-col edit menu setting
			// count by total number of characters. radio button counts as 4 characters
			const len = opts.options.reduce((total, d) => total + d.label.length + 4, 0)
			opts.styles.display = len < 36 ? 'inline-block' : 'block'
		}
	}
	const styleKeys = Object.keys(opts.styles)
	if (!styleKeys.includes('padding')) opts.styles.padding = '3px'

	const divs = opts.holder
		.selectAll('div')
		.data(opts.options, (d: any) => d?.value)
		.enter()
		.append('div')
		.attr('aria-label', (d: OptionEntry) => d.title)
		//.style('display', opts.styles.display)
		.style('padding', opts.styles.padding)

	if (opts.styles) {
		for (const k in opts.styles) {
			// apply opts.styles to div, instead of labels
			divs.style(k, opts.styles[k])
		}
	}

	const labels = divs.append('label')
	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', inputName)
		.attr('value', (d: OptionEntry) => d.value)
		/** vertical-align = top was the default in the now deleted radio2.js
		 * used exclusively for mass. Allow for mass to implement this style
		 * without impeding other use cases.*/
		.style('vertical-align', opts.styles && 'vertical-align' in opts.styles ? opts.styles['vertical-align'] : '')
		.style('margin-top', '2px')
		.style('margin-right', 0)
		.property('checked', (d: OptionEntry) => d?.checked)
	if (opts.callback) {
		inputs.on('input', async (event: KeyboardEvent, d: OptionEntry) => {
			//Disable the radio buttons while the callback is running
			inputs.property('disabled', true)
			if (!opts.callback) return //So eslint doesn't complain
			await opts.callback(d.value)
			radio.main(d.value)
			//Re-enable the radio buttons after the callback finishes
			inputs.property('disabled', false)
		})
	}

	const radioText = labels
		.append('span')
		.style('vertical-align', opts.styles && 'vertical-align' in opts.styles ? opts.styles['vertical-align'] : '')
		.html((d: OptionEntry) => '&nbsp;' + d.label)

	if (opts?.listeners?.input) {
		//Mass UI specific logic for assistive technologies
		inputs.on('mouseup', opts.listeners.input).on('keyup', opts.listeners.input)
		radioText.on('mouseup', opts.listeners.input).on('keyup', opts.listeners.input)
	}

	const radio = {
		divs,
		labels,
		inputs,
		main(currValue: string | number) {
			radio['currValue'] = currValue
			inputs.property('checked', (d: OptionEntry) => d.value == radio['currValue'])
		}
	}

	return radio
}
