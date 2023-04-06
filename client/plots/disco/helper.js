import { select as d3select } from 'd3-selection'
const tooltipMenus = []

export function tooltip(_opts = {}) {
	// defaults, overridden by user supplied options
	const opts = Object.assign(
		{
			offsetX: 20, //desired x-distance of the nearest div corner from the mousepoint
			offsetY: 20, //desired y-distance of the nearest div corner from the mousepoint
			maxWidth: 200,
			minWidth: 100,
			hideXmute: 0, // if mouse has moved less than this, ignore hide command
			hideYmute: 0, // if mouse has moved less than this, ignore hide command
			style: {}
		},
		_opts
	)

	const menu = d3select(document.body)
		.append('div')
		.attr('class', 'sja_tooltip')
		.style('position', 'absolute')
		.style('padding', '3px')
		.style('text-align', 'center')
		.style('max-width', opts.maxWidth + 'px')
		.style('min-width', opts.minWidth + 'px')
		.style('z-index', 9999)
		.style('display', 'none')

	for (const key in opts.style) {
		menu.style(key, opts.style[key])
	}

	tooltipMenus.push(menu)
	d3select(document.body).on('click.ppClientTooltipMenu', () => {
		tooltipMenus.forEach(m => m.style('display', 'none'))
	})

	let currY, currX

	return {
		// e=event, html=content, color=optional color to use for border
		show(e, html, color) {
			if (html) menu.html(html)
			const bbox = menu
				.style('display', 'block')
				.style('border', '1px solid ' + (color ? color : '#ccc'))
				.node()
				.getBoundingClientRect()
			const w = bbox.width
			const h = bbox.height
			const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
			const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0
			const top =
				window.innerHeight - e.clientY < h + opts.offsetY
					? e.clientY + scrollTop - h - opts.offsetY
					: e.clientY + scrollTop + opts.offsetY
			const left =
				window.innerWidth - e.clientX < w + opts.offsetX
					? e.clientX + scrollLeft - w - opts.offsetX
					: e.clientX + scrollLeft + opts.offsetX

			menu.style('top', top + 'px').style('left', left + 'px')

			currX = e.clientX
			currY = e.clientY
		},
		hide(e = null) {
			//if (e) console.log(currX, e.clientX, currY, e.clientY)
			if (e && Math.abs(currX - e.clientX) < opts.hideXmute && Math.abs(currY - e.clientY) < opts.hideYmute) {
				return Math.max(opts.hideXmute, opts.hideYmute)
			} else {
				menu.style('display', 'none')
				return -1
			}
		},
		getPosChange(e = null) {
			if (e && Math.abs(currX - e.clientX) < opts.hideXmute && Math.abs(currY - e.clientY) < opts.hideYmute) {
				return Math.max(opts.hideXmute, opts.hideYmute)
			} else {
				return -1
			}
		}
	}
}

export function hideerrors(holder) {
	holder.selectAll('.sja_errorbar').remove()
}
