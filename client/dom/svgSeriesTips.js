import { Menu } from '#dom/menu'
import { pointer } from 'd3-selection'

/*
	Will create a multi-series tooltip that follows
 	the cursor with a moving vertical line
 	over a chart's plot area

	Arguments:
	line 	required, 
				a d3-wrapped svg.line element, to be used as the moving vertical line
				
				!!! NOTE: this line must be immediately under the rect element to avoid
				flickering and other undesired behavior !!!

				this line must already be styled with stroke, etc
				only the line's visibility and positions will be modified on mouseOver()
				the length will also be adjusted in the returned API's update() method
	
	rect 	required, 
				a d3-wrapped svg.rect element, which covers the plot area
	      in order to capture mouse events for this tooltip
	      !!! will be styled with fill: 'transparent' !!!

	_tip  optional,
				a client.Menu instance

	Returns
	an API object (see the specs at the end of this function)
*/
export function getSeriesTip(line, rect, _tip = null, plotType) {
	const tip = _tip || new Menu({ padding: '5px' })
	line.style('display', 'none')

	const rectNode = rect.style('fill', 'transparent').node()

	function mouseOver(event) {
		const m = pointer(event, rectNode)
		const mx = m[0]
		const xVal = +opts.xScale.invert(mx).toFixed(opts.decimals)
		const x = opts.xScale(xVal) /* + 0.5*/ // do not add a small float value here; otherwise, the line will not match up with the data

		line.style('display', '').attr('stroke', '#aaa').attr('stroke-dasharray', 4).attr('x1', x).attr('x2', x)

		const seriesHtmls = []
		for (const series of opts.serieses) {
			const data = series.data
			const data_x = data.map(d => d.x)
			if (xVal >= Math.min(...data_x) && xVal <= Math.max(...data_x)) {
				// xVal is within range of the series
				// determine max timepoint that is less than or
				// equal to xVal
				const max = Math.max(...data_x.filter(x => x <= xVal))
				// store html of this timepoint
				const timepoint = data.find(d => d.x == max)
				if (timepoint) seriesHtmls.push(timepoint.html)
			}
		}

		if (seriesHtmls.length) {
			if (plotType === 'survival') {
			// Sort the seriesHtmls array by percentage
			const sortedSeriesHtmls = seriesHtmls.sort((a, b) => {
				// Extract the percentage from each HTML string
				const percentageA = parseFloat(a.match(/(\d+\.\d+)%/)[1]);
				const percentageB = parseFloat(b.match(/(\d+\.\d+)%/)[1]);
				
				// Sort in descending order (highest percentage first)
				return percentageA - percentageB;
			});
		
			// Render the tooltip with sorted seriesHtmls
			tip
				.show(event.clientX, event.clientY)
				.d.html(
					`${opts.xTitleLabel}: ${xVal}<br>` +
					sortedSeriesHtmls.map(d => d).join(opts.separator)
				);
		} else {
		tip
				.show(event.clientX, event.clientY)
				.d.html(`${opts.xTitleLabel}: ${xVal}<br>` + seriesHtmls.map(d => d).join(opts.separator))
		}
	} else {
			tip.hide();
		}
	}

	rect
		.on('mouseover', mouseOver)
		.on('mousemove', mouseOver)
		.on('mouseout', () => {
			line.style('display', 'none')
			tip.hide()
		})

	const opts = {
		separator: '<br>',
		decimals: 1
	}

	/*
		The API object for this tooltip is returned below
	*/
	return {
		/*
			Will update the length of the vertical line
			and reassign optional data values

			!!! MUST call api.update() before the expected mouseover event,
			so that the line will have the proper length and the mouse
			position could be computed with .xScale !!! 

			_opts{}
			.xScale					required
										the d3-scale object that was used for the rect dimensions
										
			.xTitleLabel			required
										title of x-axis
										will be used as label of x-value in tooltip

			.serieses[{data}] 		required
										array of series objects, assumed to be visibly rendered
							
				.data[{x, html}]	required
										array of data objects
										the series data that is currently rendered in the chart
					
					.x 				required, float
										the datapoint's actual, unscaled x value
					
					.html   		required, string
										the HTML to display in the tooltip if this datapoint's 
										x value matched the vertical line's position

			.separator				optional, string
										the html to be used to join the series html strings when displayed in the tooltip

			.decimals				optional, number
										number of decimal places of the datapoint's x-value
										will control the precision of the vertical line
		*/
		update(_opts = {}) {
			Object.assign(opts, _opts)
			const x = rect.attr('x')
			const y = rect.attr('y')
			line
				.attr('x1', x)
				.attr('x2', x)
				.attr('y1', y)
				.attr('y2', rect.attr('height') - y)
		},

		/*
			detroy to help minimize memory leaks
			from elements and event handlers not being garbage collected
			because of non-deactivated references
		*/
		destroy() {
			rect.on('mouseover', null).on('mousemove', null).on('mouseout', null)
		}
	}
}
