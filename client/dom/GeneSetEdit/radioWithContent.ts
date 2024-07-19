import { select as d3select } from 'd3-selection'
import { Elem } from '../../types/d3'

export function makeRadiosWithContentDivs(options: any, div: Elem) {
	const divs = div
		.selectAll()
		.data(options, (d: any) => d.value)
		.enter()
		.append('div')
		.style('margin', '5px')

	const labels = divs.append('label').on('mousedown', (event: Event) => {
		event.stopPropagation()
	})

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', (d: any) => d.label)
		.attr('value', (d: any) => d.value)
		.property('checked', (d: any) => d.checked)
		.on('input', async function (this: any, event: Event, d: any) {
			event.stopPropagation()
			inputs.property('disabled', true)
			inputs.property('checked', false)
			div.selectAll('.contentDiv').style('display', 'none')

			const contentDiv = d3select(this.parentNode)
				.append('div')
				.classed('contentDiv', true)
				.style('padding-left', '25px')
				.style('display', 'block')

			await d.callback(contentDiv)
			d3select(this).property('checked', true)
			inputs.property('disabled', false)
		})

	inputs.filter((d: any) => d.checked).property('checked', true)

	labels.append('span').html((d: any) => '&nbsp;' + d.label)

	// Using an if statement to add the sublabel here
	// causes the linter to fuss
	labels
		.append('span')
		.style('display', 'block')
		.style('padding-left', '25px')
		.style('font-size', '0.75em')
		.html((d: any) => d.sublabel || '')
}
