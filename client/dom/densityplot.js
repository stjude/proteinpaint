import { scaleLinear, axisBottom, axisLeft, line as d3line, curveMonotoneX, format, brushX } from 'd3'
import { event as d3event } from 'd3-selection'

/*
********************** EXPORTED
make_densityplot

.holder
    required
.data:
    required
    get density data for numeric data from server/src/mds3.densityPlot.js
.callback()
    required
*/

export async function make_densityplot(holder, data, callabck) {
	const width = 500,
		height = 150,
		xpad = 25,
		ypad = 20,
		xaxis_height = 20,
		default_ticks = 10
	const svg = holder.append('svg')
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
	x_axis.tickFormat(format(''))

	// y-scale
	const yscale = scaleLinear()
		.domain([0, data.densitymax])
		.range([height + ypad, ypad])

	const y_axis = axisLeft()
		.scale(yscale)
		.ticks(data.densitymax < default_ticks ? data.densitymax : default_ticks)
		.tickFormat(format('d'))

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

	const y_scale = g
		.append('g')
		.attr('transform', `translate(${xpad}, 0)`)
		.call(y_axis)

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
		.text(data.unit)
		.attr('fill', 'black')
		.attr('transform', `translate( ${width / 2} ,  ${ypad + height + 32})`)
		.attr('font-size', '13px')

	g.append('text')
		.text('# samples')
		.attr('transform', `translate(0,  ${height / 2}) rotate(-90)`)
		.attr('fill', 'black')
		.attr('font-size', '13px')
		.attr('text-anchor', 'middle')

	// add brush to select range from the density plot
	g.call(
		brushX()
			.extent([[xpad, ypad], [width - xpad, height + ypad]])
			.on('end', async () => {
				const selection = d3event.selection
				const range_start = xscale.invert(selection[0])
				const range_end = xscale.invert(selection[1])
				callabck({ range_start, range_end })
			})
	)
}
