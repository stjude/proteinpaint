import { select as d3select, selectAll as d3selectAll, event as d3event } from 'd3-selection'

// TODO may replace with radiobutton.js
export function initRadioInputs(opts) {
	const divs = opts.holder
		.selectAll('div')
		.style('display', 'block')
		.data(opts.options, d => d.value)

	divs.exit().each(function(d) {
		d3select(this)
			.on('input', null)
			.on('click', null)
			.remove()
	})

	const labels = divs
		.enter()
		.append('div')
		.style('display', 'block')
		.style('padding', '5px')
		.append('label')

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', opts.name)
		.attr('value', d => d.value)
		.property('checked', opts.isCheckedFxn)
		.style('vertical-align', 'top')
		.on('input', opts.listeners.input)

	labels
		.append('span')
		.style('vertical-align', 'top')
		.html(d => '&nbsp;' + d.label)

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
