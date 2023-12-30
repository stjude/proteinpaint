import { keyupEnter } from '#src/client'

/*
configure numeric axis
* automatic
* fixed min and max
* percentile max


arg{}

- holder
	required

- callback({})
	required
	callback parameter should be one of following 3:
	{auto:1}
	{fixed:{ min:, max:}}
	{percentile:}

- setting{}
	optional
	one of the 3 callback() parameters to populate the ui

- noPercentile:true
	if set, do not allow setting percentile
*/

export function makeNumericAxisConfig({ holder, callback, setting, noPercentile }) {
	if (!holder) throw 'no holder'
	if (typeof callback != 'function') throw 'callback not function'

	if (!setting) setting = { auto: 1 }
	if (setting.auto) {
	} else if (setting.fixed) {
		if (!Number.isFinite(setting.fixed.min)) throw 'fixed.min is not number'
		if (!Number.isFinite(setting.fixed.max)) throw 'fixed.max is not number'
		if (setting.fixed.min >= setting.fixed.max) throw 'fixed min>=max'
	} else if (setting.percentile) {
		if (setting.percentile < 0 || setting.percentile > 100) throw 'invalid setting.percentile'
	} else {
		throw 'invalid setting{}'
	}

	const row = holder.append('div')
	row.append('span').html('Y scale&nbsp;&nbsp;')
	const ss = row.append('select')
	const op1 = ss.append('option').text('Automatic')
	const op2 = ss.append('option').text('Fixed')
	let op3
	if (!noPercentile) op3 = ss.append('option').text('Percentile')

	ss.on('change', event => {
		const si = event.target.selectedIndex
		if (si == 0) {
			fixedDiv.style('display', 'none')
			percentileDiv.style('display', 'none')
			callback({ auto: 1 })
			return
		}
		if (si == 1) {
			fixedDiv.style('display', '')
			maxInput.node().focus()
			percentileDiv.style('display', 'none')
			return
		}
		fixedDiv.style('display', 'none')
		percentileDiv.style('display', '')
		perInput.node().focus()
	})

	ss.property('selectedIndex', setting.auto ? 0 : setting.fixed ? 1 : 2)

	// following code generates 3 <input> that are accessed upon select change
	let maxInput, minInput, perInput

	// when "fixed" is selected, these controls are shown to enter fixed min/max
	const fixedDiv = row
		.append('div')
		.style('margin', '10px')
		.style('display', setting.fixed ? 'block' : 'none')
	{
		const row1 = fixedDiv.append('div')
		row1.append('span').html('Max&nbsp;').style('font-family', 'Courier').style('font-size', '.9em')
		maxInput = row1.append('input').attr('type', 'number').style('width', '50px')
		if (setting.fixed) maxInput.property('value', setting.fixed.max)
		const row2 = fixedDiv.append('div')
		row2.append('span').html('Min&nbsp;').style('font-family', 'Courier').style('font-size', '.9em')
		minInput = row2.append('input').attr('type', 'number').style('width', '50px')
		if (setting.fixed) minInput.property('value', setting.fixed.min)
		row2
			.append('button')
			.text('Set')
			.style('margin-left', '5px')
			.on('click', () => {
				let min, max
				max = maxInput.property('value')
				if (max == '') {
					return
				}
				max = Number.parseFloat(max)
				if (Number.isNaN(max)) {
					alert('invalid max value')
					return
				}
				min = minInput.property('value')
				if (min == '') {
					return
				}
				min = Number.parseFloat(min)
				if (Number.isNaN(min)) {
					alert('invalid min value')
					return
				}
				if (min >= max) {
					alert('Min must be smaller than max')
					return
				}
				callback({ fixed: { min, max } })
			})
	}

	// when "percentile" is selected, these controls are shown to enter percentile value
	const percentileDiv = row
		.append('div')
		.style('margin-top', '6px')
		.style('display', setting.percentile ? 'block' : 'none')
	percentileDiv.append('span').html('Percentile&nbsp;').style('font-family', 'Courier').style('font-size', '.9em')
	perInput = percentileDiv.append('input').attr('type', 'number').style('width', '50px')
	if (setting.percentile) {
		perInput.property('value', setting.percentile)
	}
	const setpercentile = s => {
		if (s == '') return
		const v = Number.parseInt(s)
		if (Number.isNaN(v) || v <= 0 || v > 100) {
			alert('percentile should be integer within range 0-100')
			return
		}
		callback({ percentile: v })
	}
	perInput.on('keyup', event => {
		if (!keyupEnter(event)) return
		setpercentile(perInput.property('value'))
	})
	percentileDiv
		.append('button')
		.text('Set')
		.style('margin-left', '5px')
		.on('click', () => {
			setpercentile(perInput.property('value'))
		})
}
