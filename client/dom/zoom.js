export function zoom(opts) {
	if (!opts.holder) throw `zoom requires an opts.holder`
	if (typeof opts.callback != 'function') throw `zoom requires an opts.callback function`

	const defaultSettings = {
		min: 1,
		max: 100,
		value: 25,
		step: 10,
		increment: 1,
		numberInputWidth: '35px',
		showJumpBtns: false
	}

	const settings = Object.assign({}, defaultSettings, opts.settings || {})

	let showSlider = false
	opts.holder
		.attr('aria-label', opts.title || null)
		.style('vertical-align', 'top')
		.style('text-align', 'center')
		.on('mouseenter', () => {
			sliderDiv.style('display', 'inline-block').style('overflow', 'visible')
			showSlider = true
		})
		.on('mouseleave', () => {
			sliderDiv.style('display', 'none').style('overflow', 'hidden')
			showSlider = false
		})

	const label = opts.holder.append('label')
	const labelText = label.append('span').text('Zoom')

	const number = label
		.append('input')
		.attr('aria-label', 'enter a desired zoom level')
		.attr('type', 'number')
		.attr('min', settings.min)
		.attr('max', settings.max)
		.attr('step', settings.increment)
		.style('min-width', settings.numberInputWidth)
		.style('width', opts.width || 'fit-content')
		.style('margin', '3px 5px')
		.property('value', settings.value)
		.on('change', event => {
			const value = Number(event.target.value)
			api.update({ value })
			opts.callback(value)
		})

	label.append('span').text('unit' in opts ? opts.unit : '%')

	// if the zoom is rendered within a parent/ancestor div that is invisible,
	// then the box dimensions will be zero, will be corrected in the update()
	// below as needed
	const box = opts.holder.node().getBoundingClientRect()
	opts.holder.style('max-height', box.height + 'px').style('max-width', box.width + 'px')

	opts.holder.append('br')

	const sliderDiv = opts.holder.append('div').style('display', 'none')

	const minusBtn = !opts.showJumpBtns
		? null
		: opts.holder
				.append('button')
				.attr('aria-label', 'Zoom in')
				.style('width', '25px')
				.html('-')
				.on('click', () => {
					const value = Math.max(
						settings.step * Math.ceil((settings.value - settings.step) / settings.step),
						settings.min
					)
					api.update({ value })
					opts.callback(value)
				})

	const slider = sliderDiv
		.append('input')
		.attr('aria-label', 'slide to desired zoom level')
		.attr('type', 'range')
		.attr('min', settings.min)
		.attr('max', settings.max)
		.attr('step', settings.increment)
		.style('margin', '2px 5px')
		.style('padding', 0)
		.style('vertical-align', 'middle')
		.property('value', settings.value)
		.html('-')
		.on('input', event => {
			number.property('value', event.target.value)
		})
		.on('change', event => {
			const value = Number(event.target.value)
			api.update({ value })
			opts.callback(value)
		})

	// TODO: may give an option to render plus/minus 'jump' buttons
	const plusBtn = !opts.showJumpBtns
		? null
		: opts.holder
				.append('button')
				.attr('aria-label', 'Zoom out')
				.style('width', '25px')
				.html('+')
				.on('click', () => {
					const value = Math.min(
						settings.step * Math.floor((settings.value + settings.step) / settings.step),
						settings.max
					)
					api.update({ value })
					opts.callback(value)
				})

	sliderDiv
		.append('span')
		.style('text-decoration', 'underline')
		.style('cursor', 'pointer')
		.style('title', 'use the default zoom value')
		.text('Reset')
		.on('click', opts.reset)

	const api = {
		update(s = {}) {
			const box = opts.holder.node().getBoundingClientRect()
			if (!box.height || !box.width) {
				// when the matrix renders in an invisible div, these dimensions are empty,
				// should be reset based on the width of its contents
				opts.holder.style('max-height', '').style('max-width', '')
				const box = opts.holder.node().getBoundingClientRect()
				opts.holder.style('max-height', box.height + 'px').style('max-width', box.width + 'px')
			}

			Object.assign(settings, s)
			slider
				.property('value', settings.value)
				.attr('min', settings.min)
				.attr('max', settings.max)
				.attr('step', settings.increment)
			number
				.property('value', settings.value)
				.attr('min', settings.min)
				.attr('max', settings.max)
				.attr('step', settings.increment)
			minusBtn?.property('disabled', settings.value <= settings.min)
			plusBtn?.property('disabled', settings.value >= settings.max)
		}
	}

	if (opts.debug)
		api.Inner = {
			settings,
			number,
			slider,
			minusBtn,
			plusBtn
		}

	return api
}
