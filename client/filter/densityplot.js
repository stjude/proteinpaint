import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, format } from 'd3'

/*
	opts{}
		svg // (required) svg holder where density_plot will be rendered
		data: { // (required)
			density: [
				[x, y], // x and y position of density plot, both float
				...
			]
			minvalue: FLOAT // min value of x
			maxvalue: FLOAT // max value of x
			densitymax: FLOAT // max value of y
		} 
		term: { // (optional)
			type: STR // type of numeric variable, default - 'float'
					  // it can be specified as 'integer' 
					  // NOTE: rightnow tickFormat is same for 'integer' and 'float'
			unit: STR // unit of numeric varaible
		}
		plot_size: { // (optional)
			width: INT
			height: INT
			xpad: INT
			ypad: INT
			xasis_height: INT
		}
*/

export function makeDensityPlot(opts) {
	const { svg, data, term, plot_size } = opts
	const width = plot_size.width || 500,
		height = plot_size.height || 100,
		xpad = plot_size.xpad || 10,
		ypad = plot_size.ypad || 20,
		xaxis_height = plot_size.xaxis_height || 20

	svg.attr('width', width + xpad * 2).attr('height', height + ypad * 2 + xaxis_height)

	//density data, add first and last values to array
	const density_data = data.density
	density_data.unshift([data.minvalue, 0])
	density_data.push([data.maxvalue, 0])

	// x-axis
	const xscale = scaleLinear()
		.domain([data.minvalue, data.maxvalue])
		.range([xpad, width - xpad])

	let min = data.minvalue
	let max = data.maxvalue
	const vc = term?.valueConversion
	if (vc) {
		min = min * vc.scaleFactor
		max = max * vc.scaleFactor
	}

	const xscaleTicks = scaleLinear()
		.domain([min, max])
		.range([xpad, width - xpad])

	const x_axis = axisBottom().scale(xscaleTicks)
	if (term && term.type == 'integer') x_axis.tickFormat(format('')) //'.4r'))

	// y-scale
	const yscale = scaleLinear()
		.domain([0, data.densitymax])
		.range([height + ypad, ypad])

	const g = svg.append('g').attr('transform', `translate(${xpad}, 0)`)

	// SVG line generator
	const line = d3line()
		.x(function (d) {
			return xscale(d[0])
		})
		.y(function (d) {
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

	if (vc) {
		g.append('text')
			.text(vc.toUnit)
			.attr('fill', 'black')
			.attr('transform', `translate( ${width / 2} ,  ${ypad + height + 32})`)
			.attr('font-size', '13px')
			.attr('text-anchor', 'middle')
			.classed('sjpp-mds3-xlabel', true)
	}

	if (term && term.unit)
		g.append('text')
			.attr('transform', `translate( ${width / 2} ,  ${ypad + height + 32})`)
			.attr('font-size', '13px')
			.text(term.unit)
}
