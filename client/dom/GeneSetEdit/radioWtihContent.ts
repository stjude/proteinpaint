import { select as d3select } from 'd3-selection'

export function makeRadiosWithContentDivs(options, div) {
	const divs = div
		.selectAll()
		.data(options, (d: any) => d.value)
		.enter()
		.append('div')
		.style('margin', '5px')

	const labels = divs.append('label')

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', (d: any) => d.label)
		.attr('value', (d: any) => d.value)

	inputs.filter((d: any) => d.checked).property('checked', true)

	labels.append('span').html((d: any) => '&nbsp;' + d.label)
	// Using an if statement cause the linter to fuss
	labels
		.append('span')
		.style('display', 'block')
		.style('padding-left', '25px')
		.style('font-size', '0.75em')
		.html((d: any) => d.sublabel || '')

	//Add a div to display callback content
	divs.each(function (this: any, d: any) {
		d.contentDiv = d3select(this).append('div').style('padding-left', '25px').style('display', 'none')
		d.callback(d.contentDiv)
	})

	inputs.on('input', async (event: Event, d: any) => {
		event.stopPropagation()
		inputs.property('disabled', true)
		d.contentDiv.style('display', 'block')
		inputs.property('disabled', false)
	})
}
