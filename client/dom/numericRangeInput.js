export class NumericRangeInput {
	constructor(holder, range, callback) {
		this.input = holder
			.append('input')
			.attr('name', 'rangeInput')
			.attr('aria-label', `leave blank for the allowed minimum value`)
			.style('width', '250px')
			.style('margin', '3px 5px')
			//.style('font-size', '20px')
			.on('change', () => {
				try {
					this.parseRange()
				} catch (ex) {
					alert(ex)
					this.setRange()
				}
			})
		this.setRange(range)
		this.callback = callback
	}

	getInput() {
		return this.input
	}

	parseRange() {
		const str = this.input.node().value
		const new_range = parseRange(str)
		if (this.range?.min != undefined) {
			if (!new_range.startunbounded && this.range?.min > new_range.start) throw 'Invalid start value < minimum allowed'
			if (!new_range.stopunbounded && this.range?.min >= new_range.stop) throw 'Invalid stop value >= minimum allowed'
		}
		if (this.range?.max != undefined) {
			if (!new_range.stopunbounded && this.range?.max < new_range.stop) throw 'Invalid stop value > maximum allowed'

			if (!new_range.startunbounded && new_range.start >= this.range?.max)
				throw 'Invalid start value >= maximum allowed'
		}

		this.range = new_range
		this.callback(new_range)
		return new_range
	}

	getRange() {
		return this.range
	}

	setRange(range) {
		if (!range) range = this.range
		//When an error is thrown the previous range is restored
		else this.range = range

		const start = range.start != undefined ? `${range.start} <=` : ''
		const stop = range.stop != undefined ? `<= ${range.stop}` : ''
		this.input.node().value = range.value != undefined ? ` x=${range.value} ` : `${start} x ${stop}`
	}
}

export function parseRange(str) {
	if (!str) throw 'Empty range'
	const tokens = str.replace(/\s/g, '').split('x')
	let start, stop, startinclusive, stopinclusive, value

	if (tokens[0]) parseRangeToken(tokens[0])
	if (tokens[1]) parseRangeToken(tokens[1])
	if (value != undefined) return { value, label: `x = ${value}` }
	const startunbounded = start === undefined
	const stopunbounded = stop === undefined

	if (!startunbounded && !stopunbounded && start > stop) throw 'start must be lower than stop'
	return { start, stop, value, startinclusive, stopinclusive, startunbounded, stopunbounded }

	function parseRangeToken(rangeToken) {
		const floatExpr = '[+-]?\\d+(\\.\\d+)?'

		if (new RegExp(`^${floatExpr}<$`).test(rangeToken) || new RegExp(`^>${floatExpr}$`).test(rangeToken)) {
			start = parseFloat(rangeToken.match(floatExpr))
			startinclusive = false
		} else if (new RegExp(`^${floatExpr}<=$`).test(rangeToken) || new RegExp(`^>=${floatExpr}$`).test(rangeToken)) {
			start = parseFloat(rangeToken.match(floatExpr))
			startinclusive = true
		} else if (new RegExp(`^${floatExpr}>$`).test(rangeToken) || new RegExp(`^<${floatExpr}$`).test(rangeToken)) {
			stop = parseFloat(rangeToken.match(floatExpr))
			stopinclusive = false
		} else if (new RegExp(`^${floatExpr}>=$`).test(rangeToken) || new RegExp(`^<=${floatExpr}$`).test(rangeToken)) {
			stop = parseFloat(rangeToken.match(floatExpr))
			stopinclusive = true
		} else if (new RegExp(`^${floatExpr}=$`).test(rangeToken) || new RegExp(`^=${floatExpr}$`).test(rangeToken)) {
			value = parseFloat(rangeToken.match(floatExpr))
			stopinclusive = true
			startinclusive = true
		} else throw `Could not parse expression '${rangeToken}'`
	}
}
