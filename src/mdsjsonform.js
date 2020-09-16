import { select as d3select } from 'd3'

export async function init_mdsjsonform(holder) {
	const form_div = holder.append('div')

	form_div
		.append('div')
		.style('font-size', '20px')
		.style('margin', '10px')
		.text('Create a Custom GenomePaint Track')

	const tk_name_div = form_div
		.append('div')
		.style('display', 'block')
		.style('margin', '5px 10px')

	tk_name_div
		.append('div')
		.style('display', 'inline-block')
		.style('padding-right', '10px')
		.text('Track name')

	tk_name_div.append('input').attr('size', 20)
}
