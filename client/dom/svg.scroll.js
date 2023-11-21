import { select } from 'd3-selection'

export function svgScroll(_opts) {
	if (!_opts.holder) throw `missing svgScroll.opts.holder argument`
	const defaults = {
		height: 12,
		zoomLevel: 1,
		opacity: 0.3
	}

	const opts = Object.assign({}, defaults, _opts)

	function scrollInit(e) {
		ref.x = e.clientX
		select('body').on('mousemove.sjppSvgScroll', scrollMove).on('mouseup.sjppSvgScroll', scrollStop)
	}

	function scrollMove(e) {
		if (!('x' in ref)) return
		const dx = e.clientX - ref.x
		if (ref.sliderX + ref.sliderWidth + dx > opts.visibleWidth - 1) {
			// when the available space at the right side is less than the distance moved to the right
			return
		}
		if (ref.sliderX + dx < 0) {
			// when the available space at the left side is less than the distance moved to the left
			return
		}
		slider.attr('x', ref.sliderX + dx)
		opts.callback(ref.dxFactor * dx, 'move')
	}

	function scrollStop(e) {
		if (!('x' in ref)) return
		const dx = e.clientX - ref.x
		opts.callback(ref.dxFactor * Math.min(ref.maxDx, Math.max(dx, ref.minDx)), 'up')
		delete ref.x
		select('body').on('mousemove.sjppSvgScroll', null).on('mouseup.sjppSvgScroll', null)
	}

	function scrollByClick(e) {
		ref.x = e.clientX
		const i = e.clientX < slideElem.getBoundingClientRect().x ? -1 : 1
		scrollStop({ clientX: Math.floor(ref.x + i * ref.arrowDx) })
	}

	opts.holder
		.attr('display', 'none')
		.attr('opacity', opts.opacity)
		.on('mouseover', () => opts.holder.attr('opacity', 1))
		.on('mouseout', () => opts.holder.attr('opacity', opts.opacity))

	// assumes horizontal for now
	const rect = opts.holder
		.append('rect')
		.style('height', opts.height)
		.style('stroke', 'none')
		//.style('stroke-width', 1)
		//.attr('rx', opts.height / 2)
		.style('fill', '#fff')
		.on('click', scrollByClick)

	const line = opts.holder.append('line').style('stroke', '#ccc').style('stroke-width', 1).on('click', scrollByClick)

	const leftArrow = opts.holder
		.append('path')
		.attr('y', -opts.height)
		.attr('d', `M0,${opts.height / 2}L${opts.height},0L${opts.height},${opts.height}Z`)
		.style('stroke', '#ccc')
		.style('stroke-width', 1)
		//.attr('rx', opts.height / 2)
		.style('fill', '#ccc')
		.on('click', e => {
			ref.x = e.clientX
			scrollStop({ clientX: Math.round(ref.x - ref.arrowDx) })
		})

	const rtArrow = opts.holder
		.append('path')
		.attr('y', -opts.height)
		.style('stroke', '#ccc')
		.style('stroke-width', 1)
		//.attr('rx', opts.height / 2)
		.style('fill', '#ccc')
		.attr('d', `M0,0L${opts.height},${opts.height / 2}L0,${opts.height}Z`)
		.on('click', e => {
			ref.x = e.clientX
			scrollStop({ clientX: Math.round(ref.x + ref.arrowDx) })
		})

	const sliderHt = opts.height - 4
	const slider = opts.holder
		.append('rect')
		.attr('y', 2)
		.attr('height', sliderHt)
		.attr('stroke', '#aaa')
		.attr('stroke-width', 1)
		.attr('fill', '#ccc')
		.attr('rx', sliderHt / 2)
		.on('mousedown', scrollInit)
		.on('mousemove', scrollMove)
		.on('mouseup', scrollStop)

	const slideElem = slider.node()

	const ref = {}

	const api = {
		update(_opts) {
			const prev = { v: opts.visibleWidth, t: opts.totalWidth, z: opts.zoomCenter }
			Object.assign(opts, _opts)
			const t = opts.totalWidth
			const v = opts.visibleWidth
			if (t <= v) {
				opts.holder.attr('display', 'none')
				return
			}
			opts.holder.attr('transform', `translate(${opts.x},${opts.y})`).attr('display', '')

			rect.attr('width', v)

			line
				.attr('x1', 0)
				.attr('x2', v)
				.attr('y1', opts.height / 2)
				.attr('y2', opts.height / 2)

			leftArrow.attr('transform', `translate(0,0)`)

			rtArrow.attr('transform', `translate(${v - opts.height},0)`)

			if (v != prev.v || t != prev.t) {
				// multiply visibleWidth by the ratio of v:t,
				// to make the slider width proportional to v:t
				ref.sliderWidth = (v * v) / t
				// each slider dx movement is equivalent to the ratio of
				// the open slider space on its left and right side
				// versus the unseen left and right portions of the element to be scrolled;
				// in other words, the available slidable segment of the scrollbar handle
				// proprotionally represents the unseen segment of the svg element
				ref.dxFactor = (t - v) / (v - ref.sliderWidth)
			}

			const center = v * (opts.zoomCenter / t)
			ref.sliderX = Math.max(0, Math.min(center - ref.sliderWidth / 2, v - ref.sliderWidth - 1))
			slider.attr('width', ref.sliderWidth).attr('x', ref.sliderX)

			ref.maxDx = opts.visibleWidth - ref.sliderX - ref.sliderWidth
			ref.minDx = -ref.sliderX
			ref.arrowDx = Math.round(0.1 * opts.visibleWidth)
			delete ref.x
		}
	}

	return api
}
