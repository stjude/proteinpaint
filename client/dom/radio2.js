import { select as d3select, selectAll as d3selectAll } from 'd3-selection'

// TODO may replace with radiobutton.js
export function initRadioInputs(opts) {
	const divs = opts.holder
		.selectAll('div')
		.data(opts.options, d => d.value)
		.style('display', 'block')

	divs.exit().each(function (d) {
		d3select(this).on('input', null).on('click', null).remove()
	})

	const labels = divs
		.enter()
		.append('div')
		.attr('aria-label', d => d.title)
		.style('display', 'block')
		.style('padding', opts.styles && 'padding' in opts.styles ? opts.styles.padding : '5px')
		.append('label')

	if (opts.styles) {
		for (const key in opts.styles) {
			labels.style(key, opts.styles[key])
		}
	}

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', opts.name)
		.attr('value', d => d.value)
		.style('vertical-align', 'top')
		.style('margin-top', '2px')
		.style('margin-right', 0)
		.property('checked', opts.isCheckedFxn)
		.on('mouseup', opts.listeners.input)
		.on('keyup', opts.listeners.input)

	labels
		.append('span')
		.style('vertical-align', 'top')
		.html(d => '&nbsp;' + d.label)
		.on('mouseup', opts.listeners.input)
		.on('keyup', opts.listeners.input)

	function isChecked(d) {
		return d.value == radio.currValue
	}

	const radio = {
		main(currValue) {
			radio.currValue = currValue
			inputs.property('checked', isChecked)
		},
		dom: {
			divs: opts.holder.selectAll('div'),
			labels: opts.holder.selectAll('label').select('span'),
			inputs: labels.selectAll('input')
		}
	}

	return radio
}
