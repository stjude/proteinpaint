import { mouse, event } from 'd3-selection'
import { Menu } from '#dom/menu'

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
export function getSeriesTip(line, rect, _tip = null) {
	const tip = _tip || new Menu({ padding: '5px' })
	line.style('display', 'none')

	const rectNode = rect.style('fill', 'transparent').node()

	function mouseOver() {
		const m = mouse(rectNode)
		// adding 1 makes the vertical line match the
		// x-axis tick position exactly
		const mx = m[0] + 1
		const xVal = +opts.xScale.invert(mx).toFixed(1)
		const x = opts.xScale(xVal)

		line
			.style('display', '')
			.attr('stroke', '#aaa')
			.attr('stroke-dasharray', 4)
			.attr('x1', x)
			.attr('x2', x)

		const seriesHtmls = opts.serieses
			.map(s => {
				let matched
				for (const d of s.data) {
					if (d.x > xVal) break
					matched = d
				}
				return !matched ? null : matched.html
			})
			.filter(d => d)

		if (seriesHtmls.length) {
			tip.show(event.clientX, event.clientY).d.html(`Time: ${xVal}<br>` + seriesHtmls.map(d => d).join(opts.separator))
		} else {
			tip.hide()
		}
	}

	rect
		.on('mouseover', mouseOver)
		.on('mousemove', mouseOver)
		.on('mouseout', () => {
			line.style('display', 'none')
		})

	const opts = {
		separator: '<br>'
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
			.xScale	required
							the d3-scale object that was used for the rect dimensions

			.serieses[{data}] 		required, array of series objects, assumed to be visibly rendered
							
				.data[{x, html}]		required, array of data objects
														the series data that is currently rendered in the chart
					
					.x 								required, float
														the datapoint's actual, unscaled x value
					
					.html   					required, string
														the HTML to display in the tooltip if this datapoint's 
														x value matched the vertical line's position

			.separator	optional, string
									the html to be used to join the series html strings when displayed in the tooltip
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
			rect
				.on('mouseover', null)
				.on('mousemove', null)
				.on('mouseout', null)
		}
	}
}
