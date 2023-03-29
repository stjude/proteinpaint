export function svgScroll(_opts) {
	if (!_opts.holder) throw `missing svgScroll.opts.holder argument`
	const defaults = {
		height: 36,
		zoomLevel: 1
	}

	const opts = Object.assign({}, defaults, _opts)

	opts.holder.attr('display', 'none')

	// assumes horizontal for now
	const rect = opts.holder
		.append('rect')
		.style('height', opts.height)
		.style('stroke', '#999')
		.style('stroke-width', 1)
		.style('fill', '#fff')

	const ref = {}

	function scrollStop(e) {
		if (!('x' in ref)) return
		if (opts.noTextHighlight) {
			opts.noTextHighlight
				.style('-webkit-user-select', '')
				.style('-moz-user-select', '')
				.style('-ms-user-select', '')
				.style('user-select', '')
		}
		opts.callback(ref.dxFactor * (e.clientX - ref.x), 'up')
		delete ref.x
	}

	const slider = opts.holder
		.append('rect')
		.attr('y', 1)
		.attr('height', opts.height - 2)
		.attr('stroke', '#aaa')
		.attr('stroke-width', 1)
		.attr('fill', '#ccc')
		.on('mousedown', e => {
			if (opts.noTextHighlight) {
				opts.noTextHighlight
					.style('-webkit-user-select', 'none')
					.style('-moz-user-select', 'none')
					.style('-ms-user-select', 'none')
					.style('user-select', 'none')
			}
			ref.x = e.clientX
		})
		.on('mousemove', e => {
			if (!('x' in ref)) return
			const dx = e.clientX - ref.x
			if (ref.sliderX + ref.sliderWidth + dx > opts.visibleWidth + 1) return
			if (ref.sliderX + dx < -1) return
			slider.attr('x', ref.sliderX + dx)
			opts.callback(ref.dxFactor * dx, 'move')
		})
		.on('mouseup', scrollStop)
		.on('mouseout', scrollStop)

	const api = {
		update(_opts) {
			Object.assign(opts, _opts)
			const t = opts.totalWidth
			const v = opts.visibleWidth
			if (t <= v) {
				opts.holder.attr('display', 'none')
				return
			}
			opts.holder.attr('transform', `translate(${opts.x},${opts.y})`).attr('display', '')
			rect.attr('width', v)

			// multiply visibleWidth by the ratio of v:t,
			// to make the slider width proportional to v:t
			ref.sliderWidth = (v * v) / t
			// each slider dx movement is equivalent to the ratio of
			// the open slider space on its left and right side
			// versus the unseen left and right portions of the element to be scrolled;
			// in other words, the available slidable segment of the scrollbar handle
			// proprotionally represents the unseen segment of the svg element
			ref.dxFactor = (t - v) / (v - ref.sliderWidth)

			const center = v * (1 - opts.zoomCenter / t)
			ref.sliderX = center - ref.sliderWidth / 2
			slider.attr('width', ref.sliderWidth).attr('x', ref.sliderX)
			delete ref.x
		}
	}

	return api
}
