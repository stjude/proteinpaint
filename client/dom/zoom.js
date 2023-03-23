export function zoom(opts) {
	if (!opts.holder) throw `zoom requires an opts.holder`
	if (typeof opts.callback != 'function') throw `zoom requires an opts.callback function`

	const defaultSettings = {
		min: 1,
		max: 100,
		value: 25,
		step: 10,
		increment: 1,
		numberInputWidth: '35px'
	}

	const settings = Object.assign({}, defaultSettings, opts.settings || {})

	const minusBtn = opts.holder
		.append('button')
		.attr('title', 'Zoom in')
		.style('width', '25px')
		.html('-')
		.on('click', () => {
			const value = Math.max(settings.step * Math.ceil((settings.value - settings.step) / settings.step), settings.min)
			api.update({ value })
			opts.callback(value)
		})

	const slider = opts.holder
		.append('input')
		.attr('title', 'slide to desired zoom level')
		.attr('type', 'range')
		.attr('min', settings.min)
		.attr('max', settings.max)
		.attr('step', settings.increment)
		.style('margin', '3px 5px')
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

	const number = opts.holder
		.append('input')
		.attr('title', 'enter a desired zoom level')
		.attr('type', 'number')
		.attr('min', settings.min)
		.attr('max', settings.max)
		.attr('step', settings.increment)
		.style('min-width', settings.numberInputWidth)
		.style('width', 'fit-content')
		.style('margin', '3px 5px')
		.property('value', settings.value)
		.on('change', event => {
			const value = Number(event.target.value)
			api.update({ value })
			opts.callback(value)
		})

	opts.holder.append('span').text('%')

	const plusBtn = opts.holder
		.append('button')
		.attr('title', 'Zoom out')
		.style('width', '25px')
		.html('+')
		.on('click', () => {
			const value = Math.min(settings.step * Math.floor((settings.value + settings.step) / settings.step), settings.max)
			api.update({ value })
			opts.callback(value)
		})

	const api = {
		update(s = {}) {
			Object.assign(settings, s)
			slider.property('value', settings.value) //; console.log(74, 'zoom.update() value=', settings.value)
			number.property('value', settings.value)
			minusBtn.property('disabled', settings.value <= settings.min)
			plusBtn.property('disabled', settings.value >= settings.max)
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
