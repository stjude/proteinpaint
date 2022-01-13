import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, format } from 'd3'

export function makeDensityPlot(svg, data, term) {
	const width = 500,
		height = 100,
		xpad = 10,
		ypad = 20,
		xaxis_height = 20

	svg.attr('width', width + xpad * 2).attr('height', height + ypad * 2 + xaxis_height)

	//density data, add first and last values to array
	const density_data = data.density
	density_data.unshift([data.minvalue, 0])
	density_data.push([data.maxvalue, 0])

	// x-axis
	const xscale = scaleLinear()
		.domain([data.minvalue, data.maxvalue])
		.range([xpad, width - xpad])

	const x_axis = axisBottom().scale(xscale)
	if (term && term.type == 'integer') x_axis.tickFormat(format('')) //'.4r'))

	// y-scale
	const yscale = scaleLinear()
		.domain([0, data.densitymax])
		.range([height + ypad, ypad])

	const g = svg.append('g').attr('transform', `translate(${xpad}, 0)`)

	// SVG line generator
	const line = d3line()
		.x(function(d) {
			return xscale(d[0])
		})
		.y(function(d) {
			return yscale(d[1])
		})
		.curve(curveMonotoneX)

	// plot the data as a line
	g.append('path')
		.datum(density_data)
		.attr('class', 'line')
		.attr('d', line)
		.style('fill', '#eee')
		.style('stroke', '#000')

	g.append('g')
		.attr('transform', `translate(0, ${ypad + height})`)
		.call(x_axis)

	g.append('text')
		.attr('transform', `translate( ${width / 2} ,  ${ypad + height + 32})`)
		.attr('font-size', '13px')
		.text(term ? term.unit : '')

	const brush_g = svg
		.append('g')
		.attr('class', 'brush_g')
		.attr('transform', `translate(${xpad}, ${ypad})`)

	const binsize_g = svg
		.append('g')
		.attr('class', 'binsize_g')
		.attr('transform', `translate(${xpad}, ${ypad})`)

	// num_obj.custombins_g = svg
	// 	.append('g')
	// 	.attr('class', 'custombins_g')
	// 	.attr('transform', `translate(${xpad}, ${ypad})`)
	// 	.style('display', 'none')

	return { brush_g, binsize_g }
}
