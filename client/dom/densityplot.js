import { scaleLinear, axisBottom, axisLeft, line as d3line, curveMonotoneX, format, brushX } from 'd3'

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

export async function make_densityplot(holder, data, callabck, term) {
	const width = 500,
		height = 150,
		xpad = 25,
		ypad = 20,
		xaxis_height = 20,
		default_ticks = 10
	const svg = holder.append('svg')
	svg.attr('width', width + xpad * 2).attr('height', height + ypad * 2 + xaxis_height)
	//density data, add first and last values to array

	const density_data = data.density_data
	console.log(density_data)
	//density data, add first and last values to array
	let min = density_data.minvalue
	let max = density_data.maxvalue
	const xscale = scaleLinear()
		.domain([min, max])
		.range([xpad, width - xpad])

	const vc = term.valueConversion
	if (vc) {
		min = min * vc.scaleFactor
		max = max * vc.scaleFactor
	}

	// x-axis
	const xscaleTicks = scaleLinear()
		.domain([min, max])
		.range([xpad, width - xpad])

	const x_axis = axisBottom().scale(xscaleTicks)

	x_axis

	// y-scale
	const yscale = scaleLinear()
		.domain([0, density_data.densityMax])
		.range([height + ypad, ypad])
	const y_axis = axisLeft().scale(yscale).ticks(default_ticks).tickFormat(format('d'))

	const g = svg.append('g').attr('transform', `translate(${xpad}, 0)`)

	// SVG line generator
	const line = d3line()
		.x(function (d) {
			return xscale(d.x0)
		})
		.y(function (d) {
			return yscale(d.density)
		})
		.curve(curveMonotoneX)
	g.append('g').attr('transform', `translate(${xpad}, 0)`).call(y_axis)

	// plot the data as a line
	g.append('path')
		.datum(density_data.density)
		.attr('class', 'line')
		.attr('d', line)
		.style('fill', '#eee')
		.style('stroke', '#000')

	g.append('g')
		.attr('transform', `translate(0, ${ypad + height})`)
		.call(x_axis)

	g.append('text')
		.text(`${data.termname ? data.termname + ', ' : ''}${vc ? `${vc.toUnit}s` : 'days'}`)
		.attr('fill', 'black')
		.attr('transform', `translate( ${width / 2} ,  ${ypad + height + 32})`)
		.attr('font-size', '13px')
		.attr('text-anchor', 'middle')
		.classed('sjpp-mds3-xlabel', true)

	g.append('text')
		.text('# samples')
		.attr('transform', `translate(-5,  ${height / 2}) rotate(-90)`)
		.attr('fill', 'black')
		.attr('font-size', '13px')
		.attr('text-anchor', 'middle')
		.classed('sjpp-mds3-ylabel', true)

	// add brush to select range from the density plot
	g.call(
		brushX()
			.extent([
				[xpad, ypad],
				[width - xpad, height + ypad]
			])
			.on('end', async event => {
				const selection = event.selection
				const range_start = xscale.invert(selection[0])
				const range_end = xscale.invert(selection[1])
				callabck({ range_start, range_end })
			})
	)
}
